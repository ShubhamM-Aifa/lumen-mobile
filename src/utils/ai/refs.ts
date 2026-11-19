/**
 * Lumen AI chat attachments ("refs"): a day, a note, a task or list, a medicine, a health record,
 * a flare, an experiment, an insight pattern, a weekly review, a PDF or an Explore analysis. The server resolves the
 * full item; the app only keeps kind, id and a chip title.
 */
import type { AiChatRefKind, IAiChatRef } from '../../shared/types';
import { formatDateShort } from '../todo/dates';

export type ChatRef = IAiChatRef;

export const MAX_REFS = 5;
export const MAX_FILE_REFS = 2;
/** The server reads PDFs up to 10 MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const REF_KIND_META: Record<AiChatRefKind, { label: string; emoji: string }> = {
  day: { label: 'Day', emoji: '📅' },
  note: { label: 'Note', emoji: '📝' },
  task: { label: 'Task', emoji: '✅' },
  list: { label: 'List', emoji: '📋' },
  medication: { label: 'Medicine', emoji: '💊' },
  record: { label: 'Health record', emoji: '🩺' },
  flare: { label: 'Flare', emoji: '🔥' },
  experiment: { label: 'Experiment', emoji: '🧪' },
  pattern: { label: 'Pattern', emoji: '🔎' },
  weekly_report: { label: 'Weekly review', emoji: '🗓️' },
  file: { label: 'PDF', emoji: '📄' },
  analysis: { label: 'Analysis', emoji: '📊' },
};

const KINDS = Object.keys(REF_KIND_META) as AiChatRefKind[];

export const sameRef = (a: Pick<ChatRef, 'kind' | 'id'>, b: Pick<ChatRef, 'kind' | 'id'>) => a.kind === b.kind && a.id === b.id;

/** Adds a ref unless it is already there or the limits are reached. Returns the same array when nothing changed. */
export function addRef(refs: ChatRef[], ref: ChatRef): ChatRef[] {
  if (refs.some(r => sameRef(r, ref))) return refs;
  if (refs.length >= MAX_REFS) return refs;
  if (ref.kind === 'file' && refs.filter(r => r.kind === 'file').length >= MAX_FILE_REFS) return refs;
  return [...refs, ref];
}

/** Chip title for a day: "Mon, 17 Nov" (year added when it isn't this year). */
export const dayRefTitle = (date: string, todayStr: string) => formatDateShort(date, todayStr);

/** For the `attach` route param of /ai/new. */
export const encodeRef = (ref: ChatRef) => JSON.stringify({ kind: ref.kind, id: ref.id, title: ref.title });

export function decodeRef(raw: unknown): ChatRef | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ChatRef>;
    if (!v || typeof v.id !== 'string' || !v.id || !KINDS.includes(v.kind as AiChatRefKind)) return null;
    return { kind: v.kind as AiChatRefKind, id: v.id.slice(0, 200), title: String(v.title ?? '').slice(0, 200) || REF_KIND_META[v.kind as AiChatRefKind].label };
  } catch {
    return null;
  }
}

/** Where tapping a sent chip goes. Files have no screen (null): the chat opens their link instead. */
export function refRoute(ref: Pick<ChatRef, 'kind' | 'id'>): string | null {
  switch (ref.kind) {
    case 'day': return `/(tabs)/timeline?date=${ref.id}`;
    case 'note': return `/notes/${ref.id}`;
    case 'task': return `/todo/task/${ref.id}`;
    case 'list': return `/todo/list/${ref.id}`;
    case 'record': return `/records/${ref.id}`;
    case 'medication': return '/customize/medications';
    case 'weekly_report': return '/ai/reports';
    case 'pattern':
    case 'experiment':
    case 'flare': return '/(tabs)/insights';
    case 'file': return null;
    // An Explore question travels as a token; the Insights Explore pane re-runs it.
    case 'analysis': return `/(tabs)/insights?tab=explore&q=${encodeURIComponent(ref.id)}`;
  }
  return null;
}
