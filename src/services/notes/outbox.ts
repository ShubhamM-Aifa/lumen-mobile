/**
 * Persisted, ordered queue of Notes & Docs writes.
 * Backed by the generalized createOutbox factory.
 */
import { createOutbox, OutboxMethod, OutboxItem, OutboxState } from '../outbox/createOutbox';

export const NOTES_OUTBOX_KEY = 'lumen:notes_outbox_v1';

const instance = createOutbox(NOTES_OUTBOX_KEY, 'notesOutbox');

export const useNotesOutboxStore = instance.useOutboxStore;
export const loadNotesOutbox = instance.loadOutbox;
export const enqueueNotesWrite = instance.enqueue;
export const flushNotesOutbox = instance.flushOutbox;
export const getNotesPendingCount = instance.getPendingCount;
export const __setNotesAutoFlushForTests = instance.__setAutoFlushForTests;
export const __resetNotesOutboxForTests = instance.__resetOutboxForTests;

export type { OutboxMethod, OutboxItem, OutboxState };

