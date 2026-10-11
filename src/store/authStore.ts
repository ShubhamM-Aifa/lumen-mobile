import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUser, UpdateProfileDto } from '@lumen/shared';
import { api, saveTokens, clearTokens, getAccessToken } from '../api/client';
import { queryClient } from '../api/queryClient';
import { cancelAllNotifications } from '../services/notifications';
import { useConfigStore } from './configStore';
import { useDaySessionStore } from './daySessionStore';
import { useQuickLogStore } from './quickLogStore';
import { useActivityStore } from './activityStore';
import { useReminderStore } from './reminderStore';
import { useSleepTrackerStore } from './sleepTrackerStore';
import { useSecurityStore } from './securityStore';
import { useWeatherStore } from './weatherStore';

const USER_CACHE_KEY = 'lumen:auth:user_v1';

interface AuthState {
  user: IUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  fetchProfile: () => Promise<IUser | null>;
  updateProfile: (patch: UpdateProfileDto) => Promise<IUser>;
  logout: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
  purgeAllLocalData: () => Promise<void>;
  setUser: (user: IUser) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  initAuth: async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ user: null, isAuthenticated: false });
        return;
      }
      // Instantly load cached user profile so initials and name are ready on frame 1
      const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
      if (cached) {
        try {
          const user = JSON.parse(cached);
          if (user && user._id) {
            set({ user, isAuthenticated: true });
          }
        } catch {}
      } else {
        set({ isAuthenticated: true });
      }

      // Simultaneously fetch fresh profile from API in background
      await get().fetchProfile();
    } catch {}
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/login',
        { email, password },
      );
      await saveTokens(data.accessToken, data.refreshToken);
      const user = { ...data.user, authMethod: 'password' as const, hasPassword: true };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/register',
        { email, password, name },
      );
      await saveTokens(data.accessToken, data.refreshToken);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user)).catch(() => {});
      set({ user: data.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async (idToken: string) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/google',
        { idToken },
      );
      await saveTokens(data.accessToken, data.refreshToken);
      const user = { ...data.user, authMethod: 'google' as const };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setPassword: async (password: string) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/set-password', { password });
      const current = get().user;
      if (current) {
        const updated = { ...current, hasPassword: true };
        set({ user: updated });
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProfile: async () => {
    try {
      const token = await getAccessToken();
      if (!token) return null;
      const user = await api.get<IUser>('/auth/me');
      if (user) {
        set({ user, isAuthenticated: true });
        AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
        return user;
      }
      return null;
    } catch (err: any) {
      if (err?.statusCode === 401) {
        set({ user: null, isAuthenticated: false });
        AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => {});
      }
      return null;
    }
  },

  updateProfile: async (patch: UpdateProfileDto) => {
    set({ isLoading: true });
    try {
      const updatedUser = await api.patch<IUser>('/auth/me', patch);
      set({ user: updatedUser });
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedUser)).catch(() => {});
      return updatedUser;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore network errors during logout
    }
    await clearTokens();

    try {
      await AsyncStorage.multiRemove([
        USER_CACHE_KEY,
        'lumen:activity:history_v1',
        'lumen:reminders:cache_v1',
      ]);
    } catch {}

    set({ user: null, isAuthenticated: false });

    // Reset dependent application stores
    useConfigStore.setState({ config: null, lastFetchedAt: null, isLoading: false });
    useDaySessionStore.setState({ todaySession: null, isLoading: false });
    useQuickLogStore.setState({ todayTaps: {}, undoEntry: null, undoTimer: null });
    useActivityStore.setState({
      activeSession: null,
      isTracking: false,
      isPaused: false,
      activeSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      currentSpeedKmh: 0,
      averagePaceMinPerKm: 0,
      routePoints: [],
      history: [],
      todaySummary: null,
      isLoading: false,
      error: null,
    });
    useReminderStore.setState({ reminders: [], isLoading: false, error: null });
  },

  deleteAccountAndData: async () => {
    set({ isLoading: true });
    try {
      try {
        await api.delete('/auth/me');
      } catch (err: any) {
        // If 401 or 404, user is already deleted or token expired; proceed with local wipe
        if (err?.statusCode !== 401 && err?.statusCode !== 404) {
          throw err;
        }
      }

      await get().purgeAllLocalData();
    } finally {
      set({ isLoading: false });
    }
  },

  purgeAllLocalData: async () => {
    // 1. Cancel all scheduled notification alarms on device
    try {
      await cancelAllNotifications();
    } catch (e) {
      console.warn('[authStore] Failed to cancel notifications:', e);
    }

    // 2. Clear SecureStore auth tokens
    try {
      await clearTokens();
    } catch (e) {
      console.warn('[authStore] Failed to clear tokens:', e);
    }

    // 3. Clear ALL local persistent storage (cache, offline uploads, preferences, sleep)
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('[authStore] Failed to clear AsyncStorage:', e);
    }

    // 4. Clear React Query memory cache
    try {
      queryClient.clear();
    } catch (e) {
      console.warn('[authStore] Failed to clear queryClient:', e);
    }

    // 5. Reset all Zustand application stores to clean state
    set({ user: null, isAuthenticated: false, isLoading: false });
    useConfigStore.setState({ config: null, lastFetchedAt: null, isLoading: false });
    useDaySessionStore.setState({ todaySession: null, isLoading: false });
    useQuickLogStore.setState({ todayTaps: {}, undoEntry: null, undoTimer: null });
    useActivityStore.setState({
      activeSession: null,
      isTracking: false,
      isPaused: false,
      activeSeconds: 0,
      distanceMeters: 0,
      steps: 0,
      currentSpeedKmh: 0,
      averagePaceMinPerKm: 0,
      routePoints: [],
      history: [],
      todaySummary: null,
      isLoading: false,
      error: null,
    });
    useReminderStore.setState({ reminders: [], isLoading: false, error: null });
    useSleepTrackerStore.setState({
      isSleeping: false,
      activeSleepStart: null,
      lastSleepRecord: null,
      targetGoalMinutes: 480,
      minRecoveryMinutes: 420,
      isLoaded: false,
    });
    useSecurityStore.setState({
      isAppLockEnabled: false,
      isLocked: false,
      isAuthenticating: false,
    });
    useWeatherStore.setState({
      weather: null,
      assessment: null,
      activeFlareAlert: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
    });
  },

  setUser: (user) => {
    AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
    set({ user, isAuthenticated: true });
  },
}));

// Early rehydration to prevent any avatar or name flicker on cold launch
AsyncStorage.getItem(USER_CACHE_KEY)
  .then(cached => {
    if (cached) {
      try {
        const user = JSON.parse(cached);
        if (user && user._id && !useAuthStore.getState().user) {
          useAuthStore.setState({ user, isAuthenticated: true });
        }
      } catch {}
    }
  })
  .catch(() => {});

