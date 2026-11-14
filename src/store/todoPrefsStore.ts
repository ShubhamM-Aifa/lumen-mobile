import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TaskEnergyCost } from '../shared/types';
import { SortField, SortDir, SMART_VIEW_IDS, SmartViewId } from '../utils/todo/views';

const PREFS_KEY = 'lumen:todo_prefs_v1';

export interface ViewPrefs {
  sortField: SortField;
  sortDir: SortDir;
  showCompleted: boolean;
  energy: TaskEnergyCost | null;
  category: string | null;
}

export interface TodoSettings {
  /** New tasks go to the top of the list (otherwise the bottom). */
  addOnTop: boolean;
  /** Starred tasks float above the rest, whatever the sort. */
  starredToTop: boolean;
  /** Ask before deleting a task (off by default: deleting shows an Undo instead). */
  confirmDelete: boolean;
  /** Show tasks due today in My Day even if they were never added. */
  dueTodayInMyDay: boolean;
  /** Hide smart lists from the To Do home. */
  hiddenSmartLists: SmartViewId[];
  /** Hide smart lists that have no open tasks. */
  hideEmptySmartLists: boolean;
}

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  sortField: 'custom',
  sortDir: 'asc',
  showCompleted: true,
  energy: null,
  category: null,
};

export const DEFAULT_SETTINGS: TodoSettings = {
  addOnTop: true,
  starredToTop: false,
  confirmDelete: false,
  dueTodayInMyDay: false,
  hiddenSmartLists: [],
  hideEmptySmartLists: false,
};

interface PrefsState {
  loaded: boolean;
  views: Record<string, Partial<ViewPrefs>>;
  settings: TodoSettings;
  load: () => Promise<void>;
  setViewPrefs: (viewId: string, patch: Partial<ViewPrefs>) => void;
  setSettings: (patch: Partial<TodoSettings>) => void;
  toggleSmartList: (id: SmartViewId) => void;
}

function persist(state: Pick<PrefsState, 'views' | 'settings'>): void {
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ views: state.views, settings: state.settings })).catch(() => {});
}

export const useTodoPrefs = create<PrefsState>((set, get) => ({
  loaded: false,
  views: {},
  settings: DEFAULT_SETTINGS,

  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          views: parsed?.views && typeof parsed.views === 'object' ? parsed.views : {},
          settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings ?? {}) },
        });
      }
    } catch {
      /* use defaults */
    }
    set({ loaded: true });
  },

  setViewPrefs: (viewId, patch) => {
    const views = { ...get().views, [viewId]: { ...(get().views[viewId] ?? {}), ...patch } };
    set({ views });
    persist({ views, settings: get().settings });
  },

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    persist({ views: get().views, settings });
  },

  toggleSmartList: (id) => {
    const hidden = get().settings.hiddenSmartLists;
    get().setSettings({ hiddenSmartLists: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] });
  },
}));

/** Preferences for one view, with defaults filled in. Planned defaults to due-date order. */
export function resolveViewPrefs(views: Record<string, Partial<ViewPrefs>>, viewId: string): ViewPrefs {
  const base: ViewPrefs = viewId === 'planned' ? { ...DEFAULT_VIEW_PREFS, sortField: 'dueDate' } : DEFAULT_VIEW_PREFS;
  return { ...base, ...(views[viewId] ?? {}) };
}

export { SMART_VIEW_IDS };
