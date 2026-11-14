import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ITask,
  ITaskList,
  ITaskListGroup,
  ITaskCategory,
  ITaskRepeat,
  ITaskStep,
  TaskEnergyCost,
} from '../shared/types';
import { api } from '../api/client';
import { getTrackingDayDateString } from '../utils/dayBoundary';
import { newObjectId } from '../utils/todo/objectId';
import { computeNextOccurrence } from '../utils/todo/recurrence';
import { addDays, shiftIsoByDays } from '../utils/todo/dates';
import { nextSortOrder } from '../utils/todo/views';
import { enqueue, flushOutbox, loadOutbox, getPendingCount } from '../services/todo/outbox';
import { useTodoPrefs } from './todoPrefsStore';

const TASKS_CACHE_KEY = 'lumen:tasks:cache_v1';
const TASK_LISTS_CACHE_KEY = 'lumen:task_lists:cache_v1';
const TASK_GROUPS_CACHE_KEY = 'lumen:task_groups:cache_v1';
const TASK_CATEGORIES_CACHE_KEY = 'lumen:task_categories:cache_v1';

// ───────── side effects that must never break saving ─────────

function triggerWidgetSync(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncLiveWidgetsFromStores } = require('../widgets/widgetSync');
    syncLiveWidgetsFromStores();
  } catch {}
}

let lastReminderSignature = '';
function syncReminders(tasks: ITask[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { tasksNeedingReminder, syncTaskReminders } = require('../services/todo/taskReminders');
    const signature = (tasksNeedingReminder(tasks) as ITask[]).map((t) => `${t._id}@${t.reminderTime}|${t.title}`).join(',');
    if (signature === lastReminderSignature) return;
    lastReminderSignature = signature;
    Promise.resolve(syncTaskReminders(tasks)).catch(() => {});
  } catch {}
}

/** The user's own day-boundary hour (not a hardcoded 4). */
export function currentBoundaryHour(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('./authStore');
    const h = useAuthStore.getState().user?.preferences?.dayBoundaryHour;
    return typeof h === 'number' ? h : 4;
  } catch {
    return 4;
  }
}

function save(key: string, value: unknown): void {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

// ───────── types ─────────

export interface TaskSuggestions {
  overdue: ITask[];
  dueToday: ITask[];
  important: ITask[];
  recent: ITask[];
  yesterday: ITask[];
}

/** Like Partial<ITask>, but null (or undefined) means "clear this field". */
export type TaskPatch = { [K in keyof ITask]?: ITask[K] | null };

export interface NewTaskInput {
  title: string;
  notes?: string;
  inMyDay?: boolean;
  isImportant?: boolean;
  dueDate?: string;
  reminderTime?: string;
  repeat?: ITaskRepeat;
  energyCost?: TaskEnergyCost;
  listId?: string;
  categories?: string[];
  steps?: ITaskStep[];
  sortOrder?: number;
}

export interface UndoEntry {
  id: string;
  label: string;
  tasks: ITask[];
}

interface TaskState {
  tasks: ITask[];
  lists: ITaskList[];
  groups: ITaskListGroup[];
  categories: ITaskCategory[];
  isLoading: boolean;
  error: string | null;
  suggestions: TaskSuggestions | null;
  undoEntry: UndoEntry | null;

  fetchTasks: (boundaryHour?: number) => Promise<void>;
  fetchLists: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchSuggestions: (boundaryHour?: number) => Promise<TaskSuggestions | null>;
  pruneDayBoundary: (boundaryHour?: number) => Promise<void>;

  addTask: (input: NewTaskInput, boundaryHour?: number) => Promise<ITask>;
  updateTask: (id: string, updates: TaskPatch) => Promise<void>;
  toggleTaskCompleted: (id: string, boundaryHour?: number) => Promise<void>;
  toggleTaskImportant: (id: string) => Promise<void>;
  toggleTaskMyDay: (id: string, boundaryHour?: number) => Promise<void>;
  moveTask: (id: string, listId: string | null) => Promise<void>;
  setTaskCategories: (id: string, categories: string[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasks: (ids: string[]) => Promise<void>;
  undoLast: () => Promise<void>;
  clearUndo: () => void;

  /** Saves a custom order: the given ids are numbered 0..n in the order passed. */
  reorderTasks: (orderedIds: string[]) => Promise<void>;
  bulkUpdate: (ids: string[], updates: TaskPatch) => Promise<void>;
  bulkComplete: (ids: string[], boundaryHour?: number) => Promise<void>;

  addStep: (taskId: string, title: string) => Promise<void>;
  toggleStep: (taskId: string, stepId: string) => Promise<void>;
  renameStep: (taskId: string, stepId: string, title: string) => Promise<void>;
  deleteStep: (taskId: string, stepId: string) => Promise<void>;
  promoteStepToTask: (taskId: string, stepId: string) => Promise<ITask | null>;

  deferForFlare: (taskId: string, days?: number, boundaryHour?: number) => Promise<void>;

  createList: (name: string, icon?: string, color?: string, groupId?: string) => Promise<ITaskList>;
  updateList: (id: string, updates: { name?: string; icon?: string; color?: string; groupId?: string | null }) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  duplicateList: (id: string) => Promise<ITaskList | null>;

  createGroup: (name: string) => Promise<ITaskListGroup>;
  renameGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  createCategory: (name: string, color?: string) => Promise<ITaskCategory>;
  updateCategory: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

// ───────── helpers ─────────

const CLEARABLE = new Set(['notes', 'myDayDate', 'dueDate', 'reminderTime', 'repeat', 'energyCost', 'listId', 'nextOccurrenceId']);
const SERVER_FIELDS = new Set([
  'title', 'notes', 'isCompleted', 'isImportant', 'inMyDay', 'myDayDate', 'dueDate', 'reminderTime',
  'repeat', 'energyCost', 'listId', 'categories', 'nextOccurrenceId', 'steps', 'sortOrder',
]);

/** Request body for a PATCH. Clearing sends null (JSON.stringify would silently drop undefined). */
function toBody(updates: TaskPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!SERVER_FIELDS.has(key)) continue;
    if (value === undefined || value === null) {
      if (CLEARABLE.has(key)) body[key] = null;
    } else {
      body[key] = value;
    }
  }
  return body;
}

function applyPatch(task: ITask, updates: TaskPatch): ITask {
  const next: Record<string, unknown> = { ...task };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) delete next[key];
    else next[key] = value;
  }
  next.updatedAt = new Date().toISOString();
  return next as unknown as ITask;
}

function taskToCreateBody(t: ITask): Record<string, unknown> {
  const body: Record<string, unknown> = {
    _id: t._id,
    title: t.title,
    isCompleted: t.isCompleted,
    isImportant: t.isImportant,
    inMyDay: t.inMyDay,
    steps: t.steps ?? [],
    categories: t.categories ?? [],
    sortOrder: t.sortOrder ?? 0,
  };
  const optional: Array<keyof ITask> = ['notes', 'myDayDate', 'dueDate', 'reminderTime', 'repeat', 'energyCost', 'listId', 'nextOccurrenceId'];
  for (const k of optional) if (t[k] !== undefined && t[k] !== null) body[k] = t[k];
  return body;
}

/** Clears My Day for tasks added on an earlier tracking day. */
function pruneMyDay(tasks: ITask[], todayStr: string): { tasks: ITask[]; staleIds: string[] } {
  const staleIds: string[] = [];
  const out = tasks.map((t) => {
    if (t.inMyDay && t.myDayDate && t.myDayDate !== todayStr) {
      staleIds.push(t._id);
      const { myDayDate: _drop, ...rest } = t;
      return { ...rest, inMyDay: false } as ITask;
    }
    return t;
  });
  return { tasks: out, staleIds };
}

let mutations = 0;

export const useTaskStore = create<TaskState>((set, get) => {
  /** Applies a local change: state, cache, widget and reminders. */
  const commitTasks = (tasks: ITask[], local = true) => {
    if (local) mutations++;
    set({ tasks });
    save(TASKS_CACHE_KEY, tasks);
    triggerWidgetSync();
    syncReminders(tasks);
  };
  const commitLists = (lists: ITaskList[], local = true) => {
    if (local) mutations++;
    set({ lists });
    save(TASK_LISTS_CACHE_KEY, lists);
  };
  const commitGroups = (groups: ITaskListGroup[], local = true) => {
    if (local) mutations++;
    set({ groups });
    save(TASK_GROUPS_CACHE_KEY, groups);
  };
  const commitCategories = (categories: ITaskCategory[], local = true) => {
    if (local) mutations++;
    set({ categories });
    save(TASK_CATEGORIES_CACHE_KEY, categories);
  };

  const today = (boundaryHour?: number) => getTrackingDayDateString(new Date(), boundaryHour ?? currentBoundaryHour());

  /** Adds a fully formed task locally and queues its creation. */
  const insertTask = async (task: ITask) => {
    commitTasks([task, ...get().tasks]);
    await enqueue('POST', '/tasks', taskToCreateBody(task));
  };

  const makeTask = (input: NewTaskInput, boundaryHour?: number): ITask => {
    const now = new Date().toISOString();
    const inMyDay = !!input.inMyDay;
    const addOnTop = useTodoPrefs.getState().settings.addOnTop;
    const task: ITask = {
      _id: newObjectId(),
      userId: '',
      title: input.title.trim(),
      isCompleted: false,
      isImportant: !!input.isImportant,
      inMyDay,
      steps: input.steps ?? [],
      categories: input.categories ?? [],
      sortOrder: input.sortOrder ?? nextSortOrder(get().tasks, addOnTop ? 'top' : 'bottom'),
      createdAt: now,
      updatedAt: now,
    };
    if (input.notes) task.notes = input.notes;
    if (inMyDay) task.myDayDate = today(boundaryHour);
    if (input.dueDate) task.dueDate = input.dueDate;
    if (input.reminderTime) task.reminderTime = input.reminderTime;
    if (input.repeat) task.repeat = input.repeat;
    if (input.energyCost) task.energyCost = input.energyCost;
    if (input.listId) task.listId = input.listId;
    return task;
  };

  const patchLocalAndQueue = async (id: string, updates: TaskPatch) => {
    const prev = get().tasks;
    if (!prev.some((t) => t._id === id)) return;
    commitTasks(prev.map((t) => (t._id === id ? applyPatch(t, updates) : t)));
    const body = toBody(updates);
    if (Object.keys(body).length > 0) await enqueue('PATCH', `/tasks/${id}`, body);
  };

  const setSteps = (taskId: string, steps: ITaskStep[]) => patchLocalAndQueue(taskId, { steps });

  const fetchInto = async <T,>(path: string, commit: (v: T[], local: boolean) => void) => {
    await loadOutbox();
    await flushOutbox();
    if (getPendingCount() > 0) return; // never overwrite changes that haven't reached the server
    const startedAt = mutations;
    try {
      const res = await api.get<T[]>(path);
      if (Array.isArray(res) && getPendingCount() === 0 && mutations === startedAt) commit(res, false);
    } catch {
      /* keep what we have */
    }
  };

  return {
    tasks: [],
    lists: [],
    groups: [],
    categories: [],
    isLoading: false,
    error: null,
    suggestions: null,
    undoEntry: null,

    // ───────── loading ─────────

    fetchTasks: async (boundaryHour) => {
      set({ isLoading: true, error: null });
      const todayStr = today(boundaryHour);
      try {
        if (get().tasks.length === 0) await rehydrateTasks();
        await loadOutbox();
        await flushOutbox();
        if (getPendingCount() > 0) {
          set({ error: 'Some changes are waiting to sync' });
          return;
        }
        const startedAt = mutations;
        const res = await api.get<ITask[]>(`/tasks?includeCompleted=true&today=${todayStr}`);
        if (Array.isArray(res) && getPendingCount() === 0 && mutations === startedAt) {
          commitTasks(pruneMyDay(res, todayStr).tasks, false);
        }
      } catch (err) {
        set({ error: (err as Error)?.message || 'Failed to sync tasks' });
      } finally {
        set({ isLoading: false });
      }
    },

    fetchLists: () => fetchInto<ITaskList>('/tasks/lists', commitLists),
    fetchGroups: () => fetchInto<ITaskListGroup>('/tasks/groups', commitGroups),
    fetchCategories: () => fetchInto<ITaskCategory>('/tasks/categories', commitCategories),

    fetchSuggestions: async (boundaryHour) => {
      try {
        const res = await api.get<TaskSuggestions>(`/tasks/suggestions?today=${today(boundaryHour)}`);
        if (res) {
          const full: TaskSuggestions = { ...res, yesterday: res.yesterday ?? [] };
          set({ suggestions: full });
          return full;
        }
      } catch {}
      return null;
    },

    pruneDayBoundary: async (boundaryHour) => {
      const { tasks, staleIds } = pruneMyDay(get().tasks, today(boundaryHour));
      if (staleIds.length === 0) return;
      commitTasks(tasks);
      for (const id of staleIds) await enqueue('PATCH', `/tasks/${id}`, { inMyDay: false, myDayDate: null });
    },

    // ───────── tasks ─────────

    addTask: async (input, boundaryHour) => {
      const task = makeTask(input, boundaryHour);
      await insertTask(task);
      return task;
    },

    updateTask: (id, updates) => patchLocalAndQueue(id, updates),

    toggleTaskCompleted: async (id, boundaryHour) => {
      let task = get().tasks.find((t) => t._id === id);
      if (!task) {
        const cached = await rehydrateTasks();
        task = cached.find((t) => t._id === id);
      }
      if (!task) return;

      const completing = !task.isCompleted;
      const updates: TaskPatch = {
        isCompleted: completing,
        completedAt: completing ? new Date().toISOString() : null,
      };

      // A repeating task spawns its next occurrence once, even if it is un-ticked and ticked again.
      let spawned: ITask | null = null;
      if (completing && task.repeat && !task.nextOccurrenceId) {
        const occ = computeNextOccurrence(task.repeat, task.dueDate, task.reminderTime, today(boundaryHour));
        const now = new Date().toISOString();
        spawned = {
          _id: newObjectId(),
          userId: task.userId,
          title: task.title,
          isCompleted: false,
          isImportant: task.isImportant,
          inMyDay: false,
          steps: (task.steps ?? []).map((s) => ({ id: s.id, title: s.title, completed: false })),
          categories: task.categories ?? [],
          sortOrder: task.sortOrder ?? 0,
          dueDate: occ.dueDate,
          repeat: task.repeat,
          createdAt: now,
          updatedAt: now,
        };
        if (occ.reminderTime) spawned.reminderTime = occ.reminderTime;
        if (task.notes) spawned.notes = task.notes;
        if (task.energyCost) spawned.energyCost = task.energyCost;
        if (task.listId) spawned.listId = task.listId;
        updates.nextOccurrenceId = spawned._id;
      }

      await patchLocalAndQueue(id, updates);
      if (spawned) await insertTask(spawned);
    },

    toggleTaskImportant: async (id) => {
      const task = get().tasks.find((t) => t._id === id);
      if (!task) return;
      await patchLocalAndQueue(id, { isImportant: !task.isImportant });
    },

    toggleTaskMyDay: async (id, boundaryHour) => {
      const task = get().tasks.find((t) => t._id === id);
      if (!task) return;
      const next = !task.inMyDay;
      await patchLocalAndQueue(id, { inMyDay: next, myDayDate: next ? today(boundaryHour) : null });
    },

    moveTask: (id, listId) => patchLocalAndQueue(id, { listId }),

    setTaskCategories: (id, categories) => patchLocalAndQueue(id, { categories }),

    deleteTask: (id) => get().deleteTasks([id]),

    deleteTasks: async (ids) => {
      const idSet = new Set(ids);
      const removed = get().tasks.filter((t) => idSet.has(t._id));
      if (removed.length === 0) return;
      commitTasks(get().tasks.filter((t) => !idSet.has(t._id)));
      set({
        undoEntry: {
          id: newObjectId(),
          label: removed.length === 1 ? 'Task deleted' : `${removed.length} tasks deleted`,
          tasks: removed,
        },
      });
      for (const t of removed) await enqueue('DELETE', `/tasks/${t._id}`);
    },

    undoLast: async () => {
      const entry = get().undoEntry;
      if (!entry) return;
      set({ undoEntry: null });
      const existing = new Set(get().tasks.map((t) => t._id));
      const restored = entry.tasks.filter((t) => !existing.has(t._id));
      commitTasks([...restored, ...get().tasks]);
      // Same _id as before: the server creates it again (or returns it if the delete never ran).
      for (const t of restored) await enqueue('POST', '/tasks', taskToCreateBody(t));
    },

    clearUndo: () => set({ undoEntry: null }),

    reorderTasks: async (orderedIds) => {
      const order = new Map(orderedIds.map((id, i) => [id, i]));
      const changed: string[] = [];
      const next = get().tasks.map((t) => {
        const i = order.get(t._id);
        if (i === undefined || t.sortOrder === i) return t;
        changed.push(t._id);
        return { ...t, sortOrder: i, updatedAt: new Date().toISOString() };
      });
      if (changed.length === 0) return;
      commitTasks(next);
      for (const id of changed) await enqueue('PATCH', `/tasks/${id}`, { sortOrder: order.get(id) });
    },

    bulkUpdate: async (ids, updates) => {
      const idSet = new Set(ids);
      commitTasks(get().tasks.map((t) => (idSet.has(t._id) ? applyPatch(t, updates) : t)));
      const body = toBody(updates);
      if (Object.keys(body).length === 0) return;
      for (const id of ids) await enqueue('PATCH', `/tasks/${id}`, body);
    },

    bulkComplete: async (ids, boundaryHour) => {
      for (const id of ids) {
        const t = get().tasks.find((x) => x._id === id);
        if (t && !t.isCompleted) await get().toggleTaskCompleted(id, boundaryHour);
      }
    },

    // ───────── steps ─────────

    addStep: async (taskId, title) => {
      const clean = title.trim();
      const task = get().tasks.find((t) => t._id === taskId);
      if (!clean || !task) return;
      await setSteps(taskId, [...(task.steps ?? []), { id: `step_${newObjectId()}`, title: clean, completed: false }]);
    },

    toggleStep: async (taskId, stepId) => {
      const task = get().tasks.find((t) => t._id === taskId);
      if (!task) return;
      await setSteps(
        taskId,
        (task.steps ?? []).map((s) => {
          if (s.id !== stepId) return s;
          const completed = !s.completed;
          const next: ITaskStep = { id: s.id, title: s.title, completed };
          if (completed) next.completedAt = new Date().toISOString();
          return next;
        })
      );
    },

    renameStep: async (taskId, stepId, title) => {
      const clean = title.trim();
      const task = get().tasks.find((t) => t._id === taskId);
      if (!clean || !task) return;
      await setSteps(taskId, (task.steps ?? []).map((s) => (s.id === stepId ? { ...s, title: clean } : s)));
    },

    deleteStep: async (taskId, stepId) => {
      const task = get().tasks.find((t) => t._id === taskId);
      if (!task) return;
      await setSteps(taskId, (task.steps ?? []).filter((s) => s.id !== stepId));
    },

    promoteStepToTask: async (taskId, stepId) => {
      const task = get().tasks.find((t) => t._id === taskId);
      const step = task?.steps?.find((s) => s.id === stepId);
      if (!task || !step) return null;
      const created = makeTask({ title: step.title, listId: task.listId, isImportant: false });
      await insertTask(created);
      await setSteps(taskId, (task.steps ?? []).filter((s) => s.id !== stepId));
      return created;
    },

    deferForFlare: async (taskId, days = 2, boundaryHour) => {
      const task = get().tasks.find((t) => t._id === taskId);
      if (!task) return;
      const updates: TaskPatch = {
        inMyDay: false,
        myDayDate: null,
        dueDate: addDays(task.dueDate || today(boundaryHour), days),
      };
      if (task.reminderTime) updates.reminderTime = shiftIsoByDays(task.reminderTime, days);
      await patchLocalAndQueue(taskId, updates);
    },

    // ───────── lists ─────────

    createList: async (name, icon = '📋', color = '#4A90E2', groupId) => {
      const now = new Date().toISOString();
      const list: ITaskList = {
        _id: newObjectId(),
        userId: '',
        name: name.trim(),
        icon,
        color,
        sortOrder: get().lists.length,
        createdAt: now,
        updatedAt: now,
      };
      if (groupId) list.groupId = groupId;
      commitLists([...get().lists, list]);
      const body: Record<string, unknown> = { _id: list._id, name: list.name, icon, color, sortOrder: list.sortOrder };
      if (groupId) body.groupId = groupId;
      await enqueue('POST', '/tasks/lists', body);
      return list;
    },

    updateList: async (id, updates) => {
      commitLists(
        get().lists.map((l) => {
          if (l._id !== id) return l;
          const next: Record<string, unknown> = { ...l, updatedAt: new Date().toISOString() };
          for (const [k, v] of Object.entries(updates)) {
            if (v === null || v === undefined) delete next[k];
            else next[k] = v;
          }
          return next as unknown as ITaskList;
        })
      );
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) body[k] = v;
      }
      if (Object.keys(body).length > 0) await enqueue('PATCH', `/tasks/lists/${id}`, body);
    },

    deleteList: async (id) => {
      const affected = get().tasks.filter((t) => t.listId === id);
      commitLists(get().lists.filter((l) => l._id !== id));
      if (affected.length > 0) {
        commitTasks(get().tasks.map((t) => (t.listId === id ? (applyPatch(t, { listId: null }) as ITask) : t)));
      }
      await enqueue('DELETE', `/tasks/lists/${id}`);
      // Tasks still queued to be created with this list would otherwise point at nothing.
      for (const t of affected) await enqueue('PATCH', `/tasks/${t._id}`, { listId: null });
    },

    duplicateList: async (id) => {
      const source = get().lists.find((l) => l._id === id);
      if (!source) return null;
      const copy = await get().createList(`${source.name} copy`, source.icon, source.color, source.groupId);
      const tasks = get().tasks.filter((t) => t.listId === id && !t.isCompleted);
      for (const t of tasks) {
        await get().addTask({
          title: t.title,
          notes: t.notes,
          isImportant: t.isImportant,
          dueDate: t.dueDate,
          reminderTime: t.reminderTime,
          repeat: t.repeat,
          energyCost: t.energyCost,
          categories: t.categories,
          listId: copy._id,
          steps: (t.steps ?? []).map((s) => ({ id: `step_${newObjectId()}`, title: s.title, completed: false })),
        });
      }
      return copy;
    },

    // ───────── groups ─────────

    createGroup: async (name) => {
      const now = new Date().toISOString();
      const group: ITaskListGroup = {
        _id: newObjectId(),
        userId: '',
        name: name.trim(),
        sortOrder: get().groups.length,
        createdAt: now,
        updatedAt: now,
      };
      commitGroups([...get().groups, group]);
      await enqueue('POST', '/tasks/groups', { _id: group._id, name: group.name, sortOrder: group.sortOrder });
      return group;
    },

    renameGroup: async (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      commitGroups(get().groups.map((g) => (g._id === id ? { ...g, name: clean } : g)));
      await enqueue('PATCH', `/tasks/groups/${id}`, { name: clean });
    },

    deleteGroup: async (id) => {
      const members = get().lists.filter((l) => l.groupId === id);
      commitGroups(get().groups.filter((g) => g._id !== id));
      if (members.length > 0) {
        commitLists(get().lists.map((l) => {
          if (l.groupId !== id) return l;
          const { groupId: _drop, ...rest } = l;
          return rest as ITaskList;
        }));
      }
      await enqueue('DELETE', `/tasks/groups/${id}`);
      for (const l of members) await enqueue('PATCH', `/tasks/lists/${l._id}`, { groupId: null });
    },

    // ───────── categories ─────────

    createCategory: async (name, color = '#007AFF') => {
      const now = new Date().toISOString();
      const cat: ITaskCategory = {
        _id: newObjectId(),
        userId: '',
        name: name.trim(),
        color,
        sortOrder: get().categories.length,
        createdAt: now,
        updatedAt: now,
      };
      commitCategories([...get().categories, cat]);
      await enqueue('POST', '/tasks/categories', { _id: cat._id, name: cat.name, color, sortOrder: cat.sortOrder });
      return cat;
    },

    updateCategory: async (id, updates) => {
      const cat = get().categories.find((c) => c._id === id);
      if (!cat) return;
      const clean = { ...updates };
      if (clean.name !== undefined) clean.name = clean.name.trim();
      if (clean.name === '') return;
      commitCategories(get().categories.map((c) => (c._id === id ? { ...c, ...clean } : c)));
      if (clean.name && clean.name !== cat.name) {
        // Tasks hold the category name; the server renames it on its side too.
        const oldName = cat.name;
        const newName = clean.name;
        commitTasks(get().tasks.map((t) => (t.categories?.includes(oldName)
          ? { ...t, categories: t.categories.map((c) => (c === oldName ? newName : c)) }
          : t)));
      }
      await enqueue('PATCH', `/tasks/categories/${id}`, clean);
    },

    deleteCategory: async (id) => {
      const cat = get().categories.find((c) => c._id === id);
      if (!cat) return;
      commitCategories(get().categories.filter((c) => c._id !== id));
      commitTasks(get().tasks.map((t) => (t.categories?.includes(cat.name)
        ? { ...t, categories: t.categories.filter((c) => c !== cat.name) }
        : t)));
      await enqueue('DELETE', `/tasks/categories/${id}`);
    },
  };
});

// ───────── startup ─────────

async function readCache<T>(key: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Loads the cached tasks into the store (used by the widget handler and on startup). Stale My Day
 * entries are cleared exactly like fetchTasks does, so every entry point agrees.
 */
export async function rehydrateTasks(): Promise<ITask[]> {
  const cached = await readCache<ITask>(TASKS_CACHE_KEY);
  if (!cached || cached.length === 0) return [];
  const pruned = pruneMyDay(cached, getTrackingDayDateString(new Date(), currentBoundaryHour())).tasks;
  useTaskStore.setState({ tasks: pruned });
  return pruned;
}

async function rehydrateCollections(): Promise<void> {
  const [lists, groups, categories] = await Promise.all([
    readCache<ITaskList>(TASK_LISTS_CACHE_KEY),
    readCache<ITaskListGroup>(TASK_GROUPS_CACHE_KEY),
    readCache<ITaskCategory>(TASK_CATEGORIES_CACHE_KEY),
  ]);
  const patch: Partial<TaskState> = {};
  if (lists) patch.lists = lists;
  if (groups) patch.groups = groups;
  if (categories) patch.categories = categories;
  if (Object.keys(patch).length > 0) useTaskStore.setState(patch);
}

rehydrateTasks()
  .then((tasks) => {
    if (tasks.length > 0) triggerWidgetSync();
  })
  .catch(() => {});
rehydrateCollections().catch(() => {});
loadOutbox().catch(() => {});
