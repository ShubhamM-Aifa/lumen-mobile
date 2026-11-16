/**
 * Lumen AI notifications are written and pushed by the server (it applies the same daily budget,
 * quiet hours and flare mode). The app pulls the recent ones so they also appear in "For you
 * today" and the notification inbox, including pushes that arrived while it was closed and notes
 * that were held back (budget, quiet hours). Nothing is scheduled again on the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../api/client';
import type { Candidate } from './budgetEngine';

export type AiNoteKind = 'briefing' | 'nudge' | 'check_in' | 'log_reply' | 'test';

export interface AiNoteDto {
  id: string;
  kind: AiNoteKind;
  title: string;
  body: string;
  route: string;
  conversationId: string | null;
  pushed: boolean;
  reason: string | null;
  dateKey: string;
  createdAt: string;
}

const SEEN_KEY = 'lumen:intel:ai_seen_v1';
const MAX_SEEN = 100;
const SHOW_FOR_MS = 24 * 3600_000;

const TIMELINESS: Record<AiNoteKind, number> = { log_reply: 1, briefing: 0.75, nudge: 0.7, check_in: 0.6, test: 0.5 };

const WHY: Record<AiNoteKind, string> = {
  briefing: 'Your morning briefing, written by Lumen AI from your own data',
  nudge: 'Lumen AI noticed this in what you logged today',
  check_in: 'Lumen AI’s evening question about your day',
  log_reply: 'Lumen AI’s reply to something serious you logged',
  test: 'A test notification you asked for',
};

/** Kinds that count against the daily budget when pushed (a log reply and a test don't). */
export function countsAgainstBudget(kind: AiNoteKind): boolean {
  return kind === 'briefing' || kind === 'nudge' || kind === 'check_in';
}

export function candidateFromNote(note: AiNoteDto): Candidate {
  const created = Date.parse(note.createdAt);
  return {
    id: `ai:${note.id}`,
    type: 'AI_NOTE',
    title: note.title,
    body: note.body,
    confidence: 0.8,
    timeliness: TIMELINESS[note.kind] ?? 0.6,
    expiresAt: (Number.isFinite(created) ? created : Date.now()) + SHOW_FOR_MS,
    inAppNow: true,
    provenance: [WHY[note.kind] ?? 'Written by Lumen AI from your own data'],
    data: { route: note.route, kind: note.kind, aiNotificationId: note.id, conversationId: note.conversationId, pushed: note.pushed },
  };
}

async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Notes not seen before on this phone, oldest first; marks them seen. */
export async function takeUnseen(notes: AiNoteDto[]): Promise<AiNoteDto[]> {
  const seen = await readSeen();
  const known = new Set(seen);
  const fresh = notes.filter(n => !known.has(n.id)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (fresh.length) {
    const next = [...fresh.map(n => n.id), ...seen].slice(0, MAX_SEEN);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
  }
  return fresh;
}

let inFlight: Promise<void> | null = null;

/**
 * Pull recent Lumen AI notes into the app. Quietly does nothing when Lumen AI is off (403) or
 * offline. `add` is the intelligence store's addAiNotes.
 */
export function syncAiNotes(add: (notes: AiNoteDto[]) => void): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const notes = await api.get<AiNoteDto[]>(`/ai/notifications?since=${encodeURIComponent(since)}`);
      const fresh = await takeUnseen(Array.isArray(notes) ? notes : []);
      if (fresh.length) add(fresh);
    } catch {
      // Lumen AI off, offline or an older server: nothing to show.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
