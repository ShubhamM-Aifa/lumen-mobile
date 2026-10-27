import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useKeyboard } from '../src/hooks/useKeyboard';
import { safeGoBack } from '../src/utils/navigation';
import { AppDateTimePicker } from '../src/components/common/AppDateTimePicker';
import { Clock, Check, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { uuidv4 } from '../src/utils/uuid';
import { IQuestion, IOption, ICategory, Answer } from '@lumen/shared';
import { useConfigStore } from '../src/store/configStore';
import { useDaySessionStore } from '../src/store/daySessionStore';
import { useAuthStore } from '../src/store/authStore';
import { useQuickLogConfigStore, MAX_QUICK_LOG_QUESTIONS } from '../src/store/quickLogConfigStore';
import { api } from '../src/api/client';
import { queryClient } from '../src/api/queryClient';
import { useTheme, createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { QuestionCard } from '../src/components/QuestionCard';
import { ScreenTopBar, HeaderTextButton } from '../src/components/ios/ScreenTopBar';
import { FloatingCta, FLOATING_CTA_CLEARANCE } from '../src/components/ios/FloatingCta';
import { NoteField } from '../src/components/ios/NoteField';
import { InsetGroup, GroupedRow } from '../src/components/ios/InsetGroup';
import { validateAnswers } from '../src/utils/validateAnswers';
import { uploadAnswerImages } from '../src/utils/uploadAnswerImages';
import { logLocationService } from '../src/services/logLocationService';

function fmt(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const isToday = new Date().toDateString() === d.toDateString();
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return isToday ? `Today at ${h12}:${m} ${period}` : `${dateStr} at ${h12}:${m} ${period}`;
}

export default function QuickLogScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { isKeyboardVisible } = useKeyboard();
  const { config, fetchConfig, isLoading: isConfigLoading } = useConfigStore();
  const { todaySession } = useDaySessionStore();
  const { user } = useAuthStore();
  const {
    selectedQuestionIds,
    loadSelectedQuestions,
  } = useQuickLogConfigStore();

  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, Answer[]>>({});
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchConfig();
    logLocationService.refreshLocationCacheInBackground().catch(() => {});
  }, [fetchConfig]);

  useEffect(() => {
    if (config?.questions) {
      loadSelectedQuestions(config.questions);
    }
  }, [config?.questions, loadSelectedQuestions]);

  const activeCategories: ICategory[] = (config?.categories ?? []).filter(c => c.isActive);
  const allActiveQuestions: IQuestion[] = (config?.questions ?? []).filter(q => q.isActive);

  // Filter to the configured questions (max 5)
  const quickLogQuestions: IQuestion[] = selectedQuestionIds
    .map(id => allActiveQuestions.find(q => q._id === id))
    .filter((q): q is IQuestion => q !== undefined)
    .slice(0, MAX_QUICK_LOG_QUESTIONS);

  const optionsByQuestion: Record<string, IOption[]> = {};
  for (const q of quickLogQuestions) {
    optionsByQuestion[q._id] = (config?.options ?? [])
      .filter(o => o.questionId === q._id && o.isActive)
      .sort((a, b) => a.order - b.order);
  }

  const allAnswers = Object.values(answersByQuestion).flat();

  const setQAnswers = useCallback((qId: string, ans: Answer[]) => {
    setAnswersByQuestion(prev => ({ ...prev, [qId]: ans }));
  }, []);

  const validate = (): string | null => {
    for (const q of quickLogQuestions) {
      if (!q.required) continue;
      const answers = answersByQuestion[q._id] ?? [];
      if (answers.length === 0) {
        return `"${q.title}" is required — please select at least one option.`;
      }
    }
    const allOptions = Object.values(optionsByQuestion).flat();
    return validateAnswers(allAnswers, allOptions);
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Missing Answer', error);
      return;
    }

    if (allAnswers.length === 0 && !note.trim()) {
      Alert.alert('Nothing Selected', 'Please answer at least one question before saving.');
      return;
    }

    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const [uploadedAnswers, location] = await Promise.all([
        uploadAnswerImages(allAnswers),
        logLocationService.getFastLocationSnapshot().catch(() => null),
      ]);

      await api.post('/logs', {
        clientId: uuidv4(),
        daySessionId: todaySession?._id,
        source: 'quick_log',
        occurredAt: occurredAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: uploadedAnswers,
        note: note.trim() || undefined,
        ...(location ? { location } : {}),
      });

      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });

      safeGoBack('/(tabs)/today');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save Quick Log';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenTopBar
          title="Quick Log"
          onBack={() => safeGoBack('/(tabs)/today')}
          right={
            <HeaderTextButton
              label={`Edit ${quickLogQuestions.length}/${MAX_QUICK_LOG_QUESTIONS}`}
              accessibilityLabel="Edit Quick Log Questions"
              onPress={() => router.push('/customize/quick-log-questions')}
            />
          }
        />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: FLOATING_CTA_CLEARANCE }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <InsetGroup>
            <GroupedRow
              icon={Clock}
              tile="#8E8E93"
              label="Logged Time"
              value={fmt(occurredAt)}
              chevron
              accessibilityLabel={`Logged time: ${fmt(occurredAt)}. Tap to change.`}
              onPress={() => setShowDatePicker(true)}
            />
          </InsetGroup>

          <AppDateTimePicker
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            value={occurredAt}
            onChange={(d) => setOccurredAt(d)}
            maximumDate={new Date()}
            mode="time"
          />

          {/* Empty state if user deselected all questions */}
          {quickLogQuestions.length === 0 && !isConfigLoading && (
            <View style={styles.emptyCard}>
              <Sparkles size={36} color={palette.primaryText} />
              <Text style={styles.emptyTitle}>No Questions Selected</Text>
              <Text style={styles.emptyDesc}>
                Pick up to {MAX_QUICK_LOG_QUESTIONS} questions across your categories to display here for 1-tap logging.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/customize/quick-log-questions')}
                accessibilityRole="button"
              >
                <Text style={styles.emptyBtnText}>Choose Questions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Questions with category label */}
          {quickLogQuestions.map(question => {
            const category = activeCategories.find(c => c._id === question.categoryId);
            const options = optionsByQuestion[question._id] ?? [];
            const answers = answersByQuestion[question._id] ?? [];

            return (
              <View key={question._id} style={styles.questionSection}>
                {category ? (
                  <Text style={styles.categoryLabel}>
                    {category.icon || '📁'} {category.name}
                  </Text>
                ) : null}

                <QuestionCard
                  question={question}
                  options={options}
                  answers={answers}
                  sessionAnswers={allAnswers}
                  onChange={ans => setQAnswers(question._id, ans)}
                  tempPrefUnit={user?.preferences?.tempUnit ?? 'C'}
                />
              </View>
            );
          })}

          {quickLogQuestions.length > 0 ? (
            <View style={styles.gutter}>
              <NoteField
                title="Quick Note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Add context, thoughts, or observations..."
                accessibilityLabel="Quick note"
              />
            </View>
          ) : null}
        </ScrollView>

        {quickLogQuestions.length > 0 ? (
          <FloatingCta
            label="Save Quick Log"
            icon={<Check size={18} color="#FFFFFF" strokeWidth={2.5} />}
            onPress={handleSubmit}
            loading={isSubmitting}
            keyboardVisible={isKeyboardVisible}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingHorizontal: 0, paddingTop: 14, gap: 18 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 28,
    gap: 12,
    marginHorizontal: 16,
  },
  emptyTitle: { ...typography.title2, color: palette.text },
  emptyDesc: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 22,
    minHeight: 48,
    borderRadius: 24,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { ...typography.headline, color: '#FFFFFF' },
  gutter: { paddingHorizontal: 16 },
  questionSection: { gap: 7, paddingHorizontal: 16 },
  categoryLabel: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 4 },
}));
