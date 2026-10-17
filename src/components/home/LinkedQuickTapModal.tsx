/**
 * LinkedQuickTapModal — In-Place Flare & Log Modal for Quick Taps
 * Opens directly on the Today screen when a Quick Tap linked to a log option is tapped.
 * Pre-selects the linked option and provides full interactive follow-ups (Body Map, Severity, Comments).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Clock, Check, X, Sparkles, MapPin, AlertCircle, FileText } from 'lucide-react-native';
import { IQuickAction, IQuestion, IOption, Answer, FieldValue } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useConfigStore } from '../../store/configStore';
import { useQuickLogStore } from '../../store/quickLogStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { logLocationService } from '../../services/logLocationService';
import { uploadAnswerImages } from '../../utils/uploadAnswerImages';
import { QuickActionIcon } from '../QuickActionIcon';
import { DynamicField } from '../fields/DynamicField';
import AppDateTimePicker from '../common/AppDateTimePicker';
import { uuidv4 } from '../../utils/uuid';
import { isWithinDayBoundary } from '../../utils/dayBoundary';

interface Props {
  visible: boolean;
  action: IQuickAction | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LinkedQuickTapModal({ visible, action, onClose, onSuccess }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config } = useConfigStore();
  const { user } = useAuthStore();
  const tempPrefUnit = user?.preferences?.tempUnit ?? 'C';

  // Modal form state
  const [occurredAt, setOccurredAt] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [comment, setComment] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Resolve Linked Entities from Config
  const { linkedQuestion, linkedOption, linkedCategory } = useMemo(() => {
    if (!action?.linkedQuestionId || !action?.linkedOptionId || !config) {
      return { linkedQuestion: null, linkedOption: null, linkedCategory: null };
    }
    const q = config.questions?.find((item) => item._id === action.linkedQuestionId) ?? null;
    const o = config.options?.find((item) => item._id === action.linkedOptionId) ?? null;
    const c = q ? config.categories?.find((cat) => cat._id === q.categoryId) ?? null : null;
    return { linkedQuestion: q, linkedOption: o, linkedCategory: c };
  }, [action, config]);

  // Reset state whenever modal opens for an action
  useEffect(() => {
    if (visible && action) {
      setOccurredAt(new Date());
      setFieldValues([]);
      setComment('');
      setNote('');
      setIsSubmitting(false);
      setShowTimePicker(false);
    }
  }, [visible, action]);

  if (!visible || !action) return null;

  const handleUpdateFieldValue = (
    fieldKey: string,
    partial: Pick<FieldValue, 'value' | 'unit'>,
    dataType: string
  ) => {
    setFieldValues((prev) => {
      const idx = prev.findIndex((fv) => fv.fieldKey === fieldKey);
      const nextFv: FieldValue = {
        fieldKey,
        dataType: dataType as any,
        value: partial.value as any,
        unit: partial.unit,
      };
      if (idx === -1) {
        return [...prev, nextFv];
      }
      const copy = [...prev];
      copy[idx] = nextFv;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!linkedQuestion || !linkedOption) {
      Alert.alert('Configuration error', 'The linked option could not be loaded.');
      return;
    }

    try {
      setIsSubmitting(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const rawAnswer: Answer = {
        optionId: linkedOption._id,
        optionLabelSnapshot: linkedOption.label,
        values: fieldValues,
        comment: comment.trim() || undefined,
      };

      // Upload any attached images if present
      const processedAnswers = await uploadAnswerImages([rawAnswer]);

      // Grab quick location snapshot
      const location = await logLocationService.getFastLocationSnapshot().catch(() => null);

      const clientId = uuidv4();
      const nowIso = occurredAt.toISOString();

      // Submit clinical log entry
      const logRes = await api.post<{ _id: string }>('/logs', {
        clientId,
        source: 'quick_action',
        quickActionId: action._id,
        categoryId: linkedQuestion.categoryId,
        occurredAt: nowIso,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: processedAnswers,
        mediaIds: [],
        note: note.trim() || undefined,
        ...(location ? { location } : {}),
      });

      // Update Today's Quick Log Store count optimistically (respecting Day Reset Boundary)
      const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
      const isToday = isWithinDayBoundary(nowIso, boundaryHour, new Date());
      if (isToday) {
        const { todayTaps } = useQuickLogStore.getState();
        const prev = todayTaps[action._id];
        const isPrevValid = prev && prev.lastAt && isWithinDayBoundary(prev.lastAt, boundaryHour, occurredAt);
        const newCount = isPrevValid ? (prev?.count ?? 0) + 1 : 1;
        const updatedEntry = {
          id: clientId,
          quickActionId: action._id,
          occurredAt: nowIso,
          count: newCount,
          lastAt: nowIso,
          serverId: logRes._id,
          synced: true,
        };

        useQuickLogStore.setState({
          todayTaps: { ...todayTaps, [action._id]: updatedEntry },
        });
      }

      // Invalidate relevant React Query caches
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record entry';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const accentColor = action.color || palette.primary;
  const timeFormatted = occurredAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const isTodayDate = new Date().toDateString() === occurredAt.toDateString();
  const dateFormatted = isTodayDate
    ? 'Today'
    : occurredAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.actionIconBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
                <QuickActionIcon
                  icon={action.icon}
                  templateKey={action.templateKey}
                  label={action.label}
                  color={accentColor}
                  size={20}
                />
              </View>
              <View style={styles.headerTitles}>
                <Text style={styles.title}>{action.label}</Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  {linkedCategory?.name ?? 'Log entry'} • {linkedQuestion?.title ?? 'Question'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Timestamp selector pill */}
            <View style={styles.timeCard}>
              <View style={styles.timeCardLeft}>
                <Clock size={15} color={palette.primary} strokeWidth={2.4} />
                <Text style={styles.timeLabel}>
                  {dateFormatted} at {timeFormatted}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeTimeBtn}
                onPress={() => setShowTimePicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Change timestamp"
              >
                <Text style={[styles.changeTimeText, { color: palette.primary }]}>Change</Text>
              </TouchableOpacity>
            </View>

            <AppDateTimePicker
              visible={showTimePicker}
              onClose={() => setShowTimePicker(false)}
              value={occurredAt}
              onChange={(d) => setOccurredAt(d)}
              maximumDate={new Date()}
            />

            {/* Active Selected Option Card */}
            {linkedOption ? (
              <View style={[styles.selectedOptionCard, { borderColor: accentColor + '50' }]}>
                <View style={styles.optionHeaderRow}>
                  <View style={styles.optionHeaderLeft}>
                    {linkedOption.icon ? (
                      <Text style={styles.optionEmoji}>{linkedOption.icon}</Text>
                    ) : (
                      <View style={[styles.optionDot, { backgroundColor: accentColor }]} />
                    )}
                    <Text style={[styles.optionLabel, { color: accentColor }]}>
                      {linkedOption.label}
                    </Text>
                  </View>
                  <View style={[styles.checkPill, { backgroundColor: accentColor }]}>
                    <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                  </View>
                </View>

                {/* Follow-up Fields (Body Map, Severity, etc.) */}
                {linkedOption.fields && linkedOption.fields.length > 0 && (
                  <View style={styles.followUpWrap}>
                    {linkedOption.fields.map((field) => {
                      const fv = fieldValues.find((v) => v.fieldKey === field.key);
                      return (
                        <View key={field.key} style={styles.fieldItem}>
                          <DynamicField
                            field={field}
                            fieldValue={fv}
                            onChange={(partial) =>
                              handleUpdateFieldValue(field.key, partial, field.dataType)
                            }
                            tempPrefUnit={tempPrefUnit}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Option Specific Comment */}
                {linkedOption.allowComment && (
                  <View style={styles.commentWrap}>
                    <TextInput
                      style={[styles.commentInput, { color: palette.text, borderColor: palette.border }]}
                      placeholder="Add a comment, trigger, or details…"
                      placeholderTextColor={palette.placeholder}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={500}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.missingCard}>
                <AlertCircle size={24} color={palette.error} />
                <Text style={styles.missingText}>
                  Linked option was not found in active questions. Please update in Quick Actions customization.
                </Text>
              </View>
            )}

            {/* Optional general note */}
            <View style={styles.noteSection}>
              <View style={styles.noteHeader}>
                <FileText size={14} color={palette.textSecondary} />
                <Text style={styles.noteHeading}>Additional Notes (optional)</Text>
              </View>
              <TextInput
                style={[styles.noteInput, { color: palette.text, borderColor: palette.border }]}
                placeholder="Any other triggers or observations…"
                placeholderTextColor={palette.placeholder}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor }, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save entry"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.6} style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Log</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? {
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }
      : null),
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    ...(Platform.OS === 'web'
      ? {
          maxWidth: 480,
          borderRadius: 24,
          borderWidth: 1,
          paddingBottom: 20,
        }
      : null),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 16,
    color: palette.text,
  },
  subTitle: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 20,
    gap: 16,
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
  timeLabel: {
    ...typography.bodyBold,
    fontSize: 13.5,
    color: palette.text,
  },
  changeTimeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeTimeText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedOptionCard: {
    backgroundColor: palette.background,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionLabel: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '700',
  },
  checkPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpWrap: {
    gap: 14,
    paddingTop: 4,
  },
  fieldItem: {
    gap: 6,
  },
  commentWrap: {
    paddingTop: 4,
  },
  commentInput: {
    ...typography.body,
    fontSize: 13.5,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  missingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: palette.error + '14',
    borderWidth: 1,
    borderColor: palette.error + '40',
  },
  missingText: {
    ...typography.body,
    fontSize: 13,
    color: palette.error,
    flex: 1,
  },
  noteSection: {
    gap: 8,
    marginTop: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteHeading: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteInput: {
    ...typography.body,
    fontSize: 13,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.textSecondary,
  },
  saveBtn: {
    flex: 1.4,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
}));

export default LinkedQuickTapModal;
