/**
 * Intelligence Store: the patient's notification policy, flare mode, the daily budget ledger,
 * and the in-app "For you today" queue. Every intelligent candidate goes through `submit`,
 * which applies the budget engine before anything reaches the lock screen.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { uuidv4 } from '../utils/uuid';
import {
  Candidate,
  IntelligenceCapability,
  NotificationType,
  PolicySnapshot,
  InAppReason,
  decide,
  countsAgainstBudget,
} from '../services/intelligence/budgetEngine';
import {
  scheduleIntelligentNotification,
  CHANNEL_ID_SAFETY,
  CHANNEL_ID_HEADS_UP,
  CHANNEL_ID_INSIGHTS,
  CHANNEL_ID_PACING,
  CHANNEL_ID_ALARM,
} from '../services/notifications';
import { entryFromNotification, useNotificationInboxStore } from './notificationInboxStore';

const POLICY_KEY = 'lumen:intel:policy_v1';
const LEDGER_KEY = 'lumen:intel:ledger_v1';
const INBOX_KEY = 'lumen:intel:inbox_v1';
const MAX_INBOX = 20;

export interface ServerPolicy {
  masterEnabled: boolean;
  dailyBudget: number;
  quietHours: { enabled: boolean; start: string; end: string };
  flareMode: { active: boolean; auto: boolean; source?: 'auto' | 'manual'; activatedAt?: string };
  capabilities: Record<IntelligenceCapability, boolean>;
  mutedUntil: string | null;
  suppressedTypes: NotificationType[];
  careTeamPhone: string | null;
  safetyConsentAt: string | null;
}

export type PolicyPatch = Partial<{
  masterEnabled: boolean;
  dailyBudget: number;
  quietHours: Partial<ServerPolicy['quietHours']>;
  capabilities: Partial<Record<IntelligenceCapability, boolean>>;
  flareAutoDetect: boolean;
  mutedUntil: string | null;
  suppressedTypes: NotificationType[];
}>;

export interface InboxItem {
  candidate: Candidate;
  reason: InAppReason;
  addedAt: number;
}

export const DEFAULT_POLICY: ServerPolicy = {
  masterEnabled: true,
  dailyBudget: 2,
  quietHours: { enabled: true, start: '22:00', end: '07:00' },
  flareMode: { active: false, auto: true },
  capabilities: { adaptiveTiming: true, flareRisk: true, triggerWatch: true, pacing: true, safety: false },
  mutedUntil: null,
  suppressedTypes: [],
  careTeamPhone: null,
  safetyConsentAt: null,
};

export function toSnapshot(p: ServerPolicy): PolicySnapshot {
  return {
    masterEnabled: p.masterEnabled,
    dailyBudget: p.dailyBudget,
    quietHours: p.quietHours,
    flareModeActive: p.flareMode.active,
    capabilities: p.capabilities,
    mutedUntil: p.mutedUntil ? Date.parse(p.mutedUntil) : null,
    suppressedTypes: p.suppressedTypes,
  };
}

function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function channelFor(type: NotificationType): string {
  switch (type) {
    case 'SAFETY': return CHANNEL_ID_SAFETY;
    case 'FLARE_RISK': return CHANNEL_ID_HEADS_UP;
    case 'PACING': return CHANNEL_ID_PACING;
    case 'MEDICATION': return CHANNEL_ID_ALARM;
    default: return CHANNEL_ID_INSIGHTS;
  }
}

interface IntelligenceState {
  policy: ServerPolicy;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  sentToday: { date: string; count: number };
  inbox: InboxItem[];

  hydrate: () => Promise<void>;
  fetchPolicy: () => Promise<void>;
  updatePolicy: (patch: PolicyPatch) => Promise<void>;
  setFlareMode: (active: boolean) => Promise<void>;
  evaluateFlareMode: () => Promise<void>;
  submit: (candidates: Candidate[], now?: number) => Promise<void>;
  dismissInboxItem: (candidateId: string, feedback?: 'helpful' | 'not_useful') => Promise<void>;
}

function recordEvent(body: Record<string, unknown>): void {
  api.post('/notification-policy/events', body).catch(() => {});
}

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  policy: DEFAULT_POLICY,
  loaded: false,
  saving: false,
  error: null,
  sentToday: { date: localDateKey(Date.now()), count: 0 },
  inbox: [],

  hydrate: async () => {
    try {
      const [p, l, i] = await Promise.all([
        AsyncStorage.getItem(POLICY_KEY),
        AsyncStorage.getItem(LEDGER_KEY),
        AsyncStorage.getItem(INBOX_KEY),
      ]);
      set(s => ({
        policy: p ? { ...DEFAULT_POLICY, ...JSON.parse(p) } : s.policy,
        sentToday: l ? JSON.parse(l) : s.sentToday,
        inbox: i ? JSON.parse(i) : s.inbox,
      }));
    } catch {
      // A corrupt cache falls back to defaults rather than blocking the app.
    }
  },

  fetchPolicy: async () => {
    try {
      const res = await api.get<ServerPolicy>('/notification-policy');
      set({ policy: res, loaded: true, error: null });
      AsyncStorage.setItem(POLICY_KEY, JSON.stringify(res)).catch(() => {});
    } catch (err: any) {
      set({ loaded: true, error: err?.statusCode === 401 ? null : (err?.message ?? 'Could not load settings') });
    }
  },

  updatePolicy: async (patch) => {
    const previous = get().policy;
    // Optimistic: apply locally so the switch responds instantly, roll back on failure.
    const optimistic: ServerPolicy = {
      ...previous,
      ...(patch.masterEnabled !== undefined ? { masterEnabled: patch.masterEnabled } : {}),
      ...(patch.dailyBudget !== undefined ? { dailyBudget: patch.dailyBudget } : {}),
      ...(patch.mutedUntil !== undefined ? { mutedUntil: patch.mutedUntil } : {}),
      ...(patch.suppressedTypes !== undefined ? { suppressedTypes: patch.suppressedTypes } : {}),
      quietHours: { ...previous.quietHours, ...patch.quietHours },
      capabilities: { ...previous.capabilities, ...patch.capabilities },
      flareMode: patch.flareAutoDetect !== undefined
        ? { ...previous.flareMode, auto: patch.flareAutoDetect }
        : previous.flareMode,
    };
    set({ policy: optimistic, saving: true, error: null });
    try {
      const saved = await api.put<ServerPolicy>('/notification-policy', patch);
      set({ policy: saved, saving: false });
      AsyncStorage.setItem(POLICY_KEY, JSON.stringify(saved)).catch(() => {});
    } catch (err: any) {
      set({ policy: previous, saving: false, error: err?.message ?? 'Could not save settings' });
    }
  },

  setFlareMode: async (active) => {
    const previous = get().policy;
    set({
      policy: {
        ...previous,
        flareMode: {
          ...previous.flareMode,
          active,
          source: active ? 'manual' : undefined,
          activatedAt: active ? new Date().toISOString() : undefined,
        },
      },
      error: null,
    });
    try {
      const saved = await api.post<ServerPolicy>('/notification-policy/flare-mode', { active });
      set({ policy: saved });
      AsyncStorage.setItem(POLICY_KEY, JSON.stringify(saved)).catch(() => {});
    } catch (err: any) {
      set({ policy: previous, error: err?.message ?? 'Could not change flare mode' });
    }
  },

  evaluateFlareMode: async () => {
    try {
      const res = await api.post<{ changed: boolean; policy: ServerPolicy }>('/notification-policy/flare-mode/evaluate', {});
      if (res?.policy) {
        set({ policy: res.policy });
        AsyncStorage.setItem(POLICY_KEY, JSON.stringify(res.policy)).catch(() => {});
      }
    } catch {
      // Detection is best-effort; the manual toggle still works offline.
    }
  },

  submit: async (candidates, now = Date.now()) => {
    if (candidates.length === 0) return;
    const state = get();
    const today = localDateKey(now);
    const sent = state.sentToday.date === today ? state.sentToday.count : 0;

    const result = decide(candidates, toSnapshot(state.policy), { now, sentToday: sent });

    let spent = 0;
    for (const c of result.deliverNow) {
      const id = await scheduleIntelligentNotification({
        title: c.title,
        body: c.body,
        channelId: channelFor(c.type),
        data: { type: `INTEL_${c.type}`, candidateId: c.id, ...c.data },
      });
      if (id && countsAgainstBudget(c.type)) spent++;
      if (id) recordEvent({ notificationType: c.type, clientId: `${c.id}:${today}`, status: 'TRIGGERED' });
    }
    for (const d of result.deferred) {
      const id = await scheduleIntelligentNotification({
        title: d.candidate.title,
        body: d.candidate.body,
        channelId: channelFor(d.candidate.type),
        data: { type: `INTEL_${d.candidate.type}`, candidateId: d.candidate.id, ...d.candidate.data },
        deliverAt: d.deliverAt,
      });
      // A deferred notification spends the budget of the day it will actually arrive,
      // so it is counted when delivered. It does not reduce today's allowance.
      if (id) recordEvent({ notificationType: d.candidate.type, clientId: `${d.candidate.id}:${localDateKey(d.deliverAt)}`, status: 'TRIGGERED', scheduledFor: new Date(d.deliverAt).toISOString() });
    }

    const logged = [
      ...result.deliverNow.map(c => ({ c, at: now })),
      ...result.deferred.map(d => ({ c: d.candidate, at: d.deliverAt })),
      ...result.inApp.map(x => ({ c: x.candidate, at: now })),
    ]
      .map(({ c, at }) => entryFromNotification(
        { title: c.title, body: c.body, data: { type: `INTEL_${c.type}`, candidateId: c.id }, at },
      ))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    useNotificationInboxStore.getState().add(logged).catch(() => {});

    const known = new Set(state.inbox.map(i => i.candidate.id));
    const shownNow = [
      ...result.deliverNow.filter(c => c.inAppNow).map(c => ({ candidate: c, reason: 'watch' as InAppReason })),
      ...result.deferred.filter(d => d.candidate.inAppNow).map(d => ({ candidate: d.candidate, reason: 'watch' as InAppReason })),
    ];
    const additions: InboxItem[] = [...result.inApp, ...shownNow]
      .filter((x, i, all) => !known.has(x.candidate.id) && all.findIndex(y => y.candidate.id === x.candidate.id) === i)
      .map(x => ({ candidate: x.candidate, reason: x.reason, addedAt: now }));
    const inbox = [...additions, ...state.inbox]
      .filter(i => i.candidate.expiresAt === undefined || i.candidate.expiresAt > now)
      .slice(0, MAX_INBOX);

    const sentToday = { date: today, count: sent + spent };
    set({ sentToday, inbox });
    AsyncStorage.multiSet([[LEDGER_KEY, JSON.stringify(sentToday)], [INBOX_KEY, JSON.stringify(inbox)]]).catch(() => {});
  },

  dismissInboxItem: async (candidateId, feedback) => {
    const item = get().inbox.find(i => i.candidate.id === candidateId);
    const inbox = get().inbox.filter(i => i.candidate.id !== candidateId);
    set({ inbox });
    AsyncStorage.setItem(INBOX_KEY, JSON.stringify(inbox)).catch(() => {});
    if (item && feedback) {
      recordEvent({
        notificationType: item.candidate.type,
        clientId: `${candidateId}:feedback:${uuidv4()}`,
        status: 'DISMISSED',
        feedback,
      });
    }
  },
}));
