import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Sun,
  Star,
  Calendar,
  CheckCircle2,
  ListTodo,
  Lightbulb,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  BatteryCharging,
  FolderPlus,
  X,
  Check,
} from 'lucide-react-native';
import { useTaskStore, TaskFilterType } from '../../src/store/taskStore';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { TaskItem } from '../../src/components/todo/TaskItem';
import { TaskDetailSheet } from '../../src/components/todo/TaskDetailSheet';
import { SuggestionsModal } from '../../src/components/todo/SuggestionsModal';
import { ITask, TaskEnergyCost } from '../../src/shared/types';
import { getTrackingDayDateString } from '../../src/utils/dayBoundary';
import { useKeyboard } from '../../src/hooks/useKeyboard';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { FilterChip } from '../../src/components/ios/FilterChip';

export default function TodoHubScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const { user } = useAuthStore();
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const { isKeyboardVisible } = useKeyboard();

  const {
    tasks,
    lists,
    activeFilter,
    fetchTasks,
    fetchLists,
    pruneDayBoundary,
    setActiveFilter,
    addTask,
    toggleTaskCompleted,
    toggleTaskImportant,
    createList,
  } = useTaskStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);

  const activeSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find((t) => t._id === selectedTask._id) || selectedTask;
  }, [selectedTask, tasks]);

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // New task quick add input
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEnergy, setNewTaskEnergy] = useState<TaskEnergyCost | undefined>(undefined);
  const [newTaskImportant, setNewTaskImportant] = useState(false);

  // New custom list prompt
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    fetchTasks(boundaryHour);
    fetchLists();
    pruneDayBoundary(boundaryHour);
  }, [fetchTasks, fetchLists, pruneDayBoundary, boundaryHour]);

  useEffect(() => {
    if (listId) {
      setActiveFilter(listId);
    }
  }, [listId, setActiveFilter]);

  const todayStr = getTrackingDayDateString(new Date(), boundaryHour);

  // Filter tasks based on activeFilter & search
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
      return result;
    }

    // Smart list filtering
    switch (activeFilter) {
      case 'my-day':
        result = result.filter((t) => t.inMyDay);
        break;
      case 'important':
        result = result.filter((t) => t.isImportant);
        break;
      case 'planned':
        result = result.filter((t) => !!t.dueDate);
        break;
      case 'completed':
        result = result.filter((t) => t.isCompleted);
        break;
      case 'energy-gentle':
        result = result.filter((t) => t.energyCost === 'gentle');
        break;
      case 'energy-moderate':
        result = result.filter((t) => t.energyCost === 'moderate');
        break;
      case 'energy-demanding':
        result = result.filter((t) => t.energyCost === 'demanding');
        break;
      case 'all':
        // all tasks
        break;
      default:
        // custom listId
        result = result.filter((t) => t.listId === activeFilter);
        break;
    }

    return result;
  }, [tasks, activeFilter, searchQuery]);

  const uncompletedTasks = filteredTasks.filter((t) => !t.isCompleted);
  const completedTasks = filteredTasks.filter((t) => t.isCompleted);

  const handleQuickAdd = () => {
    if (!newTaskTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isMyDay = activeFilter === 'my-day';
    const isImportant = newTaskImportant || activeFilter === 'important';
    const energy = newTaskEnergy || (activeFilter.startsWith('energy-') ? (activeFilter.replace('energy-', '') as TaskEnergyCost) : undefined);
    const listId = !['my-day', 'important', 'planned', 'all', 'completed', 'energy-gentle', 'energy-moderate', 'energy-demanding'].includes(activeFilter)
      ? activeFilter
      : undefined;

    addTask(
      {
        title: newTaskTitle.trim(),
        inMyDay: isMyDay,
        isImportant,
        energyCost: energy,
        listId,
        dueDate: activeFilter === 'planned' ? todayStr : undefined,
      },
      boundaryHour
    );

    setNewTaskTitle('');
    setNewTaskEnergy(undefined);
    setNewTaskImportant(false);
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createList(newListName.trim());
    setNewListName('');
    setIsCreatingList(false);
  };

  // Active filter title metadata
  const filterMeta = useMemo(() => {
    switch (activeFilter) {
      case 'my-day':
        return { title: 'My Day', icon: Sun, color: '#38BDF8', sub: 'Today’s clean focus slate' };
      case 'important':
        return { title: 'Important', icon: Star, color: '#F59E0B', sub: 'High priority starred items' };
      case 'planned':
        return { title: 'Planned', icon: Calendar, color: '#10B981', sub: 'Tasks scheduled with due dates' };
      case 'all':
        return { title: 'All Tasks', icon: ListTodo, color: '#818CF8', sub: 'Comprehensive task backlog' };
      case 'energy-gentle':
        return { title: 'Gentle Pacing', icon: BatteryCharging, color: '#22C55E', sub: 'Low spoon cost recovery tasks' };
      case 'energy-moderate':
        return { title: 'Moderate Pacing', icon: BatteryCharging, color: '#EAB308', sub: 'Balanced daily activity' };
      case 'energy-demanding':
        return { title: 'High Energy', icon: BatteryCharging, color: '#EF4444', sub: 'Demanding tasks, pace carefully' };
      case 'completed':
        return { title: 'Completed', icon: CheckCircle2, color: '#94A3B8', sub: 'Accomplished milestones' };
      default: {
        const found = lists.find((l) => l._id === activeFilter);
        return {
          title: found?.name || 'Custom List',
          icon: ListTodo,
          color: found?.color || '#38BDF8',
          sub: 'Personalized task collection',
        };
      }
    }
  }, [activeFilter, lists]);

  const smartChips: Array<{ key: string; label: string; icon: typeof Sun; color: string }> = [
    { key: 'my-day', label: 'My Day', icon: Sun, color: palette.tint },
    { key: 'important', label: 'Important', icon: Star, color: palette.warning },
    { key: 'planned', label: 'Planned', icon: Calendar, color: palette.success },
    { key: 'all', label: 'All Tasks', icon: ListTodo, color: '#5856D6' },
    { key: 'energy-gentle', label: 'Gentle Pacing', icon: BatteryCharging, color: palette.success },
    { key: 'energy-moderate', label: 'Moderate Pacing', icon: BatteryCharging, color: palette.accent },
    { key: 'energy-demanding', label: 'High Energy', icon: BatteryCharging, color: palette.error },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: '#8E8E93' },
  ];

  const renderRows = (list: ITask[]) =>
    list.map((task, i) => (
      <View key={task._id} style={i < list.length - 1 ? styles.separated : undefined}>
        <TaskItem
          task={task}
          todayStr={todayStr}
          onPress={() => setSelectedTask(task)}
          onToggleComplete={() => toggleTaskCompleted(task._id)}
          onToggleImportant={() => toggleTaskImportant(task._id)}
        />
      </View>
    ));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.taskList}
          contentContainerStyle={styles.taskListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <LargeTitleHeader
            title={filterMeta.title}
            titleColor={palette.primaryText}
            subtitle={`${uncompletedTasks.length} active · ${filterMeta.sub}`}
            leading={
              <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/(tabs)/today')}>
                <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            }
            actions={
              <>
                <GlassCircleButton
                  accessibilityLabel="Search tasks"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsSearching(!isSearching);
                  }}
                >
                  <Search size={20} color={isSearching ? palette.tint : palette.text} strokeWidth={2.2} />
                </GlassCircleButton>
                <GlassCircleButton
                  accessibilityLabel="Intelligent suggestions"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSuggestionsOpen(true);
                  }}
                >
                  <Lightbulb size={20} color={palette.text} strokeWidth={2.2} />
                </GlassCircleButton>
              </>
            }
          />

          {isSearching && (
            <View style={styles.searchBar}>
              <Search size={16} color={palette.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search all tasks and notes..."
                placeholderTextColor={palette.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                accessibilityLabel="Search tasks"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Smart lists and custom lists */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterCarousel}
            keyboardShouldPersistTaps="handled"
          >
            {smartChips.map(c => {
              const Icon = c.icon;
              return (
                <FilterChip
                  key={c.key}
                  label={c.label}
                  selected={activeFilter === c.key}
                  onPress={() => setActiveFilter(c.key)}
                  icon={<Icon size={16} color={activeFilter === c.key ? palette.background : c.color} strokeWidth={2.2} />}
                />
              );
            })}
            {lists.map((l) => (
              <FilterChip
                key={l._id}
                label={l.name}
                selected={activeFilter === l._id}
                onPress={() => setActiveFilter(l._id)}
                icon={<Text style={styles.chipEmoji}>{l.icon || '📋'}</Text>}
              />
            ))}
            <FilterChip
              label="New List"
              onPress={() => setIsCreatingList(true)}
              icon={<Plus size={16} color={palette.textSecondary} strokeWidth={2.4} />}
            />
          </ScrollView>

          {isCreatingList && (
            <View style={styles.createListBanner}>
              <TextInput
                style={styles.createListInput}
                placeholder="List name (e.g. Physical Therapy, Work)..."
                placeholderTextColor={palette.placeholder}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
                accessibilityLabel="New list name"
              />
              <TouchableOpacity style={styles.createListConfirm} onPress={handleCreateList} accessibilityRole="button" accessibilityLabel="Create list">
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.createListCancel} onPress={() => setIsCreatingList(false)} accessibilityRole="button" accessibilityLabel="Cancel new list">
                <X size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {uncompletedTasks.length === 0 && completedTasks.length === 0 ? (
            <View style={styles.emptyTasksBox}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTasksTitle}>No tasks here yet</Text>
              <Text style={styles.emptyTasksSub}>
                Add a task below or check Suggestions to plan your day.
              </Text>
            </View>
          ) : (
            <>
              {uncompletedTasks.length > 0 && (
                <View style={styles.card}>{renderRows(uncompletedTasks)}</View>
              )}

              {completedTasks.length > 0 && activeFilter !== 'completed' && (
                <View style={styles.completedSection}>
                  <TouchableOpacity
                    style={styles.completedHeader}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCompletedExpanded(!completedExpanded);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: completedExpanded }}
                  >
                    {completedExpanded ? (
                      <ChevronDown size={16} color={palette.textSecondary} />
                    ) : (
                      <ChevronRight size={16} color={palette.textSecondary} />
                    )}
                    <Text style={styles.completedHeaderText}>Completed ({completedTasks.length})</Text>
                  </TouchableOpacity>

                  {completedExpanded && <View style={styles.card}>{renderRows(completedTasks)}</View>}
                </View>
              )}

              {activeFilter === 'completed' && completedTasks.length > 0 && uncompletedTasks.length === 0 && (
                <View style={styles.card}>{renderRows(completedTasks)}</View>
              )}
            </>
          )}
        </ScrollView>

        {/* Floating task composer */}
        <View
          style={[
            styles.composer,
            {
              marginBottom: isKeyboardVisible
                ? 8
                : (Platform.OS === 'android' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12)) + 6,
            },
          ]}
        >
          <View style={styles.quickTagsRow}>
            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskImportant && { backgroundColor: palette.warning + '33' }]}
              onPress={() => setNewTaskImportant(!newTaskImportant)}
              accessibilityRole="button"
              accessibilityState={{ selected: newTaskImportant }}
              accessibilityLabel="Mark new task important"
            >
              <Star
                size={14}
                color={newTaskImportant ? palette.warningText : palette.textSecondary}
                fill={newTaskImportant ? palette.warning : 'transparent'}
              />
              <Text style={[styles.quickTagText, newTaskImportant && { color: palette.warningText }]} maxFontSizeMultiplier={1.3}>Important</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskEnergy === 'gentle' && { backgroundColor: palette.success + '33' }]}
              onPress={() => setNewTaskEnergy(newTaskEnergy === 'gentle' ? undefined : 'gentle')}
              accessibilityRole="button"
              accessibilityState={{ selected: newTaskEnergy === 'gentle' }}
              accessibilityLabel="Gentle energy cost"
            >
              <Text style={styles.quickTagText} maxFontSizeMultiplier={1.3}>🟢 Gentle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskEnergy === 'moderate' && { backgroundColor: palette.warning + '33' }]}
              onPress={() => setNewTaskEnergy(newTaskEnergy === 'moderate' ? undefined : 'moderate')}
              accessibilityRole="button"
              accessibilityState={{ selected: newTaskEnergy === 'moderate' }}
              accessibilityLabel="Moderate energy cost"
            >
              <Text style={styles.quickTagText} maxFontSizeMultiplier={1.3}>🟡 Moderate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.plusDisc}>
              <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <TextInput
              style={styles.mainInput}
              placeholder={`New task in ${filterMeta.title}...`}
              placeholderTextColor={palette.placeholder}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={handleQuickAdd}
              returnKeyType="done"
              accessibilityLabel="New task title"
            />
            {newTaskTitle.trim().length > 0 && (
              <TouchableOpacity style={styles.submitBtn} onPress={handleQuickAdd} accessibilityRole="button" accessibilityLabel="Add task">
                <Check size={18} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TaskDetailSheet
          task={activeSelectedTask}
          visible={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          boundaryHour={boundaryHour}
        />

        <SuggestionsModal
          visible={suggestionsOpen}
          onClose={() => setSuggestionsOpen(false)}
          boundaryHour={boundaryHour}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  keyboardContainer: { flex: 1 },
  taskList: { flex: 1 },
  taskListContent: { gap: 16, paddingBottom: 24, paddingTop: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    gap: 8,
    backgroundColor: palette.surface,
  },
  searchInput: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  filterCarousel: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  chipEmoji: { fontSize: 14 },
  createListBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 48,
    borderRadius: 24,
    gap: 8,
    backgroundColor: palette.surface,
  },
  createListInput: { flex: 1, ...typography.bodyLarge, color: palette.text },
  createListConfirm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createListCancel: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden' },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  emptyTasksBox: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyEmoji: { fontSize: 40 },
  emptyTasksTitle: { ...typography.title2, color: palette.text, marginTop: 6 },
  emptyTasksSub: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  completedSection: { gap: 7 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 20 },
  completedHeaderText: { ...typography.subheadBold, color: palette.textSecondary },
  composer: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 26,
    gap: 8,
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  quickTagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
  },
  quickTagText: { ...typography.footnote, fontWeight: '500', color: palette.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  plusDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInput: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  submitBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
