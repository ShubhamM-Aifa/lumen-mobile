/**
 * Morning / evening check-in modal.
 * Filters questions by frequency ('morning' | 'evening') across all active categories.
 * Submitted as source: 'check_in'.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useTheme, createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { QuestionCard } from '../src/components/QuestionCard';
import { MorningSleepCheckinBanner } from '../src/components/sleep/MorningSleepCheckinBanner';
import { useSleepTrackerStore, SleepQuality } from '../src/store/sleepTrackerStore';
import { useTodayCategoryLogs } from '../src/hooks/useTodayCategoryLogs';
import { logLocationService } from '../src/services/logLocationService';

const META: Record<string, { emoji: string; title: string; subtitle: string }> = {
  morning: {
    emoji: '☀️',
    title: 'Morning check-in',
    subtitle: 'How are you feeling as you start your day?',
  },
  evening: {
    emoji: '🌙',
    title: 'Evening check-in',
    subtitle: 'A quick look back before you rest.',
  },
};

export default function CheckInModal() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
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
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.primary,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero header */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{meta.emoji}</Text>
          <Text style={styles.heroTitle}>{meta.title}</Text>
          <Text style={styles.heroSubtitle}>{meta.subtitle}</Text>
        </View>

        {/* Autoimmune Sleep Recovery Banner (Morning Check-in only) */}
        {type === 'morning' && (
          <MorningSleepCheckinBanner
            selectedQuality={sleepQuality}
            onQualityChange={handleQualityChange}
          />
        )}

        {/* Check-In Questions */}
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

        <View style={{ height: 100 + Math.max(insets.bottom, 16) }} />
      </ScrollView>

      {/* Footer buttons */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 16),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip check-in"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Save check-in"
        >
          {isSubmitting
            ? <ActivityIndicator color={palette.white} />
            : <Text style={styles.submitText}>Save check-in</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 14 },
  hero: {
    alignItems: 'center', paddingVertical: 20, gap: 6,
  },
  heroEmoji: { fontSize: 48 },
  heroTitle: { ...typography.h2, color: palette.text, textAlign: 'center' },
  heroSubtitle: { ...typography.body, color: palette.textSecondary, textAlign: 'center', maxWidth: 300 },
  emptyCard: {
    backgroundColor: palette.surface, borderRadius: 14,
    borderWidth: 1, borderColor: palette.border,
    padding: 20, alignItems: 'center', gap: 6,
  },
  emptyText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  emptyHint: { ...typography.small, color: palette.textDisabled, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border,
  },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1, borderColor: palette.border,
    alignItems: 'center',
  },
  skipText: { ...typography.button, color: palette.textSecondary },
  submitBtn: {
    flex: 2, backgroundColor: palette.primary,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { ...typography.button, color: '#FFFFFF' },
}));
