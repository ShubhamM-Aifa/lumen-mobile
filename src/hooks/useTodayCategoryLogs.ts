/**
 * Hook to fetch and organize log entries for the current tracking day,
 * respecting the user's Day Reset Boundary (preferences.dayBoundaryHour).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ILogEntry, Answer, IOption } from '@lumen/shared';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import {
  getDayBoundaryWindow,
  getTrackingDayWindowFromDateString,
  formatTimeRelative,
  DayBoundaryWindow,
} from '../utils/dayBoundary';
import { isMediaId, isDirectDisplayableUri } from '../services/mediaService';


export interface CategoryLogStatus {
  isLoggedToday: boolean;
  count: number;
  latestLog?: ILogEntry;
  latestTimeStr?: string;
}

export interface HistoryFieldDetail {
  key?: string;
  label: string;
  value: unknown;
  displayValue: string;
  unit?: string;
  dataType?: string;
  isImage?: boolean;
}

export interface HistoryAnswerDetail {
  optionId: string;
  optionLabel: string;
  icon?: string;
  color?: string;
  fields: HistoryFieldDetail[];
  comment?: string;
  otherText?: string;
}

export interface QuestionTodayHistoryEntry {
  logId: string;
  occurredAt: string;
  timeFormatted: string;
  timeClockStr: string;
  answers: Answer[];
  summaryText: string;
  details?: HistoryAnswerDetail[];
}

export function isPhotoFieldOrValue(key?: string, dataType?: string, val?: unknown): boolean {
  if (dataType === 'image') return true;
  const k = key ? key.toLowerCase() : '';
  if (k === 'photo' || k === 'image' || k.includes('photo') || k.includes('image')) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (isDirectDisplayableUri(trimmed)) return true;
    if (
      isMediaId(trimmed) &&
      (k.includes('media') || k.includes('pic') || k.includes('photo') || k.includes('img') || k === '')
    ) {
      return true;
    }
  }
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
    if (isDirectDisplayableUri(val[0]) || isMediaId(val[0])) return true;
  }
  return false;
}

function humanizeFieldKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function formatSingleFieldValue(val: unknown, key?: string, dataType?: string): string {
  if (val === undefined || val === null || val === '') return '';
  if (isPhotoFieldOrValue(key, dataType, val)) {
    return '📷 Attached';
  }
  const str = String(val);
  // Humanize zone and joint IDs if formatted like chest_right_parasternal
  if (str.includes('_')) {
    return str
      .split(',')
      .map(part => {
        const cleaned = part
          .trim()
          .replace(/^chest_/, '')
          .replace(/^joint_/, '')
          .replace(/_/g, ' ');
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      })
      .join(', ');
  }
  return str;
}

export function formatValueWithUnit(val: unknown, unit?: string, fieldKey?: string, dataType?: string): string {
  if (val === undefined || val === null || val === '') return '';
  if (isPhotoFieldOrValue(fieldKey, dataType, val)) {
    return '📷 Attached';
  }

  // Duration in seconds (e.g. 3600 seconds -> 1 hr)
  const isSeconds = unit === 'seconds' || unit === 'sec' || unit === 's' || (fieldKey && fieldKey.toLowerCase().includes('duration'));
  const numVal = typeof val === 'number' ? val : Number(val);
  if (isSeconds && !isNaN(numVal)) {
    if (numVal >= 3600) {
      const hrs = Math.floor(numVal / 3600);
      const remMins = Math.round((numVal % 3600) / 60);
      return remMins > 0 ? `${hrs}h ${remMins}m` : (hrs === 1 ? '1 hr' : `${hrs} hrs`);
    } else if (numVal >= 60) {
      const mins = Math.round(numVal / 60);
      return `${mins} min`;
    } else if (numVal > 0) {
      return `${numVal}s`;
    }
  }

  // Severity rating (e.g. 3 -> Severity 3)
  // Severity rating (e.g. 3 -> Severity 3)
  if (fieldKey && fieldKey.toLowerCase().includes('severity') && !isNaN(numVal)) {
    return `Severity: ${numVal}`;
  }

  // Bristol scale rating (e.g. 4 -> Type 4)
  const isBristol =
    (fieldKey && fieldKey.toLowerCase().includes('bristol')) ||
    (fieldKey && fieldKey.toLowerCase() === 'type' && ['1', '2', '3', '4', '5', '6', '7'].includes(String(val)));
  if (isBristol) {
    const valStr = String(val);
    return valStr.toLowerCase().startsWith('type') ? valStr : `Type ${valStr}`;
  }

  const formattedVal = formatSingleFieldValue(val, fieldKey, dataType);
  return unit ? `${formattedVal} ${unit}` : formattedVal;
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
          const fieldDef = option?.fields?.find(f => f.key === fv.fieldKey);
          const isPhoto = isPhotoFieldOrValue(fv.fieldKey, fv.dataType || fieldDef?.dataType, fv.value);
          const isBristol =
            (fv.fieldKey && fv.fieldKey.toLowerCase().includes('bristol')) ||
            (fieldDef?.label && fieldDef.label.toLowerCase().includes('bristol')) ||
            (fieldDef?.key && fieldDef.key.toLowerCase().includes('bristol')) ||
            (fv.fieldKey === 'type' && ['1', '2', '3', '4', '5', '6', '7'].includes(String(fv.value)));

          if (isPhoto) {
            fieldParts.push('📷 Photo');
          } else if (isBristol) {
            const valStr = String(fv.value);
            fieldParts.push(valStr.toLowerCase().startsWith('type') ? valStr : `Type ${valStr}`);
          } else {
            const displayVal = formatValueWithUnit(fv.value, fv.unit, fv.fieldKey, fv.dataType || fieldDef?.dataType);
            fieldParts.push(displayVal);
          }
        }
      }
    } else if ((ans as any).value !== undefined && (ans as any).value !== null && (ans as any).value !== '') {
      const formattedVal = formatSingleFieldValue((ans as any).value);
      fieldParts.push(formattedVal);
    }

    if (fieldParts.length > 0) {
      return `${baseLabel} (${fieldParts.join(', ')})`;
    }
    return baseLabel;
  });
  return parts.filter(Boolean).join(', ');
}


export function useTodayCategoryLogs(customDateStr?: string) {
  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;

  const boundaryWindow: DayBoundaryWindow = useMemo(() => {
    if (customDateStr) {
      return getTrackingDayWindowFromDateString(customDateStr, boundaryHour);
    }
    return getDayBoundaryWindow(boundaryHour);
  }, [boundaryHour, customDateStr]);

  const from = boundaryWindow.start.toISOString();
  const to = boundaryWindow.end.toISOString();

  const query = useQuery<ILogEntry[]>({
    queryKey: ['today-logs', customDateStr || 'today', from, to],
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
        const d = new Date(log.occurredAt);
        const h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, '0');
        const period = h < 12 ? 'AM' : 'PM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const timeClockStr = isNaN(d.getTime()) ? '' : `${h12}:${m} ${period}`;

        const details: HistoryAnswerDetail[] = matchedAnswers.map(ans => {
          if (ans.optionId === '__other__') {
            return {
              optionId: '__other__',
              optionLabel: 'Other',
              fields: [],
              otherText: (ans as any).otherText || '',
              comment: ans.comment,
            };
          }
          const option = options.find(o => o._id === ans.optionId);
          const baseLabel = (ans as any).optionLabelSnapshot || option?.label || 'Selected';

          const fields: HistoryFieldDetail[] = [];
          if (ans.values && ans.values.length > 0) {
            for (const fv of ans.values) {
              if (fv.value !== undefined && fv.value !== null && fv.value !== '') {
                const fieldDef = option?.fields?.find(f => f.key === fv.fieldKey);
                const isPhoto = isPhotoFieldOrValue(fv.fieldKey, fv.dataType || fieldDef?.dataType, fv.value);
                const isBristol =
                  (fv.fieldKey && fv.fieldKey.toLowerCase().includes('bristol')) ||
                  (fieldDef?.label && fieldDef.label.toLowerCase().includes('bristol')) ||
                  (fieldDef?.key && fieldDef.key.toLowerCase().includes('bristol')) ||
                  (fv.fieldKey === 'type' && ['1', '2', '3', '4', '5', '6', '7'].includes(String(fv.value)));
                const label = isPhoto
                  ? 'Photo'
                  : isBristol
                  ? 'Bristol type'
                  : (fieldDef?.label || (fv.fieldKey ? humanizeFieldKey(fv.fieldKey) : 'Value'));
                const displayVal = formatValueWithUnit(fv.value, fv.unit, fv.fieldKey, fv.dataType || fieldDef?.dataType);
                fields.push({
                  key: fv.fieldKey,
                  label,
                  value: fv.value,
                  displayValue: isPhoto ? '📷 Attached' : displayVal,
                  unit: fv.unit,
                  dataType: fv.dataType || fieldDef?.dataType,
                  isImage: isPhoto,
                });

              }
            }
          } else if ((ans as any).value !== undefined && (ans as any).value !== null && (ans as any).value !== '') {
            const formattedVal = formatSingleFieldValue((ans as any).value);
            fields.push({
              label: 'Value',
              value: (ans as any).value,
              displayValue: formattedVal,
            });
          }

          return {
            optionId: ans.optionId,
            optionLabel: baseLabel,
            icon: option?.icon,
            color: option?.color,
            fields,
            comment: ans.comment,
            otherText: (ans as any).otherText,
          };
        });

        result.push({
          logId: log._id,
          occurredAt: log.occurredAt,
          timeFormatted: formatTimeRelative(log.occurredAt),
          timeClockStr,
          answers: matchedAnswers,
          summaryText: summary || 'Answered',
          details,
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
