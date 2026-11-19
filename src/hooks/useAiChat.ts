/**
 * Lumen AI: chat over all of the member's own data, photo analysis and weekly reviews.
 * Server: server/src/routes/ai.ts. Everything except /ai/access needs AI full access on.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AiChatRefKind, IAiChatRef } from '../shared/types';

export interface AiAccess {
  fullAccess: boolean;
  photoAccess: boolean;
  freeTierAcknowledged: boolean;
  hasPhotoPin: boolean;
  /** False when the server has no AI key at all. */
  configured: boolean;
  claudeAcknowledged: boolean;
  /** What the next answer runs on (the member's choice, or Gemini if that can't run). */
  provider: AiProviderId;
  model: string;
  modelLabel: string;
  /** The member picked a model that can't run right now (e.g. Claude without a server key). */
  chosenModelUnavailable: boolean;
  voice: AiVoiceSettings;
  /** Daily health journal note (Lumen AI writes yesterday's entry each morning). */
  journal?: boolean;
}

export type AiProviderId = 'gemini' | 'claude';

export interface AiVoiceSettings {
  /** Gemini voice name, e.g. 'Kore'. */
  ttsVoice: string;
  /** Natural AI voice (Gemini TTS) vs the phone's own voice. */
  natural: boolean;
  /** Listening language: English/Hinglish or Hindi. */
  sttLang: 'en-IN' | 'hi-IN';
}

export interface AiModelInfo {
  id: string;
  provider: AiProviderId;
  label: string;
  note: string;
  inputPerM: number;
  outputPerM: number;
  /** False when the server has no key for this provider. */
  available: boolean;
}

export interface AiModelsResponse {
  models: AiModelInfo[];
  defaults: Record<AiProviderId, string>;
  current: { provider: AiProviderId; model: string; chosenModelUnavailable: boolean };
  voices: { id: string; label: string; tone: string }[];
}

export interface AiUsage {
  month: string;
  models: { model: string; label: string; provider: AiProviderId | null; replies: number; inputTokens: number; outputTokens: number; estimatedUsd: number }[];
  totalUsd: number;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mediaIds: string[];
  /** Member messages: Lumen items and PDFs attached to it. */
  refs?: IAiChatRef[];
  createdAt: string;
  /** Assistant replies: which model wrote it. */
  provider?: AiProviderId | null;
  /** Notes and template drafts this reply made. */
  artifacts?: AiArtifact[];
  model?: string | null;
  modelLabel?: string | null;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  sourceMediaId?: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
}

export interface AiConversation extends AiConversationSummary {
  messages: AiMessage[];
}

export interface AiTurnResult {
  /** Null when the turn failed (it is not saved, so the member can retry). */
  conversation: AiConversation | null;
  reply: string;
  error: string | null;
  requests: number;
  provider?: AiProviderId;
  model?: string;
  modelLabel?: string;
  /** The member's chosen model couldn't run, so Gemini answered. */
  fellBack?: boolean;
}

export interface AiWeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  text: string;
  createdAt: string;
  modelLabel?: string | null;
}

const keys = {
  access: ['ai', 'access'] as const,
  conversations: ['ai', 'conversations'] as const,
  conversation: (id: string) => ['ai', 'conversation', id] as const,
  reports: ['ai', 'weekly-reports'] as const,
  models: ['ai', 'models'] as const,
  usage: (month: string) => ['ai', 'usage', month] as const,
};

export function useAiAccess() {
  return useQuery<AiAccess>({ queryKey: keys.access, queryFn: () => api.get<AiAccess>('/ai/access'), staleTime: 60_000 });
}

export interface AiAccessChange {
  fullAccess?: boolean;
  photoAccess?: boolean;
  acknowledgeFreeTier?: boolean;
  pin?: string;
}

export function useSetAiAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: AiAccessChange) => api.post<AiAccess>('/ai/access', change),
    onSuccess: data => {
      qc.setQueryData(keys.access, data);
      qc.invalidateQueries({ queryKey: ['ai'] });
    },
  });
}

export function useAiConversations(enabled = true) {
  return useQuery<AiConversationSummary[]>({
    queryKey: keys.conversations,
    queryFn: () => api.get<AiConversationSummary[]>('/ai/conversations'),
    enabled,
  });
}

export function useAiConversation(id: string | undefined) {
  return useQuery<AiConversation>({
    queryKey: keys.conversation(id ?? 'new'),
    queryFn: () => api.get<AiConversation>(`/ai/conversations/${id}`),
    enabled: !!id && id !== 'new',
  });
}

export interface SendAiMessage {
  conversationId?: string;
  message: string;
  mediaIds?: string[];
  /** Lumen items and PDFs attached to this message. */
  refs?: IAiChatRef[];
  /** Voice conversation: the reply is written to be spoken (short, no markdown). */
  voice?: boolean;
}

export function useSendAiMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendAiMessage) => api.post<AiTurnResult>('/ai/chat', input),
    onSuccess: res => {
      if (res.conversation) {
        qc.setQueryData(keys.conversation(res.conversation.id), res.conversation);
        qc.invalidateQueries({ queryKey: keys.conversations });
      }
    },
  });
}

/** One row in the chat's "attach" pickers. */
export interface Attachable {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
}

export type AttachableKind = Exclude<AiChatRefKind, 'day' | 'file'>;

/** The member's items of one kind for the attach picker (newest first), searched by title on the server. */
export function useAttachables(kind: AttachableKind | null, q = '') {
  const query = q.trim();
  return useQuery<Attachable[]>({
    queryKey: ['ai', 'attachables', kind, query],
    queryFn: () => api.get<Attachable[]>(`/ai/attachables?kind=${kind}${query ? `&q=${encodeURIComponent(query)}` : ''}`),
    enabled: !!kind,
    staleTime: 30_000,
  });
}

export function useDeleteAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ai/conversations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.conversations }),
  });
}

export function useAnalysePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => api.post<AiTurnResult>(`/ai/photos/${mediaId}/analyse`, {}),
    onSuccess: res => {
      if (res.conversation) {
        qc.setQueryData(keys.conversation(res.conversation.id), res.conversation);
        qc.invalidateQueries({ queryKey: keys.conversations });
      }
    },
  });
}

export function useAiWeeklyReports(enabled = true) {
  return useQuery<AiWeeklyReport[]>({
    queryKey: keys.reports,
    queryFn: () => api.get<AiWeeklyReport[]>('/ai/weekly-reports'),
    enabled,
  });
}

export function useGenerateWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { weekStart?: string; force?: boolean } = {}) =>
      api.post<{ report: AiWeeklyReport | null; error: string | null }>('/ai/weekly-reports/generate', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2 Nov – 8 Nov" for a review's week. */
export function weekLabel(start: string, end: string): string {
  const fmt = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

// ── Provider, model and voice ────────────────────────────────────────────────

export function useAiModels(enabled = true) {
  return useQuery<AiModelsResponse>({ queryKey: keys.models, queryFn: () => api.get<AiModelsResponse>('/ai/models'), enabled, staleTime: 60_000 });
}

export interface AiSettingsChange {
  model?: string;
  journal?: boolean;
  acknowledgeClaude?: boolean;
  voice?: Partial<AiVoiceSettings>;
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: AiSettingsChange) => api.patch<AiAccess>('/ai/settings', change),
    onSuccess: data => {
      qc.setQueryData(keys.access, data);
      qc.invalidateQueries({ queryKey: keys.models });
    },
  });
}

/** This month's tokens and estimated cost per model (Claude is paid; Gemini shows $0). */
export function useAiUsage(month = new Date().toISOString().slice(0, 7), enabled = true) {
  return useQuery<AiUsage>({ queryKey: keys.usage(month), queryFn: () => api.get<AiUsage>(`/ai/usage?month=${month}`), enabled });
}

/** Rough INR for a USD estimate, for display only. */
export const USD_TO_INR = 88;
export function formatInr(usd: number): string {
  const inr = usd * USD_TO_INR;
  return inr < 1 ? `₹${inr.toFixed(2)}` : `₹${Math.round(inr)}`;
}

// ── Lumen AI notifications ───────────────────────────────────────────────────

export interface AiTestNotificationResult {
  notification: { id: string; title: string; body: string; route: string; pushed: boolean } | null;
  /** Why it wasn't pushed: no_token (phone not registered for push), skip, rate_limited, … */
  error: string | null;
}

/** Settings → "Send a test": Lumen AI writes a briefing now and pushes it to this phone. */
export function useSendTestAiNotification() {
  return useMutation({
    mutationFn: () => api.post<AiTestNotificationResult>('/ai/notifications/test', {}),
  });
}

// ── Lumen AI notes and log templates ─────────────────────────────────────────

export interface AiArtifact {
  type: 'note' | 'template_draft';
  id: string;
  title: string;
}

/** "Save as note" on a chat reply. */
export function useSaveMessageAsNote() {
  return useMutation({
    mutationFn: (input: { conversationId: string; messageId: string }) =>
      api.post<{ noteId: string; title: string }>(`/ai/conversations/${input.conversationId}/messages/${input.messageId}/save-note`, {}),
  });
}

export function useSaveReviewAsNote() {
  return useMutation({
    mutationFn: (reportId: string) => api.post<{ noteId: string; title: string }>(`/ai/weekly-reports/${reportId}/save-note`, {}),
  });
}

/** Lumen AI writes a doctor-visit prep note from the last few weeks. */
export function useDoctorVisitNote() {
  return useMutation({
    mutationFn: (weeks: number = 4) => api.post<{ noteId: string | null; error: string | null }>('/ai/notes/doctor-visit', { weeks }),
  });
}

export type NoteAiAction = 'summarize' | 'checklist' | 'continue' | 'hinglish' | 'english';

export interface NoteActionResult {
  noteId: string | null;
  /** True when the result is a new note (a translated copy), false when the note itself was extended. */
  created: boolean;
  note: Record<string, unknown> & { _id: string } | null;
  error: string | null;
}

export function useNoteAiAction() {
  return useMutation({
    mutationFn: (input: { noteId: string; action: NoteAiAction }) =>
      api.post<NoteActionResult>(`/ai/notes/${input.noteId}/action`, { action: input.action }),
  });
}

export interface DraftField { key: string; label: string; dataType: string; unit?: string; min?: number; max?: number }
export interface DraftOption { id: string; label: string; measure: string; fields: DraftField[]; include: boolean; existingId?: string; templateKey?: string }
export interface DraftQuestion { id: string; title: string; frequency: string; selectionType: string; options: DraftOption[]; include: boolean; existingId?: string }
export interface DraftCategory {
  id: string; name: string; icon: string; color: string; role: string; fromLibrary: boolean;
  questions: DraftQuestion[]; include: boolean; existingId?: string;
}
export interface TemplateDraft {
  id: string;
  title: string;
  summary: string;
  status: 'draft' | 'applied' | 'undone' | 'discarded';
  categories: DraftCategory[];
  addOptions: { id: string; questionId: string; questionTitle: string; options: DraftOption[] }[];
  quickActions: { id: string; label: string; icon: string; mode: string; unit?: string; fromLibrary: boolean; include: boolean; existingId?: string }[];
  archive: { id: string; kind: 'category' | 'question' | 'option'; targetId: string; label: string; reason: string; include: boolean }[];
  counts: { categories: number; options: number; quickActions: number; archive: number };
  applied: { created: number; archived: number; at: string | null };
}

const draftKey = (id: string) => ['ai', 'template-draft', id] as const;

export function useTemplateDraft(id: string | undefined) {
  return useQuery<TemplateDraft>({
    queryKey: draftKey(id ?? ''),
    queryFn: () => api.get<TemplateDraft>(`/ai/template-drafts/${id}`),
    enabled: !!id,
  });
}

export function useGenerateTemplateDraft() {
  return useMutation({
    mutationFn: (input: { request?: string; mode: 'create' | 'improve' }) =>
      api.post<{ draftId: string | null; reply: string; error: string | null }>('/ai/template-drafts/generate', input),
  });
}

export type DraftItemEdits = Record<string, { include?: boolean; label?: string }>;

export function useApplyTemplateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; items: DraftItemEdits }) => api.post<TemplateDraft>(`/ai/template-drafts/${input.id}/apply`, { items: input.items }),
    onSuccess: d => qc.setQueryData(draftKey(d.id), d),
  });
}

export function useUndoTemplateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TemplateDraft>(`/ai/template-drafts/${id}/undo`, {}),
    onSuccess: d => qc.setQueryData(draftKey(d.id), d),
  });
}
