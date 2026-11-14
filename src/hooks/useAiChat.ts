/**
 * Lumen AI: chat over all of the member's own data, photo analysis and weekly reviews.
 * Server: server/src/routes/ai.ts. Everything except /ai/access needs AI full access on.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export interface AiAccess {
  fullAccess: boolean;
  photoAccess: boolean;
  freeTierAcknowledged: boolean;
  hasPhotoPin: boolean;
  /** False when the server has no Gemini key. */
  configured: boolean;
  model: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mediaIds: string[];
  createdAt: string;
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
}

export interface AiWeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  text: string;
  createdAt: string;
}

const keys = {
  access: ['ai', 'access'] as const,
  conversations: ['ai', 'conversations'] as const,
  conversation: (id: string) => ['ai', 'conversation', id] as const,
  reports: ['ai', 'weekly-reports'] as const,
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
