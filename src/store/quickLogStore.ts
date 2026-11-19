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

function triggerWidgetSync(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncLiveWidgetsFromStores } = require('../widgets/widgetSync');
    syncLiveWidgetsFromStores();
  } catch {}
}

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
  /** Sum of amounts recorded explicitly today (e.g. water ml picked in the sheet). */
  explicitAmount?: number;
  /** How many of today's taps carried an explicit amount (the rest count as the default amount). */
  explicitCount?: number;
  /** Amount of the last tap (for undo). */
  lastAmount?: number;
}

/** What a tap records besides "it happened": an amount (water ml) or a duration (a timer). */
export interface TapDetail {
  amount?: { value: number; unit: string };
  durationSec?: number;
}

export const TAP_AMOUNT_OPTION_ID = 'qa:amount';
export const TAP_TIMER_OPTION_ID = 'qa:timer';

/** The answer a tap with a detail sends (the server and analytics read these option ids). */
export function tapAnswers(detail?: TapDetail) {
  if (detail?.amount && Number.isFinite(detail.amount.value) && detail.amount.value > 0) {
    return [{
      optionId: TAP_AMOUNT_OPTION_ID,
      optionLabelSnapshot: `${detail.amount.value} ${detail.amount.unit}`,
      values: [{ fieldKey: 'amount', dataType: 'number', value: detail.amount.value, unit: detail.amount.unit }],
    }];
  }
  if (typeof detail?.durationSec === 'number' && detail.durationSec > 0) {
    const sec = Math.round(detail.durationSec);
    const min = Math.max(1, Math.round(sec / 60));
    return [{
      optionId: TAP_TIMER_OPTION_ID,
      optionLabelSnapshot: `${min} min`,
      values: [{ fieldKey: 'duration', dataType: 'duration', value: sec, unit: 's' }],
    }];
  }
  return [];
}

/** Today's total amount for a tap: explicit amounts plus the default amount for plain taps. */
export function tapTotalAmount(entry: QuickTapEntry | undefined, defaultValue: number | undefined): number {
  if (!entry) return 0;
  const plain = Math.max(0, entry.count - (entry.explicitCount ?? 0));
  return (entry.explicitAmount ?? 0) + plain * (defaultValue ?? 0);
}

/** Amount recorded by a logged tap, if it carried one. */
export function tapAmountOf(log: { answers?: Array<{ optionId?: string; values?: Array<{ value?: unknown }> }> }): number | undefined {
  const a = log.answers?.find(x => x.optionId === TAP_AMOUNT_OPTION_ID);
  const v = Number(a?.values?.[0]?.value);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

interface QuickLogState {
  // Map: quickActionId → QuickTapEntry (active tracking day window only)
  todayTaps: Record<string, QuickTapEntry>;
  // Undo queue
  undoEntry: QuickTapEntry | null;
  undoTimer: ReturnType<typeof setTimeout> | null;

  tap: (quickActionId: string, customOccurredAt?: string, boundaryHour?: number, detail?: TapDetail) => Promise<void>;
  undo: () => void;
  resetToday: () => void;
  loadTodayTaps: (quickActionId: string, count: number, lastAt: string, boundaryHour?: number) => void;
  fetchTodayTaps: (boundaryHour?: number) => Promise<void>;
  pruneStaleTaps: (boundaryHour?: number) => void;
  rehydrate: (boundaryHour?: number) => Promise<Record<string, QuickTapEntry>>;
}

export const useQuickLogStore = create<QuickLogState>((set, get) => ({
  todayTaps: {},
  undoEntry: null,
  undoTimer: null,

  tap: async (quickActionId: string, customOccurredAt?: string, boundaryHour?: number, detail?: TapDetail) => {
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
    const amount = detail?.amount && detail.amount.value > 0 ? detail.amount.value : undefined;
    const explicitAmount = (isPrevValid ? prev?.explicitAmount ?? 0 : 0) + (amount ?? 0);
    const explicitCount = (isPrevValid ? prev?.explicitCount ?? 0 : 0) + (amount !== undefined ? 1 : 0);

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
      explicitAmount,
      explicitCount,
      lastAmount: amount,
    };
    const nextTaps = { ...cleanedTaps, [quickActionId]: entry };
    set({
      todayTaps: nextTaps,
      undoEntry: entry,
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTaps)).catch(() => {});
    triggerWidgetSync();

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
        answers: tapAnswers(detail),
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
      const undone = entry.lastAmount;
      const nextTaps = {
        ...get().todayTaps,
        [entry.quickActionId]: {
          ...prev,
          count: newCount,
          ...(undone !== undefined
            ? { explicitAmount: Math.max(0, (prev.explicitAmount ?? 0) - undone), explicitCount: Math.max(0, (prev.explicitCount ?? 0) - 1) }
            : {}),
        },
      };
      set({
        undoEntry: null,
        todayTaps: nextTaps,
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextTaps)).catch(() => {});
      triggerWidgetSync();
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
    triggerWidgetSync();
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
    triggerWidgetSync();
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
      triggerWidgetSync();
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
          const amount = tapAmountOf(log);
          if (!tapsMap[qid]) {
            tapsMap[qid] = {
              id: log.clientId || log._id,
              quickActionId: qid,
              occurredAt: log.occurredAt,
              count: 1,
              lastAt: log.occurredAt,
              serverId: log._id,
              synced: true,
              explicitAmount: amount ?? 0,
              explicitCount: amount !== undefined ? 1 : 0,
            };
          } else {
            tapsMap[qid].count += 1;
            if (amount !== undefined) {
              tapsMap[qid].explicitAmount = (tapsMap[qid].explicitAmount ?? 0) + amount;
              tapsMap[qid].explicitCount = (tapsMap[qid].explicitCount ?? 0) + 1;
            }
            if (new Date(log.occurredAt) > new Date(tapsMap[qid].lastAt)) {
              tapsMap[qid].lastAt = log.occurredAt;
            }
          }
        }
      }
      set({ todayTaps: tapsMap });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tapsMap)).catch(() => {});
      triggerWidgetSync();
    } catch (err) {
      console.warn('[quickLog] fetchTodayTaps failed, using cached state:', err);
    }
  },

  rehydrate: async (boundaryHour?: number) => {
    return rehydrateTodayTaps(boundaryHour);
  },
}));

export async function rehydrateTodayTaps(overrideHour?: number): Promise<Record<string, QuickTapEntry>> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as Record<string, QuickTapEntry>;
      const bHour = getActiveBoundaryHour(overrideHour);
      const now = new Date();
      const validTaps: Record<string, QuickTapEntry> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v.lastAt && isWithinDayBoundary(v.lastAt, bHour, now)) {
          validTaps[k] = v;
        }
      }
      useQuickLogStore.setState({ todayTaps: validTaps });
      return validTaps;
    }
  } catch (err) {
    console.warn('[quickLog] rehydrateTodayTaps error:', err);
  }
  return {};
}

// Hydrate from AsyncStorage on startup respecting Day Reset Boundary
rehydrateTodayTaps().then((taps) => {
  if (Object.keys(taps).length > 0) {
    triggerWidgetSync();
  }
}).catch(() => {});
