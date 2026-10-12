/**
 * DayView — vertical timeline for a single day.
 * Groups entries into hour buckets; draws a vertical line on the left.
 * Fully supports Quick Actions, custom units, entry editing/deletion,
 * and bulk Expand all / Collapse all toggle.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, ChevronDown, ChevronUp, CalendarClock, Sparkles, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { ILogEntry, ICategory, IOption, IQuestion, IQuickAction } from '@lumen/shared';
import { TimelineItem } from './TimelineItem';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { PressableScale } from '../common/PressableScale';
import { getTrackingDayDateString } from '../../utils/dayBoundary';
import { useQuickLogStore } from '../../store/quickLogStore';

interface Props {
  date: string; // 'YYYY-MM-DD'
  entries: ILogEntry[];
  categories: ICategory[];
  questions: IQuestion[];
  options: IOption[];
  quickActions?: IQuickAction[];
  loading: boolean;
  onEditEntry?: (id: string) => void;
  onDeleteEntry?: (id: string) => void;
  boundaryHour?: number;
}

interface HourBucket {
  hour: number;
  label: string;
  entries: ILogEntry[];
}

function toHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export function DayView({
  date,
  entries,
  categories,
  questions,
  options,
  quickActions = [],
  loading,
  onEditEntry,
  onDeleteEntry,
  boundaryHour = 4,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  // Bulk expand/collapse state: defaults to false (collapsed by default)
  const [allExpanded, setAllExpanded] = useState<boolean | null>(false);
  const { tap } = useQuickLogStore();
  const queryClient = useQueryClient();

  const handleQuickActionTap = async (qa: IQuickAction) => {
    const parts = (date || '').split('-');
    let targetOccurredAt: string;
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const now = new Date();
      targetOccurredAt = new Date(y, m, d, now.getHours(), now.getMinutes(), 0).toISOString();
    } else {
      targetOccurredAt = new Date().toISOString();
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await tap(qa._id, targetOccurredAt);
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
    } catch {
      Alert.alert('Error', `Could not log ${qa.label}`);
    }
  };

  const toggleAllExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllExpanded(prev => (prev === true ? false : true));
  };

  const buckets = useMemo<HourBucket[]>(() => {
    const map: Record<number, ILogEntry[]> = {};
    entries.forEach(e => {
      const h = new Date(e.occurredAt).getHours();
      if (!map[h]) map[h] = [];
      map[h].push(e);
    });

    const hourKeys = Object.keys(map).map(Number);
    // Sort reverse-chronologically by latest entry timestamp in each bucket so that
    // late-night entries (e.g. 1 AM, 2 AM before boundary) sit at the top of the day,
    // preceding midnight and evening entries.
    hourKeys.sort((a, b) => {
      const maxA = Math.max(...map[a].map(e => new Date(e.occurredAt).getTime()));
      const maxB = Math.max(...map[b].map(e => new Date(e.occurredAt).getTime()));
      return maxB - maxA;
    });

    return hourKeys.map(hour => ({
      hour,
      label: toHourLabel(hour),
      entries: map[hour].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      ),
    }));
  }, [entries]);

  const formattedDate = useMemo(() => {
    const curToday = getTrackingDayDateString(new Date(), boundaryHour);
    if (date === curToday) return 'Today';
    const parts = (date || '').split('-');
    const d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }, [date, boundaryHour]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={palette.primary} />
      </View>
    );
  }

  if (entries.length === 0) {
    const visibleQuickActions = quickActions.filter(qa => qa.isVisible !== false).slice(0, 3);

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <View style={styles.emptyIconBadge}>
              <CalendarClock size={36} color={palette.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.sparkleBadge}>
              <Sparkles size={12} color="#F59E0B" strokeWidth={2.4} />
            </View>
          </View>
          <Text style={styles.emptyText}>No logs for this day</Text>
          <Text style={styles.emptyHint}>
            Track how you feel, your meals, or symptoms to see them on your timeline.
          </Text>
          <PressableScale
            style={styles.emptyAddBtn}
            onPress={() =>
              router.push({
                pathname: '/log',
                params: { date },
              } as any)
            }
            haptic="medium"
            activeScale={0.95}
            accessibilityRole="button"
            accessibilityLabel="Log an entry"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.emptyAddText}>Log an entry</Text>
          </PressableScale>

          {visibleQuickActions.length > 0 && (
            <View style={styles.emptyQuickSection}>
              <View style={styles.emptyQuickDivider}>
                <View style={styles.emptyQuickLine} />
                <Text style={styles.emptyQuickDividerText}>OR QUICK LOG</Text>
                <View style={styles.emptyQuickLine} />
              </View>
              <View style={styles.emptyQuickRow}>
                {visibleQuickActions.map(qa => (
                  <PressableScale
                    key={qa._id}
                    style={styles.emptyQuickChip}
                    onPress={() => handleQuickActionTap(qa)}
                    haptic="light"
                    activeScale={0.93}
                  >
                    {qa.icon ? <Text style={styles.emptyQuickIcon}>{qa.icon}</Text> : null}
                    <Text style={styles.emptyQuickText} numberOfLines={1}>
                      {qa.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.dateLabel}>{formattedDate}</Text>
          <Text style={styles.countBadge}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
          {boundaryHour !== undefined && boundaryHour !== 0 && (
            <View style={styles.boundaryBadge}>
              <Clock size={11} color={palette.primary} strokeWidth={2.4} />
              <Text style={styles.boundaryBadgeText}>
                {boundaryHour % 12 || 12} {boundaryHour < 12 ? 'AM' : 'PM'} Reset
              </Text>
            </View>
          )}
        </View>

        {/* Global Expand all / Collapse all toggle button */}
        {entries.length > 0 && (
          <PressableScale
            style={styles.expandAllBtn}
            onPress={toggleAllExpanded}
            haptic="light"
            activeScale={0.92}
            accessibilityRole="button"
            accessibilityLabel={allExpanded ? 'Collapse all logs' : 'Expand all logs'}
          >
            <Text style={[styles.expandAllText, { color: palette.primary }]}>
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Text>
            {allExpanded ? (
              <ChevronUp size={14} color={palette.primary} />
            ) : (
              <ChevronDown size={14} color={palette.primary} />
            )}
          </PressableScale>
        )}
      </View>

      {buckets.map((bucket, index) => (
        <View key={bucket.hour} style={[styles.bucket, index === 0 && styles.firstBucket]}>
          {/* Hour label + horizontal divider line */}
          <View style={styles.hourRow}>
            <View style={styles.hourLabelWrap}>
              <Text style={styles.hourLabel}>{bucket.label}</Text>
            </View>
            <View style={styles.line} />
          </View>

          {/* Entries in this bucket */}
          <View style={styles.entriesWrap}>
            {bucket.entries.map(entry => {
              const cat = categories.find(c => c._id === entry.categoryId);
              const q = questions.find(q => q._id === entry.questionId);
              const opts = options.filter(o => entry.answers?.some(a => a.optionId === o._id));
              const qa = quickActions.find(q => q._id === entry.quickActionId);

              return (
                <TimelineItem
                  key={entry._id}
                  entry={entry}
                  category={cat}
                  question={q}
                  options={opts}
                  allQuestions={questions}
                  allOptions={options}
                  quickAction={qa}
                  onDelete={onDeleteEntry}
                  onEdit={onEditEntry}
                  forceExpanded={allExpanded}
                />
              );
            })}
          </View>
        </View>
      ))}

      {/* Footer action to add another log for this day */}
      <View style={styles.dayFooterAddWrap}>
        <PressableScale
          style={styles.dayFooterAddBtn}
          onPress={() =>
            router.push({
              pathname: '/log',
              params: { date },
            } as any)
          }
          haptic="medium"
          activeScale={0.96}
          accessibilityRole="button"
          accessibilityLabel={`Log an entry for ${formattedDate}`}
        >
          <Plus size={16} color={palette.primary} strokeWidth={2.5} />
          <Text style={styles.dayFooterAddText}>Log an entry for this day</Text>
        </PressableScale>
      </View>

      <View style={{ height: 32 }} />
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  center: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconContainer: {
    position: 'relative',
    marginTop: 2,
    marginBottom: 12,
  },
  emptyIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: palette.primary + '14',
    borderWidth: 1.5,
    borderColor: palette.primary + '2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  sparkleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyText: {
    ...typography.h3,
    fontSize: 18,
    color: palette.text,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyHint: {
    ...typography.body,
    fontSize: 13.5,
    color: palette.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyAddText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  emptyQuickSection: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
  },
  emptyQuickDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  emptyQuickLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  emptyQuickDividerText: {
    ...typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.textDisabled,
    letterSpacing: 0.8,
  },
  emptyQuickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyQuickIcon: {
    fontSize: 14,
  },
  emptyQuickText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: { ...typography.h3, fontSize: 18, color: palette.text, fontWeight: '700' },
  countBadge: {
    ...typography.caption,
    color: palette.primary,
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '700',
  },
  boundaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary + '14',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary + '2E',
  },
  boundaryBadgeText: {
    ...typography.caption,
    color: palette.primary,
    fontSize: 10.5,
    fontWeight: '700',
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.primary + '12',
    borderWidth: 1,
    borderColor: palette.primary + '28',
  },
  expandAllText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11.5,
  },
  bucket: { marginBottom: 16 },
  firstBucket: { marginTop: 4 },
  hourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hourLabelWrap: { minWidth: 62, paddingRight: 8 },
  hourLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  line: { flex: 1, height: 1, backgroundColor: palette.border },
  entriesWrap: { paddingLeft: 4 },
  dayFooterAddWrap: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayFooterAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: palette.primary + '12',
    borderWidth: 1.5,
    borderColor: palette.primary + '35',
  },
  dayFooterAddText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.primary,
  },
}));
