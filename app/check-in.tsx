/**
 * Morning / evening check-in modal.
 * Filters questions by frequency ('morning' | 'evening') across all active categories.
 * Submitted as source: 'check_in'.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Alert, Platform,
} from 'react-native';
import { uuidv4 } from '../src/utils/uuid';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import { IQuestion, IOption, Answer, QuestionFrequency } from '@lumen/shared';
import { useConfigStore } from '../src/store/configStore';
import { useDaySessionStore } from '../src/store/daySessionStore';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/api/client';
import { queryClient } from '../src/api/queryClient';
import { uploadAnswerImages } from '../src/utils/uploadAnswerImages';
import { createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { QuestionCard } from '../src/components/QuestionCard';
import { ScreenTopBar, HeaderTextButton } from '../src/components/ios/ScreenTopBar';
import { FloatingCta, FLOATING_CTA_CLEARANCE } from '../src/components/ios/FloatingCta';
import { IosSegmented } from '../src/components/ios/IosSegmented';
import { MorningSleepCheckinBanner } from '../src/components/sleep/MorningSleepCheckinBanner';
import { useSleepTrackerStore, SleepQuality } from '../src/store/sleepTrackerStore';
import { useTodayCategoryLogs } from '../src/hooks/useTodayCategoryLogs';
import { logLocationService } from '../src/services/logLocationService';

const META: Record<string, { title: string; subtitle: string }> = {
  morning: {
    title: 'Morning check-in',
    subtitle: 'How are you feeling as you start your day?',
  },
  evening: {
    title: 'Evening check-in',
    subtitle: 'A quick look back before you rest.',
  },
};

const WHEN_OPTIONS = [
  { key: 'morning' as const, label: 'Morning' },
  { key: 'evening' as const, label: 'Evening' },
];

export default function CheckInModal() {
  const styles = useStyles();
  const { type = 'morning', date } = useLocalSearchParams<{ type: string; date?: string }>();
  const { config } = useConfigStore();
  const { todaySession } = useDaySessionStore();
  const { user } = useAuthStore();
  const { lastSleepRecord } = useSleepTrackerStore();
  const { getQuestionTodayHistory } = useTodayCategoryLogs(date);

  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, Answer[]>>({});
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | null>(lastSleepRecord?.quality ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-warm location in background when modal opens
  useEffect(() => {
    logLocationService.refreshLocationCacheInBackground().catch(() => {});
  }, []);

  const meta = META[type] ?? META.morning!;
  const freq: QuestionFrequency = type === 'evening' ? 'evening' : 'morning';
  const tempPrefUnit = user?.preferences.tempUnit ?? 'C';

  const allQuestions: IQuestion[] = (config?.questions ?? [])
    .filter(q => q.isActive && (q.frequency === freq || q.frequency === 'anytime' || q.frequency === 'once_per_day'))
    .sort((a, b) => a.order - b.order)
    .slice(0, 8); // limit check-in to 8 questions

  // Check if a sleep quality question exists in template
  const sleepQualityQuestion = allQuestions.find(
    q => q.templateKey === 'q_sleep_quality' || q.title.toLowerCase().includes('how did you sleep')
  );

  // If in morning check-in, the AutoimmuneSleepCheckinBanner provides the enhanced sleep quality question,
  // so filter out redundant standalone sleep questions to prevent duplication while showing all other questions.
  const displayQuestions = type === 'morning' && sleepQualityQuestion
    ? allQuestions.filter(q => q._id !== sleepQualityQuestion._id)
    : allQuestions;

  const optionsByQuestion: Record<string, IOption[]> = {};
  for (const q of allQuestions) {
    optionsByQuestion[q._id] = (config?.options ?? [])
      .filter(o => o.questionId === q._id && o.isActive)
      .sort((a, b) => a.order - b.order);
  }

  const allAnswers = Object.values(answersByQuestion).flat();

  const setQAnswers = useCallback(
    (qId: string, ans: Answer[]) =>
      setAnswersByQuestion(prev => ({ ...prev, [qId]: ans })),
    [],
  );

  const handleQualityChange = (quality: SleepQuality) => {
    setSleepQuality(quality);
    if (sleepQualityQuestion) {
      const opts = optionsByQuestion[sleepQualityQuestion._id] ?? [];
      const matchedOpt = opts.find(o => {
        if (quality === 'RESTFUL') return o.templateKey === 'opt_sleep_great' || o.label.toLowerCase().includes('great');
        if (quality === 'GOOD') return o.templateKey === 'opt_sleep_good' || o.label.toLowerCase().includes('good');
        if (quality === 'FAIR') return o.templateKey === 'opt_sleep_fair' || o.label.toLowerCase().includes('fair');
        if (quality === 'POOR') return o.templateKey === 'opt_sleep_poor' || o.label.toLowerCase().includes('poor');
        return false;
      }) ?? opts[0];

      if (matchedOpt) {
        const hoursSlept = lastSleepRecord ? +(lastSleepRecord.durationMinutes / 60).toFixed(1) : 8;
        setQAnswers(sleepQualityQuestion._id, [
          {
            optionId: matchedOpt._id,
            optionLabelSnapshot: matchedOpt.label,
            values: [
              {
                fieldKey: 'hours',
                dataType: 'number',
                value: hoursSlept,
                unit: 'h',
              },
            ],
          },
        ]);
      }
    }
  };

  const handleSkip = () => safeGoBack('/(tabs)/today');

  const handleSwitchWhen = (next: 'morning' | 'evening') => {
    if (next === (type === 'evening' ? 'evening' : 'morning')) return;
    setAnswersByQuestion({});
    router.setParams({ type: next });
  };

  const handleSubmit = async () => {
    if (allAnswers.length === 0 && !sleepQuality) {
      safeGoBack('/(tabs)/today');
      return;
    }

    setIsSubmitting(true);
    try {
      if (allAnswers.length > 0) {
        const [uploadedAnswers, location] = await Promise.all([
          uploadAnswerImages(allAnswers),
          logLocationService.getFastLocationSnapshot().catch(() => null),
        ]);

        const parts = (date || '').split('-');
        let targetOccurredAt: string;
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const defaultHour = type === 'morning' ? 8 : 21;
          targetOccurredAt = new Date(y, m, d, defaultHour, 0, 0).toISOString();
        } else {
          targetOccurredAt = new Date().toISOString();
        }

        const isTodaySession = !date;

        await api.post('/logs', {
          clientId: uuidv4(),
          daySessionId: isTodaySession ? todaySession?._id : undefined,
          source: 'check_in',
          occurredAt: targetOccurredAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: uploadedAnswers,
          ...(location ? { location } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['today-logs'] });
        queryClient.invalidateQueries({ queryKey: ['day-entries'] });
        queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      }
      if (date) {
        safeGoBack('/(tabs)/timeline');
      } else {
        safeGoBack('/(tabs)/today');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />

      <ScreenTopBar
        sheet={Platform.OS === 'ios'}
        backIcon="close"
        backLabel="Close"
        onBack={handleSkip}
        right={<HeaderTextButton label="Skip" accessibilityLabel="Skip check-in" onPress={handleSkip} />}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: FLOATING_CTA_CLEARANCE }]}
        keyboardShouldPersistTaps="handled"
      >
        <IosSegmented options={WHEN_OPTIONS} value={type === 'evening' ? 'evening' : 'morning'} onChange={handleSwitchWhen} />

        <View style={styles.hero}>
          <Text style={styles.heroTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{meta.title}</Text>
          <Text style={styles.heroSubtitle}>{meta.subtitle}</Text>
        </View>

        <View style={styles.gutter}>
          {/* Sleep recovery banner (morning check-in only) */}
          {type === 'morning' && (
            <MorningSleepCheckinBanner
              selectedQuality={sleepQuality}
              onQualityChange={handleQualityChange}
            />
          )}

          {/* Check-in questions */}
          {displayQuestions.length === 0 && type !== 'morning' ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No check-in questions configured yet.</Text>
              <Text style={styles.emptyHint}>
                Go to Customize → Questions and set frequency to "{freq}" on any question.
              </Text>
            </View>
          ) : (
            displayQuestions.map((q) => (
              <QuestionCard
                key={q._id}
                question={q}
                options={optionsByQuestion[q._id] ?? []}
                answers={answersByQuestion[q._id] ?? []}
                sessionAnswers={allAnswers}
                onChange={(ans) => setQAnswers(q._id, ans)}
                tempPrefUnit={tempPrefUnit}
                todayHistory={getQuestionTodayHistory(q._id, optionsByQuestion[q._id] ?? [])}
                onReuseAnswers={(ans) => setQAnswers(q._id, ans)}
                onEditLog={(logId) =>
                  router.push({
                    pathname: `/log/edit/${logId}`,
                    params: { questionId: q._id },
                  })
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <FloatingCta label="Save check-in" onPress={handleSubmit} loading={isSubmitting} />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingTop: 14, gap: 18 },
  gutter: { paddingHorizontal: 16, gap: 14 },
  hero: { paddingHorizontal: 20, gap: 4 },
  heroTitle: { ...typography.largeTitle, fontSize: 28, lineHeight: 34, color: palette.text },
  heroSubtitle: { ...typography.subhead, color: palette.textSecondary },
  emptyCard: {
    backgroundColor: palette.surface, borderRadius: 26,
    padding: 20, alignItems: 'center', gap: 6,
  },
  emptyText: { ...typography.bodyLarge, color: palette.textSecondary, textAlign: 'center' },
  emptyHint: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center' },
}));
