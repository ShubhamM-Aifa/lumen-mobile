/**
 * Dedicated Log Edit Screen
 * Allows editing an existing log entry:
 * - Pre-populates all answers, question fields, body map locations, photos, date/time, notes
 * - Validates and uploads any new media
 * - Updates the log via PATCH /logs/:id
 * - Refreshes the Timeline instantly
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Check, Clock, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { safeGoBack } from '../../../src/utils/navigation';
import { IQuestion, IOption, ICategory, Answer, ILogEntry } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { useAuthStore } from '../../../src/store/authStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { QuestionCard } from '../../../src/components/QuestionCard';
import { validateAnswers } from '../../../src/utils/validateAnswers';
import { uploadAnswerImages } from '../../../src/utils/uploadAnswerImages';

function fmtDate(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateStr} at ${h12}:${m} ${period}`;
}

export default function EditLogScreen() {
  const { id, questionId } = useLocalSearchParams<{ id: string; questionId?: string }>();
  const { palette } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { config, fetchConfig } = useConfigStore();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logEntry, setLogEntry] = useState<ILogEntry | null>(null);

  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, Answer[]>>({});
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  // Fetch the log entry
  useEffect(() => {
    let isMounted = true;
    async function loadLog() {
      try {
        setIsLoading(true);
        if (!config) {
          await fetchConfig();
        }
        const data = await api.get<ILogEntry>(`/logs/${id}`);
        if (!isMounted) return;

        setLogEntry(data);
        setOccurredAt(new Date(data.occurredAt));
        setNote(data.note || '');

        // Map answers flat list back to answersByQuestion
        const byQ: Record<string, Answer[]> = {};
        for (const answer of data.answers) {
          const opt = config?.options.find((o) => o._id === answer.optionId);
          if (opt) {
            const qId = opt.questionId;
            if (!byQ[qId]) byQ[qId] = [];
            byQ[qId].push({ ...answer });
          } else if (data.questionId) {
            if (!byQ[data.questionId]) byQ[data.questionId] = [];
            byQ[data.questionId].push({ ...answer });
          }
        }
        setAnswersByQuestion(byQ);
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Could not load log entry for editing.');
        safeGoBack('/(tabs)/timeline');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (id) {
      loadLog();
    }

    return () => {
      isMounted = false;
    };
  }, [id, config, fetchConfig]);

  const categoryId = logEntry?.categoryId;
  const category: ICategory | undefined = config?.categories.find((c) => c._id === categoryId);

  const questions: IQuestion[] = useMemo(() => {
    if (!categoryId || !config) return [];
    let list = config.questions
      .filter((q) => q.categoryId === categoryId && q.isActive);
    if (questionId) {
      const single = list.find((q) => q._id === questionId);
      if (single) list = [single];
    }
    return list.sort((a, b) => a.order - b.order);
  }, [categoryId, config, questionId]);

  const optionsByQuestion = useMemo(() => {
    const map: Record<string, IOption[]> = {};
    if (!config) return map;
    for (const q of questions) {
      map[q._id] = config.options
        .filter((o) => o.questionId === q._id && o.isActive)
        .sort((a, b) => a.order - b.order);
    }
    return map;
  }, [config, questions]);

  const allAnswers = useMemo(() => {
    return Object.values(answersByQuestion).flat();
  }, [answersByQuestion]);

  const tempPrefUnit = user?.preferences.tempUnit ?? 'C';

  const setQAnswers = useCallback((questionId: string, answers: Answer[]) => {
    setAnswersByQuestion((prev) => ({ ...prev, [questionId]: answers }));
  }, []);

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setOccurredAt(date);
  };

  const validate = (): string | null => {
    for (const q of questions) {
      if (!q.required) continue;
      const answers = answersByQuestion[q._id] ?? [];
      if (answers.length === 0) {
        return `"${q.title}" is required — please select at least one option.`;
      }
    }
    const allOptions = Object.values(optionsByQuestion).flat();
    return validateAnswers(allAnswers, allOptions);
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Missing answer', error);
      return;
    }

    if (allAnswers.length === 0) {
      Alert.alert('Nothing selected', 'Please select at least one option before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uploadedAnswers = await uploadAnswerImages(allAnswers);

      let finalAnswers = uploadedAnswers;
      if (questionId && logEntry) {
        // preserve answers of other questions that belong to this log entry
        const currentQOptionIds = new Set((optionsByQuestion[questionId] ?? []).map((o) => o._id));
        const otherAnswers = (logEntry.answers ?? []).filter(
          (a) => !currentQOptionIds.has(a.optionId) && a.optionId !== '__other__'
        );
        finalAnswers = [...otherAnswers, ...uploadedAnswers];
      }

      await api.patch(`/logs/${id}`, {
        occurredAt: occurredAt.toISOString(),
        answers: finalAnswers,
        note: note.trim() || undefined,
      });

      // Invalidate day entries and timeline summary cache
      const dateKey = occurredAt.toISOString().slice(0, 10);
      queryClient.invalidateQueries({ queryKey: ['day-entries', dateKey] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/timeline');
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Failed to update log entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Loading log entry…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: questionId && questions[0] ? `Edit ${questions[0].title}` : `Edit ${category?.name ?? 'Log'}`,
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => safeGoBack('/(tabs)/timeline')}
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
            >
              <ChevronLeft size={24} color={palette.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Date / Time Backdating row */}
        <View style={styles.dateTimeCard}>
          <View style={styles.dateLabelRow}>
            <Clock size={16} color={palette.primary} />
            <Text style={styles.dateTimeHeading}>Time Logged</Text>
          </View>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Change log time"
          >
            <Text style={[styles.datePickerText, { color: palette.text }]}>
              {fmtDate(occurredAt)}
            </Text>
            <Text style={[styles.changeTimeHint, { color: palette.primary }]}>Change</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={occurredAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onPickerChange}
          />
        )}

        {/* Question cards with full interactive option pickers, body maps, and photos */}
        {questions.length === 0 ? (
          <View style={styles.emptyCard}>
            <AlertCircle size={24} color={palette.textDisabled} />
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No questions found for this category.
            </Text>
          </View>
        ) : (
          questions.map((question) => (
            <QuestionCard
              key={question._id}
              question={question}
              options={optionsByQuestion[question._id] ?? []}
              answers={answersByQuestion[question._id] ?? []}
              sessionAnswers={allAnswers}
              onChange={(ans) => setQAnswers(question._id, ans)}
              tempPrefUnit={tempPrefUnit}
            />
          ))
        )}

        {/* Notes block */}
        <View style={styles.noteCard}>
          <Text style={styles.noteHeading}>Notes & Observations</Text>
          <TextInput
            style={[styles.noteInput, { color: palette.text, borderColor: palette.border }]}
            placeholder="Add context, triggers, or how you felt…"
            placeholderTextColor={palette.placeholder}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...typography.body,
    fontWeight: '500',
  },
  headerBtn: {
    padding: 6,
    marginLeft: -4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  dateTimeCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 8,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeHeading: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  datePickerText: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  changeTimeHint: {
    ...typography.caption,
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 8,
  },
  noteHeading: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteInput: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
    backgroundColor: palette.background,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
}));
