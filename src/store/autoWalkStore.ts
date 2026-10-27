/**
 * "Track walks automatically": off until the member turns it on. When on, Lumen reads the steps
 * the phone already counted (no Start button, no GPS) and saves walks it finds, marked
 * "Auto-detected", plus a daily step total.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { queryClient } from '../api/queryClient';
import { getStepSource } from '../services/activity/stepSource';
import { runAutoWalkSync, trackingDayKey } from '../services/activity/autoWalkSync';
import { DEFAULT_MIN_WALK_MINUTES } from '../services/activity/walkDetection';
import { getActiveBoundaryHour } from './quickLogStore';

export const AUTO_WALK_KEY = 'lumen:auto_walk_v1';
/** Opening the app often should not re-read the step history every time. */
const MIN_SYNC_GAP_MS = 5 * 60000;

export type AutoWalkStatus =
  | 'off'
  | 'ready'
  /** The phone has no step history Lumen can read (web, old Android without Health Connect). */
  | 'unavailable'
  /** The member did not allow access, or took it back in phone settings. */
  | 'no_access'
  | 'error';

interface Saved {
  enabled: boolean;
  minWalkMinutes: number;
  cursor: number | null;
  lastSyncAt: number | null;
  todaySteps: number | null;
  todayKey: string | null;
}

interface AutoWalkState extends Saved {
  loaded: boolean;
  status: AutoWalkStatus;
  syncing: boolean;
  lastFound: number;

  hydrate: () => Promise<void>;
  /** Turning on asks the phone for step access. Resolves to the new on/off state. */
  setEnabled: (on: boolean) => Promise<boolean>;
  setMinWalkMinutes: (minutes: number) => Promise<void>;
  sync: (opts?: { force?: boolean; now?: number }) => Promise<void>;
}

const DEFAULTS: Saved = {
  enabled: false,
  minWalkMinutes: DEFAULT_MIN_WALK_MINUTES,
  cursor: null,
  lastSyncAt: null,
  todaySteps: null,
  todayKey: null,
};

/** Today's steps reset at the member's Day Reset Boundary, like the rest of Today. */
const dayKey = (ms: number) => `${trackingDayKey(ms, getActiveBoundaryHour())}@${getActiveBoundaryHour()}`;

let running: Promise<void> | null = null;

export const useAutoWalkStore = create<AutoWalkState>((set, get) => {
  const persist = () => {
    const { enabled, minWalkMinutes, cursor, lastSyncAt, todaySteps, todayKey } = get();
    AsyncStorage.setItem(AUTO_WALK_KEY, JSON.stringify({ enabled, minWalkMinutes, cursor, lastSyncAt, todaySteps, todayKey }))
      .catch(() => {});
  };

  return {
    ...DEFAULTS,
    loaded: false,
    status: 'off',
    syncing: false,
    lastFound: 0,

    hydrate: async () => {
      if (get().loaded) return;
      try {
        const raw = await AsyncStorage.getItem(AUTO_WALK_KEY);
        const saved: Partial<Saved> = raw ? JSON.parse(raw) : {};
        const merged = { ...DEFAULTS, ...saved };
        // Yesterday's count is not today's
        if (merged.todayKey !== dayKey(Date.now())) merged.todaySteps = null;
        set({ ...merged, loaded: true, status: merged.enabled ? 'ready' : 'off' });
      } catch {
        set({ loaded: true });
      }
    },

    setEnabled: async (on) => {
      await get().hydrate();
      if (!on) {
        set({ enabled: false, status: 'off' });
        persist();
        unregisterBackground();
        return false;
      }
      const source = getStepSource();
      if (!source || !(await source.isAvailable())) {
        set({ enabled: false, status: 'unavailable' });
        persist();
        return false;
      }
      const granted = (await source.hasAccess()) || (await source.requestAccess());
      if (!granted) {
        set({ enabled: false, status: 'no_access' });
        persist();
        return false;
      }
      set({ enabled: true, status: 'ready' });
      persist();
      registerBackground();
      get().sync({ force: true }).catch(() => {});
      return true;
    },

    setMinWalkMinutes: async (minutes) => {
      set({ minWalkMinutes: minutes === 5 ? 5 : DEFAULT_MIN_WALK_MINUTES });
      persist();
    },

    sync: async (opts = {}) => {
      await get().hydrate();
      const now = opts.now ?? Date.now();
      const s = get();
      if (!s.enabled) return;
      if (running) return running;
      if (!opts.force && s.lastSyncAt && now - s.lastSyncAt < MIN_SYNC_GAP_MS) return;

      running = (async () => {
        const source = getStepSource();
        if (!source || !(await source.isAvailable())) { set({ status: 'unavailable' }); return; }
        if (!(await source.hasAccess())) { set({ status: 'no_access' }); return; }
        set({ syncing: true });
        try {
          const outcome = await runAutoWalkSync({
            source,
            now,
            cursor: get().cursor,
            minWalkMinutes: get().minWalkMinutes,
            post: (path, body) => api.post(path, body),
            put: (path, body) => api.put(path, body),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            boundaryHour: getActiveBoundaryHour(),
          });
          set({
            cursor: outcome.cursor,
            lastSyncAt: now,
            status: 'ready',
            lastFound: outcome.walks.length,
            ...(outcome.todaySteps !== null ? { todaySteps: outcome.todaySteps, todayKey: dayKey(now) } : {}),
          });
          persist();
          if (outcome.walks.length > 0) refreshScreens();
        } catch {
          set({ status: 'error' });
        } finally {
          set({ syncing: false });
        }
      })();
      try { await running; } finally { running = null; }
    },
  };
});

/** New walks show up on Walking, Today and the timeline without a manual refresh. */
function refreshScreens(): void {
  queryClient.invalidateQueries({ queryKey: ['day-entries'] }).catch(() => {});
  // Lazy to keep this store free of a circular import with the walking store
  const { useActivityStore } = require('./activityStore') as typeof import('./activityStore');
  useActivityStore.getState().fetchTodaySummary().catch(() => {});
  useActivityStore.getState().fetchHistory().catch(() => {});
}

function registerBackground(): void {
  const bg = require('../services/activity/backgroundSync') as typeof import('../services/activity/backgroundSync');
  bg.registerAutoWalkTask().catch(() => {});
}

function unregisterBackground(): void {
  const bg = require('../services/activity/backgroundSync') as typeof import('../services/activity/backgroundSync');
  bg.unregisterAutoWalkTask().catch(() => {});
}
