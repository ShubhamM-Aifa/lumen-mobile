/**
 * Phase 6: opt-in plain-language narration on top of a pattern/progress/warning card, and a
 * bounded Q&A box. Both are gated server-side on preferences.aiExplanations (off by default);
 * calling these while it's off returns a 403 the caller should just not show.
 */
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

export interface NarrationResponse { text: string; source: 'ai' | 'template' }

export type ExplainInput =
  | { kind: 'finding'; exposureKey: string; outcomeKey: string; lagDays: number }
  | { kind: 'progress' }
  | { kind: 'warning' };

export function useExplain() {
  return useMutation({
    mutationFn: (input: ExplainInput) => api.post<NarrationResponse>('/insights/explain', input),
  });
}

export function useAskLumen() {
  return useMutation({
    mutationFn: (question: string) => api.post<NarrationResponse>('/insights/ask', { question }),
  });
}
