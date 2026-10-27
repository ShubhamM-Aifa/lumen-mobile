/**
 * Holds the "contact your doctor" notice that is on screen. These come from the server's fixed
 * rules, are not part of the notification budget, and are shown right away.
 *
 * An urgent ("now") notice is shown every time. A "today" notice is shown once per kind per day,
 * so logging blood in the stool three times does not bury the screen in the same message.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafetyFlag, setSafetyListener } from '../api/client';

export const SAFETY_SEEN_KEY = 'lumen:safety_seen_v1';

interface SafetyState {
  /** Notices waiting to be read, most urgent first. */
  flags: SafetyFlag[];
  show: (incoming: SafetyFlag[], now?: Date) => Promise<void>;
  dismiss: () => void;
}

const dayStamp = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

async function loadSeen(day: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SAFETY_SEEN_KEY);
    const saved = raw ? (JSON.parse(raw) as { day: string; ids: string[] }) : null;
    return saved && saved.day === day ? saved.ids : [];
  } catch {
    return [];
  }
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  flags: [],

  show: async (incoming, now = new Date()) => {
    const day = dayStamp(now);
    const seen = await loadSeen(day);
    const fresh = incoming.filter(f => f.level === 'now' || !seen.includes(f.id));
    if (fresh.length === 0) return;

    const known = new Set(get().flags.map(f => f.id));
    const merged = [...get().flags, ...fresh.filter(f => !known.has(f.id))]
      .sort((a, b) => Number(b.level === 'now') - Number(a.level === 'now'));
    set({ flags: merged });

    const ids = Array.from(new Set([...seen, ...fresh.filter(f => f.level === 'today').map(f => f.id)]));
    AsyncStorage.setItem(SAFETY_SEEN_KEY, JSON.stringify({ day, ids })).catch(() => {});
  },

  dismiss: () => set(state => ({ flags: state.flags.slice(1) })),
}));

// Any log saved anywhere in the app comes through the API client, so one hook covers every screen
setSafetyListener(flags => { useSafetyStore.getState().show(flags).catch(() => {}); });
