/**
 * Manages instant quick-tap logs with optimistic updates and undo support.
 * Logs are sent to the server immediately; an "undo" toast appears for 5s.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '../utils/uuid';
import { api } from '../api/client';
import { queryClient } from '../api/queryClient';
import { logLocationService } from '../services/logLocationService';

const STORAGE_KEY = 'lumen:quick_log:today_taps_v1';

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
  // Map: quickActionId → QuickTapEntry (today only; reset on new day)
  todayTaps: Record<string, QuickTapEntry>;
  // Undo queue
  undoEntry: QuickTapEntry | null;
  undoTimer: ReturnType<typeof setTimeout> | null;

  tap: (quickActionId: string) => Promise<void>;
  undo: () => void;
  resetToday: () => void;
  loadTodayTaps: (quickActionId: string, count: number, lastAt: string) => void;
  fetchTodayTaps: () => Promise<void>;
}

export const useQuickLogStore = create<QuickLogState>((set, get) => ({
  todayTaps: {},
  undoEntry: null,
  undoTimer: null,

  tap: async (quickActionId: string) => {
    const now = new Date().toISOString();
    const clientId = uuidv4();
    const prev = get().todayTaps[quickActionId];

    // Optimistic update
    const entry: QuickTapEntry = {
      id: clientId,
      quickActionId,
      occurredAt: now,
      count: (prev?.count ?? 0) + 1,
      lastAt: now,
      synced: false,
    };
    const nextTaps = { ...get().todayTaps, [quickActionId]: entry };
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
      set({ todayTaps: syncedTaps });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(syncedTaps)).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
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

  loadTodayTaps: (quickActionId, count, lastAt) => {
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

  fetchTodayTaps: async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const logs = await api.get<any[]>('/logs', {
        params: {
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
          limit: 500,
        },
      });

      if (Array.isArray(logs)) {
        const tapsMap: Record<string, QuickTapEntry> = {};
        for (const log of logs) {
          if (log.source === 'quick_action' && log.quickActionId) {
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
      }
    } catch (err) {
      console.warn('[quickLog] fetchTodayTaps failed, using cached state:', err);
    }
  },
}));

// Hydrate from AsyncStorage on startup
AsyncStorage.getItem(STORAGE_KEY).then(cached => {
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Record<string, QuickTapEntry>;
      const todayStr = new Date().toISOString().slice(0, 10);
      const validTaps: Record<string, QuickTapEntry> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v.lastAt && v.lastAt.slice(0, 10) === todayStr) {
          validTaps[k] = v;
        }
      }
      useQuickLogStore.setState({ todayTaps: validTaps });
    } catch {}
  }
}).catch(() => {});
