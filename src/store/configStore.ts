import { create } from 'zustand';
import { UserConfig } from '@lumen/shared';
import { api } from '../api/client';

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
