import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ITask, ITaskList, ITaskStep, TaskEnergyCost } from '../shared/types';
import { api } from '../api/client';
import { getTrackingDayDateString } from '../utils/dayBoundary';

const TASKS_CACHE_KEY = 'lumen:tasks:cache_v1';
const TASK_LISTS_CACHE_KEY = 'lumen:task_lists:cache_v1';

export type TaskFilterType =
  | 'my-day'
  | 'important'
  | 'planned'
  | 'all'
  | 'completed'
  | 'energy-gentle'
  | 'energy-moderate'
  | 'energy-demanding'
  | string; // or a custom listId

export interface TaskSuggestions {
  overdue: ITask[];
  dueToday: ITask[];
  important: ITask[];
  recent: ITask[];
}

interface TaskState {
  tasks: ITask[];
  lists: ITaskList[];
  activeFilter: TaskFilterType;
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;
  suggestions: TaskSuggestions | null;

  // Actions
  fetchTasks: () => Promise<void>;
  fetchLists: () => Promise<void>;
  fetchSuggestions: (boundaryHour?: number) => Promise<TaskSuggestions | null>;
  pruneDayBoundary: (boundaryHour?: number) => void;
  setActiveFilter: (filter: TaskFilterType) => void;
  setSelectedTaskId: (id: string | null) => void;

  addTask: (input: {
    title: string;
    notes?: string;
    inMyDay?: boolean;
    isImportant?: boolean;
    dueDate?: string;
    reminderTime?: string;
    energyCost?: TaskEnergyCost;
    listId?: string;
    steps?: ITaskStep[];
  }, boundaryHour?: number) => Promise<ITask>;

  updateTask: (id: string, updates: Partial<ITask>) => Promise<void>;
  toggleTaskCompleted: (id: string) => Promise<void>;
  toggleTaskImportant: (id: string) => Promise<void>;
  toggleTaskMyDay: (id: string, boundaryHour?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Step sub-items
  addStep: (taskId: string, title: string) => Promise<void>;
  toggleStep: (taskId: string, stepId: string) => Promise<void>;
  deleteStep: (taskId: string, stepId: string) => Promise<void>;

  // Chronic Flare Deferral
  deferForFlare: (taskId: string, days?: number) => Promise<void>;

  // List Management
  createList: (name: string, icon?: string, color?: string) => Promise<ITaskList>;
  deleteList: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  lists: [],
  activeFilter: 'my-day',
  selectedTaskId: null,
  isLoading: false,
  error: null,
  suggestions: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydration
    try {
      const cached = await AsyncStorage.getItem(TASKS_CACHE_KEY);
      if (cached) {
        set({ tasks: JSON.parse(cached) });
      }
    } catch {}

    // 2. Network fetch
    try {
      const res = await api.get<ITask[]>('/tasks?includeCompleted=true');
      if (res && Array.isArray(res)) {
        set({ tasks: res });
        await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(res));
      }
    } catch (err: any) {
      // Keep cached data
      set({ error: err.message || 'Failed to sync tasks' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLists: async () => {
    try {
      const cached = await AsyncStorage.getItem(TASK_LISTS_CACHE_KEY);
      if (cached) {
        set({ lists: JSON.parse(cached) });
      }
    } catch {}

    try {
      const res = await api.get<ITaskList[]>('/tasks/lists');
      if (res && Array.isArray(res)) {
        set({ lists: res });
        await AsyncStorage.setItem(TASK_LISTS_CACHE_KEY, JSON.stringify(res));
      }
    } catch {}
  },

  fetchSuggestions: async (boundaryHour = 4) => {
    const todayStr = getTrackingDayDateString(new Date(), boundaryHour);
    try {
      const res = await api.get<TaskSuggestions>(`/tasks/suggestions?today=${todayStr}`);
      if (res) {
        set({ suggestions: res });
        return res;
      }
    } catch {}
    return null;
  },

  pruneDayBoundary: (boundaryHour = 4) => {
    const currentTrackingDay = getTrackingDayDateString(new Date(), boundaryHour);
    const updated = get().tasks.map((task) => {
      // If task was in My Day on a previous tracking day, unpin it to give a clean daily slate
      if (task.inMyDay && task.myDayDate && task.myDayDate !== currentTrackingDay) {
        return {
          ...task,
          inMyDay: false,
        };
      }
      return task;
    });

    set({ tasks: updated });
    AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  setActiveFilter: (filter: TaskFilterType) => {
    set({ activeFilter: filter });
  },

  setSelectedTaskId: (id: string | null) => {
    set({ selectedTaskId: id });
  },

  addTask: async (input, boundaryHour = 4) => {
    const todayStr = getTrackingDayDateString(new Date(), boundaryHour);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newTask: ITask = {
      _id: tempId,
      userId: '',
      title: input.title.trim(),
      notes: input.notes,
      isCompleted: false,
      isImportant: input.isImportant || false,
      inMyDay: input.inMyDay || false,
      myDayDate: input.inMyDay ? todayStr : undefined,
      dueDate: input.dueDate,
      reminderTime: input.reminderTime,
      energyCost: input.energyCost,
      listId: input.listId,
      steps: input.steps || [],
      sortOrder: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic insert
    const previousTasks = get().tasks;
    const updated = [newTask, ...previousTasks];
    set({ tasks: updated });
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      const payload = {
        title: newTask.title,
        notes: newTask.notes,
        isCompleted: newTask.isCompleted,
        isImportant: newTask.isImportant,
        inMyDay: newTask.inMyDay,
        myDayDate: newTask.myDayDate,
        dueDate: newTask.dueDate,
        reminderTime: newTask.reminderTime,
        energyCost: newTask.energyCost,
        listId: newTask.listId,
        steps: newTask.steps,
      };

      const serverTask = await api.post<ITask>('/tasks', payload);
      if (serverTask && serverTask._id) {
        const finalized = get().tasks.map((t) => (t._id === tempId ? serverTask : t));
        set({ tasks: finalized });
        await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(finalized));
        return serverTask;
      }
    } catch (err) {
      // Revert if severe failure, or keep optimistic for offline
    }

    return newTask;
  },

  updateTask: async (id: string, updates: Partial<ITask>) => {
    const previous = get().tasks;
    const updated = previous.map((t) => (t._id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    set({ tasks: updated });
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.patch<ITask>(`/tasks/${id}`, updates);
    } catch {}
  },

  toggleTaskCompleted: async (id: string) => {
    const task = get().tasks.find((t) => t._id === id);
    if (!task) return;

    const nextCompleted = !task.isCompleted;
    const updates: Partial<ITask> = {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
    };

    await get().updateTask(id, updates);
  },

  toggleTaskImportant: async (id: string) => {
    const task = get().tasks.find((t) => t._id === id);
    if (!task) return;

    const updates: Partial<ITask> = {
      isImportant: !task.isImportant,
    };

    await get().updateTask(id, updates);
  },

  toggleTaskMyDay: async (id: string, boundaryHour = 4) => {
    const task = get().tasks.find((t) => t._id === id);
    if (!task) return;

    const nextInMyDay = !task.inMyDay;
    const todayStr = getTrackingDayDateString(new Date(), boundaryHour);

    const updates: Partial<ITask> = {
      inMyDay: nextInMyDay,
      myDayDate: nextInMyDay ? todayStr : undefined,
    };

    await get().updateTask(id, updates);
  },

  deleteTask: async (id: string) => {
    const previous = get().tasks;
    const updated = previous.filter((t) => t._id !== id);
    set({ tasks: updated });
    if (get().selectedTaskId === id) {
      set({ selectedTaskId: null });
    }
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.delete(`/tasks/${id}`);
    } catch {}
  },

  addStep: async (taskId: string, title: string) => {
    if (!title.trim()) return;
    const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newStep: ITaskStep = {
      id: stepId,
      title: title.trim(),
      completed: false,
    };

    const task = get().tasks.find((t) => t._id === taskId);
    if (!task) return;

    const updatedSteps = [...(task.steps || []), newStep];
    const previous = get().tasks;
    const updated = previous.map((t) => (t._id === taskId ? { ...t, steps: updatedSteps } : t));
    set({ tasks: updated });
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.post(`/tasks/${taskId}/steps`, { title: title.trim() });
    } catch {}
  },

  toggleStep: async (taskId: string, stepId: string) => {
    const task = get().tasks.find((t) => t._id === taskId);
    if (!task) return;

    let targetCompleted = false;
    const updatedSteps = (task.steps || []).map((s) => {
      if (s.id === stepId) {
        targetCompleted = !s.completed;
        return {
          ...s,
          completed: targetCompleted,
          completedAt: targetCompleted ? new Date().toISOString() : undefined,
        };
      }
      return s;
    });

    const previous = get().tasks;
    const updated = previous.map((t) => (t._id === taskId ? { ...t, steps: updatedSteps } : t));
    set({ tasks: updated });
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.patch(`/tasks/${taskId}/steps/${stepId}`, { completed: targetCompleted });
    } catch {}
  },

  deleteStep: async (taskId: string, stepId: string) => {
    const task = get().tasks.find((t) => t._id === taskId);
    if (!task) return;

    const updatedSteps = (task.steps || []).filter((s) => s.id !== stepId);
    const previous = get().tasks;
    const updated = previous.map((t) => (t._id === taskId ? { ...t, steps: updatedSteps } : t));
    set({ tasks: updated });
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.delete(`/tasks/${taskId}/steps/${stepId}`);
    } catch {}
  },

  deferForFlare: async (taskId: string, days = 2) => {
    const task = get().tasks.find((t) => t._id === taskId);
    if (!task) return;

    // Calculate deferred date
    const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const deferredDateStr = baseDate.toISOString().slice(0, 10);

    // Gently remove from today's My Day and set new future due date
    const updates: Partial<ITask> = {
      inMyDay: false,
      myDayDate: undefined,
      dueDate: deferredDateStr,
    };

    await get().updateTask(taskId, updates);
  },

  createList: async (name: string, icon = '📋', color = '#4A90E2') => {
    const tempId = `list_${Date.now()}`;
    const newList: ITaskList = {
      _id: tempId,
      userId: '',
      name: name.trim(),
      icon,
      color,
      sortOrder: get().lists.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...get().lists, newList];
    set({ lists: updated });
    await AsyncStorage.setItem(TASK_LISTS_CACHE_KEY, JSON.stringify(updated));

    try {
      const serverList = await api.post<ITaskList>('/tasks/lists', {
        name: newList.name,
        icon: newList.icon,
        color: newList.color,
      });
      if (serverList && serverList._id) {
        const finalized = get().lists.map((l) => (l._id === tempId ? serverList : l));
        set({ lists: finalized });
        await AsyncStorage.setItem(TASK_LISTS_CACHE_KEY, JSON.stringify(finalized));
        return serverList;
      }
    } catch {}

    return newList;
  },

  deleteList: async (id: string) => {
    const updated = get().lists.filter((l) => l._id !== id);
    set({ lists: updated });
    if (get().activeFilter === id) {
      set({ activeFilter: 'my-day' });
    }
    await AsyncStorage.setItem(TASK_LISTS_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.delete(`/tasks/lists/${id}`);
    } catch {}
  },
}));
