/**
 * Early warning: "higher than your usual" (level 0) or "resembles your pre-flare days" (level 1).
 * Computed server-side as part of the nightly/on-demand analysis; this just reads the last result.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export type WarningGateReason = 'too_few_episodes' | 'too_few_logged_days' | null;

export interface WarningData {
  ready: boolean;
  enabledLevel?: 0 | 1;
  alert?: boolean;
  alertLevel?: 0 | 1 | null;
  suppressedByFlare?: boolean;
  disabled?: boolean;
  level1?: {
    enabled: boolean;
    gateReason: WarningGateReason;
    episodeCount: number;
    loggedDays: number;
    trackRecord: { followed: number; of: number } | null;
  };
  computedAt?: string;
}

export function useWarning() {
  return useQuery<WarningData>({
    queryKey: ['insights-warning'],
    queryFn: () => api.get<WarningData>('/insights/warning'),
    staleTime: 10 * 60 * 1000,
  });
}

export type WarningFeedback = 'helpful' | 'not_this_time' | 'stop';

export function useWarningFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: WarningFeedback) => api.post('/insights/warning/feedback', { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights-warning'] }),
  });
}
