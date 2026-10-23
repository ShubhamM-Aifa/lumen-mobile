/**
 * CalendarHeatMap — month grid or compact week strip with per-day symptom severity colouring
 * and circular progress rings indicating daily question completion.
 * Tap a day to select it; toggle between Week and Month view.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { PressableScale } from '../common/PressableScale';
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

  const renderDayCellContent = (
    dayNum: number | string,
    iso: string,
    info: DaySeverity | undefined,
    isToday: boolean,
    isSelected: boolean
  ) => {
    const bg = info ? severityColor(info.maxSeverity, palette.primary) : 'transparent';
    const progress = info?.progress ?? 0;
    const isComplete = info?.isComplete ?? (progress >= 1);

    // If selected and no severity background, use a sleek surface highlight
    const effectiveBg = isSelected && bg === 'transparent'
      ? (palette.surfaceAlt === '#F5F0EB' ? '#E5E7EB' : '#3A3330')
      : bg;

    return (
      <View
        style={[
          styles.dayCell,
          isSelected && styles.selectedGlow,
        ]}
      >
        {/* Render background circle and rings in SVG for 100% vector precision without Android clipping/square bugs */}
        <Svg width={36} height={36} style={styles.cellProgressRing} pointerEvents="none">
          {/* 1. Geometric Circular Background (guarantees true circle on dates with logs like 19) */}
          {effectiveBg !== 'transparent' && (
            <Circle cx={18} cy={18} r={15.5} fill={effectiveBg} />
          )}

          {/* 2. Progress Ring when progress > 0 */}
          {progress > 0 ? (
            <>
              {/* Background track */}
              <Circle
                cx={18}
                cy={18}
                r={15.5}
                stroke={isComplete ? '#10B98126' : palette.primary + '25'}
                strokeWidth={2.5}
                fill="transparent"
              />
              {/* Active progress arc */}
              <Circle
                cx={18}
                cy={18}
                r={15.5}
                stroke={isComplete ? '#10B981' : palette.primary}
                strokeWidth={2.5}
                strokeDasharray="97.39"
                strokeDashoffset={97.39 * (1 - Math.min(1, progress))}
                strokeLinecap="round"
                fill="transparent"
                transform="rotate(-90 18 18)"
              />
            </>
          ) : (
            // 3. When progress === 0: Render clean selection border or today border without overlap
            <>
              {isSelected ? (
                <Circle
                  cx={18}
                  cy={18}
                  r={15.5}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill="transparent"
                />
              ) : isToday ? (
                <Circle
                  cx={18}
                  cy={18}
                  r={15.5}
                  stroke={palette.primary}
                  strokeWidth={1.5}
                  fill="transparent"
                />
              ) : null}
            </>
          )}
        </Svg>

        <Text
          style={[
            styles.dayNum,
            isSelected && styles.dayNumSelected,
            isToday && !isSelected && styles.dayNumToday,
          ]}
        >
          {dayNum}
        </Text>
        {info?.hasLogs && !isSelected && progress === 0 && <View style={styles.dot} />}
      </View>
    );
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
            {weekDays.map((item) => {
              const info = dataMap[item.iso];
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
                  accessibilityLabel={`${item.dayOfWeek} ${item.dayNum}, progress ${info?.percentage ?? 0} percent`}
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
                  {renderDayCellContent(item.dayNum, item.iso, info, isToday, isSelected)}
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
                const isToday = iso === todayStr;
                const isSelected = iso === selectedDate;

                return (
                  <TouchableOpacity
                    key={col}
                    style={styles.cell}
                    onPress={() => onSelectDate(iso)}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTH_NAMES[month]}, progress ${info?.percentage ?? 0} percent`}
                  >
                    {renderDayCellContent(day, iso, info, isToday, isSelected)}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Enhanced Legend for Month View */}
          <View style={styles.legendContainer}>
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

            <View style={styles.legendDivider} />

            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Progress: </Text>
              <View style={[styles.legendRingPreview, { borderColor: palette.primary }]} />
              <Text style={styles.legendLabel}>In progress</Text>
              <View style={[styles.legendRingPreview, { borderColor: '#10B981' }]} />
              <Text style={styles.legendLabel}>100% Done</Text>
            </View>
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
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cellProgressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  selectedGlow: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  today: { borderWidth: 1.5, borderColor: palette.primary, backgroundColor: palette.primary + '10' },
  selected: {
    borderWidth: 2.2,
    borderColor: '#FFFFFF',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  dayNum: { ...typography.small, color: palette.text, fontWeight: '600', fontSize: 13.5 },
  dayNumSelected: { color: '#FFFFFF', fontWeight: '800' },
  dayNumToday: { color: palette.primary, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.primary, position: 'absolute', bottom: 3 },
  legendContainer: {
    marginTop: 10,
    gap: 5,
  },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  legendDivider: {
    height: 1,
    backgroundColor: palette.border,
    opacity: 0.5,
    marginHorizontal: 20,
    marginVertical: 2,
  },
  legendLabel: { ...typography.caption, color: palette.textDisabled, fontSize: 11 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendRingPreview: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    backgroundColor: 'transparent',
    marginLeft: 4,
  },
}));
