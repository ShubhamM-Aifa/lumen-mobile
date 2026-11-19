/**
 * Insights › Explore and Metrics data. The server folds in every change before answering,
 * so a log made a minute ago is already counted.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export type MetricRange = '7d' | '30d' | '90d' | '365d';
export type ChangeWord = 'higher' | 'lower' | 'similar' | 'not_enough';
export type TrendWord = 'rising' | 'falling' | 'steady' | 'not_enough';

export interface CatalogMetric { id: string; label: string; unit: string; group: string; scaleNote: string | null; days: number }
export interface CatalogItem {
  key: string; label: string; icon: string | null; groupLabel: string | null; kind: 'option' | 'category' | 'quick' | 'feeling';
  archived: boolean; days: number; lastSeen: string; hasQty: boolean; unit: string | null; hasSev: boolean; outcome: boolean;
}
export interface CatalogMedication { id: string; name: string; dose: string | null; prn: boolean; active: boolean; plannedDoses: number; skippedDoses: number }
export interface AnalyticsCatalog {
  firstDay: string | null; today: string; loggedDays: number;
  metrics: CatalogMetric[]; items: CatalogItem[]; medications: CatalogMedication[]; pins: string[];
}

export interface MetricSummary {
  id: string; label: string; unit: string; decimals: number; better: 'higher' | 'lower' | null; scaleNote?: string;
  summary: 'average' | 'share';
  value: number | null; median: number | null; min: number | null; max: number | null;
  covered: number; total: number;
  prev: { value: number | null; covered: number } | null;
  change: ChangeWord; shift: number | null;
  goal: number | null; goalRate: { hit: number; of: number } | null;
  trend: TrendWord;
  series: Array<{ day: string; v: number | null }>;
}
export interface MetricDetail extends MetricSummary {
  weekday: Array<number | null> | null;
  histogram: Array<{ from: number; to: number; count: number }>;
  best: Array<{ day: string; v: number }>;
  worst: Array<{ day: string; v: number }>;
}

export type ExploreTarget =
  | { kind: 'item'; key: string; minSev?: number }
  | { kind: 'flare' }
  | { kind: 'dose'; medicationId: string; status: 'skipped' | 'taken' }
  | { kind: 'metric'; id: string; op: 'lt' | 'gt'; value: number }
  | { kind: 'rise'; key: string }
  | { kind: 'period'; from: string; to: string };
export type ExploreDirection = 'before' | 'after';
export type ExploreRange = '90d' | '180d' | '365d' | 'all';
export interface ExploreQuestion { target: ExploreTarget; direction: ExploreDirection; range: ExploreRange }

export type LagKey = 0 | 1 | 2 | 'w3';
export type Tier = 'consistent' | 'possible' | 'none';
export type Flag = 'logged_together' | 'already_before' | 'often_after_symptom' | 'weak_days';
export interface BinaryFinding {
  key: string; label: string; type: 'item' | 'flare' | 'dose'; lag: LagKey; way: 'more' | 'less';
  a: number; b: number; c: number; d: number; rateWith: number; rateOther: number;
  shrunkRR: number; q: number; tier: Tier; flags: Flag[];
}
export interface NumericFinding {
  id: string; label: string; unit: string; lag: 0 | 1;
  medianWith: number; medianOther: number; shift: number; nWith: number; nOther: number; q: number; tier: Tier;
}
export interface ExploreAnswer {
  target: { label: string; days: number; observedDays: number; firstDay: string | null; lastDay: string | null };
  direction: ExploreDirection;
  findings: BinaryFinding[];
  numeric: NumericFinding[];
  unclear: Array<{ key: string; label: string; lag: LagKey; rateWith: number; rateOther: number; a: number; b: number; c: number; d: number }>;
  notEnough: Array<{ key: string; label: string; days: number }>;
  checkedCount: number;
  caveats: string[];
  period?: { from: string; to: string; prevFrom: string; prevTo: string };
  range: { from: string; to: string };
  token: string;
}

export interface ScatterData {
  x: { id: string; label: string; unit: string }; y: { id: string; label: string; unit: string };
  lag: 0 | 1; from: string; to: string;
  points: Array<{ day: string; x: number; y: number }>;
  n: number; rho: { value: number; p: number } | null;
}

const STALE = 60 * 1000;

export function useAnalyticsCatalog() {
  return useQuery({ queryKey: ['analytics', 'catalog'], queryFn: () => api.get<AnalyticsCatalog>('/analytics/catalog'), staleTime: STALE });
}

export function useMetrics(ids: string[] | null, range: MetricRange) {
  return useQuery({
    queryKey: ['analytics', 'metrics', ids?.join(',') ?? 'pins', range],
    queryFn: () => api.get<{ from: string; to: string; metrics: MetricSummary[] }>('/analytics/metrics', { params: { ...(ids?.length ? { ids: ids.join(',') } : {}), range } }),
    staleTime: STALE,
  });
}

export function useMetricDetail(id: string | undefined, range: MetricRange) {
  return useQuery({
    queryKey: ['analytics', 'metric', id, range],
    queryFn: () => api.get<{ from: string; to: string; metric: MetricDetail }>(`/analytics/metrics/${encodeURIComponent(id!)}`, { params: { range } }),
    enabled: !!id,
    staleTime: STALE,
  });
}

export function useScatter(x: string | null, y: string | null, lag: 0 | 1, range: MetricRange) {
  return useQuery({
    queryKey: ['analytics', 'scatter', x, y, lag, range],
    queryFn: () => api.get<ScatterData>('/analytics/scatter', { params: { x, y, lag, range } }),
    enabled: !!x && !!y,
    staleTime: STALE,
  });
}

/** Runs an Explore question (or a saved/AI token). */
export function useExplore(question: ExploreQuestion | null, token?: string | null) {
  return useQuery({
    queryKey: ['analytics', 'explore', token ?? JSON.stringify(question)],
    queryFn: () => api.post<ExploreAnswer>('/analytics/explore', token ? { token } : question),
    enabled: !!question || !!token,
    staleTime: STALE,
  });
}

export function useSetPins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pins: string[]) => api.put<{ pins: string[] }>('/analytics/pins', { pins }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics'] }),
  });
}

export type DayState = 'hit' | 'none' | 'unknown';
export interface FindingDays { days: string[]; target: DayState[]; item: DayState[]; matches: Array<{ targetDay: string; itemDay: string }> }

export function useFindingDays(token: string | undefined, key: string | undefined, lag: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'finding-days', token, key, lag],
    queryFn: () => api.post<FindingDays>('/analytics/explore/days', { token, key, lag }),
    enabled: !!token && !!key && lag !== undefined,
    staleTime: STALE,
  });
}
