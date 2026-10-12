/**
 * CalendarHeatMap — month grid or compact week strip with per-day symptom severity colouring.
 * Tap a day to select it; toggle between Week and Month view.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { PressableScale } from '../common/PressableScale';
import { toLocalDateString } from '../../hooks/useTimelineSummary';

export interface DaySeverity {
  date: string; // 'YYYY-MM-DD'
  maxSeverity: number; // 0–10; 0 means logged but no severity; -1 means no data
  hasLogs: boolean;
}

interface Props {
  year: number;
  month: number; // 0-indexed
  data: DaySeverity[];
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  viewMode?: 'week' | 'month';
  onToggleViewMode?: (mode: 'week' | 'month') => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  todayDate?: string;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function severityColor(severity: number, primaryColor: string): string {
  if (severity < 0) return 'transparent';
  if (severity === 0) return primaryColor + '22';
  // 0–3 green-ish, 4–6 amber, 7–10 red-ish
  if (severity <= 3) return `rgba(56, 176, 120, ${0.25 + severity * 0.08})`;
  if (severity <= 6) return `rgba(251, 176, 52, ${0.3 + (severity - 4) * 0.1})`;
  return `rgba(239, 80, 80, ${0.35 + (severity - 7) * 0.1})`;
}

export function CalendarHeatMap({
  year,
  month,
  data,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  viewMode = 'week',
  onToggleViewMode,
  onPrevWeek,
  onNextWeek,
  todayDate,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  const dataMap = useMemo(() => {
    const m: Record<string, DaySeverity> = {};
    data.forEach(d => { m[d.date] = d; });
    return m;
  }, [data]);

  // Month grid cells
  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  // Week strip cells (Monday to Sunday containing selectedDate)
  const weekDays = useMemo(() => {
    const parts = (selectedDate || '').split('-');
    const selectedD = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    const dayOfWeek = (selectedD.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const monday = new Date(selectedD);
    monday.setDate(monday.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const iso = toLocalDateString(d);
      return {
        dayNum: d.getDate(),
        iso,
        dayOfWeek: DAYS[i],
      };
    });
  }, [selectedDate]);

  const todayStr = todayDate ?? toLocalDateString(new Date());

  const isoDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const handlePrev = () => {
    if (viewMode === 'week' && onPrevWeek) {
      onPrevWeek();
    } else {
      onPrevMonth();
    }
  };

  const handleNext = () => {
    if (viewMode === 'week' && onNextWeek) {
      onNextWeek();
    } else {
      onNextMonth();
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Header with Title and Mode Switcher */}
      <View style={styles.header}>
        <View style={styles.navGroup}>
          <PressableScale
            onPress={handlePrev}
            style={styles.navBtn}
            haptic="light"
            activeScale={0.92}
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft size={16} color={palette.text} strokeWidth={2.4} />
          </PressableScale>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <PressableScale
            onPress={handleNext}
            style={styles.navBtn}
            haptic="light"
            activeScale={0.92}
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'week' ? 'Next week' : 'Next month'}
          >
            <ChevronRight size={16} color={palette.text} strokeWidth={2.4} />
          </PressableScale>
        </View>

        {/* View Mode Toggle Pill (Week vs Month) */}
        {onToggleViewMode && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'week' && styles.modeBtnActive]}
              onPress={() => onToggleViewMode('week')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeText, viewMode === 'week' && styles.modeTextActive]}>
                Week
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'month' && styles.modeBtnActive]}
              onPress={() => onToggleViewMode('month')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeText, viewMode === 'month' && styles.modeTextActive]}>
                Month
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Week Strip Mode */}
      {viewMode === 'week' && (
        <View style={styles.weekContainer}>
          <View style={styles.row}>
            {weekDays.map((item, i) => {
              const info = dataMap[item.iso];
              const bg = info ? severityColor(info.maxSeverity, palette.primary) : 'transparent';
              const isToday = item.iso === todayStr;
              const isSelected = item.iso === selectedDate;

              return (
                <PressableScale
                  key={item.iso}
                  style={styles.weekCol}
                  onPress={() => onSelectDate(item.iso)}
                  haptic="selection"
                  activeScale={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.dayOfWeek} ${item.dayNum}`}
                >
                  <Text
                    style={[
                      styles.dayHeader,
                      isToday && styles.dayHeaderToday,
                      isSelected && styles.dayHeaderSelected,
                    ]}
                  >
                    {item.dayOfWeek}
                  </Text>
                  <View
                    style={[
                      styles.dayCell,
                      { backgroundColor: bg },
                      isToday && styles.today,
                      isSelected && styles.selected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isSelected && styles.dayNumSelected,
                        isToday && !isSelected && styles.dayNumToday,
                      ]}
                    >
                      {item.dayNum}
                    </Text>
                    {info?.hasLogs && !isSelected && <View style={styles.dot} />}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      )}

      {/* Full Month Grid Mode */}
      {viewMode === 'month' && (
        <View style={styles.monthContainer}>
          {/* Day-of-week header */}
          <View style={styles.row}>
            {DAYS.map((d, i) => (
              <View key={i} style={styles.cell}>
                <Text style={styles.dayHeader}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Month grid rows */}
          {Array.from({ length: monthCells.length / 7 }, (_, row) => (
            <View key={row} style={styles.row}>
              {monthCells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day === null) return <View key={col} style={styles.cell} />;
                const iso = isoDate(day);
                const info = dataMap[iso];
                const bg = info ? severityColor(info.maxSeverity, palette.primary) : 'transparent';
                const isToday = iso === todayStr;
                const isSelected = iso === selectedDate;

                return (
                  <TouchableOpacity
                    key={col}
                    style={styles.cell}
                    onPress={() => onSelectDate(iso)}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTH_NAMES[month]}`}
                  >
                    <View
                      style={[
                        styles.dayCell,
                        { backgroundColor: bg },
                        isToday && styles.today,
                        isSelected && styles.selected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          isSelected && styles.dayNumSelected,
                          isToday && !isSelected && styles.dayNumToday,
                        ]}
                      >
                        {day}
                      </Text>
                      {info?.hasLogs && !isSelected && <View style={styles.dot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Legend for month view */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Severity: </Text>
            {[0, 3, 5, 7, 10].map(s => (
              <View
                key={s}
                style={[
                  styles.legendDot,
                  { backgroundColor: s === 0 ? palette.primary + '22' : severityColor(s, palette.primary) },
                ]}
              />
            ))}
            <Text style={styles.legendLabel}> None → High</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const CELL_SIZE = 38;

const useStyles = createThemedStyles(palette => ({
  wrap: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  monthLabel: { ...typography.bodyBold, color: palette.text, fontSize: 15 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 10,
    padding: 2.5,
    borderWidth: 1,
    borderColor: palette.border,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7.5,
  },
  modeBtnActive: {
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 1,
  },
  modeText: {
    ...typography.caption,
    fontSize: 11.5,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  weekContainer: {
    paddingVertical: 4,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  monthContainer: {
    gap: 3,
  },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayHeader: { ...typography.caption, color: palette.textSecondary, fontWeight: '600', fontSize: 11.5 },
  dayHeaderToday: { color: palette.primary, fontWeight: '700' },
  dayHeaderSelected: { color: palette.primary, fontWeight: '800' },
  dayCell: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: palette.primary, backgroundColor: palette.primary + '10' },
  selected: {
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dayNum: { ...typography.small, color: palette.text, fontWeight: '600', fontSize: 13.5 },
  dayNumSelected: { color: '#FFFFFF', fontWeight: '800' },
  dayNumToday: { color: palette.primary, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.primary, position: 'absolute', bottom: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 3 },
  legendLabel: { ...typography.caption, color: palette.textDisabled, fontSize: 11 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
}));
