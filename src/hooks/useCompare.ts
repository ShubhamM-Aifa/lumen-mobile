/**
 * "Did this change help?": a before/after comparison around a date the member picks.
 */
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

export interface CompareOutcome { value: number; ci95: [number, number] }

export type CompareNotReadyReason = 'not_enough_pre_data' | 'not_enough_post_data' | 'event_too_recent';

export interface CompareData {
  ready: boolean;
  reason?: CompareNotReadyReason;
  eventDay: string;
  washoutDays: number;
  preDays: number;
  postDays: number;
  needed?: number;
  preFlares?: number;
  postFlares?: number;
  symptomDayRate?: CompareOutcome;
  medianShift?: CompareOutcome;
  flaresPer28?: CompareOutcome;
  startedDuringRoughPatch?: boolean;
  alreadyImproving?: boolean;
}

export function useCompare() {
  return useMutation({
    mutationFn: ({ day, washoutDays }: { day: string; washoutDays?: number }) =>
      api.get<CompareData>('/insights/compare', { params: { day, washoutDays } }),
  });
}
