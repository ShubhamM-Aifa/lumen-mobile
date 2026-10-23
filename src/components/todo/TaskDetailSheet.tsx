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
import { useTheme } from '../../theme/ThemeContext';
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
        <View style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Top Bar with Close button */}
          <View style={styles.topBar}>
            <View style={styles.dragHandle} />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                    borderColor: liveTask.isCompleted ? palette.primary : 'rgba(255, 255, 255, 0.4)',
                    backgroundColor: liveTask.isCompleted ? palette.primary : 'transparent',
                  },
                ]}
                onPress={() => toggleTaskCompleted(liveTask._id)}
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
              >
                <Star
                  size={22}
                  color={liveTask.isImportant ? '#F59E0B' : 'rgba(255, 255, 255, 0.3)'}
                  fill={liveTask.isImportant ? '#F59E0B' : 'transparent'}
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
                        borderColor: step.completed ? palette.primary : 'rgba(255, 255, 255, 0.3)',
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
                        color: step.completed ? palette.textDisabled : palette.text,
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
                    <Trash2 size={15} color="rgba(255, 255, 255, 0.3)" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Inline Add Step Input */}
              <View style={styles.addStepRow}>
                <Plus size={16} color={palette.primary} />
                <TextInput
                  style={[styles.addStepInput, { color: palette.text }]}
                  placeholder="Next step..."
                  placeholderTextColor={palette.textDisabled}
                  value={newStepText}
                  onChangeText={setNewStepText}
                  onSubmitEditing={handleAddStep}
                  returnKeyType="done"
                />
                {newStepText.trim().length > 0 && (
                  <TouchableOpacity onPress={handleAddStep} style={styles.addStepBtn}>
                    <Text style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>
                      Add
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 1: My Day Toggle */}
            <View style={[styles.actionCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => toggleTaskMyDay(liveTask._id, boundaryHour)}
              >
                <Sun size={20} color={liveTask.inMyDay ? '#38BDF8' : palette.textSecondary} />
                <View style={styles.actionTextCol}>
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: liveTask.inMyDay ? '#38BDF8' : palette.text },
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
            <View style={[styles.actionCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
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
                    <Text style={[styles.chipText, { color: '#EF4444' }]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 3: Repeat Presets */}
            <View style={[styles.actionCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
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
                    <Text style={[styles.chipText, { color: '#EF4444' }]}>None</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Group 4: Energy Cost & Chronic Flare Deferral */}
            <View style={[styles.actionCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
              <View style={styles.actionRow}>
                <BatteryCharging size={20} color="#10B981" />
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
                <Flame size={16} color="#F97316" />
                <Text style={styles.flareDeferText}>Postpone 2 days due to flare</Text>
              </TouchableOpacity>
            </View>

            {/* Action Group 5: Notes */}
            <View style={[styles.actionCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
              <Text style={[styles.actionLabel, { color: palette.text, marginBottom: 8 }]}>
                Notes
              </Text>
              <TextInput
                style={[styles.notesInput, { color: palette.text }]}
                placeholder="Add notes..."
                placeholderTextColor={palette.textDisabled}
                value={editedNotes}
                onChangeText={setEditedNotes}
                onBlur={handleSaveNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Bottom: Created timestamp & Delete Task Button */}
            <View style={styles.footerRow}>
              <Text style={[styles.createdText, { color: palette.textDisabled }]}>
                Created {liveTask.createdAt ? new Date(liveTask.createdAt).toLocaleDateString() : 'recently'}
              </Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteTask}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  topBar: {
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    top: 10,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  titleInput: {
    flex: 1,
    ...typography.h3,
    fontSize: 18,
    lineHeight: 24,
    padding: 0,
  },
  starBtn: {
    paddingLeft: 12,
    paddingTop: 2,
  },
  stepsSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepTitle: {
    flex: 1,
    fontSize: 14,
  },
  addStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  addStepInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  addStepBtn: {
    paddingHorizontal: 10,
  },
  actionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38BDF8',
  },
  chipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  chipActiveGentle: {
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    borderColor: '#22C55E',
  },
  chipTextActiveGentle: {
    color: '#22C55E',
    fontWeight: '700',
  },
  chipActiveModerate: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: '#F59E0B',
  },
  chipTextActiveModerate: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  chipActiveDemanding: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: '#EF4444',
  },
  chipTextActiveDemanding: {
    color: '#EF4444',
    fontWeight: '700',
  },
  chipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  flareDeferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
  },
  flareDeferText: {
    fontSize: 13,
    color: '#F97316',
    fontWeight: '600',
  },
  notesInput: {
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  createdText: {
    fontSize: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
});

