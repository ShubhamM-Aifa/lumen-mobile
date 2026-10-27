/**
 * Sleep Tracker Store
 * Manages sleep lifecycle tailored for autoimmune disorder recovery:
 * - Sleep goal the user can set (8 h default, 6 to 10 h); the on-target floor sits one hour below it
 * - Live tracking from "Go to bed" to "Tap when you're awake"
 * - Autoimmune immune modulation & cytokine suppression insights
 * - 1-tap sleep quality check-in (RESTFUL, GOOD, FAIR, POOR)
 * - Persistent storage with AsyncStorage + server sync via daySessionStore
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDaySessionStore } from './daySessionStore';
import { api } from '../api/client';
import { queryClient } from '../api/queryClient';
import { uuidv4 } from '../utils/uuid';
import { logLocationService } from '../services/logLocationService';

export type SleepQuality = 'RESTFUL' | 'GOOD' | 'FAIR' | 'POOR';

export interface SleepRecord {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  bedtime: string; // ISO datetime
  wakeTime: string; // ISO datetime
  quality?: SleepQuality;
  targetGoalMinutes: number; // 480 = 8 hours
}

interface SleepTrackerState {
  isSleeping: boolean;
  activeSleepStart: string | null; // ISO datetime when user went to bed
  lastSleepRecord: SleepRecord | null;
  targetGoalMinutes: number; // default 480 (8 hours)
  minRecoveryMinutes: number; // 420 (7 hours baseline for autoimmune health)
  isLoaded: boolean;

  // Actions
  loadState: () => Promise<void>;
  startSleep: (customTime?: Date) => Promise<void>;
  wakeUp: (customTime?: Date) => Promise<SleepRecord>;
  recordSleepQuality: (quality: SleepQuality) => Promise<void>;
  adjustTimes: (bedtime: Date, wakeTime: Date, quality?: SleepQuality) => Promise<void>;
  getLiveElapsedMinutes: () => number;
  setTargetGoalMinutes: (minutes: number) => Promise<void>;
}

const STORAGE_KEY_ACTIVE_SLEEP = 'lumen:sleep_active_start_v1';
const STORAGE_KEY_LAST_RECORD = 'lumen:sleep_last_record_v1';
const STORAGE_KEY_GOAL = 'lumen:sleep_goal_minutes_v1';
const DEFAULT_TARGET_GOAL_MINUTES = 480; // 8 hours
const MIN_RECOVERY_MINUTES = 420; // 7 hours
export const SLEEP_GOAL_MIN_MINUTES = 360; // 6 hours
export const SLEEP_GOAL_MAX_MINUTES = 600; // 10 hours
export const SLEEP_GOAL_STEP_MINUTES = 30;
const RECOVERY_GAP_MINUTES = 60;

/** Snap a goal to the allowed range and step. */
export function clampSleepGoal(minutes: number): number {
  const snapped = Math.round(minutes / SLEEP_GOAL_STEP_MINUTES) * SLEEP_GOAL_STEP_MINUTES;
  return Math.min(SLEEP_GOAL_MAX_MINUTES, Math.max(SLEEP_GOAL_MIN_MINUTES, snapped));
}

/** Nights at or above this count as on target. */
export function recoveryFloorFor(goalMinutes: number): number {
  return goalMinutes - RECOVERY_GAP_MINUTES;
}

/** 480 -> "8", 450 -> "7.5". */
export function formatGoalHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** "7–8" for an 8 hour goal, "8–9" for 9 hours. */
export function goalRangeLabel(goalMinutes: number): string {
  return `${formatGoalHours(recoveryFloorFor(goalMinutes))}–${formatGoalHours(goalMinutes)}`;
}

export const useSleepTrackerStore = create<SleepTrackerState>((set, get) => ({
  isSleeping: false,
  activeSleepStart: null,
  lastSleepRecord: null,
  targetGoalMinutes: DEFAULT_TARGET_GOAL_MINUTES,
  minRecoveryMinutes: MIN_RECOVERY_MINUTES,
  isLoaded: false,

  setTargetGoalMinutes: async (minutes: number) => {
    const goal = clampSleepGoal(minutes);
    set({ targetGoalMinutes: goal, minRecoveryMinutes: recoveryFloorFor(goal) });
    try {
      await AsyncStorage.setItem(STORAGE_KEY_GOAL, String(goal));
    } catch (e) {
      console.warn('[SleepTrackerStore] setTargetGoalMinutes error:', e);
    }
  },

  loadState: async () => {
    try {
      const [activeStart, lastRecordStr, goalStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_ACTIVE_SLEEP),
        AsyncStorage.getItem(STORAGE_KEY_LAST_RECORD),
        AsyncStorage.getItem(STORAGE_KEY_GOAL),
      ]);

      const savedGoal = goalStr ? Number(goalStr) : NaN;
      if (Number.isFinite(savedGoal)) {
        const goal = clampSleepGoal(savedGoal);
        set({ targetGoalMinutes: goal, minRecoveryMinutes: recoveryFloorFor(goal) });
      }

      let lastRecord: SleepRecord | null = null;
      if (lastRecordStr) {
        try {
          lastRecord = JSON.parse(lastRecordStr);
        } catch {
          lastRecord = null;
        }
      }

      // Check if active sleep exists
      if (activeStart) {
        const startTime = new Date(activeStart).getTime();
        const now = Date.now();
        const elapsedHours = (now - startTime) / 3600000;

        // Auto-sanitize: If sleep started more than 24 hours ago, close it automatically to prevent runaway state
        if (elapsedHours > 24) {
          await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_SLEEP);
          set({
            isSleeping: false,
            activeSleepStart: null,
            lastSleepRecord: lastRecord,
            isLoaded: true,
          });
          return;
        }

        set({
          isSleeping: true,
          activeSleepStart: activeStart,
          lastSleepRecord: lastRecord,
          isLoaded: true,
        });
        return;
      }

      // If no active sleep is stored locally, fallback to daySessionStore if it has bedtime recorded but not woken yet
      const daySession = useDaySessionStore.getState().todaySession;
      if (daySession?.sleepTime && !daySession.wakeTime) {
        set({
          isSleeping: true,
          activeSleepStart: daySession.sleepTime,
          lastSleepRecord: lastRecord,
          isLoaded: true,
        });
        return;
      }

      set({
        isSleeping: false,
        activeSleepStart: null,
        lastSleepRecord: lastRecord,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  startSleep: async (customTime?: Date) => {
    const bedtime = (customTime ?? new Date()).toISOString();
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_SLEEP, bedtime);
      set({
        isSleeping: true,
        activeSleepStart: bedtime,
      });

      // Synchronize with server day session (recordGoToBed)
      try {
        await useDaySessionStore.getState().recordGoToBed(customTime);
      } catch {
        // Backend day session might be already closed or offline, continue with local tracking
      }
    } catch (e) {
      console.warn('[SleepTrackerStore] startSleep error:', e);
    }
  },

  wakeUp: async (customTime?: Date): Promise<SleepRecord> => {
    const { activeSleepStart, targetGoalMinutes } = get();
    const wakeDate = customTime ?? new Date();
    const wakeTimeIso = wakeDate.toISOString();

    // Determine bedtime
    let bedtimeIso = activeSleepStart;
    if (!bedtimeIso) {
      // If user hadn't tapped "Go to bed", assume a healthy default of 8 hours before wake
      const inferredBed = new Date(wakeDate.getTime() - 8 * 3600000);
      bedtimeIso = inferredBed.toISOString();
    }

    const startMs = new Date(bedtimeIso).getTime();
    const endMs = wakeDate.getTime();
    const durationMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
    const todayStr = wakeDate.toISOString().slice(0, 10);

    const record: SleepRecord = {
      date: todayStr,
      durationMinutes,
      bedtime: bedtimeIso,
      wakeTime: wakeTimeIso,
      targetGoalMinutes,
    };

    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_SLEEP),
        AsyncStorage.setItem(STORAGE_KEY_LAST_RECORD, JSON.stringify(record)),
      ]);

      set({
        isSleeping: false,
        activeSleepStart: null,
        lastSleepRecord: record,
      });

      // Synchronize with server day session (recordWakeUp)
      try {
        await useDaySessionStore.getState().recordWakeUp(wakeDate);
      } catch {
        // Ignore if already recorded on server
      }
    } catch (e) {
      console.warn('[SleepTrackerStore] wakeUp error:', e);
    }

    return record;
  },

  recordSleepQuality: async (quality: SleepQuality) => {
    const { lastSleepRecord } = get();
    if (!lastSleepRecord) return;

    const updated: SleepRecord = {
      ...lastSleepRecord,
      quality,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_RECORD, JSON.stringify(updated));
      set({ lastSleepRecord: updated });

      // Optionally log to backend as a wellness log entry
      try {
        const location = await logLocationService.getFastLocationSnapshot().catch(() => null);
        await api.post('/logs', {
          clientId: uuidv4(),
          source: 'sleep_quality_checkin',
          occurredAt: updated.wakeTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: [
            {
              fieldKey: 'sleep_duration_minutes',
              dataType: 'NUMBER',
              value: updated.durationMinutes,
              unit: 'minutes',
            },
            {
              fieldKey: 'sleep_quality',
              dataType: 'ENUM',
              value: quality,
            },
          ],
          ...(location ? { location } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['day-entries'] });
        queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      } catch {
        // Offline or backend unavailable, local state already persisted
      }
    } catch (e) {
      console.warn('[SleepTrackerStore] recordSleepQuality error:', e);
    }
  },

  adjustTimes: async (bedtime: Date, wakeTime: Date, quality?: SleepQuality) => {
    const { targetGoalMinutes, lastSleepRecord } = get();
    const durationMinutes = Math.max(15, Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000));
    const todayStr = wakeTime.toISOString().slice(0, 10);

    const record: SleepRecord = {
      date: todayStr,
      durationMinutes,
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      quality: quality ?? lastSleepRecord?.quality,
      targetGoalMinutes,
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_RECORD, JSON.stringify(record));
      set({
        isSleeping: false,
        activeSleepStart: null,
        lastSleepRecord: record,
      });
    } catch (e) {
      console.warn('[SleepTrackerStore] adjustTimes error:', e);
    }
  },

  getLiveElapsedMinutes: () => {
    const { activeSleepStart, isSleeping } = get();
    if (!isSleeping || !activeSleepStart) return 0;
    const elapsed = Math.round((Date.now() - new Date(activeSleepStart).getTime()) / 60000);
    return Math.max(0, elapsed);
  },
}));
