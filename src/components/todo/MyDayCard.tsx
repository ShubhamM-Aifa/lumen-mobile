import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Sun, Lightbulb, ChevronRight, Plus, Check } from 'lucide-react-native';
import { useTaskStore } from '../../store/taskStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { TaskDetailSheet } from './TaskDetailSheet';
import { SuggestionsModal } from './SuggestionsModal';
import { TaskItem } from './TaskItem';
import { ITask } from '../../shared/types';
import { getTrackingDayDateString } from '../../utils/dayBoundary';

interface MyDayCardProps {
  boundaryHour?: number;
}

export const MyDayCard: React.FC<MyDayCardProps> = ({ boundaryHour = 4 }) => {
  const { palette } = useTheme();
  const {
    tasks,
    addTask,
    toggleTaskCompleted,
    toggleTaskImportant,
    pruneDayBoundary,
  } = useTaskStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  React.useEffect(() => {
    pruneDayBoundary(boundaryHour);
  }, [boundaryHour, pruneDayBoundary]);

  const todayStr = getTrackingDayDateString(new Date(), boundaryHour);

  // Filter tasks in My Day
  const myDayTasks = tasks.filter((t) => t.inMyDay);
  const completedCount = myDayTasks.filter((t) => t.isCompleted).length;
  const totalCount = myDayTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Show up to 3 tasks in preview
  const previewTasks = myDayTasks.slice(0, 3);
  const remainingCount = totalCount - previewTasks.length;

  const handleQuickAdd = () => {
    if (!newTaskTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addTask(
      {
        title: newTaskTitle.trim(),
        inMyDay: true,
      },
      boundaryHour
    );
    setNewTaskTitle('');
  };

  const handleOpenHub = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/todo');
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: 'rgba(56, 189, 248, 0.25)' }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.titleArea} onPress={handleOpenHub} activeOpacity={0.7}>
          <View style={styles.sunIconWell}>
            <Sun size={18} color="#38BDF8" strokeWidth={2.4} />
          </View>
          <View>
            <View style={styles.titleBadgeRow}>
              <Text style={[styles.title, { color: palette.text }]}>My Day</Text>
              <View style={styles.toDoTag}>
                <Text style={styles.toDoTagText}>To Do</Text>
              </View>
            </View>
            <Text style={[styles.dateSubtitle, { color: palette.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.lightbulbBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSuggestionsOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="View task suggestions"
          >
            <Lightbulb size={18} color="#FBBF24" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.openHubBtn}
            onPress={handleOpenHub}
            accessibilityRole="button"
            accessibilityLabel="Open To Do Hub"
          >
            <ChevronRight size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Bar (if tasks exist) */}
      {totalCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressText, { color: palette.textSecondary }]}>
              {completedCount} of {totalCount} completed
            </Text>
            <Text style={[styles.progressPercent, { color: '#38BDF8' }]}>
              {progressPercent}%
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {/* Tasks Preview List */}
      <View style={styles.taskListArea}>
        {previewTasks.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyPlaceholder}
            onPress={() => setSuggestionsOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Start with a clean slate today. Tap to view suggestions ✨
            </Text>
          </TouchableOpacity>
        ) : (
          previewTasks.map((task) => (
            <TaskItem
              key={task._id}
              task={task}
              todayStr={todayStr}
              onPress={() => setSelectedTask(task)}
              onToggleComplete={() => toggleTaskCompleted(task._id)}
              onToggleImportant={() => toggleTaskImportant(task._id)}
            />
          ))
        )}
      </View>

      {/* Remaining Tasks Count */}
      {remainingCount > 0 && (
        <TouchableOpacity style={styles.moreTasksRow} onPress={handleOpenHub}>
          <Text style={[styles.moreTasksText, { color: palette.primary }]}>
            +{remainingCount} more in My Day
          </Text>
          <ChevronRight size={14} color={palette.primary} />
        </TouchableOpacity>
      )}

      {/* Quick Add Input Bar */}
      <View style={[styles.quickAddBar, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
        <Plus size={18} color={palette.primary} />
        <TextInput
          style={[styles.quickAddInput, { color: palette.text }]}
          placeholder="Add a task to My Day..."
          placeholderTextColor={palette.textDisabled}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
        />
        {newTaskTitle.trim().length > 0 && (
          <TouchableOpacity style={styles.addSubmitBtn} onPress={handleQuickAdd}>
            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {/* Detail Sheet Modal */}
      <TaskDetailSheet
        task={selectedTask}
        visible={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        boundaryHour={boundaryHour}
      />

      {/* Suggestions Modal */}
      <SuggestionsModal
        visible={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        boundaryHour={boundaryHour}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sunIconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
  },
  toDoTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  toDoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  dateSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lightbulbBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openHubBtn: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  taskListArea: {
    marginBottom: 8,
  },
  emptyPlaceholder: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    marginVertical: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  moreTasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginBottom: 6,
  },
  moreTasksText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  quickAddInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
  },
  addSubmitBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
