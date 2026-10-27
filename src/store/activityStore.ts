/**
 * Activity & Walking Tracker Store.
 * Manages active session lifecycle (Start, Pause, Resume, Stop), hardware sensor subscriptions,
 * live metrics calculation (distance, pace, speed, steps), and persistence.
 */
import { create } from 'zustand';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from '../utils/uuid';
import { IActivitySession, IActivityPoint, ActivityType } from '@lumen/shared';
import { api } from '../api/client';
import { queryClient } from '../api/queryClient';
import { locationService } from '../services/locationService';
import { sendPacingAlertNotification } from '../services/notifications';
import { getStepSource } from '../services/activity/stepSource';
import { getDayBoundaryWindow } from '../utils/dayBoundary';
import { getActiveBoundaryHour } from './quickLogStore';

const SESSIONS_CACHE_KEY = 'lumen:activity:history_v1';

export interface PacingAlert {
  id: string;
  distanceKm: number;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

export interface WalkingSummaryStats {
  period: string;
  count: number;
  totalDistanceMeters: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  totalDurationMinutes: number;
  totalSteps: number;
  averagePaceMinPerKm: number;
  averageSpeedKmh: number;
}

interface ActivityState {
  // Active session live state
  activeSession: IActivitySession | null;
  isTracking: boolean;
  isPaused: boolean;
  startTimeMs: number;
  accumulatedActiveMs: number;
  lastResumeMs: number;
  activeSeconds: number;
  distanceMeters: number;
  steps: number;
  currentSpeedKmh: number;
  averagePaceMinPerKm: number;
  routePoints: IActivityPoint[];

  // Historical data & daily aggregates
  history: IActivitySession[];
  todaySummary: WalkingSummaryStats | null;
  activePacingAlert: PacingAlert | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startWalking: (title?: string) => Promise<boolean>;
  pauseWalking: () => Promise<void>;
  resumeWalking: () => Promise<void>;
  stopWalking: (notes?: string) => Promise<IActivitySession | null>;
  discardWalking: () => Promise<void>;
  dismissPacingAlert: () => void;
  recalculateActiveTime: () => number;
  /** "Not a walk": removes a walk from history, totals and the timeline. */
  removeSession: (id: string) => Promise<void>;

  fetchHistory: () => Promise<void>;
  fetchTodaySummary: () => Promise<void>;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const useActivityStore = create<ActivityState>((set, get) => ({
  activeSession: null,
  isTracking: false,
  isPaused: false,
  startTimeMs: 0,
  accumulatedActiveMs: 0,
  lastResumeMs: 0,
  activeSeconds: 0,
  distanceMeters: 0,
  steps: 0,
  currentSpeedKmh: 0,
  averagePaceMinPerKm: 0,
  routePoints: [],

  history: [],
  todaySummary: null,
  activePacingAlert: null,
  isLoading: false,
  error: null,

  recalculateActiveTime: () => {
    const { isTracking, isPaused, accumulatedActiveMs, lastResumeMs, distanceMeters } = get();
    if (!isTracking) return get().activeSeconds;

    const now = Date.now();
    const currentActiveMs = accumulatedActiveMs + (isPaused || lastResumeMs <= 0 ? 0 : Math.max(0, now - lastResumeMs));
    const totalSeconds = Math.floor(currentActiveMs / 1000);
    const distKm = distanceMeters / 1000;
    const pace = distKm > 0.05 && totalSeconds > 10 ? (totalSeconds / 60) / distKm : 0;

    set({
      activeSeconds: totalSeconds,
      averagePaceMinPerKm: pace,
    });

    return totalSeconds;
  },

  startWalking: async (title: string = 'Outdoor Walk') => {
    const clientId = uuidv4();
    const now = Date.now();
    const startTime = new Date(now).toISOString();

    const initialSession: IActivitySession = {
      _id: clientId,
      clientId,
      userId: '',
      activityType: 'WALKING',
      title,
      status: 'ACTIVE',
      startTime,
      totalDurationSeconds: 0,
      activeDurationSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      hasRouteData: false,
      createdAt: startTime,
      updatedAt: startTime,
    };

    set({
      activeSession: initialSession,
      isTracking: true,
      isPaused: false,
      startTimeMs: now,
      accumulatedActiveMs: 0,
      lastResumeMs: now,
      activeSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      currentSpeedKmh: 0,
      averagePaceMinPerKm: 0,
      routePoints: [],
    });

    // Start live hardware tracking
    const trackingStarted = await locationService.startTracking(
      (point, totalDistanceMeters, currentSpeedKmh) => {
        // Sync active seconds and calculate live pace
        const currentActiveSec = get().recalculateActiveTime();
        const distKm = totalDistanceMeters / 1000;
        const avgPace = distKm > 0.05 && currentActiveSec > 10 ? (currentActiveSec / 60) / distKm : 0;

        set(state => ({
          distanceMeters: totalDistanceMeters,
          currentSpeedKmh,
          averagePaceMinPerKm: avgPace,
          routePoints: [...state.routePoints, point],
        }));
      },
      (steps) => {
        set({ steps });
      }
    );

    if (!trackingStarted) {
      console.warn('[activityStore] Hardware location tracking unavailable.');
    }

    // Start elapsed active time ticker (updates UI every 1s while active)
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!get().isPaused && get().isTracking) {
        get().recalculateActiveTime();
      }
    }, 1000);

    // Initial server call (non-blocking)
    api.post<IActivitySession>('/activity-sessions', {
      clientId,
      activityType: 'WALKING',
      title,
      startTime,
    }).then(serverSession => {
      if (serverSession && serverSession._id) {
        set(state => ({
          activeSession: state.activeSession ? { ...state.activeSession, _id: serverSession._id } : null,
        }));
      }
    }).catch(() => {});

    return true;
  },

  pauseWalking: async () => {
    if (!get().isTracking || get().isPaused) return;

    const now = Date.now();
    const { accumulatedActiveMs, lastResumeMs } = get();
    const newAccumulatedMs = accumulatedActiveMs + (lastResumeMs > 0 ? Math.max(0, now - lastResumeMs) : 0);
    const newSeconds = Math.floor(newAccumulatedMs / 1000);

    set({
      isPaused: true,
      currentSpeedKmh: 0,
      accumulatedActiveMs: newAccumulatedMs,
      lastResumeMs: now,
      activeSeconds: newSeconds,
    });

    await locationService.pauseTracking();

    const session = get().activeSession;
    if (session) {
      api.post(`/activity-sessions/${session._id}/pause`, {
        activeDurationSeconds: newSeconds,
        distanceMeters: get().distanceMeters,
        steps: get().steps,
      }).catch(() => {});
    }
  },

  resumeWalking: async () => {
    if (!get().isTracking || !get().isPaused) return;

    const now = Date.now();
    set({
      isPaused: false,
      lastResumeMs: now,
    });
    get().recalculateActiveTime();

    await locationService.resumeTracking(
      (point, totalDistanceMeters, currentSpeedKmh) => {
        const currentActiveSec = get().recalculateActiveTime();
        const distKm = totalDistanceMeters / 1000;
        const avgPace = distKm > 0.05 && currentActiveSec > 10 ? (currentActiveSec / 60) / distKm : 0;
        set(state => ({
          distanceMeters: totalDistanceMeters,
          currentSpeedKmh,
          averagePaceMinPerKm: avgPace,
          routePoints: [...state.routePoints, point],
        }));
      },
      (steps) => set({ steps })
    );

    const session = get().activeSession;
    if (session) {
      api.post(`/activity-sessions/${session._id}/resume`, {}).catch(() => {});
    }
  },

  stopWalking: async (notes?: string) => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    const finalActiveSeconds = get().recalculateActiveTime();
    const { distanceMeters: finalDistance, steps: finalSteps } = await locationService.stopTracking();
    const { activeSession, distanceMeters, averagePaceMinPerKm, routePoints } = get();

    if (!activeSession) return null;

    const endTime = new Date().toISOString();
    // The live step counter stops while the screen is locked; the phone's own history does not.
    const historySteps = await stepsFromPhoneHistory(activeSession.startTime, endTime);
    const distKm = Math.max(distanceMeters, finalDistance) / 1000;
    const avgSpeed = finalActiveSeconds > 0 ? distKm / (finalActiveSeconds / 3600) : 0;

    const completedSession: IActivitySession = {
      ...activeSession,
      status: 'COMPLETED',
      endTime,
      activeDurationSeconds: finalActiveSeconds,
      totalDurationSeconds: finalActiveSeconds,
      distanceMeters: Math.max(distanceMeters, finalDistance),
      steps: Math.max(get().steps, finalSteps, historySteps),
      averageSpeedKmh: Number(avgSpeed.toFixed(2)),
      averagePaceMinPerKm: Number(averagePaceMinPerKm.toFixed(2)),
      hasRouteData: routePoints.length > 0,
      routePoints: routePoints.slice(0, 300), // Cap route points
      notes,
      updatedAt: endTime,
    };

    // Reset live state and append to history
    set(state => ({
      activeSession: null,
      isTracking: false,
      isPaused: false,
      startTimeMs: 0,
      accumulatedActiveMs: 0,
      lastResumeMs: 0,
      activeSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      currentSpeedKmh: 0,
      averagePaceMinPerKm: 0,
      routePoints: [],
      history: [completedSession, ...state.history],
    }));

    // Spoon Theory Pacing Check: If walk exceeded 3.0 km, trigger fatigue crash prevention warning
    if (distKm >= 3.0) {
      const pacingAlertObj: PacingAlert = {
        id: `pacing-${Date.now()}`,
        distanceKm: Number(distKm.toFixed(1)),
        message: `You completed ${distKm.toFixed(1)} km! Autoimmune joints and muscles need post-exertional rest. Elevate your legs and hydrate now to prevent fatigue crashes.`,
        timestamp: Date.now(),
        dismissed: false,
      };
      set({ activePacingAlert: pacingAlertObj });
      sendPacingAlertNotification(
        '🏃 Spoon Theory Pacing Alert',
        pacingAlertObj.message,
        distKm
      ).catch(() => {});
    }

    // Cache updated history
    AsyncStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(get().history)).catch(() => {});

    // Sync to backend and create Timeline LogEntry
    try {
      await api.post(`/activity-sessions/${completedSession._id}/stop`, {
        endTime,
        totalDurationSeconds: finalActiveSeconds,
        activeDurationSeconds: finalActiveSeconds,
        distanceMeters: completedSession.distanceMeters,
        steps: completedSession.steps,
        averageSpeedKmh: completedSession.averageSpeedKmh,
        averagePaceMinPerKm: completedSession.averagePaceMinPerKm,
        routePoints: completedSession.routePoints,
        notes,
        createTimelineLog: true,
      });

      get().fetchTodaySummary().catch(() => {});
    } catch (e) {
      console.warn('[activityStore] Failed to sync stopped session:', e);
    }

    return completedSession;
  },

  discardWalking: async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    await locationService.stopTracking();

    set({
      activeSession: null,
      isTracking: false,
      isPaused: false,
      startTimeMs: 0,
      accumulatedActiveMs: 0,
      lastResumeMs: 0,
      activeSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      currentSpeedKmh: 0,
      averagePaceMinPerKm: 0,
      routePoints: [],
    });
  },

  dismissPacingAlert: () => {
    const current = get().activePacingAlert;
    if (current) {
      set({ activePacingAlert: { ...current, dismissed: true } });
    }
  },

  removeSession: async (id: string) => {
    const before = get().history;
    set({ history: before.filter(s => s._id !== id) });
    try {
      await api.delete(`/activity-sessions/${id}`);
      AsyncStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(get().history)).catch(() => {});
      get().fetchTodaySummary().catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['day-entries'] }).catch(() => {});
    } catch (err) {
      set({ history: before });
      throw err;
    }
  },

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      const cached = await AsyncStorage.getItem(SESSIONS_CACHE_KEY);
      if (cached) {
        set({ history: JSON.parse(cached) });
      }
    } catch {}

    try {
      const serverSessions = await api.get<IActivitySession[]>('/activity-sessions?activityType=WALKING&limit=50');
      if (Array.isArray(serverSessions)) {
        set({ history: serverSessions, isLoading: false });
        AsyncStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(serverSessions)).catch(() => {});
      }
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Failed to fetch history' });
    }
  },

  fetchTodaySummary: async () => {
    try {
      // "Today" starts at the member's Day Reset Boundary on this phone, not the server's midnight
      const { start } = getDayBoundaryWindow(getActiveBoundaryHour());
      const summary = await api.get<WalkingSummaryStats>('/activity-sessions/walking/summary', {
        params: { period: 'today', from: start.toISOString() },
      });
      if (summary) {
        set({ todaySummary: summary });
      }
    } catch {}
  },
}));

/** Steps the phone recorded between two times, or 0 when there is no readable history. */
async function stepsFromPhoneHistory(startIso: string, endIso: string): Promise<number> {
  try {
    const source = getStepSource();
    if (!source || !(await source.hasAccess())) return 0;
    return await source.stepsBetween(new Date(startIso), new Date(endIso));
  } catch {
    return 0;
  }
}

// Automatically synchronize active time when device wakes up or app comes into foreground
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    const state = useActivityStore.getState();
    if (state.isTracking && !state.isPaused) {
      state.recalculateActiveTime();
    }
  }
});
