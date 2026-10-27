import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X,
  Check,
  Star,
  Sun,
  Bell,
  Calendar,
  Repeat,
  BatteryCharging,
  Flame,
  Trash2,
  Plus,
} from 'lucide-react-native';
import { ITask, TaskEnergyCost } from '../../shared/types';
import { useTaskStore } from '../../store/taskStore';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TaskDetailSheetProps {
  task: ITask | null;
  visible: boolean;
  onClose: () => void;
  boundaryHour?: number;
}

export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  task,
  visible,
  onClose,
  boundaryHour = 4,
}) => {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const {
    tasks,
    updateTask,
    toggleTaskCompleted,
    toggleTaskImportant,
    toggleTaskMyDay,
    deleteTask,
    addStep,
    toggleStep,
    deleteStep,
    deferForFlare,
  } = useTaskStore();

  const liveTask = (task && tasks.find((t) => t._id === task._id)) || task;

  const [newStepText, setNewStepText] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedNotes, setEditedNotes] = useState('');

  // Sync state only when task ID changes or modal opens
  const taskId = task?._id;
  useEffect(() => {
    if (liveTask && visible) {
      setEditedTitle(liveTask.title);
      setEditedNotes(liveTask.notes || '');
    }
  }, [taskId, visible]);

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }, []);
  const nextWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatLocalDate(d);
  }, []);

  const handleSaveTitle = () => {
    if (!liveTask) return;
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== liveTask.title) {
      updateTask(liveTask._id, { title: trimmed });
    }
  };

  const handleSaveNotes = () => {
    if (!liveTask) return;
    if (editedNotes !== (liveTask.notes || '')) {
      updateTask(liveTask._id, { notes: editedNotes });
    }
  };

  const handleClose = () => {
    if (liveTask) {
      const trimmed = editedTitle.trim();
      if (trimmed && trimmed !== liveTask.title) {
        updateTask(liveTask._id, { title: trimmed });
      }
      if (editedNotes !== (liveTask.notes || '')) {
        updateTask(liveTask._id, { notes: editedNotes });
      }
    }
    onClose();
  };

  if (!liveTask) return null;

  const isDueToday = liveTask.dueDate === todayStr;
  const isDueTomorrow = liveTask.dueDate === tomorrowStr;
  const isDueNextWeek = liveTask.dueDate === nextWeekStr;

  const isDaily = liveTask.repeat?.frequency === 'daily';
  const isWeekdays = liveTask.repeat?.frequency === 'weekdays';
  const isWeekly = liveTask.repeat?.frequency === 'weekly';

  const isGentle = liveTask.energyCost === 'gentle';
  const isModerate = liveTask.energyCost === 'moderate';
  const isDemanding = liveTask.energyCost === 'demanding';

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addStep(liveTask._id, newStepText.trim());
    setNewStepText('');
  };

  const handleDeleteTask = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteTask(liveTask._id);
            onClose();
          },
        },
      ]
    );
  };

  const handleFlareDeferral = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deferForFlare(liveTask._id, 2);
    Alert.alert(
      'Task Postponed',
      'Pacing applied: Removed from today and postponed by 2 days. Rest up!'
    );
  };

  const setDueDatePreset = (preset: 'today' | 'tomorrow' | 'nextWeek' | 'clear') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (preset === 'clear') {
      updateTask(liveTask._id, { dueDate: undefined });
      return;
    }
    const targetDate =
      preset === 'today' ? todayStr : preset === 'tomorrow' ? tomorrowStr : nextWeekStr;
    if (liveTask.dueDate === targetDate) {
      updateTask(liveTask._id, { dueDate: undefined });
    } else {
      updateTask(liveTask._id, { dueDate: targetDate });
    }
  };

  const setRepeatPreset = (frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'none') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (frequency === 'none' || liveTask.repeat?.frequency === frequency) {
      updateTask(liveTask._id, { repeat: undefined });
    } else {
      updateTask(liveTask._id, { repeat: { frequency } });
    }
  };

  const setEnergy = (cost?: TaskEnergyCost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextCost = liveTask.energyCost === cost ? undefined : cost;
    updateTask(liveTask._id, { energyCost: nextCost });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Top Bar with Close button */}
          <View style={styles.topBar}>
            <View style={styles.dragHandle} />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close task"
            >
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Header: Complete Checkbox + Title + Star */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  {
                    borderColor: liveTask.isCompleted ? palette.primary : palette.textSecondary,
                    backgroundColor: liveTask.isCompleted ? palette.primary : 'transparent',
                  },
                ]}
                onPress={() => toggleTaskCompleted(liveTask._id)}
                accessibilityRole="checkbox"
                accessibilityLabel="Complete task"
                accessibilityState={{ checked: liveTask.isCompleted }}
              >
                {liveTask.isCompleted && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: palette.text,
                    textDecorationLine: liveTask.isCompleted ? 'line-through' : 'none',
                  },
                ]}
                value={editedTitle}
                onChangeText={setEditedTitle}
                onBlur={handleSaveTitle}
                onSubmitEditing={handleSaveTitle}
                multiline
              />

              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => toggleTaskImportant(liveTask._id)}
                accessibilityRole="button"
                accessibilityLabel={liveTask.isImportant ? 'Unmark important' : 'Mark important'}
              >
                <Star
                  size={22}
                  color={liveTask.isImportant ? palette.warning : palette.textSecondary}
                  fill={liveTask.isImportant ? palette.warning : 'transparent'}
                />
              </TouchableOpacity>
            </View>

            {/* Checklist Steps Sub-Items */}
            <View style={styles.stepsSection}>
              <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                CHECKLIST STEPS
              </Text>

              {(liveTask.steps || []).map((step) => (
                <View key={step.id} style={styles.stepRow}>
                  <TouchableOpacity
                    style={[
                      styles.stepCheckbox,
                      {
                        borderColor: step.completed ? palette.primary : palette.textSecondary,
                        backgroundColor: step.completed ? palette.primary : 'transparent',
                      },
                    ]}
                    onPress={() => toggleStep(liveTask._id, step.id)}
                  >
                    {step.completed && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.stepTitle,
                      {
                        color: step.completed ? palette.textSecondary : palette.text,
                        textDecorationLine: step.completed ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {step.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteStep(liveTask._id, step.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Inline Add Step Input */}
              <View style={styles.addStepRow}>
                <Plus size={16} color={palette.primaryText} />
                <TextInput
                  style={[styles.addStepInput, { color: palette.text }]}
                  placeholder="Next step..."
                  placeholderTextColor={palette.placeholder}
                  value={newStepText}
                  onChangeText={setNewStepText}
                  onSubmitEditing={handleAddStep}
                  returnKeyType="done"
                />
                {newStepText.trim().length > 0 && (
                  <TouchableOpacity onPress={handleAddStep} style={styles.addStepBtn}>
                    <Text style={styles.addStepText}>
                      Add
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 1: My Day Toggle */}
            <View style={styles.actionCard}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => toggleTaskMyDay(liveTask._id, boundaryHour)}
              >
                <Sun size={20} color={liveTask.inMyDay ? palette.tint : palette.textSecondary} />
                <View style={styles.actionTextCol}>
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: liveTask.inMyDay ? palette.infoText : palette.text },
                    ]}
                  >
                    {liveTask.inMyDay ? 'Added to My Day' : 'Add to My Day'}
                  </Text>
                  <Text style={[styles.actionSub, { color: palette.textSecondary }]}>
                    Resets automatically at 4:00 AM daily
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Action Group 2: Due Date Presets */}
            <View style={styles.actionCard}>
              <View style={styles.actionRow}>
                <Calendar size={20} color={liveTask.dueDate ? palette.primary : palette.textSecondary} />
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionLabel, { color: palette.text }]}>Due Date</Text>
                  <Text style={[styles.actionSub, { color: palette.textSecondary }]}>
                    {liveTask.dueDate || 'No due date set'}
                  </Text>
                </View>
              </View>
              <View style={styles.presetChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, isDueToday && styles.chipActive]}
                  onPress={() => setDueDatePreset('today')}
                >
                  <Text style={[styles.chipText, isDueToday && styles.chipTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isDueTomorrow && styles.chipActive]}
                  onPress={() => setDueDatePreset('tomorrow')}
                >
                  <Text style={[styles.chipText, isDueTomorrow && styles.chipTextActive]}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isDueNextWeek && styles.chipActive]}
                  onPress={() => setDueDatePreset('nextWeek')}
                >
                  <Text style={[styles.chipText, isDueNextWeek && styles.chipTextActive]}>Next Week</Text>
                </TouchableOpacity>
                {liveTask.dueDate && (
                  <TouchableOpacity style={styles.chip} onPress={() => setDueDatePreset('clear')}>
                    <Text style={[styles.chipText, { color: palette.errorText }]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 3: Repeat Presets */}
            <View style={styles.actionCard}>
              <View style={styles.actionRow}>
                <Repeat size={20} color={liveTask.repeat ? palette.primary : palette.textSecondary} />
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionLabel, { color: palette.text }]}>Repeat</Text>
                  <Text style={[styles.actionSub, { color: palette.textSecondary }]}>
                    {liveTask.repeat?.frequency ? `Repeats ${liveTask.repeat.frequency}` : 'Never'}
                  </Text>
                </View>
              </View>
              <View style={styles.presetChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, isDaily && styles.chipActive]}
                  onPress={() => setRepeatPreset('daily')}
                >
                  <Text style={[styles.chipText, isDaily && styles.chipTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isWeekdays && styles.chipActive]}
                  onPress={() => setRepeatPreset('weekdays')}
                >
                  <Text style={[styles.chipText, isWeekdays && styles.chipTextActive]}>Weekdays</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isWeekly && styles.chipActive]}
                  onPress={() => setRepeatPreset('weekly')}
                >
                  <Text style={[styles.chipText, isWeekly && styles.chipTextActive]}>Weekly</Text>
                </TouchableOpacity>
                {liveTask.repeat && (
                  <TouchableOpacity style={styles.chip} onPress={() => setRepeatPreset('none')}>
                    <Text style={[styles.chipText, { color: palette.errorText }]}>None</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 4: Energy Cost & Chronic Flare Deferral */}
            <View style={styles.actionCard}>
              <View style={styles.actionRow}>
                <BatteryCharging size={20} color={palette.success} />
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionLabel, { color: palette.text }]}>
                    Energy & Spoon Pacing
                  </Text>
                  <Text style={[styles.actionSub, { color: palette.textSecondary }]}>
                    Helps prevent PEM and over-exertion
                  </Text>
                </View>
              </View>
              <View style={styles.presetChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, isGentle && styles.chipActiveGentle]}
                  onPress={() => setEnergy('gentle')}
                >
                  <Text style={[styles.chipText, isGentle && styles.chipTextActiveGentle]}>🟢 Gentle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isModerate && styles.chipActiveModerate]}
                  onPress={() => setEnergy('moderate')}
                >
                  <Text style={[styles.chipText, isModerate && styles.chipTextActiveModerate]}>🟡 Moderate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, isDemanding && styles.chipActiveDemanding]}
                  onPress={() => setEnergy('demanding')}
                >
                  <Text style={[styles.chipText, isDemanding && styles.chipTextActiveDemanding]}>🔴 High Energy</Text>
                </TouchableOpacity>
              </View>

              {/* Flare Postpone Button */}
              <TouchableOpacity
                style={styles.flareDeferBtn}
                onPress={handleFlareDeferral}
              >
                <Flame size={16} color={palette.warningText} />
                <Text style={styles.flareDeferText}>Postpone 2 days due to flare</Text>
              </TouchableOpacity>
            </View>

            {/* Action Group 5: Notes */}
            <View style={styles.actionCard}>
              <Text style={[styles.actionLabel, { color: palette.text, marginBottom: 8 }]}>
                Notes
              </Text>
              <TextInput
                style={[styles.notesInput, { color: palette.text }]}
                placeholder="Add notes..."
                placeholderTextColor={palette.placeholder}
                value={editedNotes}
                onChangeText={setEditedNotes}
                onBlur={handleSaveNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Bottom: Created timestamp & Delete Task Button */}
            <View style={styles.footerRow}>
              <Text style={[styles.createdText, { color: palette.textSecondary }]}>
                Created {liveTask.createdAt ? new Date(liveTask.createdAt).toLocaleDateString() : 'recently'}
              </Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteTask}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={18} color={palette.errorText} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const useStyles = createThemedStyles(palette => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    backgroundColor: palette.background,
  },
  topBar: { alignItems: 'center', paddingVertical: 10, position: 'relative' },
  dragHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: palette.border },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  titleInput: { flex: 1, ...typography.title2, padding: 0 },
  starBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
  stepsSection: {
    marginTop: 6,
    marginBottom: 14,
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: { ...typography.sectionLabel, color: palette.textSecondary, marginBottom: 4 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  stepCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepTitle: { flex: 1, ...typography.bodyLarge },
  addStepRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  addStepInput: { flex: 1, ...typography.bodyLarge, marginLeft: 10 },
  addStepBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  addStepText: { ...typography.subheadBold, color: palette.primaryText },
  actionCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionTextCol: { marginLeft: 12, flex: 1 },
  actionLabel: { ...typography.bodyLarge },
  actionSub: { ...typography.footnote, marginTop: 2 },
  presetChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: palette.tint + '26' },
  chipTextActive: { color: palette.primaryText, fontWeight: '700' },
  chipActiveGentle: { backgroundColor: palette.success + '2E' },
  chipTextActiveGentle: { color: palette.successText, fontWeight: '700' },
  chipActiveModerate: { backgroundColor: palette.warning + '2E' },
  chipTextActiveModerate: { color: palette.warningText, fontWeight: '700' },
  chipActiveDemanding: { backgroundColor: palette.error + '2E' },
  chipTextActiveDemanding: { color: palette.errorText, fontWeight: '700' },
  chipText: { ...typography.subhead, color: palette.text },
  flareDeferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.warning + '1F',
  },
  flareDeferText: { ...typography.subheadBold, color: palette.warningText },
  notesInput: { ...typography.bodyLarge, color: palette.text, minHeight: 72, textAlignVertical: 'top' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  createdText: { ...typography.footnote },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 4 },
  deleteText: { ...typography.subheadBold, color: palette.errorText },
}));
