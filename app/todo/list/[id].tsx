import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, ArrowUpDown, MoreHorizontal, Lightbulb, X, ChevronDown, ChevronRight,
  CheckSquare, Eye, EyeOff, Zap, Tag, SlidersHorizontal, FolderInput, Inbox, Sparkles,
} from 'lucide-react-native';
import { useAskLumenAi } from '../../../src/hooks/useAskLumenAi';
import * as Haptics from 'expo-haptics';
import { safeGoBack } from '../../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { LargeTitleHeader } from '../../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../../src/components/ios/GlassCircleButton';
import { useTaskStore } from '../../../src/store/taskStore';
import { useTodoPrefs, resolveViewPrefs } from '../../../src/store/todoPrefsStore';
import { useBoundaryHour, useTodayStr, useTodoBootstrap } from '../../../src/hooks/useTodo';
import { useKeyboard } from '../../../src/hooks/useKeyboard';
import {
  filterForView, applyListFilters, sortTasks, groupPlanned, isSmartView, SortField,
} from '../../../src/utils/todo/views';
import { formatLongDate } from '../../../src/utils/todo/dates';
import { confirmAction } from '../../../src/utils/todo/confirm';
import { getSmartList, listTextColor, smartListTextColor } from '../../../src/components/todo/listTheme';
import { TaskRow } from '../../../src/components/todo/TaskRow';
import { SwipeableTaskRow } from '../../../src/components/todo/SwipeableTaskRow';
import { ReorderableTaskList, ROW_GAP } from '../../../src/components/todo/ReorderableTaskList';
import { AddTaskBar, TaskDraft } from '../../../src/components/todo/AddTaskBar';
import { SelectionBar } from '../../../src/components/todo/SelectionBar';
import { TodoUndoToast } from '../../../src/components/todo/TodoUndoToast';
import { OptionsSheet, SheetOption } from '../../../src/components/todo/OptionsSheet';
import { ListActions } from '../../../src/components/todo/ListActions';
import { SuggestionsModal } from '../../../src/components/todo/SuggestionsModal';
import { ITask, ITaskList, TaskEnergyCost } from '../../../src/shared/types';

const SORTS: Array<{ field: SortField; label: string }> = [
  { field: 'importance', label: 'Importance' },
  { field: 'dueDate', label: 'Due date' },
  { field: 'myDay', label: 'Added to My Day' },
  { field: 'alpha', label: 'Alphabetically' },
  { field: 'created', label: 'Creation date' },
  { field: 'custom', label: 'Custom order (drag to reorder)' },
];

const EMPTY: Record<string, { title: string; body: string }> = {
  'my-day': { title: 'Focus on your day', body: 'Get things done with My Day, a list that refreshes every day. Tap the lightbulb for ideas.' },
  important: { title: 'Try starring some tasks', body: 'Star a task and it will show up here.' },
  planned: { title: 'Plan ahead', body: 'Tasks with a due date appear here, grouped by when they are due.' },
  all: { title: 'Nothing here yet', body: 'Every task from every list appears here.' },
  completed: { title: 'Nothing completed yet', body: 'Finished tasks will be listed here.' },
  tasks: { title: 'Your inbox is clear', body: 'Tasks without a list land here.' },
};

export default function TodoListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewId = id ?? 'my-day';
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const styles = useStyles();
  const todayStr = useTodayStr();
  const boundaryHour = useBoundaryHour();
  const { isKeyboardVisible } = useKeyboard();
  useTodoBootstrap();
  const { ask } = useAskLumenAi();

  const tasks = useTaskStore((s) => s.tasks);
  const lists = useTaskStore((s) => s.lists);
  const categories = useTaskStore((s) => s.categories);
  const prefViews = useTodoPrefs((s) => s.views);
  const settings = useTodoPrefs((s) => s.settings);
  const setViewPrefs = useTodoPrefs((s) => s.setViewPrefs);

  const smart = getSmartList(viewId);
  const list: ITaskList | undefined = isSmartView(viewId) ? undefined : lists.find((l) => l._id === viewId);
  const isRealList = !isSmartView(viewId);
  const title = smart?.title ?? list?.name ?? 'List';
  const titleColor = smart ? smartListTextColor(viewId, isDark) : listTextColor(list?.color, isDark);
  const tickColor = list ? listTextColor(list.color, false) : palette.primary;

  const vp = resolveViewPrefs(prefViews, viewId);
  const sortDir = vp.sortField === 'custom' ? 'asc' : vp.sortDir;

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [sheet, setSheet] = useState<null | 'sort' | 'more' | 'energy' | 'category' | 'move'>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [actionList, setActionList] = useState<ITaskList | null>(null);

  const ctx = useMemo(() => ({ todayStr, dueTodayInMyDay: settings.dueTodayInMyDay }), [todayStr, settings.dueTodayInMyDay]);
  const listNames = useMemo(() => new Map(lists.map((l) => [l._id, l.name])), [lists]);
  const categoryColors = useMemo(() => Object.fromEntries(categories.map((c) => [c.name, c.color])), [categories]);

  const inView = useMemo(
    () => applyListFilters(filterForView(tasks, viewId, ctx), { energy: vp.energy, category: vp.category }),
    [tasks, viewId, ctx, vp.energy, vp.category]
  );
  const openTasks = useMemo(
    () => sortTasks(inView.filter((t) => !t.isCompleted), { field: vp.sortField, dir: sortDir }, { starredToTop: settings.starredToTop }),
    [inView, vp.sortField, sortDir, settings.starredToTop]
  );
  const doneTasks = useMemo(
    () => [...inView.filter((t) => t.isCompleted)].sort((a, b) => ((b.completedAt ?? b.updatedAt) > (a.completedAt ?? a.updatedAt) ? 1 : -1)),
    [inView]
  );
  const isCompletedView = viewId === 'completed';
  const planned = viewId === 'planned' && vp.sortField === 'dueDate';
  const dragEnabled = vp.sortField === 'custom' && !selectionMode && !planned;

  const store = useTaskStore.getState;
  const showListName = (t: ITask): string | undefined => {
    if (isRealList || viewId === 'tasks') return undefined;
    return t.listId ? listNames.get(t.listId) : 'Tasks';
  };

  // ───────── selection ─────────
  const enterSelection = (first?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectionMode(true);
    setSelected(first ? new Set([first]) : new Set());
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };
  const toggleSelected = (taskId: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  const selectable = [...openTasks, ...doneTasks];
  const ids = [...selected];

  // ───────── task actions ─────────
  const remove = (task: ITask) => {
    const run = () => void store().deleteTask(task._id);
    if (settings.confirmDelete) confirmAction('Delete task?', `"${task.title}" will be deleted.`, 'Delete', run);
    else run();
  };

  const renderRow = (task: ITask, state?: { dragging: boolean }) => (
    <SwipeableTaskRow
      inMyDay={task.inMyDay}
      disabled={selectionMode || !!state?.dragging}
      onToggleMyDay={() => void store().toggleTaskMyDay(task._id, boundaryHour)}
      onDelete={() => remove(task)}
    >
      <TaskRow
        task={task}
        todayStr={todayStr}
        listName={showListName(task)}
        accent={tickColor}
        categoryColors={categoryColors}
        selectionMode={selectionMode}
        selected={selected.has(task._id)}
        dragging={state?.dragging}
        onPress={() => (selectionMode ? toggleSelected(task._id) : router.push(`/todo/task/${task._id}` as never))}
        onLongPress={dragEnabled ? undefined : () => (selectionMode ? toggleSelected(task._id) : enterSelection(task._id))}
        onToggleComplete={() => void store().toggleTaskCompleted(task._id, boundaryHour)}
        onToggleImportant={() => void store().toggleTaskImportant(task._id)}
      />
    </SwipeableTaskRow>
  );

  const renderPlainList = (items: ITask[]) =>
    items.map((t) => (
      <View key={t._id} style={{ marginBottom: ROW_GAP }}>{renderRow(t)}</View>
    ));

  const addTask = (draft: TaskDraft) => {
    void store().addTask(
      {
        title: draft.title,
        dueDate: draft.dueDate,
        reminderTime: draft.reminderTime,
        repeat: draft.repeat,
        isImportant: draft.isImportant,
        energyCost: draft.energyCost ?? vp.energy ?? undefined,
        inMyDay: viewId === 'my-day',
        listId: isRealList ? viewId : undefined,
        categories: vp.category ? [vp.category] : undefined,
      },
      boundaryHour
    );
  };

  // ───────── menus ─────────
  const sortOptions: SheetOption[] = SORTS.map((s) => ({
    key: s.field,
    label: s.label,
    selected: vp.sortField === s.field,
    onPress: () => setViewPrefs(viewId, { sortField: s.field, sortDir: s.field === 'importance' || s.field === 'myDay' ? 'asc' : vp.sortDir }),
  }));
  const reverseOption: SheetOption = {
    key: 'reverse',
    label: 'Reverse order',
    icon: ArrowUpDown,
    selected: vp.sortDir === 'desc',
    onPress: () => setViewPrefs(viewId, { sortDir: vp.sortDir === 'desc' ? 'asc' : 'desc' }),
  };

  const filtering = !!(vp.energy || vp.category);
  const subtitle =
    viewId === 'my-day'
      ? formatLongDate(todayStr)
      : filtering
        ? ['Filtered', vp.energy ? vp.energy === 'demanding' ? 'high energy' : vp.energy : null, vp.category].filter(Boolean).join(' · ')
        : undefined;

  const moreOptions: SheetOption[] = [
    { key: 'select', label: 'Select tasks', icon: CheckSquare, onPress: () => enterSelection() },
    ...(!isCompletedView
      ? [{
          key: 'completed',
          label: vp.showCompleted ? 'Hide completed tasks' : 'Show completed tasks',
          icon: vp.showCompleted ? EyeOff : Eye,
          onPress: () => setViewPrefs(viewId, { showCompleted: !vp.showCompleted }),
        }]
      : []),
    { key: 'energy', label: 'Filter by energy', icon: Zap, hint: vp.energy ? (vp.energy === 'demanding' ? 'High' : vp.energy[0].toUpperCase() + vp.energy.slice(1)) : undefined, opensModal: true, onPress: () => setSheet('energy') },
    { key: 'category', label: 'Filter by category', icon: Tag, hint: vp.category ?? undefined, opensModal: true, onPress: () => setSheet('category') },
    ...(filtering
      ? [{ key: 'clear', label: 'Clear filters', icon: X, onPress: () => setViewPrefs(viewId, { energy: null, category: null }) }]
      : []),
    ...(list ? [{ key: 'list', label: 'List options', icon: SlidersHorizontal, opensModal: true, onPress: () => setActionList(list) }] : []),
    ...(list ? [{ key: 'ask', label: 'Ask Lumen AI about this list', icon: Sparkles, onPress: () => ask({ kind: 'list', id: list._id, title: list.name }) }] : []),
  ];

  const energyOptions: SheetOption[] = [
    { key: 'all', label: 'Any energy level', selected: !vp.energy, onPress: () => setViewPrefs(viewId, { energy: null }) },
    ...([['gentle', 'Gentle'], ['moderate', 'Moderate'], ['demanding', 'High energy']] as Array<[TaskEnergyCost, string]>).map<SheetOption>(([k, label]) => ({
      key: k, label, selected: vp.energy === k, onPress: () => setViewPrefs(viewId, { energy: k }),
    })),
  ];
  const categoryOptions: SheetOption[] = [
    { key: 'all', label: 'Any category', selected: !vp.category, onPress: () => setViewPrefs(viewId, { category: null }) },
    ...categories.map<SheetOption>((c) => ({
      key: c._id, label: c.name, selected: vp.category === c.name, iconColor: c.color, onPress: () => setViewPrefs(viewId, { category: c.name }),
    })),
    ...(categories.length === 0 ? [{ key: 'manage', label: 'Create categories in To Do settings', icon: Tag, onPress: () => router.push('/todo/settings' as never) }] : []),
  ];
  const moveOptions: SheetOption[] = [
    { key: 'inbox', label: 'Tasks', icon: Inbox, onPress: () => { void store().bulkUpdate(ids, { listId: null }); exitSelection(); } },
    ...lists.map<SheetOption>((l) => ({
      key: l._id, label: l.name, icon: FolderInput, onPress: () => { void store().bulkUpdate(ids, { listId: l._id }); exitSelection(); },
    })),
  ];

  const allImportant = ids.length > 0 && ids.every((i) => tasks.find((t) => t._id === i)?.isImportant);

  // ───────── content ─────────
  const hasAny = openTasks.length > 0 || doneTasks.length > 0;
  const empty = EMPTY[viewId] ?? { title: filtering ? 'No matching tasks' : 'No tasks yet', body: filtering ? 'Try clearing the filters.' : 'Add a task below to get started.' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!dragging}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <LargeTitleHeader
            title={selectionMode ? (selected.size > 0 ? `${selected.size} selected` : 'Select tasks') : title}
            titleColor={selectionMode ? palette.text : titleColor}
            subtitle={selectionMode ? undefined : subtitle}
            leading={
              selectionMode ? (
                <GlassCircleButton accessibilityLabel="Cancel selection" onPress={exitSelection}>
                  <X size={22} color={palette.text} strokeWidth={2.2} />
                </GlassCircleButton>
              ) : (
                <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/todo')}>
                  <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
                </GlassCircleButton>
              )
            }
            actions={
              selectionMode ? undefined : (
                <>
                  {viewId === 'my-day' ? (
                    <GlassCircleButton accessibilityLabel="Suggestions" onPress={() => setSuggestionsOpen(true)}>
                      <Lightbulb size={20} color={palette.text} strokeWidth={2.2} />
                    </GlassCircleButton>
                  ) : null}
                  {!isCompletedView ? (
                    <GlassCircleButton accessibilityLabel="Sort" onPress={() => setSheet('sort')}>
                      <ArrowUpDown size={20} color={vp.sortField !== 'custom' || vp.sortDir === 'desc' ? palette.tint : palette.text} strokeWidth={2.2} />
                    </GlassCircleButton>
                  ) : null}
                  <GlassCircleButton accessibilityLabel="More options" onPress={() => setSheet('more')} badge={filtering}>
                    <MoreHorizontal size={22} color={palette.text} strokeWidth={2.2} />
                  </GlassCircleButton>
                </>
              )
            }
          />

          {!hasAny ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyBody}>{empty.body}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {isCompletedView ? (
                renderPlainList(doneTasks)
              ) : planned ? (
                groupPlanned(openTasks, todayStr).map((g) => (
                  <View key={g.key}>
                    <Text style={[styles.groupTitle, g.key === 'overdue' && { color: palette.errorText }]}>{g.title}</Text>
                    {renderPlainList(g.tasks)}
                  </View>
                ))
              ) : (
                <ReorderableTaskList
                  tasks={openTasks}
                  enabled={dragEnabled}
                  renderRow={renderRow}
                  onReorder={(order) => void store().reorderTasks(order)}
                  onDragActive={setDragging}
                />
              )}

              {!isCompletedView && vp.showCompleted && doneTasks.length > 0 ? (
                <View>
                  <TouchableOpacity
                    style={styles.completedHeader}
                    onPress={() => setCompletedOpen((o) => !o)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: completedOpen }}
                    accessibilityLabel={`Completed, ${doneTasks.length} tasks`}
                  >
                    {completedOpen ? <ChevronDown size={16} color={palette.textSecondary} /> : <ChevronRight size={16} color={palette.textSecondary} />}
                    <Text style={styles.completedText}>Completed</Text>
                    <Text style={styles.completedCount}>{doneTasks.length}</Text>
                  </TouchableOpacity>
                  {completedOpen ? renderPlainList(doneTasks) : null}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        <TodoUndoToast bottomOffset={selectionMode ? 120 : 112} />

        {selectionMode ? (
          <SelectionBar
            count={selected.size}
            total={selectable.length}
            onToggleAll={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((t) => t._id)))}
            onMyDay={() => { void store().bulkUpdate(ids, { inMyDay: true, myDayDate: todayStr }); exitSelection(); }}
            onStar={() => { void store().bulkUpdate(ids, { isImportant: !allImportant }); exitSelection(); }}
            onComplete={() => { void store().bulkComplete(ids, boundaryHour); exitSelection(); }}
            onMove={() => setSheet('move')}
            onDelete={() => { void store().deleteTasks(ids); exitSelection(); }}
          />
        ) : !isCompletedView ? (
          <AddTaskBar
            placeholder="Add a task"
            todayStr={todayStr}
            defaultImportant={viewId === 'important'}
            defaultDueDate={viewId === 'planned' ? todayStr : undefined}
            keyboardVisible={isKeyboardVisible}
            accent={tickColor}
            onSubmit={addTask}
          />
        ) : null}
      </KeyboardAvoidingView>

      <OptionsSheet
        visible={sheet === 'sort'}
        onClose={() => setSheet(null)}
        title="Sort by"
        sections={[{ options: sortOptions }, ...(vp.sortField !== 'custom' ? [{ options: [reverseOption] }] : [])]}
      />
      <OptionsSheet visible={sheet === 'more'} onClose={() => setSheet(null)} title={title} options={moreOptions} />
      <OptionsSheet visible={sheet === 'energy'} onClose={() => setSheet(null)} title="Filter by energy" options={energyOptions} />
      <OptionsSheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Filter by category" options={categoryOptions} />
      <OptionsSheet visible={sheet === 'move'} onClose={() => setSheet(null)} title="Move to list" options={moveOptions} />
      <ListActions list={actionList} onClose={() => setActionList(null)} onDeleted={() => safeGoBack('/todo')} />
      <SuggestionsModal visible={suggestionsOpen} onClose={() => setSuggestionsOpen(false)} boundaryHour={boundaryHour} />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { paddingBottom: 24, paddingTop: 6 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  groupTitle: { ...typography.subheadBold, color: palette.textSecondary, marginTop: 8, marginBottom: 8, paddingHorizontal: 4 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 4, marginTop: 4 },
  completedText: { ...typography.subheadBold, color: palette.textSecondary },
  completedCount: { ...typography.footnote, color: palette.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { ...typography.title2, color: palette.text, textAlign: 'center' },
  emptyBody: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center' },
}));
