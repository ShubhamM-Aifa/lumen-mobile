/**
 * EditSingleQuestionModal
 *
 * Dedicated bottom-sheet modal to edit ONLY a single question's answer
 * for an existing log entry without leaving the category log screen or
 * modifying other questions' answers in the same log entry.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { AppDateTimePicker } from '../common/AppDateTimePicker';
import { X, Check, Clock, Trash2, AlertCircle, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { IQuestion, IOption, Answer, ILogEntry } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { OptionSelector } from '../OptionSelector';
import { api } from '../../api/client';
import { validateAnswers } from '../../utils/validateAnswers';

interface Props {
  visible: boolean;
  onClose: () => void;
  logId: string | null;
  question: IQuestion | null;
  options: IOption[];
  tempPrefUnit?: 'C' | 'F';
  onUpdated?: () => void;
}

function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export function EditSingleQuestionModal({
  visible,
  onClose,
  logId,
  question,
  options,
  tempPrefUnit = 'C',
  onUpdated,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [existingLog, setExistingLog] = useState<ILogEntry | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [occurredAt, setOccurredAt] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load the log entry when modal becomes visible
  useEffect(() => {
    if (!visible || !logId || !question) return;

    let isMounted = true;
    async function fetchLog() {
      try {
        setIsLoading(true);
        const data = await api.get<ILogEntry>(`/logs/${logId}`);
        if (!isMounted) return;

        setExistingLog(data);
        setOccurredAt(new Date(data.occurredAt));

        // Extract ONLY the answers belonging to this question
        const questionOptionIds = new Set(options.map((o) => o._id));
        const currentQId = question?._id;
        const matched = (data.answers ?? []).filter(
          (a) =>
            questionOptionIds.has(a.optionId) ||
            (a.optionId === '__other__' && data.questionId === currentQId)
        );

        setAnswers(matched.map((a) => ({ ...a })));
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Could not load log entry details.');
        onClose();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchLog();
    return () => {
      isMounted = false;
    };
  }, [visible, logId, question, options]);

  if (!visible || !question) return null;


  const handleSave = async () => {
    if (!existingLog || !logId) return;

    // Validate if question is required
    if (question.required && answers.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Selection required', `Please provide an answer for "${question.title}".`);
      return;
    }

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Preserve answers belonging to other questions in the same log entry
      const questionOptionIds = new Set(options.map((o) => o._id));
      const otherAnswers = (existingLog.answers ?? []).filter(
        (a) => !questionOptionIds.has(a.optionId) && a.optionId !== '__other__'
      );

      const mergedAnswers = [...otherAnswers, ...answers];

      await api.patch(`/logs/${logId}`, {
        answers: mergedAnswers,
        occurredAt: occurredAt.toISOString(),
      });

      // Invalidate relevant query caches
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['today-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['day-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['today-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['previous-category-log'] }),
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save Failed', err?.message || 'Could not update this entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!logId) return;

    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this recorded log entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await api.delete(`/logs/${logId}`);

              await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ['today-logs'] }),
                queryClient.invalidateQueries({ queryKey: ['day-entries'] }),
                queryClient.invalidateQueries({ queryKey: ['timeline-summary'] }),
                queryClient.invalidateQueries({ queryKey: ['today-summary'] }),
              ]);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onUpdated?.();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete log entry.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
            >
              <X size={20} color={palette.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <View style={styles.badgeRow}>
                <Edit3 size={12} color={palette.primary} strokeWidth={2.4} />
                <Text style={styles.badgeText}>Edit this entry only</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {question.title}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving || isLoading}
              style={[styles.saveBtn, (isSaving || isLoading) && styles.saveBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Save entry changes"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={styles.loadingText}>Loading entry values…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Recorded Timestamp Row */}
              <View style={styles.timeCard}>
                <View style={styles.timeCardLeft}>
                  <Clock size={15} color={palette.primary} strokeWidth={2.4} />
                  <Text style={styles.timeCardLabel}>Logged Time</Text>
                </View>

                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change log time"
                >
                  <Text style={styles.timeBtnText}>{fmtTime(occurredAt)}</Text>
                  <Text style={styles.timeChangeHint}>Change</Text>
                </TouchableOpacity>
              </View>

              <AppDateTimePicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                value={occurredAt}
                onChange={(d) => setOccurredAt(d)}
                maximumDate={new Date()}
              />

              {/* Question Help Text */}
              {question.helpText ? (
                <Text style={styles.helpText}>{question.helpText}</Text>
              ) : null}

              {/* Question Options Selector (Isolated to this Question) */}
              <View style={styles.selectorWrap}>
                <OptionSelector
                  options={options.filter((o) => o.isActive).sort((a, b) => a.order - b.order)}
                  selectionType={question.selectionType}
                  allowOther={question.allowOther}
                  answers={answers}
                  onChange={setAnswers}
                  tempPrefUnit={tempPrefUnit}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={[styles.primaryUpdateBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Save entry changes"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryUpdateText}>Update Entry</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDelete}
                  disabled={isDeleting || isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Delete entry"
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={palette.error} />
                  ) : (
                    <>
                      <Trash2 size={13} color={palette.error} strokeWidth={2.2} />
                      <Text style={styles.deleteBtnText}>Delete this log</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0000007A',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: 380,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${palette.primary}14`,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}2E`,
    marginBottom: 2,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.primary,
  },
  headerTitle: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
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
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...typography.body,
    fontSize: 13.5,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeCardLabel: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: '700',
    color: palette.text,
  },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  timeBtnText: {
    ...typography.bodyBold,
    fontSize: 12.5,
    color: palette.text,
  },
  timeChangeHint: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  helpText: {
    ...typography.body,
    fontSize: 12.5,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  selectorWrap: {
    marginTop: 2,
  },
  bottomActions: {
    marginTop: 10,
    gap: 12,
    alignItems: 'center',
  },
  primaryUpdateBtn: {
    width: '100%',
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryUpdateText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteBtnText: {
    ...typography.caption,
    color: palette.error,
    fontWeight: '700',
    fontSize: 12,
  },
}));
