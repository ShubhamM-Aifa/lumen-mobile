/**
 * Timeline tab — calendar heat-map + day-by-day log view with:
 * - Rich multi-dimensional filters: Search query, Log Type (Detailed, Quick, Photos, Body Map), Categories
 * - Full edit flow navigation to /log/edit/[id]
 * - Visual anatomical body map & photo inspection
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Search, X, Camera, RotateCcw, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useConfigStore } from '../../src/store/configStore';
import { useAuthStore } from '../../src/store/authStore';
import { CalendarHeatMap } from '../../src/components/timeline/CalendarHeatMap';
import { DayView } from '../../src/components/timeline/DayView';
import { useTimelineSummary, useDayEntries, toLocalDateString } from '../../src/hooks/useTimelineSummary';
import { getTrackingDayDateString } from '../../src/utils/dayBoundary';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/api/client';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';

type TypeFilter = 'all' | 'detailed' | 'quick' | 'photos' | 'bodymap';

function parseDay(date: string): Date {
  const parts = (date || '').split('-');
  return parts.length === 3
    ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
    : new Date();
}

export default function TimelineScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();

  const { user } = useAuthStore();
  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const { date: routeDate } = useLocalSearchParams<{ date?: string }>();

  const [today, setToday] = useState(() => getTrackingDayDateString(new Date(), boundaryHour));
  const [selectedDate, setSelectedDate] = useState(() => routeDate || getTrackingDayDateString(new Date(), boundaryHour));
  const [calYear, setCalYear] = useState(() => {
    const dStr = routeDate || getTrackingDayDateString(new Date(), boundaryHour);
    const p = dStr.split('-');
    return p.length === 3 ? parseInt(p[0], 10) : new Date().getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const dStr = routeDate || getTrackingDayDateString(new Date(), boundaryHour);
    const p = dStr.split('-');
    return p.length === 3 ? parseInt(p[1], 10) - 1 : new Date().getMonth();
  });
  const [calViewMode, setCalViewMode] = useState<'week' | 'month'>('week');

  useEffect(() => {
    if (routeDate && routeDate !== selectedDate) {
      jumpToDate(routeDate);
    }
  }, [routeDate]);

  // Multi-dimensional filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filterCatId, setFilterCatId] = useState<string | null>(null);

  const { config } = useConfigStore();
  const { data: summary = [], refetch: refetchSummary } = useTimelineSummary(calYear, calMonth, boundaryHour);
  const {
    data: entries = [],
    isLoading: entriesLoading,
    refetch: refetchEntries,
  } = useDayEntries(selectedDate, boundaryHour);

  // Automatically update timeline data from API whenever user switches to the Timeline tab
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      const curToday = getTrackingDayDateString(now, boundaryHour);

      setToday(prevToday => {
        if (prevToday !== curToday) {
          // If the day rolled over and user was looking at previous today, advance to new today
          setSelectedDate(prevSel => (prevSel === prevToday ? curToday : prevSel));
          const parts = curToday.split('-');
          if (parts.length === 3) {
            setCalYear(parseInt(parts[0], 10));
            setCalMonth(parseInt(parts[1], 10) - 1);
          }
        }
        return curToday;
      });

      // Invalidate queries so TanStack Query marks all timeline day entries & summaries as stale
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });

      // Trigger immediate network refetches
      refetchSummary();
      refetchEntries();

      // Refresh config in background to pick up newly added questions/categories/quick-actions
      useConfigStore.getState().fetchConfig().catch(() => {});
    }, [boundaryHour, queryClient, refetchSummary, refetchEntries])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['day-entries'] }),
      refetchSummary(),
      refetchEntries(),
      useConfigStore.getState().fetchConfig(),
    ]);
    setRefreshing(false);
  }, [queryClient, refetchSummary, refetchEntries]);

  const categories = config?.categories ?? [];
  const questions = config?.questions ?? [];
  const options = config?.options ?? [];
  const quickActions = config?.quickActions ?? [];

  const prevMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 0) { setCalYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 11) { setCalYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const jumpToDate = (date: string) => {
    setSelectedDate(date);
    const parts = (date || '').split('-');
    if (parts.length === 3) {
      setCalYear(parseInt(parts[0], 10));
      setCalMonth(parseInt(parts[1], 10) - 1);
    }
  };

  const prevWeek = useCallback(() => {
    const parts = (selectedDate || '').split('-');
    const d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    d.setDate(d.getDate() - 7);
    jumpToDate(toLocalDateString(d));
  }, [selectedDate]);

  const nextWeek = useCallback(() => {
    const parts = (selectedDate || '').split('-');
    const d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    d.setDate(d.getDate() + 7);
    const next = toLocalDateString(d);
    if (next <= today) jumpToDate(next);
  }, [selectedDate, today]);

  const isToday = selectedDate === today;

  // Compute stats across all entries for the active day
  const stats = useMemo(() => {
    let photosCount = 0;
    let bodyMapCount = 0;
    let quickCount = 0;
    let detailedCount = 0;

    entries.forEach(e => {
      const isQuick = e.source === 'quick_action' || !!e.quickActionId;
      if (isQuick) quickCount++;
      else detailedCount++;

      const hasPhotos =
        (e.mediaIds && e.mediaIds.length > 0) ||
        e.answers?.some(a =>
          a.values?.some(v => v.dataType === 'image' && Array.isArray(v.value) && v.value.length > 0)
        );
      if (hasPhotos) photosCount++;

      const hasBodyMap = e.answers?.some(a =>
        a.values?.some(v => v.dataType === 'location' && Array.isArray(v.value) && v.value.length > 0)
      );
      if (hasBodyMap) bodyMapCount++;
    });

    return {
      total: entries.length,
      quick: quickCount,
      detailed: detailedCount,
      photos: photosCount,
      bodyMap: bodyMapCount,
    };
  }, [entries]);

  // Used categories for the active day with individual log counts
  const usedCats = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      if (e.categoryId) {
        counts[e.categoryId] = (counts[e.categoryId] || 0) + 1;
      }
    });
    return categories
      .filter(c => counts[c._id] > 0)
      .map(c => ({
        ...c,
        count: counts[c._id] || 0,
      }));
  }, [entries, categories]);

  // Filtered entries based on category, type, and search query
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // 1. Category filter
      if (filterCatId && e.categoryId !== filterCatId) return false;

      // 2. Type filter
      if (typeFilter === 'detailed') {
        const isQuick = e.source === 'quick_action' || !!e.quickActionId;
        if (isQuick) return false;
      } else if (typeFilter === 'quick') {
        const isQuick = e.source === 'quick_action' || !!e.quickActionId;
        if (!isQuick) return false;
      } else if (typeFilter === 'photos') {
        const hasPhotos =
          (e.mediaIds && e.mediaIds.length > 0) ||
          e.answers?.some(a =>
            a.values?.some(v => v.dataType === 'image' && Array.isArray(v.value) && v.value.length > 0)
          );
        if (!hasPhotos) return false;
      } else if (typeFilter === 'bodymap') {
        const hasBodyMap = e.answers?.some(a =>
          a.values?.some(v => v.dataType === 'location' && Array.isArray(v.value) && v.value.length > 0)
        );
        if (!hasBodyMap) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const noteMatch = e.note?.toLowerCase().includes(q);
        const catMatch = categories.find(c => c._id === e.categoryId)?.name.toLowerCase().includes(q);
        const answerMatch = e.answers?.some(a => {
          if (a.optionLabelSnapshot?.toLowerCase().includes(q)) return true;
          if (a.otherText?.toLowerCase().includes(q)) return true;
          if (a.comment?.toLowerCase().includes(q)) return true;
          const opt = options.find(o => o._id === a.optionId);
          if (opt?.label.toLowerCase().includes(q)) return true;
          return false;
        });
        if (!noteMatch && !catMatch && !answerMatch) return false;
      }

      return true;
    });
  }, [entries, filterCatId, typeFilter, searchQuery, categories, options]);

  const hasActiveFilters = Boolean(filterCatId || typeFilter !== 'all' || searchQuery.trim());

  const resetFilters = () => {
    setFilterCatId(null);
    setTypeFilter('all');
    setSearchQuery('');
  };

  // Handle entry deletion
  const handleDeleteEntry = async (id: string) => {
    try {
      await api.delete(`/logs/${id}`);
      queryClient.invalidateQueries({ queryKey: ['day-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      refetchEntries();
      refetchSummary();
    } catch {
      Alert.alert('Error', 'Failed to delete log entry.');
    }
  };

  // Handle edit entry navigation
  const handleEditEntry = (id: string) => {
    router.push(`/log/edit/${id}` as any);
  };

  const selectedDayInfo = useMemo(() => {
    const found = summary.find(d => d.date === selectedDate);
    if (found) return found;

    const activeQuestions = (config?.questions ?? []).filter(q => q.isActive);
    const activeCategories = (config?.categories ?? []).filter(c => c.isActive);
    return {
      date: selectedDate,
      maxSeverity: -1,
      hasLogs: false,
      progress: 0,
      percentage: 0,
      answeredCount: 0,
      totalQuestions: activeQuestions.length,
      completedCategoriesCount: 0,
      totalCategoriesCount: activeCategories.length,
      isComplete: false,
    };
  }, [summary, selectedDate, config]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        <LargeTitleHeader
          title="Timeline"
          actions={
            <GlassCircleButton
              accessibilityLabel={isToday ? 'Showing today' : 'Jump to today'}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                jumpToDate(today);
              }}
            >
              <Calendar size={20} color={isToday ? palette.textSecondary : palette.tint} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        <View style={styles.calWrap}>
          <CalendarHeatMap
            year={calYear}
            month={calMonth}
            data={summary}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            viewMode={calViewMode}
            onToggleViewMode={setCalViewMode}
            onPrevWeek={prevWeek}
            onNextWeek={nextWeek}
            todayDate={today}
          />
        </View>

        {/* Selected day: title, how much is answered, and a way to add to it */}
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderText}>
            <Text style={styles.dayTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {isToday
                ? 'Today'
                : parseDay(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.daySub} maxFontSizeMultiplier={1.3}>
              {selectedDayInfo.answeredCount && selectedDayInfo.answeredCount > 0
                ? `${selectedDayInfo.answeredCount} of ${selectedDayInfo.totalQuestions} questions answered`
                : entries.length > 0
                  ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} logged`
                  : 'Nothing logged yet'}
            </Text>
            <View
              style={styles.dayTrack}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${selectedDayInfo.percentage ?? 0} percent logged`}
            >
              <View
                style={[
                  styles.dayFill,
                  {
                    width: `${selectedDayInfo.percentage ?? 0}%`,
                    backgroundColor: selectedDayInfo.isComplete ? palette.success : palette.tint,
                  },
                ]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.logDayBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: '/log', params: { date: selectedDate } });
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Log for ${selectedDate}`}
          >
            <Text style={styles.logDayText} maxFontSizeMultiplier={1.3}>Log This Day</Text>
          </TouchableOpacity>
        </View>

        {/* Search & Filter Toolbar */}
        {entries.length > 0 && (
          <View style={styles.filterToolbar}>
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Search size={16} color={palette.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search symptoms, notes, answers..."
                placeholderTextColor={palette.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Type Filter row (All, Detailed, Quick Taps, Photos, Body Map) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeFilterRow}
            >
              <TouchableOpacity
                style={[styles.typeChip, typeFilter === 'all' && styles.typeChipActive]}
                onPress={() => setTypeFilter('all')}
              >
                <Text style={[styles.typeChipText, typeFilter === 'all' && styles.typeChipTextActive]}>
                  All ({entries.length})
                </Text>
              </TouchableOpacity>

              {stats.detailed > 0 && (
                <TouchableOpacity
                  style={[styles.typeChip, typeFilter === 'detailed' && styles.typeChipActive]}
                  onPress={() => setTypeFilter(typeFilter === 'detailed' ? 'all' : 'detailed')}
                >
                  <Text style={[styles.typeChipText, typeFilter === 'detailed' && styles.typeChipTextActive]}>
                    📋 Detailed ({stats.detailed})
                  </Text>
                </TouchableOpacity>
              )}

              {stats.quick > 0 && (
                <TouchableOpacity
                  style={[styles.typeChip, typeFilter === 'quick' && styles.typeChipActive]}
                  onPress={() => setTypeFilter(typeFilter === 'quick' ? 'all' : 'quick')}
                >
                  <Text style={[styles.typeChipText, typeFilter === 'quick' && styles.typeChipTextActive]}>
                    ⚡ Quick ({stats.quick})
                  </Text>
                </TouchableOpacity>
              )}

              {stats.photos > 0 && (
                <TouchableOpacity
                  style={[styles.typeChip, typeFilter === 'photos' && styles.typeChipActive]}
                  onPress={() => setTypeFilter(typeFilter === 'photos' ? 'all' : 'photos')}
                >
                  <Camera size={13} color={typeFilter === 'photos' ? palette.primary : palette.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.typeChipText, typeFilter === 'photos' && styles.typeChipTextActive]}>
                    Photos ({stats.photos})
                  </Text>
                </TouchableOpacity>
              )}

              {stats.bodyMap > 0 && (
                <TouchableOpacity
                  style={[styles.typeChip, typeFilter === 'bodymap' && styles.typeChipActive]}
                  onPress={() => setTypeFilter(typeFilter === 'bodymap' ? 'all' : 'bodymap')}
                >
                  <Text style={{ fontSize: 13, marginRight: 2 }}>🧍</Text>
                  <Text style={[styles.typeChipText, typeFilter === 'bodymap' && styles.typeChipTextActive]}>
                    Body Map ({stats.bodyMap})
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Category filter chips with entry count badges */}
            {usedCats.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <TouchableOpacity
                  style={[styles.filterChip, filterCatId === null && styles.filterChipActive]}
                  onPress={() => setFilterCatId(null)}
                >
                  <Text style={[styles.filterText, filterCatId === null && styles.filterTextActive]}>
                    All Categories
                  </Text>
                </TouchableOpacity>

                {usedCats.map(cat => {
                  const isSelected = filterCatId === cat._id;
                  return (
                    <TouchableOpacity
                      key={cat._id}
                      style={[
                        styles.filterChip,
                        isSelected && { borderColor: cat.color, backgroundColor: cat.color + '18' },
                      ]}
                      onPress={() => setFilterCatId(isSelected ? null : cat._id)}
                    >
                      {cat.icon && <Text style={styles.filterIcon}>{cat.icon}</Text>}
                      <Text style={[styles.filterText, isSelected && { color: cat.color, fontWeight: '700' }]}>
                        {cat.name}
                      </Text>
                      <View style={[styles.catCountBadge, isSelected && { backgroundColor: cat.color + '28' }]}>
                        <Text style={[styles.catCountText, isSelected && { color: cat.color }]}>
                          {cat.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Active Filter Feedback bar */}
        {hasActiveFilters && (
          <View style={styles.activeFilterBar}>
            <Text style={styles.activeFilterCount}>
              Showing {filteredEntries.length} of {entries.length} logs
            </Text>
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
              <RotateCcw size={12} color={palette.primaryText} />
              <Text style={styles.resetBtnText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Day entries */}
        <View style={styles.dayViewWrap}>
          <DayView
            date={selectedDate}
            entries={filteredEntries}
            categories={categories}
            questions={questions}
            options={options}
            quickActions={quickActions}
            loading={entriesLoading}
            onEditEntry={handleEditEntry}
            onDeleteEntry={handleDeleteEntry}
            boundaryHour={boundaryHour}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 6, paddingBottom: TAB_BAR_CLEARANCE },
  calWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  dayHeaderText: { flex: 1, gap: 2 },
  dayTitle: { ...typography.title2, color: palette.text },
  daySub: { ...typography.subhead, color: palette.textSecondary },
  dayTrack: { width: 180, maxWidth: '100%', height: 5, borderRadius: 3, backgroundColor: palette.surfaceAlt, overflow: 'hidden', marginTop: 6 },
  dayFill: { height: '100%', borderRadius: 3 },
  logDayBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: palette.tint + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDayText: { ...typography.subheadBold, color: palette.primaryText },

  // Search & Filter Toolbar
  filterToolbar: {
    paddingTop: 6,
    paddingBottom: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyLarge,
    color: palette.text,
    padding: 0,
  },

  // Type Filter Pills
  typeFilterRow: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 8,
    alignItems: 'center',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 9999,
    backgroundColor: palette.surface,
  },
  typeChipActive: {
    backgroundColor: palette.text,
  },
  typeChipText: {
    ...typography.subhead,
    color: palette.text,
  },
  typeChipTextActive: {
    color: palette.background,
    fontWeight: '600',
  },

  // Category Filter Chips
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.surface,
  },
  filterChipActive: {
    backgroundColor: palette.text,
  },
  filterIcon: { fontSize: 13 },
  filterText: {
    ...typography.subhead,
    color: palette.text,
  },
  filterTextActive: { color: palette.background, fontWeight: '600' },
  catCountBadge: {
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textSecondary,
  },

  // Active filter summary banner
  activeFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  activeFilterCount: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resetBtnText: {
    ...typography.caption,
    color: palette.primaryText,
    fontWeight: '700',
    fontSize: 12,
  },

  dayViewWrap: { minHeight: 300 },
}));
