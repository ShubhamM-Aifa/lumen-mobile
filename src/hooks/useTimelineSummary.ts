/**
 * Fetches log entries for a month and computes per-day severity summary
 * and question completion progress for the CalendarHeatMap.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ILogEntry } from '@lumen/shared';
import { DaySeverity } from '../components/timeline/CalendarHeatMap';
import { useConfigStore } from '../store/configStore';
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
  const { config } = useConfigStore();

  // Query with 1-day padding on both ends to capture logs belonging to tracking days at month edges
  const startOfMonth = new Date(year, month, 0, 0, 0, 0, 0); // 1 day before 1st of month
  const endOfMonth = new Date(year, month + 1, 1, 23, 59, 59, 999); // 1 day after end of month
  const from = startOfMonth.toISOString();
  const to = endOfMonth.toISOString();

  const activeCategories = (config?.categories ?? []).filter(c => c.isActive);
  const activeQuestions = (config?.questions ?? []).filter(q => q.isActive);
  const activeOptions = config?.options ?? [];

  return useQuery<DaySeverity[]>({
    queryKey: ['timeline-summary', year, month, boundaryHour],
    queryFn: async () => {
      const res = await api.get<any>('/logs', { params: { from, to, limit: 1000 } });
      const entries: ILogEntry[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);

      // Group logs by tracking day
      const entriesByDay: Record<string, ILogEntry[]> = {};
      const maxSeverityByDay: Record<string, number> = {};

      for (const e of entries) {
        const day = getTrackingDayDateString(new Date(e.occurredAt), boundaryHour);
        if (!entriesByDay[day]) entriesByDay[day] = [];
        entriesByDay[day].push(e);

        if (maxSeverityByDay[day] === undefined) maxSeverityByDay[day] = -1;
        for (const ans of (e.answers || [])) {
          for (const v of ans.values ?? []) {
            if (v.dataType === 'range' && v.fieldKey === 'severity') {
              const s = Number(v.value);
              if (s > maxSeverityByDay[day]) maxSeverityByDay[day] = s;
            }
          }
        }
      }

      // Pre-compute map of questionId -> validOptionIds
      const questionOptionIdsMap = new Map<string, Set<string>>();
      for (const q of activeQuestions) {
        const optIds = new Set(
          activeOptions.filter(o => o.questionId === q._id && o.isActive).map(o => o._id)
        );
        questionOptionIdsMap.set(q._id, optIds);
      }

      const totalActiveQuestions = activeQuestions.length;
      const totalCategoriesCount = activeCategories.length;

      const result: DaySeverity[] = [];

      for (const [day, dayEntries] of Object.entries(entriesByDay)) {
        let maxSev = maxSeverityByDay[day];
        if (maxSev === undefined || maxSev === -1) maxSev = 0;

        let totalAnsweredCount = 0;
        let sumCategoryProgress = 0;
        let completedCategoriesCount = 0;

        for (const cat of activeCategories) {
          const catQuestions = activeQuestions.filter(q => q.categoryId === cat._id);
          const totalCatQ = catQuestions.length;

          let catAnsweredQ = 0;

          if (totalCatQ > 0) {
            for (const q of catQuestions) {
              const validOptIds = questionOptionIdsMap.get(q._id);
              const isAnswered = dayEntries.some(log => {
                const matchesCat = !log.categoryId || log.categoryId === cat._id;
                if (!matchesCat) return false;
                return (log.answers ?? []).some(ans => {
                  if (validOptIds && validOptIds.has(ans.optionId)) return true;
                  if (ans.optionId === '__other__' && log.questionId === q._id) return true;
                  return false;
                });
              });

              if (isAnswered) {
                catAnsweredQ += 1;
              }
            }
          } else {
            // Category has no questions configured; having 1+ log today counts as complete
            const hasCatLog = dayEntries.some(log => log.categoryId === cat._id);
            catAnsweredQ = hasCatLog ? 1 : 0;
          }

          totalAnsweredCount += (totalCatQ > 0 ? catAnsweredQ : 0);
          const effectiveTotal = totalCatQ > 0 ? totalCatQ : 1;
          const catProg = Math.min(1, catAnsweredQ / effectiveTotal);
          sumCategoryProgress += catProg;
          if (catProg >= 1) {
            completedCategoriesCount += 1;
          }
        }

        const overallProg = totalCategoriesCount > 0 ? sumCategoryProgress / totalCategoriesCount : 0;
        const clampedProgress = Math.min(1, Math.max(0, overallProg));
        const percentage = Math.round(clampedProgress * 100);
        const isComplete = clampedProgress >= 1;

        result.push({
          date: day,
          maxSeverity: maxSev,
          hasLogs: true,
          progress: clampedProgress,
          percentage,
          answeredCount: totalAnsweredCount,
          totalQuestions: totalActiveQuestions,
          completedCategoriesCount,
          totalCategoriesCount,
          isComplete,
        });
      }

      return result;
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
