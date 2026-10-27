import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Check,
  Star,
  Sun,
  Calendar,
  Repeat,
  CheckSquare,
} from 'lucide-react-native';
import { ITask } from '../../shared/types';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TaskItemProps {
  task: ITask;
  onPress: () => void;
  onToggleComplete: () => void;
  onToggleImportant: () => void;
  todayStr?: string;
}

/**
 * One task row. Rows sit inside a rounded group card (see the To Do screen),
 * so the row draws no surface or border of its own.
 */
export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onPress,
  onToggleComplete,
  onToggleImportant,
  todayStr = new Date().toISOString().slice(0, 10),
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const handleToggleComplete = () => {
    Haptics.impactAsync(
      task.isCompleted
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium
    );
    onToggleComplete();
  };

  const handleToggleImportant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleImportant();
  };

  // Due date styling
  const isOverdue = task.dueDate && task.dueDate < todayStr && !task.isCompleted;
  const isDueToday = task.dueDate === todayStr;
  const dueColor = isOverdue ? palette.errorText : isDueToday ? palette.infoText : palette.textSecondary;

  const stepsTotal = task.steps?.length || 0;
  const stepsDone = task.steps?.filter((s) => s.completed).length || 0;

  const energyConfig = {
    gentle: { label: 'Gentle', bg: palette.success + '26', text: palette.successText, dot: '🟢' },
    moderate: { label: 'Moderate', bg: palette.warning + '26', text: palette.warningText, dot: '🟡' },
    demanding: { label: 'High Energy', bg: palette.error + '26', text: palette.errorText, dot: '🔴' },
  };
  const currentEnergy = task.energyCost ? energyConfig[task.energyCost] : null;

  return (
    <TouchableOpacity
      style={[styles.row, task.isCompleted && styles.rowDone]}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}`}
    >
      <TouchableOpacity
        style={[
          styles.checkbox,
          task.isCompleted && { borderColor: palette.primary, backgroundColor: palette.primary },
        ]}
        onPress={handleToggleComplete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="checkbox"
        accessibilityLabel={`Complete ${task.title}`}
        accessibilityState={{ checked: task.isCompleted }}
      >
        {task.isCompleted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text
          style={[styles.title, task.isCompleted && styles.titleDone]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.4}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          {stepsTotal > 0 && (
            <View style={styles.metaChip}>
              <CheckSquare size={12} color={palette.textSecondary} />
              <Text style={styles.metaText} maxFontSizeMultiplier={1.4}>{stepsDone}/{stepsTotal}</Text>
            </View>
          )}

          {task.inMyDay && (
            <View style={styles.metaChip}>
              <Sun size={12} color={palette.infoText} />
              <Text style={[styles.metaText, { color: palette.infoText }]} maxFontSizeMultiplier={1.4}>My Day</Text>
            </View>
          )}

          {task.dueDate && (
            <View style={styles.metaChip}>
              <Calendar size={12} color={dueColor} />
              <Text
                style={[styles.metaText, { color: dueColor, fontWeight: isOverdue || isDueToday ? '600' : '400' }]}
                maxFontSizeMultiplier={1.4}
              >
                {isOverdue ? 'Overdue' : isDueToday ? 'Today' : task.dueDate}
              </Text>
            </View>
          )}

          {task.repeat && (
            <View style={styles.metaChip}>
              <Repeat size={12} color={palette.textSecondary} />
            </View>
          )}

          {currentEnergy && (
            <View style={[styles.energyBadge, { backgroundColor: currentEnergy.bg }]}>
              <Text style={[styles.energyText, { color: currentEnergy.text }]} maxFontSizeMultiplier={1.4}>
                {currentEnergy.dot} {currentEnergy.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.starButton}
        onPress={handleToggleImportant}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={task.isImportant ? 'Unmark important' : 'Mark important'}
      >
        <Star
          size={20}
          color={task.isImportant ? palette.warning : palette.textSecondary}
          fill={task.isImportant ? palette.warning : 'transparent'}
          strokeWidth={task.isImportant ? 2 : 1.6}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const useStyles = createThemedStyles(palette => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowDone: { opacity: 0.7 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: { flex: 1, gap: 3 },
  title: { ...typography.bodyLarge, color: palette.text },
  titleDone: { color: palette.textSecondary, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.footnote, color: palette.textSecondary },
  energyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  energyText: { ...typography.footnote, fontWeight: '600' },
  starButton: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingTop: 1 },
}));
