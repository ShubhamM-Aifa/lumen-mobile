import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserConfig } from '@lumen/shared';
import { api } from '../api/client';

const CONFIG_CACHE_KEY = 'lumen:config:cache_v1';

function triggerWidgetSync(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncLiveWidgetsFromStores } = require('../widgets/widgetSync');
    syncLiveWidgetsFromStores();
  } catch {}
}

interface ConfigState {
  config: UserConfig | null;
  isLoading: boolean;
  lastFetchedAt: number | null;

  fetchConfig: () => Promise<void>;
  invalidate: () => void;
  updateLocalCategory: (id: string, patch: Partial<UserConfig['categories'][0]>) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  lastFetchedAt: null,

  fetchConfig: async () => {
    // Don't re-fetch if fresh (< 5 minutes)
    const last = get().lastFetchedAt;
    if (last && Date.now() - last < 5 * 60 * 1000) return;

    set({ isLoading: true });
    try {
      const data = await api.get<UserConfig>('/config');
      const normalizedData: UserConfig = data ? {
        ...data,
        options: (data.options ?? []).map(o => ({
          ...o,
          captureTime: (o.captureTime === 'auto_now' || (o.captureTime as any) === 'auto') ? 'user_picks' : o.captureTime,
        })),
      } : data;
      set({ config: normalizedData, lastFetchedAt: Date.now() });
      if (normalizedData) {
        AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(normalizedData)).catch(() => {});
        triggerWidgetSync();
      }
    } catch (err: any) {
      // 401 = not logged in yet; silently skip
      if (err?.statusCode !== 401) throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  invalidate: () => set({ config: null, lastFetchedAt: null }),

  updateLocalCategory: (id, patch) => {
    const config = get().config;
    if (!config) return;
    set({
      config: {
        ...config,
        categories: config.categories.map(c => c._id === id ? { ...c, ...patch } : c),
      },
    });
  },
}));

// Rehydrate cached config from AsyncStorage for instant offline/startup access
AsyncStorage.getItem(CONFIG_CACHE_KEY).then(cached => {
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && !useConfigStore.getState().config) {
        useConfigStore.setState({ config: parsed });
        triggerWidgetSync();
      }
    } catch {}
  }
}).catch(() => {});
