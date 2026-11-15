/**
 * Generic factory for persisted, ordered outboxes of network writes.
 *
 * Every mutation is applied to local state/cache first and then queued here.
 * The queue is flushed in order, merging rapid PATCHes and cancelling unsent
 * creates on DELETE.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create, StoreApi, UseBoundStore } from 'zustand';
import { api } from '../../api/client';

export type OutboxMethod = 'POST' | 'PATCH' | 'DELETE';

export interface OutboxItem {
  id: string;
  method: OutboxMethod;
  path: string;
  body?: Record<string, unknown>;
  createdAt: number;
}

export interface OutboxState {
  pending: number;
  lastError: string | null;
}

export interface OutboxInstance {
  useOutboxStore: UseBoundStore<StoreApi<OutboxState>>;
  loadOutbox: () => Promise<void>;
  enqueue: (method: OutboxMethod, path: string, body?: Record<string, unknown>) => Promise<void>;
  flushOutbox: () => Promise<void>;
  getPendingCount: () => number;
  __setAutoFlushForTests: (on: boolean) => void;
  __resetOutboxForTests: () => void;
}

const FLUSH_DELAY_MS = 400;

export function createOutbox(storageKey: string, logPrefix = 'outbox'): OutboxInstance {
  const useOutboxStore = create<OutboxState>(() => ({ pending: 0, lastError: null }));

  let queue: OutboxItem[] = [];
  let loaded = false;
  let inFlightId: string | null = null;
  let flushing: Promise<void> | null = null;
  let seq = 0;
  let autoFlush = true;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

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
      await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
    } catch {
      // In-memory queue still functions for this session
    }
  }

  async function loadOutbox(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          queue = [...parsed, ...queue];
        }
      }
    } catch {
      // Corrupt queue, start fresh
    }
    publish();
  }

  function pathBase(path: string): string {
    return path.split('?')[0];
  }

  async function enqueue(method: OutboxMethod, path: string, body?: Record<string, unknown>): Promise<void> {
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
      const createItem = queue.find(
        (q) => q.method === 'POST' && q.path === collection && q.body?._id === entityId && q.id !== inFlightId
      );
      if (createItem) {
        queue = queue.filter(
          (q) => q !== createItem && !(q.path === base && q.id !== inFlightId) && !q.path.startsWith(`${base}/`)
        );
        await save();
        publish();
        return;
      }
    }

    queue.push({
      id: `o${Date.now().toString(36)}${(seq++).toString(36)}`,
      method,
      path: base,
      body,
      createdAt: Date.now(),
    });
    await save();
    publish();
    scheduleFlush();
  }

  function isPermanentFailure(err: unknown, item: OutboxItem): boolean {
    const status = (err as { statusCode?: number } | null)?.statusCode;
    if (typeof status !== 'number') return false;
    if (status === 404 && item.method === 'DELETE') return true;
    if (status === 401 || status === 408 || status === 429 || status >= 500) return false;
    return status >= 400;
  }

  async function send(item: OutboxItem): Promise<void> {
    if (item.method === 'POST') await api.post(item.path, item.body ?? {});
    else if (item.method === 'PATCH') await api.patch(item.path, item.body ?? {});
    else await api.delete(item.path);
  }

  function flushOutbox(): Promise<void> {
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
              console.warn(`[${logPrefix}] dropping rejected request`, item.method, item.path, (err as Error)?.message);
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

  function getPendingCount(): number {
    return queue.length;
  }

  function __setAutoFlushForTests(on: boolean): void {
    autoFlush = on;
  }

  function __resetOutboxForTests(): void {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    queue = [];
    loaded = false;
    inFlightId = null;
    flushing = null;
    seq = 0;
    useOutboxStore.setState({ pending: 0, lastError: null });
  }

  return {
    useOutboxStore,
    loadOutbox,
    enqueue,
    flushOutbox,
    getPendingCount,
    __setAutoFlushForTests,
    __resetOutboxForTests,
  };
}

