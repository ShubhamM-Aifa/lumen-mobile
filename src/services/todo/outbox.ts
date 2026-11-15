/**
 * Persisted, ordered queue of To Do writes.
 * Backed by the generalized createOutbox factory.
 */
import { createOutbox, OutboxMethod, OutboxItem, OutboxState } from '../outbox/createOutbox';

export const OUTBOX_KEY = 'lumen:todo_outbox_v1';

const instance = createOutbox(OUTBOX_KEY, 'todoOutbox');

export const useOutboxStore = instance.useOutboxStore;
export const loadOutbox = instance.loadOutbox;
export const enqueue = instance.enqueue;
export const flushOutbox = instance.flushOutbox;
export const getPendingCount = instance.getPendingCount;
export const __setAutoFlushForTests = instance.__setAutoFlushForTests;
export const __resetOutboxForTests = instance.__resetOutboxForTests;

export type { OutboxMethod, OutboxItem, OutboxState };
