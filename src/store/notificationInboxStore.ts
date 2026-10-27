/**
 * Notification inbox: a device-local history of what Lumen told the patient, newest first,
 * with a read flag. Filled from intelligent notifications, reminder notifications as they
 * arrive, and notifications still sitting in the system tray.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type InboxKind = 'Reminders' | 'Insights' | 'Community' | 'System';
export type InboxIcon =
  | 'droplet' | 'flame' | 'battery' | 'message' | 'at' | 'sun' | 'cloud-rain'
  | 'sparkles' | 'file-check' | 'pill' | 'bell' | 'shield' | 'help' | 'moon';
export type InboxTone = 'blue' | 'red' | 'green' | 'indigo' | 'orange' | 'teal' | 'purple' | 'gray';

export interface InboxEntry {
  id: string;
  kind: InboxKind;
  icon: InboxIcon;
  tone: InboxTone;
  title: string;
  body: string;
  /** Epoch ms the notification was (or will be) delivered. */
  at: number;
  read: boolean;
  route?: string;
}

export const INBOX_STORAGE_KEY = 'lumen:notification_inbox_v1';
export const MAX_INBOX_ENTRIES = 100;

interface InboxState {
  entries: InboxEntry[];
  isLoaded: boolean;
  load: () => Promise<void>;
  add: (incoming: InboxEntry[]) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

function persist(entries: InboxEntry[]) {
  AsyncStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
}

export const useNotificationInboxStore = create<InboxState>((set, get) => ({
  entries: [],
  isLoaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(INBOX_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const saved: InboxEntry[] = Array.isArray(parsed) ? parsed : [];
      // Entries added before load finished stay on top of what was saved.
      const known = new Set(get().entries.map(e => e.id));
      const merged = [...get().entries, ...saved.filter(e => !known.has(e.id))]
        .sort((a, b) => b.at - a.at)
        .slice(0, MAX_INBOX_ENTRIES);
      set({ entries: merged, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  add: async incoming => {
    const known = new Set(get().entries.map(e => e.id));
    const fresh = incoming.filter(e => !known.has(e.id));
    if (fresh.length === 0) return;
    const entries = [...fresh, ...get().entries].sort((a, b) => b.at - a.at).slice(0, MAX_INBOX_ENTRIES);
    set({ entries });
    persist(entries);
  },

  markRead: async id => {
    const entries = get().entries.map(e => (e.id === id && !e.read ? { ...e, read: true } : e));
    set({ entries });
    persist(entries);
  },

  markAllRead: async () => {
    const entries = get().entries.map(e => (e.read ? e : { ...e, read: true }));
    set({ entries });
    persist(entries);
  },
}));

/** Notifications scheduled for later are not "unread" until they are delivered. */
export function isDelivered(e: InboxEntry, now = Date.now()): boolean {
  return e.at <= now;
}

export function countUnread(entries: InboxEntry[], now = Date.now()): number {
  return entries.filter(e => !e.read && isDelivered(e, now)).length;
}

const INTEL_STYLE: Record<string, Pick<InboxEntry, 'kind' | 'icon' | 'tone' | 'route'>> = {
  SAFETY: { kind: 'System', icon: 'shield', tone: 'red', route: '/notification-settings' },
  MEDICATION: { kind: 'Reminders', icon: 'pill', tone: 'purple', route: '/reminders' },
  PACING: { kind: 'Insights', icon: 'battery', tone: 'green', route: '/walking' },
  FLARE_RISK: { kind: 'Insights', icon: 'flame', tone: 'red', route: '/(tabs)/insights' },
  TRIGGER_WATCH: { kind: 'Insights', icon: 'help', tone: 'orange', route: '/check-in' },
  HYGIENE: { kind: 'Insights', icon: 'sparkles', tone: 'purple', route: '/(tabs)/insights' },
};

export interface NotificationContent {
  /** Stable id of the notification request. */
  identifier?: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown> | null;
  /** Epoch ms. */
  at: number;
}

/** reminder categories -> icon and tint */
const REMINDER_STYLE: Record<string, Pick<InboxEntry, 'icon' | 'tone'>> = {
  MEDICATION: { icon: 'pill', tone: 'purple' },
  HYDRATION: { icon: 'droplet', tone: 'blue' },
  SLEEP: { icon: 'moon', tone: 'indigo' },
  WELLNESS: { icon: 'sun', tone: 'orange' },
  SYMPTOM_TRACKING: { icon: 'sun', tone: 'orange' },
};

/**
 * Turn one delivered notification into an inbox entry. Returns null for ones that do not belong
 * in the inbox (the Test Alarm, or a notification with no text).
 */
export function entryFromNotification(
  n: NotificationContent,
  reminderCategory?: string,
): InboxEntry | null {
  const data = n.data ?? {};
  if (data.test) return null;
  const title = (n.title ?? '').trim();
  const body = (n.body ?? '').trim();
  if (!title && !body) return null;

  const type = typeof data.type === 'string' ? data.type : '';
  const base = { title: title || body, body: title ? body : '', at: n.at, read: false };

  if (type.startsWith('INTEL_') && typeof data.candidateId === 'string') {
    const style = INTEL_STYLE[type.slice(6)] ?? { kind: 'Insights', icon: 'sparkles', tone: 'purple', route: '/(tabs)/insights' };
    return { id: `intel:${data.candidateId}`, ...style, ...base };
  }
  if (type === 'WEATHER_FLARE_ALERT') {
    return { id: `n:${n.identifier ?? type}:${Math.floor(n.at / 60000)}`, kind: 'Insights', icon: 'cloud-rain', tone: 'teal', route: '/(tabs)/insights', ...base };
  }
  if (type === 'PACING_ALERT') {
    return { id: `n:${n.identifier ?? type}:${Math.floor(n.at / 60000)}`, kind: 'Insights', icon: 'battery', tone: 'green', route: '/walking', ...base };
  }
  const style = (reminderCategory && REMINDER_STYLE[reminderCategory]) || { icon: 'bell' as InboxIcon, tone: 'blue' as InboxTone };
  const isReminder = typeof data.reminderId === 'string';
  return {
    id: `n:${n.identifier ?? title}:${Math.floor(n.at / 60000)}`,
    kind: isReminder ? 'Reminders' : 'System',
    route: isReminder ? '/reminders' : undefined,
    ...(isReminder ? style : { icon: 'bell' as InboxIcon, tone: 'gray' as InboxTone }),
    ...base,
  };
}

/** One item from GET /community/notifications. */
export interface CommunityNotificationDto {
  id: string;
  type: 'reply' | 'mention';
  channelId: string;
  channelSlug: string;
  senderName: string;
  snippet: string;
  createdAt: string;
}

export function entryFromCommunity(n: CommunityNotificationDto): InboxEntry {
  const reply = n.type === 'reply';
  return {
    id: n.id,
    kind: 'Community',
    icon: reply ? 'message' : 'at',
    tone: 'indigo',
    title: `${n.senderName} ${reply ? 'replied to you' : 'mentioned you'} in #${n.channelSlug}`,
    body: `“${n.snippet}”`,
    at: Date.parse(n.createdAt),
    read: false,
    route: `/community/${n.channelId}`,
  };
}

/** Label for a day group: Today, Yesterday, or the date. */
export function dayLabel(at: number, now = Date.now()): string {
  const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diffDays = Math.round((startOf(now) - startOf(at)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
