/**
 * Manages instant quick-tap logs with optimistic updates and undo support.
 * Logs are sent to the server immediately; an "undo" toast appears for 5s.
 * Quick taps strictly adhere to the user's Day Reset Boundary (preferences.dayBoundaryHour).
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '../utils/uuid';
import { api } from '../api/client';
import { queryClient } from '../api/queryClient';
import { logLocationService } from '../services/logLocationService';
import {
  getDayBoundaryWindow,
  isWithinDayBoundary,
} from '../utils/dayBoundary';

const STORAGE_KEY = 'lumen:quick_log:today_taps_v1';

export function getActiveBoundaryHour(overrideHour?: number): number {
  if (typeof overrideHour === 'number' && !isNaN(overrideHour)) {
    return overrideHour;
  }
  try {
    // Lazy access to avoid circular module initialization
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('./authStore');
    const user = useAuthStore?.getState?.()?.user;
    return typeof user?.preferences?.dayBoundaryHour === 'number'
      ? user.preferences.dayBoundaryHour
      : 4;
  } catch {
    return 4;
  }
}

export interface QuickTapEntry {
  id: string;           // local UUID (clientId)
  quickActionId: string;
  occurredAt: string;   // ISO
  count: number;        // number of times today
  lastAt: string;       // last occurrence ISO
  serverId?: string;    // returned from server
  synced: boolean;
}

interface QuickLogState {
  // Map: quickActionId → QuickTapEntry (active tracking day window only)
  todayTaps: Record<string, QuickTapEntry>;
  // Undo queue
  undoEntry: QuickTapEntry | null;
  undoTimer: ReturnType<typeof setTimeout> | null;

  tap: (quickActionId: string, customOccurredAt?: string, boundaryHour?: number) => Promise<void>;
  undo: () => void;
  resetToday: () => void;
  loadTodayTaps: (quickActionId: string, count: number, lastAt: string, boundaryHour?: number) => void;
  fetchTodayTaps: (boundaryHour?: number) => Promise<void>;
  pruneStaleTaps: (boundaryHour?: number) => void;
}

export const useQuickLogStore = create<QuickLogState>((set, get) => ({
  todayTaps: {},
  undoEntry: null,
  undoTimer: null,

  tap: async (quickActionId: string, customOccurredAt?: string, boundaryHour?: number) => {
    const now = customOccurredAt || new Date().toISOString();
    const bHour = getActiveBoundaryHour(boundaryHour);
    const clientId = uuidv4();
    const prev = get().todayTaps[quickActionId];

    // Check if previous tap falls in the same tracking day window as `now`
    const isPrevValid =
      prev &&
      prev.lastAt &&
      isWithinDayBoundary(prev.lastAt, bHour, new Date(now));

    const newCount = isPrevValid ? (prev?.count ?? 0) + 1 : 1;

    // Prune entries from other tracking day windows
    const currentTaps = get().todayTaps;
    const cleanedTaps: Record<string, QuickTapEntry> = {};
    for (const [qid, entry] of Object.entries(currentTaps)) {
      if (entry.lastAt && isWithinDayBoundary(entry.lastAt, bHour, new Date(now))) {
        cleanedTaps[qid] = entry;
      }
    }

    // Optimistic update
    const entry: QuickTapEntry = {
      id: clientId,
      quickActionId,
      occurredAt: now,
      count: newCount,
      lastAt: now,
      synced: false,
    };
    const nextTaps = { ...cleanedTaps, [quickActionId]: entry };
    set({
      todayTaps: nextTaps,
      undoEntry: entry,
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTaps)).catch(() => {});

    // Set undo timer
    const timer = get().undoTimer;
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(() => set({ undoEntry: null, undoTimer: null }), 5000);
    set({ undoTimer: newTimer });

    // Grab fast location snapshot (0ms if cached, <20ms if last-known)
    const location = await logLocationService.getFastLocationSnapshot().catch(() => null);

    // Send to server (non-blocking)
    try {
      const result = await api.post<{ _id: string }>('/logs', {
        clientId,
        source: 'quick_action',
        quickActionId,
        occurredAt: now,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        answers: [],
        mediaIds: [],
        ...(location ? { location } : {}),
      });
      const syncedTaps = {
        ...get().todayTaps,
        [quickActionId]: { ...get().todayTaps[quickActionId], serverId: result._id, synced: true },
      };
      const currentUndo = get().undoEntry;
      const updatedUndo = currentUndo && currentUndo.id === clientId
        ? { ...currentUndo, serverId: result._id, synced: true }
        : currentUndo;
      set({ todayTaps: syncedTaps, undoEntry: updatedUndo });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(syncedTaps)).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
    } catch (err) {
      console.warn('[quickLog] Failed to sync tap, queued for retry:', err);
    }
  },

  undo: () => {
    const entry = get().undoEntry;
    if (!entry) return;

    // Remove from today's taps
    const prev = get().todayTaps[entry.quickActionId];
    if (prev) {
      const newCount = Math.max(0, prev.count - 1);
      const nextTaps = {
        ...get().todayTaps,
        [entry.quickActionId]: { ...prev, count: newCount },
      };
      set({
        undoEntry: null,
        todayTaps: nextTaps,
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTaps)).catch(() => {});
    }

    // Soft-delete on server if we have the serverId
    if (entry.serverId) {
      api.delete(`/logs/${entry.serverId}`)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['day-entries'] });
          queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
          queryClient.invalidateQueries({ queryKey: ['today-logs'] });
        })
        .catch(() => {});
    }

    const timer = get().undoTimer;
    if (timer) clearTimeout(timer);
    set({ undoTimer: null });
  },

  resetToday: () => {
    set({ todayTaps: {}, undoEntry: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  loadTodayTaps: (quickActionId, count, lastAt, boundaryHour) => {
    const bHour = getActiveBoundaryHour(boundaryHour);
    if (!isWithinDayBoundary(lastAt, bHour, new Date())) {
      return;
    }
    const nextTaps = {
      ...get().todayTaps,
      [quickActionId]: {
        id: uuidv4(),
        quickActionId,
        occurredAt: lastAt,
        count,
        lastAt,
        synced: true,
      },
    };
    set({ todayTaps: nextTaps });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTaps)).catch(() => {});
  },

  pruneStaleTaps: (boundaryHour?: number) => {
    const bHour = getActiveBoundaryHour(boundaryHour);
    const now = new Date();
    const currentTaps = get().todayTaps;
    let hasChanges = false;
    const validTaps: Record<string, QuickTapEntry> = {};

    for (const [k, v] of Object.entries(currentTaps)) {
      if (v.lastAt && isWithinDayBoundary(v.lastAt, bHour, now)) {
        validTaps[k] = v;
      } else {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      set({ todayTaps: validTaps });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validTaps)).catch(() => {});
    }
  },

  fetchTodayTaps: async (boundaryHour?: number) => {
    try {
      const bHour = getActiveBoundaryHour(boundaryHour);
      const now = new Date();
      const { start, end } = getDayBoundaryWindow(bHour, now);

      const res = await api.get<any>('/logs', {
        params: {
          from: start.toISOString(),
          to: end.toISOString(),
          limit: 500,
        },
      });

      const logs: any[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);

      const tapsMap: Record<string, QuickTapEntry> = {};
      for (const log of logs) {
        if (log.source === 'quick_action' && log.quickActionId) {
          // Double-check boundary adherence
          if (!isWithinDayBoundary(log.occurredAt, bHour, now)) {
            continue;
          }
          const qid = String(log.quickActionId);
          if (!tapsMap[qid]) {
            tapsMap[qid] = {
              id: log.clientId || log._id,
              quickActionId: qid,
              occurredAt: log.occurredAt,
              count: 1,
              lastAt: log.occurredAt,
              serverId: log._id,
              synced: true,
            };
          } else {
            tapsMap[qid].count += 1;
            if (new Date(log.occurredAt) > new Date(tapsMap[qid].lastAt)) {
              tapsMap[qid].lastAt = log.occurredAt;
            }
          }
        }
      }
      set({ todayTaps: tapsMap });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tapsMap)).catch(() => {});
    } catch (err) {
      console.warn('[quickLog] fetchTodayTaps failed, using cached state:', err);
    }
  },
}));

// Hydrate from AsyncStorage on startup respecting Day Reset Boundary
AsyncStorage.getItem(STORAGE_KEY).then(cached => {
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Record<string, QuickTapEntry>;
      const bHour = getActiveBoundaryHour();
      const now = new Date();
      const validTaps: Record<string, QuickTapEntry> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v.lastAt && isWithinDayBoundary(v.lastAt, bHour, now)) {
          validTaps[k] = v;
        }
      }
      useQuickLogStore.setState({ todayTaps: validTaps });
    } catch {}
  }
}).catch(() => {});
