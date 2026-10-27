/**
 * CalendarHeatMap — Week / Month switcher with a progress ring per day.
 * Ring colour = how much of the day was logged (green all answered, orange partly,
 * empty track nothing). A small dot marks days with moderate or severe symptoms.
 * Tap a day to select it.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { PressableScale } from '../common/PressableScale';
import { IosSegmented } from '../ios/IosSegmented';
import { ProgressRing } from '../ios/ProgressRing';
import { toLocalDateString } from '../../hooks/useTimelineSummary';

export interface DaySeverity {
  date: string; // 'YYYY-MM-DD'
  maxSeverity: number; // 0–10; 0 means logged but no severity; -1 means no data
  hasLogs: boolean;
  progress?: number; // 0.0 to 1.0
  percentage?: number; // 0 to 100
  answeredCount?: number;
  totalQuestions?: number;
  completedCategoriesCount?: number;
  totalCategoriesCount?: number;
  isComplete?: boolean;
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
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MODES = [
  { key: 'week' as const, label: 'Week' },
  { key: 'month' as const, label: 'Month' },
];

interface DayCellProps {
  num: number;
  size: number;
  info?: DaySeverity;
  isToday: boolean;
  isSelected: boolean;
}

/** Progress ring with the day number inside; selected day is a filled disc. */
function DayRing({ num, size, info, isToday, isSelected }: DayCellProps) {
  const { palette } = useTheme();
  const styles = useStyles();
  const progress = info?.progress ?? 0;
  const complete = info?.isComplete ?? progress >= 1;
  const ringColor = complete ? palette.success : palette.warning;
  const inner = size - 6;
  const severity = info?.maxSeverity ?? -1;
  const dot = severity >= 7 ? palette.error : severity >= 4 ? palette.warning : null;

  return (
    <View style={{ width: size, height: size }}>
      <ProgressRing size={size} strokeWidth={3} progress={progress} color={ringColor} trackColor={palette.divider}>
        <View
          style={[
            { width: inner, height: inner, borderRadius: inner / 2, alignItems: 'center', justifyContent: 'center' },
            isSelected && { backgroundColor: palette.primary },
          ]}
        >
          <Text
            style={[
              styles.dayNum,
              isToday && !isSelected && { color: palette.primaryText },
              isSelected && { color: '#FFFFFF' },
            ]}
            maxFontSizeMultiplier={1.2}
          >
            {num}
          </Text>
        </View>
      </ProgressRing>
      {dot ? <View style={[styles.sevDot, { backgroundColor: dot, borderColor: palette.surface }]} /> : null}
    </View>
  );
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

  // Month grid cells (Monday first)
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
      return { dayNum: d.getDate(), iso: toLocalDateString(d), index: i };
    });
  }, [selectedDate]);

  const todayStr = todayDate ?? toLocalDateString(new Date());

  const isoDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isWeek = viewMode === 'week';
  const handlePrev = () => (isWeek && onPrevWeek ? onPrevWeek() : onPrevMonth());
  const handleNext = () => (isWeek && onNextWeek ? onNextWeek() : onNextMonth());

  const describe = (info: DaySeverity | undefined, selected: boolean) => {
    const sev = (info?.maxSeverity ?? -1) >= 7 ? ', severe symptoms' : (info?.maxSeverity ?? -1) >= 4 ? ', moderate symptoms' : '';
    return `${info?.percentage ?? 0} percent logged${sev}${selected ? ', selected' : ''}`;
  };

  const monthSummary = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const days = data.filter(d => d.date.startsWith(prefix));
    const full = days.filter(d => d.isComplete).length;
    const logged = days.filter(d => d.hasLogs).length;
    return logged === 0 ? 'Nothing logged yet' : `${full} complete · ${logged} logged`;
  }, [data, year, month]);

  return (
    <View style={styles.wrap}>
      {onToggleViewMode ? (
        <View style={styles.segWrap}>
          <IosSegmented options={MODES} value={viewMode} onChange={onToggleViewMode} />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleCol}>
            <Text style={styles.monthLabel} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {MONTH_NAMES[month]} {year}
            </Text>
            {!isWeek ? <Text style={styles.monthSummary} maxFontSizeMultiplier={1.3}>{monthSummary}</Text> : null}
          </View>
          <View style={styles.navGroup}>
            <PressableScale
              onPress={handlePrev}
              style={styles.navBtn}
              haptic="light"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel={isWeek ? 'Previous week' : 'Previous month'}
            >
              <ChevronLeft size={18} color={palette.primaryText} strokeWidth={2.4} />
            </PressableScale>
            <PressableScale
              onPress={handleNext}
              style={styles.navBtn}
              haptic="light"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel={isWeek ? 'Next week' : 'Next month'}
            >
              <ChevronRight size={18} color={palette.primaryText} strokeWidth={2.4} />
            </PressableScale>
          </View>
        </View>

        {isWeek ? (
          <View style={styles.weekRow}>
            {weekDays.map(item => {
              const info = dataMap[item.iso];
              const isSelected = item.iso === selectedDate;
              const pct = info?.percentage ?? 0;
              const complete = info?.isComplete ?? false;
              return (
                <TouchableOpacity
                  key={item.iso}
                  style={styles.weekCol}
                  onPress={() => onSelectDate(item.iso)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAY_NAMES[item.index]} ${item.dayNum}, ${describe(info, isSelected)}`}
                >
                  <Text style={styles.dow} maxFontSizeMultiplier={1.2}>{DAYS[item.index]}</Text>
                  <DayRing num={item.dayNum} size={42} info={info} isToday={item.iso === todayStr} isSelected={isSelected} />
                  <Text
                    style={[styles.pct, { color: complete ? palette.successText : palette.warningText }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {pct > 0 ? `${pct}%` : ' '}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.monthWrap}>
            <View style={styles.gridRow}>
              {DAYS.map((d, i) => (
                <Text key={i} style={styles.gridDow} maxFontSizeMultiplier={1.2}>{d}</Text>
              ))}
            </View>
            {Array.from({ length: monthCells.length / 7 }, (_, row) => (
              <View key={row} style={styles.gridRow}>
                {monthCells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (day === null) return <View key={col} style={styles.gridCell} />;
                  const iso = isoDate(day);
                  const info = dataMap[iso];
                  const isSelected = iso === selectedDate;
                  return (
                    <TouchableOpacity
                      key={col}
                      style={styles.gridCell}
                      onPress={() => onSelectDate(iso)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${day} ${MONTH_NAMES[month]}, ${describe(info, isSelected)}`}
                    >
                      <DayRing num={day} size={40} info={info} isToday={iso === todayStr} isSelected={isSelected} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
                <Text style={styles.legendText}>All answered</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.warning }]} />
                <Text style={styles.legendText}>Partly</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { borderWidth: 1.5, borderColor: palette.border }]} />
                <Text style={styles.legendText}>Nothing logged</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.error }]} />
                <Text style={styles.legendText}>Severe symptoms</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 12 },
  segWrap: { marginHorizontal: -16 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  titleCol: { flexShrink: 1, gap: 1 },
  monthLabel: { ...typography.headline, color: palette.text },
  monthSummary: { ...typography.footnote, color: palette.textSecondary },
  navGroup: { flexDirection: 'row', gap: 8 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row' },
  weekCol: { flex: 1, alignItems: 'center', gap: 6 },
  dow: { ...typography.footnote, color: palette.textSecondary, fontWeight: '500' },
  pct: { fontSize: 11, lineHeight: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dayNum: { ...typography.headline, color: palette.text, fontVariant: ['tabular-nums'] },
  sevDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  monthWrap: { gap: 8 },
  gridRow: { flexDirection: 'row' },
  gridDow: { flex: 1, textAlign: 'center', ...typography.footnote, color: palette.textSecondary, fontWeight: '500' },
  gridCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.footnote, color: palette.textSecondary },
}));
