/**
 * Fetches cached insight results and descriptive stats from the backend.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { InsightResult } from '../components/insights/InsightCard';

export interface DescriptiveStat {
  key: string;
  icon: string;
  title: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendGoodDirection?: 'up' | 'down';
  sparkValues?: number[];
  accentColor?: string;
}

interface InsightsResponse {
  insights: InsightResult[];
  stats: DescriptiveStat[];
  daysOfData: number;
  lastComputedAt?: string;
}

export function useInsights() {
  return useQuery<InsightsResponse>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await api.get<Partial<InsightsResponse> & { daysRecorded?: number }>('/insights');
      return {
        insights: res?.insights ?? [],
        stats: res?.stats ?? [],
        daysOfData: res?.daysOfData ?? res?.daysRecorded ?? 0,
        lastComputedAt: res?.lastComputedAt,
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecomputeInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/insights/recompute', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  });
}
