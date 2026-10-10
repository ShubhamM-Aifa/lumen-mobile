/**
 * Question sheet for a specific category.
 * Renders all active questions via QuestionCard, manages answer state,
 * supports backdating and "Same as yesterday" shortcut, then submits.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Platform, Modal, Pressable,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { RotateCcw, Check } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { uuidv4 } from '../../src/utils/uuid';
import { IQuestion, IOption, ICategory, Answer, ILogEntry } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { useDaySessionStore } from '../../src/store/daySessionStore';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { QuestionCard } from '../../src/components/QuestionCard';
import { validateAnswers } from '../../src/utils/validateAnswers';
import { uploadAnswerImages } from '../../src/utils/uploadAnswerImages';
import { queryClient } from '../../src/api/queryClient';
import { useTodayCategoryLogs, formatAnswerSummary } from '../../src/hooks/useTodayCategoryLogs';
import { getDayBoundaryWindow } from '../../src/utils/dayBoundary';

function fmt(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const date = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const isToday = new Date().toDateString() === d.toDateString();
  return isToday ? `Today at ${h12}:${m} ${period}` : `${date} at ${h12}:${m} ${period}`;
}

export default function QuestionSheet() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { config } = useConfigStore();
  const { todaySession } = useDaySessionStore();
  const { user } = useAuthStore();
  const { getQuestionTodayHistory } = useTodayCategoryLogs();

  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, Answer[]>>({});
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const category: ICategory | undefined = config?.categories.find(c => c._id === categoryId);
  const questions: IQuestion[] = (config?.questions ?? [])
    .filter(q => q.categoryId === categoryId && q.isActive)
    .sort((a, b) => a.order - b.order);
  const optionsByQuestion: Record<string, IOption[]> = {};
  for (const q of questions) {
    optionsByQuestion[q._id] = (config?.options ?? [])
      .filter(o => o.questionId === q._id && o.isActive)
      .sort((a, b) => a.order - b.order);
  }

  // Meal slot support for questions with frequency: 'per_meal'
  const hasPerMealQuestions = useMemo(() => questions.some(q => q.frequency === 'per_meal'), [questions]);
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 18) return 'snack';
    if (h >= 18 && h < 23) return 'dinner';
    return 'snack';
  });

  // All current answers flat — used for conditionalDisplay evaluation
  const allAnswers = Object.values(answersByQuestion).flat();

  const tempPrefUnit = user?.preferences.tempUnit ?? 'C';

  const setQAnswers = useCallback(
    (questionId: string, answers: Answer[]) => {
      setAnswersByQuestion(prev => ({ ...prev, [questionId]: answers }));
    },
    [],
  );

  // Helper to load answers from any given log entry
  const loadFromLog = (targetLog: ILogEntry) => {
    const byQ: Record<string, Answer[]> = {};
    for (const answer of targetLog.answers) {
      const option = config?.options.find(o => o._id === answer.optionId);
      if (!option) continue;
      const qId = option.questionId;
      if (!byQ[qId]) byQ[qId] = [];
      byQ[qId].push({ ...answer });
    }
    setAnswersByQuestion(byQ);
    if (targetLog.note) setNote(targetLog.note);
  };

  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const currentBoundaryWindow = useMemo(() => getDayBoundaryWindow(boundaryHour), [boundaryHour]);

  // Fetch the most recent log entry before today's cycle (smart fallback to yesterday or previous entry)
  const { data: previousLog } = useQuery<ILogEntry | null>({
    queryKey: ['previous-category-log', categoryId, currentBoundaryWindow.start.toISOString()],
    queryFn: async () => {
      if (!categoryId) return null;
      const res = await api.get<any>('/logs', {
        params: {
          to: currentBoundaryWindow.start.toISOString(),
          category: categoryId,
          limit: 1,
        },
      });
      const entries: ILogEntry[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);
      return entries.length > 0 ? entries[0] : null;
    },
    staleTime: 60 * 1000,
  });

  const isYesterdayLog = useMemo(() => {
    if (!previousLog) return false;
    const yesterdayRef = new Date(currentBoundaryWindow.start.getTime() - 1000);
    const yesterdayWindow = getDayBoundaryWindow(boundaryHour, yesterdayRef);
    const prevTime = new Date(previousLog.occurredAt).getTime();
    return prevTime >= yesterdayWindow.start.getTime() && prevTime <= yesterdayWindow.end.getTime();
  }, [previousLog, currentBoundaryWindow.start, boundaryHour]);

  const previousDateBadge = useMemo(() => {
    if (!previousLog) return '';
    const d = new Date(previousLog.occurredAt);
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isYesterdayLog) {
      return `Yesterday at ${timeStr}`;
    }
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${monthDay} at ${timeStr}`;
  }, [previousLog, isYesterdayLog]);

  const previousSummaryStr = useMemo(() => {
    if (!previousLog || !config?.options) return '';
    return formatAnswerSummary(previousLog.answers ?? [], config.options);
  }, [previousLog, config?.options]);

  const [justApplied, setJustApplied] = useState(false);

  const handleApplyPrevious = useCallback(async () => {
    if (!previousLog) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadFromLog(previousLog);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);
  }, [previousLog, loadFromLog]);

  const validate = (): string | null => {
    for (const q of questions) {
      if (!q.required) continue;
      // If once_per_day and already answered today, skip requirement check
      const isOncePerDayDone = q.frequency === 'once_per_day' && getQuestionTodayHistory(q._id, optionsByQuestion[q._id] ?? [], categoryId).length > 0;
      if (isOncePerDayDone) continue;

      const answers = answersByQuestion[q._id] ?? [];
      if (answers.length === 0) {
        return `"${q.title}" is required — please select at least one option.`;
      }
    }
    // Validate field values against field definitions
    const allOptions = Object.values(optionsByQuestion).flat();
    const allAns = Object.values(answersByQuestion).flat();
    return validateAnswers(allAns, allOptions);
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { Alert.alert('Missing answer', error); return; }

    const rawAns = Object.values(answersByQuestion).flat();
    if (rawAns.length === 0) {
      const allCompletedOnceDaily = questions.length > 0 && questions.every(q =>
        q.frequency === 'once_per_day' && getQuestionTodayHistory(q._id, optionsByQuestion[q._id] ?? [], categoryId).length > 0
      );
      if (allCompletedOnceDaily) {
        Alert.alert('Already completed', 'All questions in this category are marked "Once per day" and have already been answered today.');
      } else {
        Alert.alert('Nothing selected', 'Please select at least one option before logging.');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const allAns = await uploadAnswerImages(rawAns);
      const mealMap: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
      const mealPrefix = hasPerMealQuestions ? `[${mealMap[selectedMeal]}]` : '';
      const finalNote = note.trim()
        ? (mealPrefix ? `${mealPrefix} ${note.trim()}` : note.trim())
        : (mealPrefix || undefined);

      await api.post('/logs', {
        clientId: uuidv4(),
        daySessionId: todaySession?._id,
        source: 'questionnaire',
        categoryId,
        questionId: questions[0]?._id,           // primary question ref
        questionVersion: questions[0]?.version ?? 1,
        occurredAt: occurredAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: allAns,
        note: finalNote,
      });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      safeGoBack('/(tabs)/today');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Log failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setOccurredAt(date);
  };

  if (!category) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Log' }} />
        <Text style={styles.errorText}>Category not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: category.name }} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Log time row */}
        <TouchableOpacity
          style={styles.timeRow}
          onPress={() => setShowDatePicker(true)}
          accessibilityLabel={`Log time: ${fmt(occurredAt)}`}
          accessibilityRole="button"
        >
          <Text style={styles.timeIcon}>🕐</Text>
          <Text style={styles.timeText}>{fmt(occurredAt)}</Text>
          <Text style={styles.timeEdit}>Change</Text>
        </TouchableOpacity>

        {/* Meal Slot Selector for per_meal questions */}
        {hasPerMealQuestions && (
          <View style={styles.mealCard}>
            <Text style={styles.mealCardLabel}>Meal Slot</Text>
            <View style={styles.mealPillsRow}>
              {[
                { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
                { id: 'lunch',     label: 'Lunch',     emoji: '🥗' },
                { id: 'dinner',    label: 'Dinner',    emoji: '🍲' },
                { id: 'snack',     label: 'Snack',     emoji: '🍎' },
              ].map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.mealPill,
                    selectedMeal === m.id && styles.mealPillActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedMeal(m.id as any);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedMeal === m.id }}
                >
                  <Text style={styles.mealPillEmoji}>{m.emoji}</Text>
                  <Text
                    style={[
                      styles.mealPillText,
                      selectedMeal === m.id && styles.mealPillTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Smart Copy Previous / Same as Yesterday Card */}
        {previousLog && (
          <TouchableOpacity
            style={[
              styles.previousLogCard,
              justApplied && styles.previousLogCardApplied,
            ]}
            onPress={handleApplyPrevious}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isYesterdayLog
                ? `Copy answers from yesterday's log: ${previousSummaryStr}`
                : `Copy answers from previous log on ${previousDateBadge}: ${previousSummaryStr}`
            }
          >
            <View
              style={[
                styles.previousLogIconBox,
                justApplied && styles.previousLogIconBoxApplied,
              ]}
            >
              {justApplied ? (
                <Check size={16} color="#059669" strokeWidth={2.5} />
              ) : (
                <RotateCcw size={16} color={palette.primary} strokeWidth={2.2} />
              )}
            </View>

            <View style={styles.previousLogInfo}>
              <View style={styles.previousLogRow}>
                <Text style={styles.previousLogTitle}>
                  {justApplied
                    ? 'Applied to form!'
                    : (isYesterdayLog ? 'Same as yesterday' : 'Copy previous log')}
                </Text>
                <View style={styles.previousLogBadge}>
                  <Text style={styles.previousLogBadgeText}>{previousDateBadge}</Text>
                </View>
              </View>

              <Text style={styles.previousLogSummary} numberOfLines={1}>
                {justApplied
                  ? 'All question answers populated'
                  : (previousSummaryStr || 'Tap to fill all questions from this entry')}
              </Text>
            </View>

            <View
              style={[
                styles.previousLogActionBtn,
                justApplied && styles.previousLogActionBtnApplied,
              ]}
            >
              <Text
                style={[
                  styles.previousLogActionText,
                  justApplied && styles.previousLogActionTextApplied,
                ]}
              >
                {justApplied ? 'Applied' : 'Apply'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Question cards with question-level today history */}
        {questions.map((q) => (
          <QuestionCard
            key={q._id}
            question={q}
            options={optionsByQuestion[q._id] ?? []}
            answers={answersByQuestion[q._id] ?? []}
            sessionAnswers={allAnswers}
            onChange={(ans) => setQAnswers(q._id, ans)}
            tempPrefUnit={tempPrefUnit}
            todayHistory={getQuestionTodayHistory(q._id, optionsByQuestion[q._id] ?? [], categoryId)}
            onReuseAnswers={(ans) => setQAnswers(q._id, ans)}
            onEditLog={(logId) => router.push(`/log/edit/${logId}`)}
          />
        ))}

        {questions.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No questions configured for this category yet.</Text>
            <Text style={styles.emptyHint}>Go to Customize → Categories to add questions.</Text>
          </View>
        )}

        {/* Optional note */}
        <View style={styles.noteWrapper}>
          <Text style={styles.noteLabel}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add any extra context or notes…"
            placeholderTextColor={palette.placeholder}
            multiline
            maxLength={1000}
            accessibilityLabel="Optional note"
          />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Submit button pinned to bottom */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Log now"
        >
          {isSubmitting
            ? <ActivityIndicator color={palette.white} />
            : <Text style={styles.submitText}>Log now</Text>}
        </TouchableOpacity>
      </View>

      {/* Date/time picker — iOS modal, Android native */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.overlay} onPress={() => setShowDatePicker(false)}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>When did this happen?</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={occurredAt}
                mode="datetime"
                display="spinner"
                onChange={onPickerChange}
                maximumDate={new Date()}
                textColor={palette.text}
              />
            </View>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={occurredAt}
          mode="datetime"
          display="default"
          onChange={onPickerChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: palette.error },
  scroll: { padding: 16, gap: 14 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: palette.surface,
    borderRadius: 12, borderWidth: 1, borderColor: palette.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  timeIcon: { fontSize: 16 },
  timeText: { ...typography.smallBold, color: palette.text, flex: 1 },
  timeEdit: { ...typography.small, color: palette.primary },
  previousLogCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  previousLogCardApplied: {
    borderColor: '#10B981',
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#ECFDF5' : '#064E3B1C',
  },
  previousLogIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${palette.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousLogIconBoxApplied: {
    backgroundColor: '#10B98122',
  },
  previousLogInfo: {
    flex: 1,
    gap: 2,
  },
  previousLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  previousLogTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
    fontSize: 12.5,
  },
  previousLogBadge: {
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  previousLogBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  previousLogSummary: {
    ...typography.caption,
    fontSize: 11,
    color: palette.textSecondary,
  },
  previousLogActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: `${palette.primary}14`,
    borderWidth: 1,
    borderColor: `${palette.primary}25`,
  },
  previousLogActionBtnApplied: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  previousLogActionText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  previousLogActionTextApplied: {
    color: '#FFFFFF',
  },
  mealCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 8,
  },
  mealCardLabel: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  mealPillActive: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}12`,
  },
  mealPillEmoji: {
    fontSize: 13,
  },
  mealPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  mealPillTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 14, borderWidth: 1, borderColor: palette.border,
    padding: 20, alignItems: 'center', gap: 6,
  },
  emptyText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  emptyHint: { ...typography.small, color: palette.textDisabled, textAlign: 'center' },
  noteWrapper: { gap: 6 },
  noteLabel: { ...typography.smallBold, color: palette.textSecondary },
  noteInput: {
    backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 14, padding: 14,
    ...typography.body, color: palette.text,
    minHeight: 72,
  },
  spacer: { height: 100 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: palette.surface,
    borderTopWidth: 1, borderTopColor: palette.border,
  },
  submitBtn: {
    backgroundColor: palette.primary,
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 54,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { ...typography.button, color: '#FFFFFF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  pickerTitle: { ...typography.h4, color: palette.text },
  pickerDone: { ...typography.bodyBold, color: palette.primary },
}));
