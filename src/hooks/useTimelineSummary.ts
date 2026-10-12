/**
 * Fetches log entries for a month and computes per-day severity summary
 * for the CalendarHeatMap.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ILogEntry } from '@lumen/shared';
import { DaySeverity } from '../components/timeline/CalendarHeatMap';
import {
  getTrackingDayDateString,
  getTrackingDayWindowFromDateString,
} from '../utils/dayBoundary';

export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(
  dateStr: string,
  boundaryHour: number = 0
): { startOfDay: Date; endOfDay: Date } {
  const { start, end } = getTrackingDayWindowFromDateString(dateStr, boundaryHour);
  return { startOfDay: start, endOfDay: end };
}

export function useTimelineSummary(year: number, month: number, boundaryHour: number = 4) {
  // Query with 1-day padding on both ends to capture logs belonging to tracking days at month edges
  const startOfMonth = new Date(year, month, 0, 0, 0, 0, 0); // 1 day before 1st of month
  const endOfMonth = new Date(year, month + 1, 1, 23, 59, 59, 999); // 1 day after end of month
  const from = startOfMonth.toISOString();
  const to = endOfMonth.toISOString();

  return useQuery<DaySeverity[]>({
    queryKey: ['timeline-summary', year, month, boundaryHour],
    queryFn: async () => {
      const res = await api.get<any>('/logs', { params: { from, to, limit: 1000 } });
      const entries: ILogEntry[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);

      const map: Record<string, { maxSeverity: number; hasLogs: boolean }> = {};
      for (const e of entries) {
        // Group each entry into its tracking day based on Day Reset Boundary
        const day = getTrackingDayDateString(new Date(e.occurredAt), boundaryHour);
        if (!map[day]) map[day] = { maxSeverity: -1, hasLogs: true };
        map[day].hasLogs = true;
        for (const ans of (e.answers || [])) {
          for (const v of ans.values ?? []) {
            if (v.dataType === 'range' && v.fieldKey === 'severity') {
              const s = Number(v.value);
              if (s > map[day].maxSeverity) map[day].maxSeverity = s;
            }
          }
        }
        if (map[day].maxSeverity === -1) map[day].maxSeverity = 0;
      }

      return Object.entries(map).map(([date, info]) => ({ date, ...info }));
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

export function useDayEntries(date: string, boundaryHour: number = 4) {
  const { start, end } = getTrackingDayWindowFromDateString(date, boundaryHour);
  const from = start.toISOString();
  const to = end.toISOString();

  return useQuery<ILogEntry[]>({
    queryKey: ['day-entries', date, boundaryHour],
    queryFn: async () => {
      if (!date) return [];
      const res = await api.get<any>('/logs', { params: { from, to, limit: 500 } });
      return Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

