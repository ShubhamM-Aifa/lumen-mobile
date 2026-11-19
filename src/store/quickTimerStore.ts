/**
 * Timer quick taps (walk, stretch, nap, meditation…): the first tap starts a timer, the next
 * tap stops it and logs the minutes. One timer at a time; starting another stops and logs the
 * first. Kept in AsyncStorage so a running timer survives the app being closed.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuickLogStore } from './quickLogStore';

const STORAGE_KEY = 'lumen:quick_timer_v1';
/** Longer than this is a forgotten timer: it is logged at this length so the day isn't distorted. */
export const MAX_TIMER_SEC = 12 * 3600;

export interface RunningTimer {
  quickActionId: string;
  label: string;
  startedAt: string;
}

interface QuickTimerState {
  running: RunningTimer | null;
  hydrated: boolean;
  start: (quickActionId: string, label: string, boundaryHour?: number) => Promise<void>;
  /** Stops and logs. Returns the logged seconds, or null when nothing was running. */
  stop: (boundaryHour?: number) => Promise<number | null>;
  cancel: () => void;
  hydrate: () => Promise<void>;
}

function persist(running: RunningTimer | null) {
  (running ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(running)) : AsyncStorage.removeItem(STORAGE_KEY)).catch(() => {});
}

export function elapsedSeconds(running: RunningTimer | null, now: Date = new Date()): number {
  if (!running) return 0;
  const sec = Math.round((now.getTime() - new Date(running.startedAt).getTime()) / 1000);
  return Math.max(0, Math.min(MAX_TIMER_SEC, sec));
}

export const useQuickTimerStore = create<QuickTimerState>((set, get) => ({
  running: null,
  hydrated: false,

  start: async (quickActionId, label, boundaryHour) => {
    if (get().running) await get().stop(boundaryHour);
    const running = { quickActionId, label, startedAt: new Date().toISOString() };
    set({ running });
    persist(running);
  },

  stop: async (boundaryHour) => {
    const running = get().running;
    if (!running) return null;
    const sec = elapsedSeconds(running);
    set({ running: null });
    persist(null);
    // Logged at the start time (when the walk began), with its length.
    await useQuickLogStore.getState().tap(running.quickActionId, running.startedAt, boundaryHour, { durationSec: Math.max(1, sec) });
    return sec;
  },

  cancel: () => {
    set({ running: null });
    persist(null);
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as RunningTimer) : null;
      set({ running: parsed && parsed.quickActionId && parsed.startedAt ? parsed : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

useQuickTimerStore.getState().hydrate().catch(() => {});
