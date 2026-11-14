/**
 * Persisted, ordered queue of To Do writes.
 *
 * Every change is applied to the local store first and then queued here. The queue is flushed in order,
 * so a task is always created on the server before its edits are sent, and a failed request is kept and
 * retried instead of silently dropped. Nothing is ever replaced by a server copy while changes are waiting.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { api } from '../../api/client';

export const OUTBOX_KEY = 'lumen:todo_outbox_v1';

export type OutboxMethod = 'POST' | 'PATCH' | 'DELETE';

export interface OutboxItem {
  id: string;
  method: OutboxMethod;
  path: string;
  body?: Record<string, unknown>;
  createdAt: number;
}

interface OutboxState {
  pending: number;
  lastError: string | null;
}

export const useOutboxStore = create<OutboxState>(() => ({ pending: 0, lastError: null }));

let queue: OutboxItem[] = [];
let loaded = false;
let inFlightId: string | null = null;
let flushing: Promise<void> | null = null;
let seq = 0;
let autoFlush = true;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Rapid edits (typing a title, dragging) are sent as one request instead of many. */
const FLUSH_DELAY_MS = 400;

function scheduleFlush(): void {
  if (!autoFlush || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOutbox();
  }, FLUSH_DELAY_MS);
}

function publish(lastError?: string | null): void {
  useOutboxStore.setState(
    lastError === undefined ? { pending: queue.length } : { pending: queue.length, lastError }
  );
}

async function save(): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
  } catch {
    /* the in-memory queue still works for this session */
  }
}

export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Anything enqueued before the load finished goes after what was saved.
        queue = [...parsed, ...queue];
      }
    }
  } catch {
    /* corrupt queue: start empty */
  }
  publish();
}

function pathBase(path: string): string {
  return path.split('?')[0];
}

/**
 * Adds a write. Two shortcuts keep the queue small and correct:
 *  - consecutive PATCHes to the same path are merged (the later value wins);
 *  - deleting something whose create never left the device cancels the create and its edits.
 */
export async function enqueue(method: OutboxMethod, path: string, body?: Record<string, unknown>): Promise<void> {
  await loadOutbox();
  const base = pathBase(path);

  if (method === 'PATCH') {
    const last = queue[queue.length - 1];
    if (last && last.method === 'PATCH' && last.path === base && last.id !== inFlightId) {
      last.body = { ...(last.body ?? {}), ...(body ?? {}) };
      await save();
      publish();
      return;
    }
  }

  if (method === 'DELETE') {
    const entityId = base.split('/').pop();
    const collection = base.slice(0, base.lastIndexOf('/'));
    const create = queue.find(
      (q) => q.method === 'POST' && q.path === collection && q.body?._id === entityId && q.id !== inFlightId
    );
    if (create) {
      queue = queue.filter(
        (q) => q !== create && !(q.path === base && q.id !== inFlightId) && !q.path.startsWith(`${base}/`)
      );
      await save();
      publish();
      return;
    }
  }

  queue.push({ id: `o${Date.now().toString(36)}${(seq++).toString(36)}`, method, path: base, body, createdAt: Date.now() });
  await save();
  publish();
  scheduleFlush();
}

/** A request the server will never accept: drop it rather than block everything behind it. */
function isPermanentFailure(err: unknown, item: OutboxItem): boolean {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  if (typeof status !== 'number') return false; // network error: retry later
  if (status === 404 && item.method === 'DELETE') return true; // already gone
  if (status === 401 || status === 408 || status === 429 || status >= 500) return false;
  return status >= 400;
}

async function send(item: OutboxItem): Promise<void> {
  if (item.method === 'POST') await api.post(item.path, item.body ?? {});
  else if (item.method === 'PATCH') await api.patch(item.path, item.body ?? {});
  else await api.delete(item.path);
}

/** Sends everything that is waiting, oldest first. Stops at the first failure that is worth retrying. */
export function flushOutbox(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushing) return flushing;
  flushing = (async () => {
    await loadOutbox();
    try {
      while (queue.length > 0) {
        const item = queue[0];
        inFlightId = item.id;
        try {
          await send(item);
          queue = queue.filter((q) => q !== item);
          publish(null);
          await save();
        } catch (err) {
          if (isPermanentFailure(err, item)) {
            console.warn('[todoOutbox] dropping rejected request', item.method, item.path, (err as Error)?.message);
            queue = queue.filter((q) => q !== item);
            publish((err as Error)?.message ?? 'Request rejected');
            await save();
            continue;
          }
          publish((err as Error)?.message ?? 'Could not sync');
          break;
        } finally {
          inFlightId = null;
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export function getPendingCount(): number {
  return queue.length;
}

/** Test helper: forget everything in memory (does not touch storage). */
export function __setAutoFlushForTests(on: boolean): void {
  autoFlush = on;
}

export function __resetOutboxForTests(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  queue = [];
  loaded = false;
  inFlightId = null;
  flushing = null;
  seq = 0;
  useOutboxStore.setState({ pending: 0, lastError: null });
}
