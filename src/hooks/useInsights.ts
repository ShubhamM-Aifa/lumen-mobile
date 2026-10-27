/**
 * Fetches pattern findings and descriptive stats from the backend.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

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

/** One thing the member logged and one symptom, compared on days with and without it. */
export interface InsightFinding {
  /** `exposureKey|outcomeKey|lagDays`; stable between runs. */
  id: string;
  /** `opt_<optionId>`, `qa_<quickActionId>` or `cat_<categoryId>`; used to match what was just logged. */
  exposureKey: string;
  outcomeKey: string;
  exposure: { categoryName: string; optionLabel: string; categoryIcon?: string };
  outcome: { categoryName: string; optionLabel: string; categoryIcon?: string };
  /** 0 = same day, 1 = next day, 2 = two days later. */
  lagDays: number;
  counts: { exposedWith: number; exposedTotal: number; otherWith: number; otherTotal: number };
  tier: 'possible' | 'consistent';
  /** It was shown before but later analyses no longer support it. */
  noLongerSeen: boolean;
  lastShownDay?: string;
  weakDays: boolean;
}

export interface InsightProgress {
  /** Days the member was logging, which is what patterns can be compared on. */
  observedDays: number;
  daysNeeded: number;
  comparisons?: number;
}

export interface InsightsResponse {
  findings: InsightFinding[];
  stats: DescriptiveStat[];
  progress: InsightProgress;
  daysOfData: number;
  lastComputedAt?: string;
}

const DEFAULT_PROGRESS: InsightProgress = { observedDays: 0, daysNeeded: 30 };

export function useInsights() {
  return useQuery<InsightsResponse>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await api.get<Partial<InsightsResponse> & { daysRecorded?: number }>('/insights');
      return {
        findings: res?.findings ?? [],
        stats: res?.stats ?? [],
        progress: res?.progress ?? DEFAULT_PROGRESS,
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
