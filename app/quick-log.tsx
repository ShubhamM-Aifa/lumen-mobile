import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, SlidersHorizontal, Clock, Check, Sparkles } from 'lucide-react-native';
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
import { validateAnswers } from '../src/utils/validateAnswers';
import { uploadAnswerImages } from '../src/utils/uploadAnswerImages';

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
      const uploadedAnswers = await uploadAnswerImages(allAnswers);
      await api.post('/logs', {
        clientId: uuidv4(),
        daySessionId: todaySession?._id,
        source: 'quick_log',
        occurredAt: occurredAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: uploadedAnswers,
        note: note.trim() || undefined,
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

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setOccurredAt(date);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Quick Log',
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => safeGoBack('/(tabs)/today')}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={24} color={palette.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.editConfigBtn}
              onPress={() => router.push('/customize/quick-log-questions')}
              accessibilityRole="button"
              accessibilityLabel="Edit Quick Log Questions"
            >
              <SlidersHorizontal size={14} color={palette.primary} />
              <Text style={styles.editConfigText}>
                Edit ({quickLogQuestions.length}/{MAX_QUICK_LOG_QUESTIONS})
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Timestamp Bar */}
        <TouchableOpacity
          style={styles.timeBar}
          onPress={() => setShowDatePicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Logged time: ${fmt(occurredAt)}. Tap to change.`}
        >
          <Clock size={16} color={palette.primary} />
          <Text style={styles.timeText}>{fmt(occurredAt)}</Text>
          <Text style={styles.timeEditBadge}>Change</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={occurredAt}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        )}

        {/* Empty state if user deselected all questions */}
        {quickLogQuestions.length === 0 && !isConfigLoading && (
          <View style={styles.emptyCard}>
            <Sparkles size={36} color={palette.primary} />
            <Text style={styles.emptyTitle}>No Questions Selected</Text>
            <Text style={styles.emptyDesc}>
              Pick up to {MAX_QUICK_LOG_QUESTIONS} questions across your categories to display here for 1-tap logging.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/customize/quick-log-questions')}
            >
              <Text style={styles.emptyBtnText}>Choose Questions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Questions with Category Pill */}
        {quickLogQuestions.map(question => {
          const category = activeCategories.find(c => c._id === question.categoryId);
          const options = optionsByQuestion[question._id] ?? [];
          const answers = answersByQuestion[question._id] ?? [];

          return (
            <View key={question._id} style={styles.questionSection}>
              {category ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {category.icon || '📁'} {category.name}
                  </Text>
                </View>
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

        {/* Optional Note */}
        {quickLogQuestions.length > 0 ? (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Quick Note (Optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add context, thoughts, or observations..."
              placeholderTextColor={palette.placeholder}
              multiline
              numberOfLines={3}
            />
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Submit Button Bar */}
      {quickLogQuestions.length > 0 ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Save Quick Log"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.submitBtnText}>Save Quick Log</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    marginLeft: 4,
  },
  editConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    marginRight: 4,
  },
  editConfigText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primary,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  timeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  timeText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.text,
    flex: 1,
  },
  timeEditBadge: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 28,
    gap: 12,
    marginTop: 20,
  },
  emptyTitle: {
    ...typography.h3,
    color: palette.text,
    fontWeight: '700',
  },
  emptyDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  questionSection: {
    gap: 6,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  categoryPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  noteSection: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 8,
  },
  noteLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  noteInput: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    fontSize: 14,
    color: palette.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
}));
