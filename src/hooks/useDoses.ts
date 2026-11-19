/**
 * Medicine doses: today's planned doses with their marks, marking Taken / Skipped, clearing a
 * mark, and adherence. A mark made offline waits in a small outbox and is sent later; the server
 * keeps whichever change is newest, so a late offline mark never overwrites a newer one.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '../api/client';
import { queryClient as sharedClient } from '../api/queryClient';
import { uuidv4 } from '../utils/uuid';

export type SlotState = 'taken' | 'skipped' | 'unmarked' | 'upcoming';
export type DoseStatus = 'taken' | 'skipped' | 'extra';

export interface DoseSlot { slot: string; amount: string | null; state: SlotState; doseId: string | null }
export interface DoseItem {
  medicationId: string;
  name: string;
  dose: string | null;
  unit: string | null;
  prn: boolean;
  slots: DoseSlot[];
  extras: Array<{ doseId: string; slot: string; status: DoseStatus; at: string }>;
}
export interface DosesDay { day: string; today: string; items: DoseItem[] }

export interface DoseMarkInput {
  medicationId: string;
  dayKey: string;
  slot: string;
  status: DoseStatus;
  source?: 'notification' | 'checklist' | 'backfill';
}

const OUTBOX_KEY = 'lumen:dose_outbox_v1';

interface Queued extends DoseMarkInput { clientId: string; clientUpdatedAt: string; at: string }

async function readOutbox(): Promise<Queued[]> {
  try { return JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]') as Queued[]; } catch { return []; }
}
async function writeOutbox(items: Queued[]) {
  try { await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items)); } catch { /* best effort */ }
}

const isOffline = (err: unknown) => !(err instanceof ApiError) || err.statusCode >= 500;

async function send(q: Queued) {
  return api.put(`/medications/${q.medicationId}/doses`, {
    dayKey: q.dayKey, slot: q.slot, status: q.status, source: q.source ?? 'checklist',
    clientId: q.clientId, clientUpdatedAt: q.clientUpdatedAt, at: q.at,
  });
}

/** Sends marks made while offline. Safe to call any time. */
export async function flushDoseOutbox(): Promise<number> {
  const items = await readOutbox();
  if (items.length === 0) return 0;
  const left: Queued[] = [];
  let sent = 0;
  for (const q of items) {
    try { await send(q); sent++; } catch (err) { if (isOffline(err)) left.push(q); }
  }
  await writeOutbox(left);
  if (sent) sharedClient.invalidateQueries({ queryKey: ['doses'] });
  return sent;
}

/** Marks one dose; queues it when offline. Used by the checklist and the notification actions. */
export async function markDose(input: DoseMarkInput): Promise<'sent' | 'queued'> {
  const q: Queued = { ...input, clientId: uuidv4(), clientUpdatedAt: new Date().toISOString(), at: new Date().toISOString() };
  try {
    await send(q);
    return 'sent';
  } catch (err) {
    if (!isOffline(err)) throw err;
    await writeOutbox([...(await readOutbox()), q]);
    return 'queued';
  }
}

export function useDoses(day?: string) {
  return useQuery({
    queryKey: ['doses', day ?? 'today'],
    queryFn: async () => {
      await flushDoseOutbox().catch(() => 0);
      return api.get<DosesDay>('/medications/doses', day ? { params: { day } } : undefined);
    },
    staleTime: 60 * 1000,
  });
}

export function useMarkDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markDose,
    onMutate: async (input) => {
      const snapshot = qc.getQueriesData<DosesDay>({ queryKey: ['doses'] });
      qc.setQueriesData<DosesDay>({ queryKey: ['doses'] }, prev => {
        if (!prev || !Array.isArray((prev as DosesDay).items) || prev.day !== input.dayKey) return prev;
        return {
          ...prev,
          items: prev.items.map(i => i.medicationId !== input.medicationId ? i : {
            ...i, slots: i.slots.map(sl => sl.slot === input.slot ? { ...sl, state: input.status === 'skipped' ? 'skipped' : 'taken' } : sl),
          }),
        };
      });
      return { snapshot };
    },
    onError: (_e, _i, ctx) => { for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useClearDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ medicationId, doseId }: { medicationId: string; doseId: string }) => api.delete(`/medications/${medicationId}/doses/${doseId}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export interface Adherence {
  from: string; to: string;
  scheduled: number; taken: number; skipped: number; unmarked: number; extra: number;
  takenShareOfMarked: number | null;
  days: Array<{ day: string; scheduled: number; taken: number; skipped: number; unmarked: number; extra: number }>;
}

export function useAdherence(medicationId: string | null, days = 30) {
  return useQuery({
    queryKey: ['doses', 'adherence', medicationId, days],
    queryFn: () => api.get<Adherence>(`/medications/${medicationId}/adherence`, { params: { days } }),
    enabled: !!medicationId,
  });
}

/** "08:00" → "8:00 AM" in the phone's style. */
export function slotLabel(slot: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(slot);
  if (!m) return slot === 'prn' ? 'As needed' : slot;
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
