import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUser, UpdateProfileDto } from '@lumen/shared';
import {
  api,
  saveTokens,
  clearTokens,
  getAccessToken,
  saveAccountTokens,
  getAccountTokens,
  clearAccountTokens,
  getActiveAccountId,
  setActiveAccountId,
} from '../api/client';
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
const SAVED_ACCOUNTS_KEY = 'lumen:auth:saved_accounts_v1';

export interface SavedAccount {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  authMethod?: 'password' | 'google';
  hasPassword?: boolean;
  lastActiveAt: string;
}

interface AuthState {
  user: IUser | null;
  savedAccounts: SavedAccount[];
  isLoading: boolean;
  isAuthenticated: boolean;

  initAuth: () => Promise<void>;
  refreshSavedAccounts: () => Promise<SavedAccount[]>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  addAccount: (email: string, password: string) => Promise<void>;
  addGoogleAccount: (idToken: string) => Promise<void>;
  switchAccount: (targetUserId: string) => Promise<void>;
  removeAccount: (targetUserId: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  fetchProfile: () => Promise<IUser | null>;
  updateProfile: (patch: UpdateProfileDto) => Promise<IUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
  purgeAllLocalData: () => Promise<void>;
  setUser: (user: IUser) => void;
}

async function getStoredSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function persistSavedAccounts(accounts: SavedAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

function resetDependentStores() {
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
  useWeatherStore.setState({
    weather: null,
    assessment: null,
    activeFlareAlert: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  savedAccounts: [],
  isLoading: false,
  isAuthenticated: false,

  initAuth: async () => {
    try {
      const storedAccounts = await getStoredSavedAccounts();
      set({ savedAccounts: storedAccounts });

      const token = await getAccessToken();
      if (!token) {
        set({ user: null, isAuthenticated: false });
        return;
      }

      // Instantly load cached user profile
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
      await get().refreshSavedAccounts();
    } catch {}
  },

  refreshSavedAccounts: async () => {
    const list = await getStoredSavedAccounts();
    set({ savedAccounts: list });
    return list;
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/login',
        { email, password },
      );
      await saveTokens(data.accessToken, data.refreshToken, data.user._id);
      await setActiveAccountId(data.user._id);

      const user = { ...data.user, authMethod: 'password' as const, hasPassword: true };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      await AsyncStorage.setItem(`lumen:auth:user_${data.user._id}`, JSON.stringify(user)).catch(() => {});

      const newAccount: SavedAccount = {
        userId: data.user._id,
        email: data.user.email,
        name: data.user.name,
        authMethod: 'password',
        hasPassword: true,
        lastActiveAt: new Date().toISOString(),
      };
      const existing = await getStoredSavedAccounts();
      const updatedList = [newAccount, ...existing.filter(a => a.userId !== data.user._id)];
      await persistSavedAccounts(updatedList);

      set({ user, isAuthenticated: true, savedAccounts: updatedList });
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
      await saveTokens(data.accessToken, data.refreshToken, data.user._id);
      await setActiveAccountId(data.user._id);

      const user = { ...data.user, authMethod: 'password' as const, hasPassword: true };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      await AsyncStorage.setItem(`lumen:auth:user_${data.user._id}`, JSON.stringify(user)).catch(() => {});

      const newAccount: SavedAccount = {
        userId: data.user._id,
        email: data.user.email,
        name: data.user.name,
        authMethod: 'password',
        hasPassword: true,
        lastActiveAt: new Date().toISOString(),
      };
      const existing = await getStoredSavedAccounts();
      const updatedList = [newAccount, ...existing.filter(a => a.userId !== data.user._id)];
      await persistSavedAccounts(updatedList);

      set({ user, isAuthenticated: true, savedAccounts: updatedList });
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
      await saveTokens(data.accessToken, data.refreshToken, data.user._id);
      await setActiveAccountId(data.user._id);

      const user = { ...data.user, authMethod: 'google' as const };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      await AsyncStorage.setItem(`lumen:auth:user_${data.user._id}`, JSON.stringify(user)).catch(() => {});

      const newAccount: SavedAccount = {
        userId: data.user._id,
        email: data.user.email,
        name: data.user.name,
        authMethod: 'google',
        hasPassword: data.user.hasPassword ?? false,
        lastActiveAt: new Date().toISOString(),
      };
      const existing = await getStoredSavedAccounts();
      const updatedList = [newAccount, ...existing.filter(a => a.userId !== data.user._id)];
      await persistSavedAccounts(updatedList);

      set({ user, isAuthenticated: true, savedAccounts: updatedList });
    } finally {
      set({ isLoading: false });
    }
  },

  addAccount: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/login',
        { email, password },
      );

      // Clean medical isolation: cancel outgoing notifications & clear query cache
      await cancelAllNotifications().catch(() => {});
      queryClient.clear();
      resetDependentStores();

      await saveTokens(data.accessToken, data.refreshToken, data.user._id);
      await setActiveAccountId(data.user._id);

      const user = { ...data.user, authMethod: 'password' as const, hasPassword: true };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      await AsyncStorage.setItem(`lumen:auth:user_${data.user._id}`, JSON.stringify(user)).catch(() => {});

      const newAccount: SavedAccount = {
        userId: data.user._id,
        email: data.user.email,
        name: data.user.name,
        authMethod: 'password',
        hasPassword: true,
        lastActiveAt: new Date().toISOString(),
      };
      const existing = await getStoredSavedAccounts();
      const updatedList = [newAccount, ...existing.filter(a => a.userId !== data.user._id)];
      await persistSavedAccounts(updatedList);

      set({ user, isAuthenticated: true, savedAccounts: updatedList });

      // Initialize config for new account
      useConfigStore.getState().fetchConfig().catch(() => {});
      useReminderStore.getState().fetchReminders().catch(() => {});
    } finally {
      set({ isLoading: false });
    }
  },

  addGoogleAccount: async (idToken: string) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: IUser }>(
        '/auth/google',
        { idToken },
      );

      // Clean medical isolation: cancel outgoing notifications & clear query cache
      await cancelAllNotifications().catch(() => {});
      queryClient.clear();
      resetDependentStores();

      await saveTokens(data.accessToken, data.refreshToken, data.user._id);
      await setActiveAccountId(data.user._id);

      const user = { ...data.user, authMethod: 'google' as const };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      await AsyncStorage.setItem(`lumen:auth:user_${data.user._id}`, JSON.stringify(user)).catch(() => {});

      const newAccount: SavedAccount = {
        userId: data.user._id,
        email: data.user.email,
        name: data.user.name,
        authMethod: 'google',
        hasPassword: data.user.hasPassword ?? false,
        lastActiveAt: new Date().toISOString(),
      };
      const existing = await getStoredSavedAccounts();
      const updatedList = [newAccount, ...existing.filter(a => a.userId !== data.user._id)];
      await persistSavedAccounts(updatedList);

      set({ user, isAuthenticated: true, savedAccounts: updatedList });

      // Initialize config for new account
      useConfigStore.getState().fetchConfig().catch(() => {});
      useReminderStore.getState().fetchReminders().catch(() => {});
    } finally {
      set({ isLoading: false });
    }
  },

  switchAccount: async (targetUserId: string) => {
    const { savedAccounts, user: currentUser } = get();
    if (currentUser && currentUser._id === targetUserId) {
      return; // Already on this account
    }

    const targetAccount = savedAccounts.find(a => a.userId === targetUserId);
    if (!targetAccount) {
      throw new Error('Target account not found in saved accounts.');
    }

    set({ isLoading: true });
    try {
      const tokens = await getAccountTokens(targetUserId);
      if (!tokens.accessToken) {
        throw new Error(`Session expired for ${targetAccount.email}. Please sign in again.`);
      }

      // 1. Clean medical isolation: cancel outgoing scheduled notifications
      await cancelAllNotifications().catch(() => {});

      // 2. Clear React Query memory cache so no previous patient records leak
      queryClient.clear();

      // 3. Reset all dependent in-memory stores
      resetDependentStores();

      // 4. Activate target tokens in API client & SecureStore
      await saveTokens(tokens.accessToken, tokens.refreshToken || '', targetUserId);
      await setActiveAccountId(targetUserId);

      // 5. Update last active timestamp
      const updatedList = savedAccounts.map(a =>
        a.userId === targetUserId
          ? { ...a, lastActiveAt: new Date().toISOString() }
          : a
      );
      await persistSavedAccounts(updatedList);

      // 6. Load cached user or fall back to account metadata
      let userProfile: IUser | null = null;
      try {
        const cachedRaw = await AsyncStorage.getItem(`lumen:auth:user_${targetUserId}`);
        if (cachedRaw) userProfile = JSON.parse(cachedRaw);
      } catch {}

      if (!userProfile) {
        userProfile = {
          _id: targetAccount.userId,
          email: targetAccount.email,
          name: targetAccount.name,
          preferences: { units: 'metric', tempUnit: 'C', dayBoundaryHour: 4, theme: 'system' },
          authMethod: targetAccount.authMethod || 'password',
          hasPassword: targetAccount.hasPassword,
        } as unknown as IUser;
      }

      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userProfile)).catch(() => {});
      set({ user: userProfile, isAuthenticated: true, savedAccounts: updatedList });

      // 7. Background fresh fetch
      get().fetchProfile().catch(() => {});
      useConfigStore.getState().fetchConfig().catch(() => {});
      useReminderStore.getState().fetchReminders().catch(() => {});
    } finally {
      set({ isLoading: false });
    }
  },

  removeAccount: async (targetUserId: string) => {
    const { savedAccounts, user: currentUser } = get();
    await clearAccountTokens(targetUserId);
    await AsyncStorage.removeItem(`lumen:auth:user_${targetUserId}`).catch(() => {});

    const updatedList = savedAccounts.filter(a => a.userId !== targetUserId);
    await persistSavedAccounts(updatedList);
    set({ savedAccounts: updatedList });

    // If removing the currently active account
    if (currentUser && currentUser._id === targetUserId) {
      if (updatedList.length > 0) {
        // Switch to the next available account
        await get().switchAccount(updatedList[0].userId);
      } else {
        // No accounts left, wipe and log out
        await get().purgeAllLocalData();
      }
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
        AsyncStorage.setItem(`lumen:auth:user_${user._id}`, JSON.stringify(user)).catch(() => {});

        // The server splits days in the member's zone, and new accounts default to UTC
        const phoneZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (phoneZone && user.preferences?.timezone !== phoneZone) {
          api.patch<IUser>('/auth/me', { preferences: { timezone: phoneZone } })
            .then(updated => { if (updated) set({ user: updated }); })
            .catch(() => {});
        }

        // Keep savedAccounts entry up to date with latest profile name/email
        const existing = await getStoredSavedAccounts();
        const updatedList = existing.map(a =>
          a.userId === user._id
            ? { ...a, name: user.name, email: user.email }
            : a
        );
        await persistSavedAccounts(updatedList);
        set({ savedAccounts: updatedList });

        return user;
      }
      return null;
    } catch (err: any) {
      if (err?.statusCode === 401) {
        // If 401 and other accounts exist, do not necessarily purge all accounts
        const { savedAccounts } = get();
        const activeId = await getActiveAccountId();
        if (activeId && savedAccounts.length > 1) {
          const remaining = savedAccounts.filter(a => a.userId !== activeId);
          await clearAccountTokens(activeId);
          await persistSavedAccounts(remaining);
          set({ savedAccounts: remaining });
          if (remaining.length > 0) {
            await get().switchAccount(remaining[0].userId);
            return null;
          }
        }
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
      AsyncStorage.setItem(`lumen:auth:user_${updatedUser._id}`, JSON.stringify(updatedUser)).catch(() => {});
      return updatedUser;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const { user, savedAccounts } = get();
    try {
      await api.post('/auth/logout', {}).catch(() => {});
    } catch {}

    if (user && user._id) {
      await clearAccountTokens(user._id);
      await AsyncStorage.removeItem(`lumen:auth:user_${user._id}`).catch(() => {});
      const remaining = savedAccounts.filter(a => a.userId !== user._id);
      await persistSavedAccounts(remaining);
      set({ savedAccounts: remaining });

      if (remaining.length > 0) {
        // Switch seamlessly to the next saved account
        await get().switchAccount(remaining[0].userId);
        return;
      }
    }

    // No other accounts remain: full local clean
    await clearTokens();
    await setActiveAccountId(null);
    try {
      await AsyncStorage.multiRemove([
        USER_CACHE_KEY,
        SAVED_ACCOUNTS_KEY,
        'lumen:activity:history_v1',
        'lumen:reminders:cache_v1',
      ]);
    } catch {}

    set({ user: null, isAuthenticated: false, savedAccounts: [] });
    resetDependentStores();
  },

  logoutAll: async () => {
    const { savedAccounts } = get();
    for (const a of savedAccounts) {
      await clearAccountTokens(a.userId).catch(() => {});
    }
    await get().purgeAllLocalData();
  },

  deleteAccountAndData: async () => {
    set({ isLoading: true });
    try {
      try {
        await api.delete('/auth/me');
      } catch (err: any) {
        if (err?.statusCode !== 401 && err?.statusCode !== 404) {
          throw err;
        }
      }

      const { user, savedAccounts } = get();
      if (user && user._id) {
        await clearAccountTokens(user._id);
        const remaining = savedAccounts.filter(a => a.userId !== user._id);
        await persistSavedAccounts(remaining);
        if (remaining.length > 0) {
          await get().switchAccount(remaining[0].userId);
          return;
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
      await setActiveAccountId(null);
    } catch (e) {
      console.warn('[authStore] Failed to clear tokens:', e);
    }

    // 3. Clear ALL local persistent storage
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
    set({ user: null, isAuthenticated: false, isLoading: false, savedAccounts: [] });
    resetDependentStores();
    useSecurityStore.setState({
      isAppLockEnabled: false,
      isLocked: false,
      isAuthenticating: false,
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
