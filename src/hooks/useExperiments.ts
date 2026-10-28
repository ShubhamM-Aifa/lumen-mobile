/**
 * "Test it for 6 weeks": guided self-experiments, with a randomised with/without block schedule
 * the member never gets to see in advance.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export type ExperimentBlock = 'with' | 'without';
export type ExperimentStatus = 'active' | 'completed' | 'abandoned';

export interface ExperimentProgress {
  currentBlockIndex: number | null;
  currentBlock: ExperimentBlock | null;
  dayInBlock: number | null;
  daysElapsed: number;
  daysRemaining: number;
  readyForAnalysis: boolean;
}

export interface ExperimentResult {
  withCount: number; withTotal: number;
  withoutCount: number; withoutTotal: number;
  statistic: number;
  pValue: number;
  thinBlocks: number;
}

export interface ExperimentData {
  id: string;
  exposureKey: string; exposureLabel: string;
  outcomeKey: string; outcomeLabel: string;
  startDay: string; endDay: string;
  washoutDays: number;
  isMedicineRelated: boolean;
  status: ExperimentStatus;
  progress: ExperimentProgress;
  result: ExperimentResult | null;
}

export interface StartExperimentInput {
  exposureKey: string; exposureLabel: string;
  outcomeKey: string; outcomeLabel: string;
  isMedicineRelated?: boolean;
}

export function useExperiments() {
  return useQuery<ExperimentData[]>({
    queryKey: ['experiments'],
    queryFn: () => api.get<ExperimentData[]>('/experiments'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartExperimentInput) => api.post<ExperimentData>('/experiments', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  });
}

export function useEndExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'abandoned' }) =>
      api.patch<ExperimentData>(`/experiments/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  });
}
