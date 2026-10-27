/**
 * "Am I getting better?": the weekly trend, good/bad-day count and the latest regime-shift label.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export type TrendState = 'improving' | 'worsening' | 'steady' | 'mixed' | 'not_enough_data';

export interface TrendData {
  state: TrendState;
  weeklyValues: Array<{ weekKey: string; value: number }>;
  pValue: number | null;
  estimatedChange: number | null;
  weeksNeeded: number;
}

export interface GoodBadDaysData {
  good: number;
  bad: number;
  observed: number;
  windowDays: number;
}

export interface RegimeShiftData { dayKey: string; direction: 'up' | 'down' }

export interface ProgressData {
  trend: TrendData;
  goodBadDays: GoodBadDaysData;
  recentShift: RegimeShiftData | null;
}

export function useProgress() {
  return useQuery<ProgressData>({
    queryKey: ['insights-progress'],
    queryFn: () => api.get<ProgressData>('/insights/progress'),
    staleTime: 10 * 60 * 1000,
  });
}
