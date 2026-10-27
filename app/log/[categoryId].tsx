/**
 * Question sheet for a specific category.
 * Renders all active questions via QuestionCard, manages answer state,
 * supports backdating and "Same as yesterday" shortcut, then submits.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Platform, Modal, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { AppDateTimePicker } from '../../src/components/common/AppDateTimePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RotateCcw, Check, ChevronDown, ChevronUp, Calendar } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { uuidv4 } from '../../src/utils/uuid';
import { IQuestion, IOption, ICategory, Answer, ILogEntry } from '@lumen/shared';
import { useConfigStore } from '../../src/store/configStore';
import { useDaySessionStore } from '../../src/store/daySessionStore';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { QuestionCard, QuestionPreviousEntry } from '../../src/components/QuestionCard';
import { EditSingleQuestionModal } from '../../src/components/log/EditSingleQuestionModal';
import { validateAnswers } from '../../src/utils/validateAnswers';
import { uploadAnswerImages } from '../../src/utils/uploadAnswerImages';
import { queryClient } from '../../src/api/queryClient';
import { useTodayCategoryLogs, formatAnswerSummary } from '../../src/hooks/useTodayCategoryLogs';
import { getDayBoundaryWindow, getTrackingDayDateString } from '../../src/utils/dayBoundary';
import { logLocationService } from '../../src/services/logLocationService';
import { useKeyboard } from '../../src/hooks/useKeyboard';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';

function fmtDateOnly(d: Date): string {
  const isToday = new Date().toDateString() === d.toDateString();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const isYesterday = y.toDateString() === d.toDateString();
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (isToday) return `Today (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  if (isYesterday) return `Yesterday (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  return dateStr;
}

export default function QuestionSheet() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const { categoryId, date } = useLocalSearchParams<{ categoryId: string; date?: string }>();
  const { config } = useConfigStore();
  const { todaySession } = useDaySessionStore();
  const { user } = useAuthStore();
  const { isKeyboardVisible } = useKeyboard();
  const initialOccurredAt = useMemo(() => {
    if (!date) return new Date();
    const parts = date.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const now = new Date();
      return new Date(y, m, d, now.getHours(), now.getMinutes(), 0);
    }
    return new Date();
  }, [date]);

  const [editingTarget, setEditingTarget] = useState<{
    logId: string;
    question: IQuestion;
    options: IOption[];
  } | null>(null);

  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, Answer[]>>({});
  const [occurredAt, setOccurredAt] = useState<Date>(initialOccurredAt);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setOccurredAt(initialOccurredAt);
  }, [initialOccurredAt]);

  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;

  const currentTodayDateStr = useMemo(() => {
    return getTrackingDayDateString(new Date(), boundaryHour);
  }, [boundaryHour]);

  const activeTrackingDateStr = useMemo(() => {
    return getTrackingDayDateString(occurredAt, boundaryHour);
  }, [occurredAt, boundaryHour]);

  const isLoggingForToday = activeTrackingDateStr === currentTodayDateStr;

  // Dynamically fetch and organize logs for the currently selected tracking day!
  const { getQuestionTodayHistory, refetch: refetchTodayLogs } = useTodayCategoryLogs(activeTrackingDateStr);

  const formattedTargetDate = useMemo(() => {
    if (isLoggingForToday) return null;
    return occurredAt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [isLoggingForToday, occurredAt]);

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

  const [allQuestionsExpanded, setAllQuestionsExpanded] = useState<boolean | null>(null);

  const answeredQuestionsCount = useMemo(() => {
    return questions.filter(q => (answersByQuestion[q._id] ?? []).length > 0).length;
  }, [questions, answersByQuestion]);

  const toggleAllQuestionsExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllQuestionsExpanded(prev => (prev === false ? true : false));
  };

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

  // Boundary window for the tracking day containing occurredAt
  const currentBoundaryWindow = useMemo(() => {
    return getDayBoundaryWindow(boundaryHour, occurredAt);
  }, [boundaryHour, occurredAt]);

  // Fetch recent log entries before this tracking day's window (up to 25 to cover individual questions)
  const { data: previousLogs = [] } = useQuery<ILogEntry[]>({
    queryKey: ['previous-category-logs', categoryId, currentBoundaryWindow.start.toISOString()],
    queryFn: async () => {
      if (!categoryId) return [];
      const res = await api.get<any>('/logs', {
        params: {
          to: currentBoundaryWindow.start.toISOString(),
          category: categoryId,
          limit: 25,
        },
      });
      const entries: ILogEntry[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);
      return entries;
    },
    staleTime: 60 * 1000,
  });

  const previousLog = previousLogs.length > 0 ? previousLogs[0] : null;

  const isYesterdayLog = useMemo(() => {
    if (!previousLog) return false;
    const yesterdayRef = new Date(currentBoundaryWindow.start.getTime() - 1000);
    const yesterdayWindow = getDayBoundaryWindow(boundaryHour, yesterdayRef);
    const prevTime = new Date(previousLog.occurredAt).getTime();
    return prevTime >= yesterdayWindow.start.getTime() && prevTime <= yesterdayWindow.end.getTime();
  }, [previousLog, currentBoundaryWindow.start, boundaryHour]);

  const formatBadgeDate = useCallback(
    (dateIso: string) => {
      const d = new Date(dateIso);
      const yesterdayRef = new Date(currentBoundaryWindow.start.getTime() - 1000);
      const yesterdayWindow = getDayBoundaryWindow(boundaryHour, yesterdayRef);
      const prevTime = d.getTime();
      const isYesterday = prevTime >= yesterdayWindow.start.getTime() && prevTime <= yesterdayWindow.end.getTime();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (isLoggingForToday && isYesterday) {
        return `Yesterday at ${timeStr}`;
      }
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${monthDay} at ${timeStr}`;
    },
    [currentBoundaryWindow.start, boundaryHour, isLoggingForToday],
  );

  const previousDateBadge = useMemo(() => {
    if (!previousLog) return '';
    return formatBadgeDate(previousLog.occurredAt);
  }, [previousLog, formatBadgeDate]);

  const previousSummaryStr = useMemo(() => {
    if (!previousLog || !config?.options) return '';
    return formatAnswerSummary(previousLog.answers ?? [], config.options);
  }, [previousLog, config?.options]);

  // Lookup previous entry for each specific question
  const getQuestionPreviousEntry = useCallback(
    (questionId: string, qOptions: IOption[]): QuestionPreviousEntry | null => {
      if (!previousLogs || previousLogs.length === 0 || qOptions.length === 0) return null;
      const optionIdSet = new Set(qOptions.map(o => o._id));

      for (const log of previousLogs) {
        const matchingAnswers = (log.answers ?? []).filter(a => optionIdSet.has(a.optionId));
        if (matchingAnswers.length > 0) {
          const summary = formatAnswerSummary(matchingAnswers, qOptions);
          return {
            logId: log._id,
            occurredAt: log.occurredAt,
            dateBadge: formatBadgeDate(log.occurredAt),
            answers: matchingAnswers,
            summaryText: summary,
          };
        }
      }
      return null;
    },
    [previousLogs, formatBadgeDate],
  );

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
      const [allAns, location] = await Promise.all([
        uploadAnswerImages(rawAns),
        logLocationService.getFastLocationSnapshot().catch(() => null),
      ]);

      const mealMap: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
      const mealPrefix = hasPerMealQuestions ? `[${mealMap[selectedMeal]}]` : '';
      const finalNote = note.trim()
        ? (mealPrefix ? `${mealPrefix} ${note.trim()}` : note.trim())
        : (mealPrefix || undefined);

      const primaryAnsweredQuestion = questions.find(q => (answersByQuestion[q._id] ?? []).length > 0) ?? questions[0];
      const cleanCategoryId = Array.isArray(categoryId) ? categoryId[0] : categoryId;

      // Sanitize answers to guarantee valid optionLabelSnapshot and no nulls from Mongo
      const sanitizedAnswers = allAns.map(ans => {
        const opt = config?.options.find(o => o._id === ans.optionId);
        return {
          optionId: ans.optionId,
          optionLabelSnapshot: ans.optionLabelSnapshot || opt?.label || 'Selected',
          values: (ans.values ?? []).map(v => ({
            fieldKey: v.fieldKey,
            dataType: v.dataType,
            value: v.value,
            ...(v.unit ? { unit: v.unit } : {}),
            ...(v.canonicalValue !== undefined && v.canonicalValue !== null ? { canonicalValue: v.canonicalValue } : {}),
          })),
          ...(ans.comment ? { comment: ans.comment } : {}),
          ...(ans.otherText ? { otherText: ans.otherText } : {}),
        };
      });

      // Sanitize location snapshot (strip any null/undefined fields)
      let sanitizedLocation: any = undefined;
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        sanitizedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          ...(typeof location.accuracy === 'number' ? { accuracy: location.accuracy } : {}),
          ...(location.name ? { name: location.name } : {}),
          ...(location.city ? { city: location.city } : {}),
          ...(location.region ? { region: location.region } : {}),
          ...(location.country ? { country: location.country } : {}),
          ...(location.formattedAddress ? { formattedAddress: location.formattedAddress } : {}),
        };
      }

      await api.post('/logs', {
        clientId: uuidv4(),
        daySessionId: isLoggingForToday && todaySession?._id ? String(todaySession._id) : undefined,
        source: 'questionnaire',
        categoryId: cleanCategoryId,
        questionId: primaryAnsweredQuestion?._id,
        questionVersion: primaryAnsweredQuestion?.version ?? 1,
        occurredAt: occurredAt instanceof Date && !isNaN(occurredAt.getTime()) ? occurredAt.toISOString() : new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: sanitizedAnswers,
        note: finalNote,
        ...(sanitizedLocation ? { location: sanitizedLocation } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      if (date) {
        safeGoBack('/(tabs)/timeline');
      } else {
        safeGoBack('/(tabs)/today');
      }
    } catch (err: unknown) {
      console.error('[QuestionSheet] Submit failed:', err);
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Log failed', msg);
    } finally {
      setIsSubmitting(false);
    }
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Stack.Screen options={{ headerShown: false }} />

        <ScreenTopBar
          title={category.name}
          onBack={() => safeGoBack(date ? '/(tabs)/timeline' : '/log')}
          right={
            <TouchableOpacity
              style={styles.datePill}
              onPress={() => setShowDatePicker(true)}
              accessibilityLabel={`Log date: ${fmtDateOnly(occurredAt)}`}
              accessibilityHint="Change the date"
              accessibilityRole="button"
            >
              <Text style={styles.datePillText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {isLoggingForToday
                  ? 'Today'
                  : occurredAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Past Date Context Banner */}
        {formattedTargetDate && (
          <View style={styles.pastDateBanner}>
            <Calendar size={15} color={palette.primaryText} strokeWidth={2.4} />
            <Text style={styles.pastDateBannerText}>
              Logging for <Text style={styles.pastDateHighlight}>{formattedTargetDate}</Text>
            </Text>
          </View>
        )}

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
                <RotateCcw size={16} color={palette.primaryText} strokeWidth={2.2} />
              )}
            </View>

            <View style={styles.previousLogInfo}>
              <View style={styles.previousLogRow}>
                <Text style={styles.previousLogTitle}>
                  {justApplied
                    ? 'Applied to form!'
                    : (isLoggingForToday && isYesterdayLog ? 'Same as yesterday' : 'Copy previous log')}
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

        {/* Category Questions Toolbar with Expand/Collapse All */}
        {questions.length > 1 && (
          <View style={styles.questionsToolbar}>
            <View style={styles.questionsToolbarLeft}>
              <Text style={styles.questionsToolbarTitle}>
                Questions ({questions.length})
              </Text>
              {answeredQuestionsCount > 0 && (
                <View style={styles.answeredCountBadge}>
                  <Text style={styles.answeredCountBadgeText}>
                    {answeredQuestionsCount} answered
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.expandCollapseAllBtn}
              onPress={toggleAllQuestionsExpanded}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={allQuestionsExpanded === false ? 'Expand all questions' : 'Collapse all questions'}
            >
              <Text style={styles.expandCollapseAllText}>
                {allQuestionsExpanded === false ? 'Expand all' : 'Collapse all'}
              </Text>
              {allQuestionsExpanded === false ? (
                <ChevronDown size={14} color={palette.primaryText} strokeWidth={2.4} />
              ) : (
                <ChevronUp size={14} color={palette.primaryText} strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>
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
            previousEntry={getQuestionPreviousEntry(q._id, optionsByQuestion[q._id] ?? [])}
            onReuseAnswers={(ans) => setQAnswers(q._id, ans)}
            onEditLog={(logId) =>
              setEditingTarget({
                logId,
                question: q,
                options: optionsByQuestion[q._id] ?? [],
              })
            }
            forceExpanded={allQuestionsExpanded}
            isToday={isLoggingForToday}
            targetDayLabel={formattedTargetDate || undefined}
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

        <View style={{ height: 96 + Math.max(insets.bottom, 20) }} />
      </ScrollView>

      {/* Submit button pinned to bottom */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: isKeyboardVisible
              ? 8
              : (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 20)),
          },
        ]}
      >
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
      </KeyboardAvoidingView>

      {/* Date picker — iOS modal, Android native, Web responsive sheet */}
      <AppDateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={occurredAt}
        onChange={(d) => setOccurredAt(d)}
        maximumDate={new Date()}
        mode="date"
        title="When did this happen?"
      />

      {/* Focused Single-Question Edit Modal */}
      <EditSingleQuestionModal
        visible={!!editingTarget}
        onClose={() => setEditingTarget(null)}
        logId={editingTarget?.logId ?? null}
        question={editingTarget?.question ?? null}
        options={editingTarget?.options ?? []}
        tempPrefUnit={tempPrefUnit}
        onUpdated={() => {
          refetchTodayLogs?.();
        }}
      />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: palette.errorText },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  pastDateBannerText: {
    ...typography.caption,
    fontSize: 13,
    color: palette.text,
    fontWeight: '600',
  },
  pastDateHighlight: {
    color: palette.primaryText,
    fontWeight: '800',
  },
  previousLogCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previousLogCardApplied: { backgroundColor: palette.success + '1F' },
  previousLogIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: palette.tint + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousLogIconBoxApplied: { backgroundColor: palette.success + '33' },
  previousLogInfo: {
    flex: 1,
    gap: 2,
  },
  previousLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  previousLogTitle: { ...typography.subheadBold, color: palette.text },
  previousLogBadge: { backgroundColor: palette.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  previousLogBadgeText: { ...typography.footnote, color: palette.textSecondary },
  previousLogSummary: { ...typography.footnote, color: palette.textSecondary },
  previousLogActionBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: palette.tint + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousLogActionBtnApplied: { backgroundColor: palette.success },
  previousLogActionText: { ...typography.subheadBold, color: palette.primaryText },
  previousLogActionTextApplied: {
    color: '#FFFFFF',
  },
  mealCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 14,
    gap: 10,
  },
  mealCardLabel: { ...typography.sectionLabel, color: palette.textSecondary },
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
    minHeight: 44,
    paddingHorizontal: 4,
    borderRadius: 22,
    backgroundColor: palette.surfaceAlt,
  },
  mealPillActive: { backgroundColor: palette.primary },
  mealPillEmoji: {
    fontSize: 13,
  },
  mealPillText: { ...typography.subhead, color: palette.text },
  mealPillTextActive: { color: '#FFFFFF', fontWeight: '600' },
  questionsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: -4,
  },
  questionsToolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionsToolbarTitle: { ...typography.sectionLabel, color: palette.textSecondary },
  answeredCountBadge: { backgroundColor: palette.success + '1F', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  answeredCountBadgeText: { ...typography.footnote, fontWeight: '600', color: palette.successText },
  expandCollapseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  expandCollapseAllText: { ...typography.subheadBold, color: palette.primaryText },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 20, alignItems: 'center', gap: 6,
  },
  emptyText: { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  emptyHint: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center' },
  noteWrapper: { gap: 6 },
  noteLabel: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 4 },
  noteInput: {
    backgroundColor: palette.surface,
    borderRadius: 26, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    ...typography.bodyLarge, color: palette.text,
    minHeight: 84, textAlignVertical: 'top',
  },
  datePill: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillText: { ...typography.subheadBold, color: palette.primaryText },
  spacer: { height: 100 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8,
  },
  submitBtn: {
    backgroundColor: palette.primary,
    borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 54,
    shadowColor: palette.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { ...typography.headline, color: '#FFFFFF' },
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
  pickerDone: { ...typography.bodyBold, color: palette.primaryText },
}));
