import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GlanceMetricKey =
  | 'water'
  | 'walking'
  | 'reminders'
  | 'quick_logs'
  | 'day_session'
  | 'active_time';

export interface MetricDefinition {
  key: GlanceMetricKey;
  label: string;
  description: string;
  category: string;
  color: string;
  defaultEnabled: boolean;
}

export const AVAILABLE_METRICS: MetricDefinition[] = [
  {
    key: 'walking',
    label: 'Walking Distance',
    description: 'Daily walking distance in km and quick GPS launch',
    category: 'Activity',
    color: '#FF6B35',
    defaultEnabled: true,
  },
  {
    key: 'active_time',
    label: 'Active Time',
    description: 'Total active and walking minutes accumulated today',
    category: 'Activity',
    color: '#F59E0B',
    defaultEnabled: true,
  },
  {
    key: 'day_session',
    label: 'Day Session',
    description: 'Wake time and bedtime clock-in status',
    category: 'Sleep',
    color: '#10B981',
    defaultEnabled: true,
  },
  {
    key: 'reminders',
    label: 'Active Reminders',
    description: 'Count of upcoming alerts and quick access to alarms',
    category: 'Alerts',
    color: '#8B5CF6',
    defaultEnabled: true,
  },
];

export const DEFAULT_COMPACT_ORDER: GlanceMetricKey[] = [
  'walking',
  'active_time',
  'day_session',
  'reminders',
];

const STORAGE_KEY = 'lumen:glance_metrics_v1';
const ORDER_STORAGE_KEY = 'lumen:glance_metrics_order_v1';

const DEFAULT_STATE: Record<GlanceMetricKey, boolean> = {
  walking: true,
  active_time: true,
  day_session: true,
  reminders: true,
  water: false,
  quick_logs: false,
};

interface GlanceConfigState {
  enabledMetrics: Record<GlanceMetricKey, boolean>;
  compactOrder: GlanceMetricKey[];
  isLoaded: boolean;

  fetchGlanceConfig: () => Promise<void>;
  toggleMetric: (key: GlanceMetricKey) => Promise<boolean>;
  setMetricEnabled: (key: GlanceMetricKey, enabled: boolean) => Promise<void>;
  setCompactOrder: (order: GlanceMetricKey[]) => Promise<void>;
  swapCompactMetrics: (keyA: GlanceMetricKey, keyB: GlanceMetricKey) => Promise<void>;
  moveCompactMetric: (fromIndex: number, toIndex: number) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isMetricEnabled: (key: GlanceMetricKey) => boolean;
  getActiveCount: () => number;
}

export const useGlanceConfigStore = create<GlanceConfigState>((set, get) => ({
  enabledMetrics: { ...DEFAULT_STATE },
  compactOrder: [...DEFAULT_COMPACT_ORDER],
  isLoaded: false,

  fetchGlanceConfig: async () => {
    try {
      const [storedEnabled, storedOrder] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(ORDER_STORAGE_KEY),
      ]);

      let enabledMap = { ...DEFAULT_STATE };
      if (storedEnabled) {
        const parsed = JSON.parse(storedEnabled);
        if (typeof parsed === 'object' && parsed !== null) {
          enabledMap = { ...DEFAULT_STATE, ...parsed };
        }
      }

      let resolvedOrder = [...DEFAULT_COMPACT_ORDER];
      if (storedOrder) {
        try {
          const parsedOrder = JSON.parse(storedOrder);
          if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
            const validKeys = parsedOrder.filter((k: GlanceMetricKey) => DEFAULT_COMPACT_ORDER.includes(k));
            const missingKeys = DEFAULT_COMPACT_ORDER.filter(k => !validKeys.includes(k));
            resolvedOrder = [...validKeys, ...missingKeys];
          }
        } catch {}
      }

      set({
        enabledMetrics: enabledMap,
        compactOrder: resolvedOrder,
        isLoaded: true,
      });
      return;
    } catch {}

    set({
      enabledMetrics: { ...DEFAULT_STATE },
      compactOrder: [...DEFAULT_COMPACT_ORDER],
      isLoaded: true,
    });
  },

  toggleMetric: async (key: GlanceMetricKey) => {
    const current = get().enabledMetrics;
    const nextVal = !current[key];
    const updated = { ...current, [key]: nextVal };

    set({ enabledMetrics: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    return nextVal;
  },

  setMetricEnabled: async (key: GlanceMetricKey, enabled: boolean) => {
    const current = get().enabledMetrics;
    const updated = { ...current, [key]: enabled };

    set({ enabledMetrics: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  setCompactOrder: async (newOrder: GlanceMetricKey[]) => {
    set({ compactOrder: newOrder });
    await AsyncStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(newOrder)).catch(() => {});
  },

  swapCompactMetrics: async (keyA: GlanceMetricKey, keyB: GlanceMetricKey) => {
    const current = [...get().compactOrder];
    const idxA = current.indexOf(keyA);
    const idxB = current.indexOf(keyB);
    if (idxA === -1 || idxB === -1 || idxA === idxB) return;
    const temp = current[idxA];
    current[idxA] = current[idxB];
    current[idxB] = temp;
    set({ compactOrder: current });
    await AsyncStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  },

  moveCompactMetric: async (fromIndex: number, toIndex: number) => {
    const current = [...get().compactOrder];
    if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length || fromIndex === toIndex) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    set({ compactOrder: current });
    await AsyncStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  },

  resetToDefaults: async () => {
    set({
      enabledMetrics: { ...DEFAULT_STATE },
      compactOrder: [...DEFAULT_COMPACT_ORDER],
      isLoaded: true,
    });
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE)),
      AsyncStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(DEFAULT_COMPACT_ORDER)),
    ]).catch(() => {});
  },

  isMetricEnabled: (key: GlanceMetricKey) => {
    return get().enabledMetrics[key] ?? true;
  },

  getActiveCount: () => {
    const state = get().enabledMetrics;
    return AVAILABLE_METRICS.filter(m => state[m.key]).length;
  },
}));
