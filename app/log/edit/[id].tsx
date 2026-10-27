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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppDateTimePicker } from '../../../src/components/common/AppDateTimePicker';
import { AlertCircle, Trash2 } from 'lucide-react-native';
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
import { ScreenTopBar, HeaderTextButton } from '../../../src/components/ios/ScreenTopBar';
import { NoteField } from '../../../src/components/ios/NoteField';
import { InsetGroup, GroupedRow } from '../../../src/components/ios/InsetGroup';
import { validateAnswers } from '../../../src/utils/validateAnswers';
import { uploadAnswerImages } from '../../../src/utils/uploadAnswerImages';

function fmtDateOnly(d: Date): string {
  const isToday = new Date().toDateString() === d.toDateString();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const isYesterday = y.toDateString() === d.toDateString();
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (isToday) return `Today (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  if (isYesterday) return `Yesterday (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  return dateStr;
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

  const handleDelete = () => {
    Alert.alert('Delete entry', 'Remove this log entry? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsSubmitting(true);
          try {
            await api.delete(`/logs/${id}`);
            queryClient.invalidateQueries({ queryKey: ['day-entries'] });
            queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
            queryClient.invalidateQueries({ queryKey: ['today-logs'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            safeGoBack('/(tabs)/timeline');
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Could not delete this entry. Please try again.');
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={palette.primaryText} />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Loading log entry…
        </Text>
      </View>
    );
  }

  const heading = questionId && questions[0] ? `Edit ${questions[0].title}` : `Edit ${category?.name ?? 'Log'}`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenTopBar
        title={heading}
        backLabel="Cancel edit"
        onBack={() => safeGoBack('/(tabs)/timeline')}
        right={
          <HeaderTextButton
            label="Save"
            accessibilityLabel="Save changes"
            prominent
            loading={isSubmitting}
            onPress={handleSave}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <InsetGroup title="Date Logged">
          <GroupedRow
            label={fmtDateOnly(occurredAt)}
            value={occurredAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            chevron
            accessibilityLabel={`Change log date, currently ${fmtDateOnly(occurredAt)}`}
            onPress={() => setShowDatePicker(true)}
          />
        </InsetGroup>

        <AppDateTimePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          value={occurredAt}
          onChange={(d) => setOccurredAt(d)}
          maximumDate={new Date()}
          mode="date"
          title="When did this happen?"
        />

        {/* Question cards with full interactive option pickers, body maps, and photos */}
        <View style={styles.gutter}>
          {questions.length === 0 ? (
            <View style={styles.emptyCard}>
              <AlertCircle size={24} color={palette.textSecondary} />
              <Text style={styles.emptyText}>No questions found for this category.</Text>
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

          <NoteField
            title="Notes & Observations"
            value={note}
            onChangeText={setNote}
            placeholder="Add context, triggers, or how you felt…"
            accessibilityLabel="Notes and observations"
          />
        </View>

        <InsetGroup>
          <GroupedRow
            icon={Trash2}
            tile={palette.error}
            label="Delete Entry"
            destructive
            accessibilityLabel="Delete entry"
            onPress={handleDelete}
          />
        </InsetGroup>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...typography.bodyLarge, fontWeight: '500' },
  scrollContent: { paddingTop: 14, paddingBottom: 48, gap: 18 },
  gutter: { paddingHorizontal: 16, gap: 14 },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { ...typography.bodyLarge, color: palette.textSecondary, textAlign: 'center' },
}));
