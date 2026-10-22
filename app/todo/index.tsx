import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { TaskItem } from '../../src/components/todo/TaskItem';
import { TaskDetailSheet } from '../../src/components/todo/TaskDetailSheet';
import { SuggestionsModal } from '../../src/components/todo/SuggestionsModal';
import { ITask, TaskEnergyCost } from '../../src/shared/types';
import { getTrackingDayDateString } from '../../src/utils/dayBoundary';

export default function TodoHubScreen() {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;

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
    fetchTasks();
    fetchLists();
    pruneDayBoundary(boundaryHour);
  }, [fetchTasks, fetchLists, pruneDayBoundary, boundaryHour]);

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

  const ActiveIcon = filterMeta.icon;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Bar */}
        <View style={[styles.topBar, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.topBarTitleArea}>
            <Text style={[styles.screenTitle, { color: palette.text }]}>To Do</Text>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSearching(!isSearching);
              }}
              accessibilityRole="button"
              accessibilityLabel="Search tasks"
            >
              <Search size={20} color={isSearching ? palette.primary : palette.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconBtn, styles.lightbulbBtn]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSuggestionsOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Intelligent suggestions"
            >
              <Lightbulb size={20} color="#FBBF24" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar (Collapsible) */}
        {isSearching && (
          <View style={[styles.searchBar, { backgroundColor: palette.surface }]}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              placeholder="Search all tasks and notes..."
              placeholderTextColor={palette.textDisabled}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Smart Lists Carousel Selector */}
        <View style={styles.filterCarouselWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterCarousel}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'my-day' && { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38BDF8' },
              ]}
              onPress={() => setActiveFilter('my-day')}
            >
              <Sun size={14} color="#38BDF8" />
              <Text style={[styles.filterChipText, activeFilter === 'my-day' && { color: '#38BDF8', fontWeight: '700' }]}>
                My Day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'important' && { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
              ]}
              onPress={() => setActiveFilter('important')}
            >
              <Star size={14} color="#F59E0B" fill={activeFilter === 'important' ? '#F59E0B' : 'transparent'} />
              <Text style={[styles.filterChipText, activeFilter === 'important' && { color: '#F59E0B', fontWeight: '700' }]}>
                Important
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'planned' && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
              ]}
              onPress={() => setActiveFilter('planned')}
            >
              <Calendar size={14} color="#10B981" />
              <Text style={[styles.filterChipText, activeFilter === 'planned' && { color: '#10B981', fontWeight: '700' }]}>
                Planned
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'all' && { backgroundColor: 'rgba(129, 140, 248, 0.2)', borderColor: '#818CF8' },
              ]}
              onPress={() => setActiveFilter('all')}
            >
              <ListTodo size={14} color="#818CF8" />
              <Text style={[styles.filterChipText, activeFilter === 'all' && { color: '#818CF8', fontWeight: '700' }]}>
                All Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'energy-gentle' && { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22C55E' },
              ]}
              onPress={() => setActiveFilter('energy-gentle')}
            >
              <Text style={{ fontSize: 12 }}>🟢</Text>
              <Text style={[styles.filterChipText, activeFilter === 'energy-gentle' && { color: '#22C55E', fontWeight: '700' }]}>
                Gentle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'completed' && { backgroundColor: 'rgba(148, 163, 184, 0.2)', borderColor: '#94A3B8' },
              ]}
              onPress={() => setActiveFilter('completed')}
            >
              <CheckCircle2 size={14} color="#94A3B8" />
              <Text style={[styles.filterChipText, activeFilter === 'completed' && { color: '#94A3B8', fontWeight: '700' }]}>
                Completed
              </Text>
            </TouchableOpacity>

            {/* Custom Lists */}
            {lists.map((l) => (
              <TouchableOpacity
                key={l._id}
                style={[
                  styles.filterChip,
                  activeFilter === l._id && { backgroundColor: `${l.color}33`, borderColor: l.color },
                ]}
                onPress={() => setActiveFilter(l._id)}
              >
                <Text style={{ fontSize: 13 }}>{l.icon || '📋'}</Text>
                <Text style={[styles.filterChipText, activeFilter === l._id && { color: l.color, fontWeight: '700' }]}>
                  {l.name}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.filterChip, styles.addListChip]}
              onPress={() => setIsCreatingList(true)}
            >
              <Plus size={13} color={palette.textSecondary} />
              <Text style={[styles.filterChipText, { color: palette.textSecondary }]}>New List</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Modal / Prompt for Creating Custom List */}
        {isCreatingList && (
          <View style={[styles.createListBanner, { backgroundColor: palette.surface }]}>
            <TextInput
              style={[styles.createListInput, { color: palette.text }]}
              placeholder="List name (e.g. Physical Therapy, Work)..."
              placeholderTextColor={palette.textDisabled}
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
            <TouchableOpacity style={styles.createListConfirm} onPress={handleCreateList}>
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.createListCancel} onPress={() => setIsCreatingList(false)}>
              <X size={16} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Active List Banner */}
        <View style={styles.listBanner}>
          <View style={[styles.listBannerIcon, { backgroundColor: `${filterMeta.color}22` }]}>
            <ActiveIcon size={20} color={filterMeta.color} />
          </View>
          <View style={styles.listBannerText}>
            <Text style={[styles.listBannerTitle, { color: palette.text }]}>{filterMeta.title}</Text>
            <Text style={[styles.listBannerSub, { color: palette.textSecondary }]}>
              {uncompletedTasks.length} active • {filterMeta.sub}
            </Text>
          </View>
        </View>

        {/* Tasks List */}
        <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
          {uncompletedTasks.length === 0 && completedTasks.length === 0 ? (
            <View style={styles.emptyTasksBox}>
              <Text style={{ fontSize: 36 }}>📋</Text>
              <Text style={[styles.emptyTasksTitle, { color: palette.text }]}>No tasks here yet</Text>
              <Text style={[styles.emptyTasksSub, { color: palette.textSecondary }]}>
                Add a task below or check Suggestions to plan your day.
              </Text>
            </View>
          ) : (
            <>
              {/* Uncompleted Tasks */}
              {uncompletedTasks.map((task) => (
                <TaskItem
                  key={task._id}
                  task={task}
                  todayStr={todayStr}
                  onPress={() => setSelectedTask(task)}
                  onToggleComplete={() => toggleTaskCompleted(task._id)}
                  onToggleImportant={() => toggleTaskImportant(task._id)}
                />
              ))}

              {/* Completed Tasks Accordion */}
              {completedTasks.length > 0 && activeFilter !== 'completed' && (
                <View style={styles.completedSection}>
                  <TouchableOpacity
                    style={styles.completedHeader}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCompletedExpanded(!completedExpanded);
                    }}
                  >
                    {completedExpanded ? (
                      <ChevronDown size={16} color={palette.textSecondary} />
                    ) : (
                      <ChevronRight size={16} color={palette.textSecondary} />
                    )}
                    <Text style={[styles.completedHeaderText, { color: palette.textSecondary }]}>
                      Completed ({completedTasks.length})
                    </Text>
                  </TouchableOpacity>

                  {completedExpanded &&
                    completedTasks.map((task) => (
                      <TaskItem
                        key={task._id}
                        task={task}
                        todayStr={todayStr}
                        onPress={() => setSelectedTask(task)}
                        onToggleComplete={() => toggleTaskCompleted(task._id)}
                        onToggleImportant={() => toggleTaskImportant(task._id)}
                      />
                    ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Sticky Task Creation Bar */}
        <View style={[styles.stickyBottomBar, { backgroundColor: palette.surface, borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
          {/* Quick Tag Options Row (Energy & Star) */}
          <View style={styles.quickTagsRow}>
            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskImportant && styles.quickTagBtnActiveStar]}
              onPress={() => setNewTaskImportant(!newTaskImportant)}
            >
              <Star
                size={13}
                color={newTaskImportant ? '#F59E0B' : palette.textSecondary}
                fill={newTaskImportant ? '#F59E0B' : 'transparent'}
              />
              <Text style={[styles.quickTagText, { color: newTaskImportant ? '#F59E0B' : palette.textSecondary }]}>
                Important
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskEnergy === 'gentle' && styles.quickTagBtnActiveGentle]}
              onPress={() => setNewTaskEnergy(newTaskEnergy === 'gentle' ? undefined : 'gentle')}
            >
              <Text style={{ fontSize: 11 }}>🟢 Gentle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickTagBtn, newTaskEnergy === 'moderate' && styles.quickTagBtnActiveModerate]}
              onPress={() => setNewTaskEnergy(newTaskEnergy === 'moderate' ? undefined : 'moderate')}
            >
              <Text style={{ fontSize: 11 }}>🟡 Moderate</Text>
            </TouchableOpacity>
          </View>

          {/* Main Input Row */}
          <View style={styles.inputRow}>
            <Plus size={20} color={palette.primary} />
            <TextInput
              style={[styles.mainInput, { color: palette.text }]}
              placeholder={`Add a task to ${filterMeta.title}...`}
              placeholderTextColor={palette.textDisabled}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={handleQuickAdd}
              returnKeyType="done"
            />
            {newTaskTitle.trim().length > 0 && (
              <TouchableOpacity style={styles.submitBtn} onPress={handleQuickAdd}>
                <Check size={18} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            )}
          </View>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightbulbBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterCarouselWrapper: {
    paddingVertical: 10,
  },
  filterCarousel: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  addListChip: {
    borderStyle: 'dashed',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  createListBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 8,
  },
  createListInput: {
    flex: 1,
    fontSize: 14,
  },
  createListConfirm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createListCancel: {
    padding: 4,
  },
  listBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 12,
  },
  listBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBannerText: {
    flex: 1,
  },
  listBannerTitle: {
    ...typography.h3,
    fontSize: 20,
  },
  listBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  taskList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyTasksBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTasksTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyTasksSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
  completedSection: {
    marginTop: 16,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 6,
  },
  completedHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stickyBottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
  },
  quickTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickTagBtnActiveStar: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  quickTagBtnActiveGentle: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  quickTagBtnActiveModerate: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  quickTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  submitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
