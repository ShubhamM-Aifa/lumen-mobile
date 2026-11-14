/**
 * Phase 6: opt-in plain-language narration on top of a pattern/progress/warning card. Gated
 * server-side on preferences.aiExplanations (off by default); calling it while that is off returns
 * a 403 the caller should just not show. Lumen AI chat lives in useAiChat.ts.
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

