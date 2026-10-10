/**
 * Hook to fetch and organize log entries for the current tracking day,
 * respecting the user's Day Reset Boundary (preferences.dayBoundaryHour).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ILogEntry, Answer, IOption } from '@lumen/shared';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { getDayBoundaryWindow, formatTimeRelative, DayBoundaryWindow } from '../utils/dayBoundary';

export interface CategoryLogStatus {
  isLoggedToday: boolean;
  count: number;
  latestLog?: ILogEntry;
  latestTimeStr?: string;
}

export interface QuestionTodayHistoryEntry {
  logId: string;
  occurredAt: string;
  timeFormatted: string;
  answers: Answer[];
  summaryText: string;
}

export function formatAnswerSummary(answers: Answer[], options: IOption[]): string {
  if (!answers || answers.length === 0) return '';
  const parts = answers.map(ans => {
    if (ans.optionId === '__other__') {
      const other = (ans as any).otherText;
      return other ? `Other: "${other}"` : 'Other';
    }
    const option = options.find(o => o._id === ans.optionId);
    const baseLabel = (ans as any).optionLabelSnapshot || option?.label || 'Selected';

    const fieldParts: string[] = [];
    if (ans.values && ans.values.length > 0) {
      for (const fv of ans.values) {
        if (fv.value !== undefined && fv.value !== null && fv.value !== '') {
          fieldParts.push(fv.unit ? `${fv.value} ${fv.unit}` : `${fv.value}`);
        }
      }
    } else if ((ans as any).value !== undefined && (ans as any).value !== null && (ans as any).value !== '') {
      fieldParts.push(String((ans as any).value));
    }
    if (fieldParts.length > 0) {
      return `${baseLabel} (${fieldParts.join(', ')})`;
    }
    return baseLabel;
  });
  return parts.filter(Boolean).join(', ');
}

export function useTodayCategoryLogs() {
  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;

  const boundaryWindow: DayBoundaryWindow = useMemo(() => {
    return getDayBoundaryWindow(boundaryHour);
  }, [boundaryHour]);

  const from = boundaryWindow.start.toISOString();
  const to = boundaryWindow.end.toISOString();

  const query = useQuery<ILogEntry[]>({
    queryKey: ['today-logs', from, to],
    queryFn: async () => {
      const res = await api.get<any>('/logs', {
        params: { from, to, limit: 500 },
      });
      const entries: ILogEntry[] = Array.isArray(res) ? res : (res?.logs ?? res?.data ?? []);
      return entries;
    },
    staleTime: 30 * 1000, // 30s cache before refetch
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  const todayLogs = query.data ?? [];

  // Group logs by categoryId, keeping sorted by latest occurredAt
  const logsByCategoryId = useMemo(() => {
    const map: Record<string, ILogEntry[]> = {};
    for (const log of todayLogs) {
      const catId = log.categoryId ? String(log.categoryId) : '';
      if (!catId) continue;
      if (!map[catId]) map[catId] = [];
      map[catId].push(log);
    }
    // Ensure descending order by occurredAt
    for (const catId of Object.keys(map)) {
      map[catId].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
    }
    return map;
  }, [todayLogs]);

  const getCategoryStatus = (categoryId: string): CategoryLogStatus => {
    const entries = logsByCategoryId[categoryId] ?? [];
    if (entries.length === 0) {
      return {
        isLoggedToday: false,
        count: 0,
      };
    }
    const latestLog = entries[0];
    const latestTimeStr = latestLog ? formatTimeRelative(latestLog.occurredAt) : undefined;
    return {
      isLoggedToday: true,
      count: entries.length,
      latestLog,
      latestTimeStr,
    };
  };

  const getQuestionTodayHistory = (
    questionId: string,
    options: IOption[],
    categoryId?: string,
  ): QuestionTodayHistoryEntry[] => {
    const sourceLogs = categoryId ? (logsByCategoryId[categoryId] ?? todayLogs) : todayLogs;
    const validOptionIds = new Set(options.map(o => o._id));
    const result: QuestionTodayHistoryEntry[] = [];

    for (const log of sourceLogs) {
      const matchedAnswers = (log.answers ?? []).filter(a => {
        if (validOptionIds.has(a.optionId)) return true;
        if (a.optionId === '__other__' && log.questionId === questionId) return true;
        return false;
      });

      if (matchedAnswers.length > 0) {
        const summary = formatAnswerSummary(matchedAnswers, options);
        result.push({
          logId: log._id,
          occurredAt: log.occurredAt,
          timeFormatted: formatTimeRelative(log.occurredAt),
          answers: matchedAnswers,
          summaryText: summary || 'Answered',
        });
      }
    }

    result.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    return result;
  };

  return {
    todayLogs,
    logsByCategoryId,
    getCategoryStatus,
    getQuestionTodayHistory,
    boundaryWindow,
    boundaryHour,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
