/**
 * DayView — vertical timeline for a single day.
 * Groups entries into hour buckets; draws a vertical line on the left.
 * Fully supports Quick Actions, custom units, entry editing/deletion,
 * and bulk Expand all / Collapse all toggle.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, ActivityIndicator, Alert, StyleSheet,
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
        <ActivityIndicator size="small" color={palette.primaryText} />
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
              <CalendarClock size={36} color={palette.primaryText} strokeWidth={2.2} />
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
          <Text style={styles.countLabel}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
          {boundaryHour !== undefined && boundaryHour !== 0 && (
            <View style={styles.boundaryBadge}>
              <Clock size={12} color={palette.textSecondary} strokeWidth={2.4} />
              <Text style={styles.boundaryBadgeText}>
                {boundaryHour % 12 || 12} {boundaryHour < 12 ? 'AM' : 'PM'} reset
              </Text>
            </View>
          )}
        </View>

        <PressableScale
          style={styles.expandAllBtn}
          onPress={toggleAllExpanded}
          haptic="light"
          activeScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={allExpanded ? 'Collapse all logs' : 'Expand all logs'}
        >
          <Text style={styles.expandAllText}>{allExpanded ? 'Collapse all' : 'Expand all'}</Text>
          {allExpanded ? (
            <ChevronUp size={14} color={palette.primaryText} />
          ) : (
            <ChevronDown size={14} color={palette.primaryText} />
          )}
        </PressableScale>
      </View>

      {buckets.map(bucket => (
        <View key={bucket.hour} style={styles.bucket}>
          <Text style={styles.hourLabel} accessibilityRole="header">{bucket.label}</Text>
          <View style={styles.hourCard}>
            {bucket.entries.map((entry, i) => {
              const cat = categories.find(c => c._id === entry.categoryId);
              const q = questions.find(q => q._id === entry.questionId);
              const opts = options.filter(o => entry.answers?.some(a => a.optionId === o._id));
              const qa = quickActions.find(q => q._id === entry.quickActionId);

              return (
                <View key={entry._id} style={i < bucket.entries.length - 1 ? styles.separated : undefined}>
                  <TimelineItem
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
                </View>
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
          <Plus size={16} color={palette.primaryText} strokeWidth={2.5} />
          <Text style={styles.dayFooterAddText}>Log an entry for this day</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { paddingTop: 4, paddingBottom: 16, gap: 18 },
  center: { paddingVertical: 56, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyIconContainer: { position: 'relative', marginTop: 2, marginBottom: 12 },
  emptyIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: palette.tint + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...typography.title2, color: palette.text, textAlign: 'center', marginBottom: 6 },
  emptyHint: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center', maxWidth: 270 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    minHeight: 50,
    borderRadius: 25,
    marginTop: 20,
  },
  emptyAddText: { ...typography.headline, color: '#FFFFFF' },
  emptyQuickSection: { width: '100%', marginTop: 24, alignItems: 'center' },
  emptyQuickDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 12 },
  emptyQuickLine: { flex: 1, height: 1, backgroundColor: palette.divider },
  emptyQuickDividerText: { ...typography.sectionLabel, color: palette.textSecondary },
  emptyQuickRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  emptyQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: palette.surfaceAlt,
  },
  emptyQuickIcon: { fontSize: 15 },
  emptyQuickText: { ...typography.subheadBold, color: palette.text },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 32,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  countLabel: { ...typography.subhead, color: palette.textSecondary },
  boundaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boundaryBadgeText: { ...typography.footnote, color: palette.textSecondary },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  expandAllText: { ...typography.subheadBold, color: palette.primaryText },

  bucket: { gap: 7 },
  hourLabel: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 20 },
  hourCard: {
    marginHorizontal: 16,
    backgroundColor: palette.surface,
    borderRadius: 26,
    overflow: 'hidden',
  },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },

  dayFooterAddWrap: { alignItems: 'center', justifyContent: 'center' },
  dayFooterAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: palette.tint + '1F',
  },
  dayFooterAddText: { ...typography.headline, color: palette.primaryText },
}));
