/**
 * Reminder Store — Zustand state for creating, updating, toggling, and synchronizing reminders.
 * Automatically synchronizes with local native notification schedules.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '../utils/uuid';
import { IReminder, ReminderCategory, ReminderScheduleType, WeekDay } from '@lumen/shared';
import { api } from '../api/client';
import {
  scheduleReminder,
  cancelReminder,
  snoozeReminder,
  syncReminders,
  purgeAllGhostAlarms,
} from '../services/notifications';

const REMINDERS_CACHE_KEY = 'lumen:reminders:cache_v1';

export interface CreateReminderInput {
  name: string;
  description?: string;
  icon: string;
  category: ReminderCategory;
  scheduleType: ReminderScheduleType;
  targetTime?: string;
  targetDate?: string;
  daysOfWeek?: WeekDay[];
  intervalMinutes?: number;
  windowStartTime?: string;
  windowEndTime?: string;
  inactivityThresholdMinutes?: number;
  notificationTitle?: string;
  notificationMessage: string;
  snoozeDurationMinutes?: number;
  sound?: string;
  linkedQuickActionId?: string;
  linkedQuestionId?: string;
  enabled?: boolean;
}

interface ReminderState {
  reminders: IReminder[];
  isLoading: boolean;
  error: string | null;

  fetchReminders: () => Promise<void>;
  addReminder: (input: CreateReminderInput) => Promise<IReminder>;
  updateReminder: (id: string, updates: Partial<IReminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  unarchiveReminder: (id: string) => Promise<void>;
  permanentDeleteReminder: (id: string) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  snooze: (id: string, minutes?: number) => Promise<void>;
  duplicateReminder: (id: string) => Promise<void>;
  purgeGhostReminders: () => Promise<void>;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  isLoading: false,
  error: null,

  purgeGhostReminders: async () => {
    const { reminders } = get();
    await purgeAllGhostAlarms(reminders).catch(() => {});
  },

  fetchReminders: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast load from local storage
    try {
      const cached = await AsyncStorage.getItem(REMINDERS_CACHE_KEY);
      if (cached) {
        set({ reminders: JSON.parse(cached) });
      }
    } catch {}

    // 2. Fetch from backend
    try {
      const res = await api.get<IReminder[]>('/reminders?includeArchived=true');
      if (Array.isArray(res)) {
        set({ reminders: res, isLoading: false });
        await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(res));

        // Bulletproof resync: cancels any ghost/orphan notifications and native alarms
        syncReminders(res).catch(() => {});
      }
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Failed to load reminders' });
    }
  },

  addReminder: async (input: CreateReminderInput) => {
    const clientId = uuidv4();
    const newReminder: IReminder = {
      _id: clientId, // local fallback ID until synced
      clientId,
      userId: '',
      name: input.name,
      description: input.description,
      icon: input.icon || '⏰',
      category: input.category,
      scheduleType: input.scheduleType,
      targetTime: input.targetTime,
      targetDate: input.targetDate,
      daysOfWeek: input.daysOfWeek,
      intervalMinutes: input.intervalMinutes,
      windowStartTime: input.windowStartTime,
      windowEndTime: input.windowEndTime,
      inactivityThresholdMinutes: input.inactivityThresholdMinutes,
      notificationTitle: input.notificationTitle || input.name,
      notificationMessage: input.notificationMessage,
      snoozeDurationMinutes: input.snoozeDurationMinutes || 10,
      sound: input.sound || 'default',
      linkedQuickActionId: input.linkedQuickActionId,
      linkedQuestionId: input.linkedQuestionId,
      enabled: input.enabled !== undefined ? input.enabled : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local update
    const updated = [newReminder, ...get().reminders];
    set({ reminders: updated });
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(updated));

    // Schedule locally immediately
    if (newReminder.enabled) {
      scheduleReminder(newReminder).catch(() => {});
    }

    // Sync to server
    try {
      const serverRes = await api.post<IReminder>('/reminders', newReminder);
      if (serverRes && serverRes._id) {
        const syncedList = get().reminders.map(r => r.clientId === clientId ? serverRes : r);
        set({ reminders: syncedList });
        await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(syncedList));
        return serverRes;
      }
    } catch (e) {
      console.warn('[reminderStore] Failed to save to server, saved locally:', e);
    }

    return newReminder;
  },

  updateReminder: async (id: string, updates: Partial<IReminder>) => {
    const current = get().reminders;
    const target = current.find(r => r._id === id || r.clientId === id);
    if (!target) return;

    const merged: IReminder = {
      ...target,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const nextList = current.map(r => (r._id === id || r.clientId === id) ? merged : r);
    set({ reminders: nextList });
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(nextList));

    if (merged.enabled) {
      scheduleReminder(merged).catch(() => {});
    } else {
      cancelReminder(id).catch(() => {});
    }

    api.put(`/reminders/${id}`, updates).catch(() => {});
  },

  deleteReminder: async (id: string) => {
    cancelReminder(id).catch(() => {});
    // Mark as archived locally
    const updated = get().reminders.map(r =>
      (r._id === id || r.clientId === id)
        ? { ...r, archivedAt: new Date().toISOString(), enabled: false }
        : r
    );
    set({ reminders: updated });
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(updated));

    api.delete(`/reminders/${id}`).catch(() => {});
  },

  unarchiveReminder: async (id: string) => {
    const target = get().reminders.find(r => r._id === id || r.clientId === id);
    if (!target) return;

    const restored: IReminder = {
      ...target,
      archivedAt: undefined,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };

    const nextList = get().reminders.map(r => (r._id === id || r.clientId === id) ? restored : r);
    set({ reminders: nextList });
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(nextList));

    scheduleReminder(restored).catch(() => {});
    api.post(`/reminders/${id}/unarchive`, {}).catch(() => {});
  },

  permanentDeleteReminder: async (id: string) => {
    cancelReminder(id).catch(() => {});
    const filtered = get().reminders.filter(r => r._id !== id && r.clientId !== id);
    set({ reminders: filtered });
    await AsyncStorage.setItem(REMINDERS_CACHE_KEY, JSON.stringify(filtered));

    api.delete(`/reminders/${id}?permanent=true`).catch(() => {});
  },

  toggleReminder: async (id: string) => {
    const target = get().reminders.find(r => r._id === id || r.clientId === id);
    if (!target) return;

    const newStatus = !target.enabled;
    await get().updateReminder(id, { enabled: newStatus, isActive: newStatus });
  },

  snooze: async (id: string, minutes?: number) => {
    const target = get().reminders.find(r => r._id === id || r.clientId === id);
    const duration = minutes || target?.snoozeDurationMinutes || 10;
    await snoozeReminder(id, duration, target?.name, target?.notificationMessage);
  },

  duplicateReminder: async (id: string) => {
    const target = get().reminders.find(r => r._id === id || r.clientId === id);
    if (!target) return;

    await get().addReminder({
      name: `${target.name} (Copy)`,
      description: target.description,
      icon: target.icon,
      category: target.category,
      scheduleType: target.scheduleType,
      targetTime: target.targetTime,
      targetDate: target.targetDate,
      daysOfWeek: target.daysOfWeek,
      intervalMinutes: target.intervalMinutes,
      windowStartTime: target.windowStartTime,
      windowEndTime: target.windowEndTime,
      inactivityThresholdMinutes: target.inactivityThresholdMinutes,
      notificationTitle: target.notificationTitle,
      notificationMessage: target.notificationMessage,
      snoozeDurationMinutes: target.snoozeDurationMinutes,
      linkedQuickActionId: target.linkedQuickActionId,
      linkedQuestionId: target.linkedQuestionId,
      enabled: target.enabled,
    });
  },
}));
