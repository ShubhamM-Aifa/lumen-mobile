import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TaskItemProps {
  task: ITask;
  onPress: () => void;
  onToggleComplete: () => void;
  onToggleImportant: () => void;
  todayStr?: string;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onPress,
  onToggleComplete,
  onToggleImportant,
  todayStr = new Date().toISOString().slice(0, 10),
}) => {
  const { palette } = useTheme();

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

  const stepsTotal = task.steps?.length || 0;
  const stepsDone = task.steps?.filter((s) => s.completed).length || 0;

  // Energy cost configuration
  const energyConfig = {
    gentle: { label: 'Gentle', bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', dot: '🟢' },
    moderate: { label: 'Moderate', bg: 'rgba(234, 179, 8, 0.15)', text: '#EAB308', dot: '🟡' },
    demanding: { label: 'High Energy', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', dot: '🔴' },
  };

  const currentEnergy = task.energyCost ? energyConfig[task.energyCost] : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: task.isCompleted ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
          opacity: task.isCompleted ? 0.65 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}`}
    >
      {/* Complete Checkbox */}
      <TouchableOpacity
        style={[
          styles.checkbox,
          {
            borderColor: task.isCompleted ? palette.primary : 'rgba(255, 255, 255, 0.35)',
            backgroundColor: task.isCompleted ? palette.primary : 'transparent',
          },
        ]}
        onPress={handleToggleComplete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.isCompleted }}
      >
        {task.isCompleted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </TouchableOpacity>

      {/* Main Content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: task.isCompleted ? palette.textDisabled : palette.text,
              textDecorationLine: task.isCompleted ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {/* Sub-chips Row */}
        <View style={styles.metaRow}>
          {/* Steps Indicator */}
          {stepsTotal > 0 && (
            <View style={styles.metaChip}>
              <CheckSquare size={11} color={palette.textSecondary} />
              <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                {stepsDone}/{stepsTotal}
              </Text>
            </View>
          )}

          {/* My Day Indicator */}
          {task.inMyDay && (
            <View style={styles.metaChip}>
              <Sun size={11} color="#38BDF8" />
              <Text style={[styles.metaText, { color: '#38BDF8' }]}>My Day</Text>
            </View>
          )}

          {/* Due Date Indicator */}
          {task.dueDate && (
            <View style={styles.metaChip}>
              <Calendar
                size={11}
                color={
                  isOverdue ? '#EF4444' : isDueToday ? '#38BDF8' : palette.textSecondary
                }
              />
              <Text
                style={[
                  styles.metaText,
                  {
                    color: isOverdue ? '#EF4444' : isDueToday ? '#38BDF8' : palette.textSecondary,
                    fontWeight: isOverdue || isDueToday ? '600' : '400',
                  },
                ]}
              >
                {isOverdue ? 'Overdue' : isDueToday ? 'Today' : task.dueDate}
              </Text>
            </View>
          )}

          {/* Repeat Badge */}
          {task.repeat && (
            <View style={styles.metaChip}>
              <Repeat size={11} color={palette.textSecondary} />
            </View>
          )}

          {/* Energy Cost Badge */}
          {currentEnergy && (
            <View style={[styles.energyBadge, { backgroundColor: currentEnergy.bg }]}>
              <Text style={[styles.energyText, { color: currentEnergy.text }]}>
                {currentEnergy.dot} {currentEnergy.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Star / Important Toggle */}
      <TouchableOpacity
        style={styles.starButton}
        onPress={handleToggleImportant}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={task.isImportant ? 'Unmark important' : 'Mark important'}
      >
        <Star
          size={18}
          color={task.isImportant ? '#F59E0B' : 'rgba(255, 255, 255, 0.25)'}
          fill={task.isImportant ? '#F59E0B' : 'transparent'}
          strokeWidth={task.isImportant ? 2 : 1.5}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  energyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  energyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  starButton: {
    paddingLeft: 8,
    paddingRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
