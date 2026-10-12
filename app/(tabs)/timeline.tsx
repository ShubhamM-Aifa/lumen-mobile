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
import { Search, X, Camera, RotateCcw, ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
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
import { PressableScale } from '../../src/components/common/PressableScale';

type TypeFilter = 'all' | 'detailed' | 'quick' | 'photos' | 'bodymap';

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
  const [showCalendar, setShowCalendar] = useState(true);
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

  // Swipe between days via arrow buttons
  const prevDay = () => {
    const parts = (selectedDate || '').split('-');
    const d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    d.setDate(d.getDate() - 1);
    jumpToDate(toLocalDateString(d));
  };

  const nextDay = () => {
    const parts = (selectedDate || '').split('-');
    const d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
      : new Date();
    d.setDate(d.getDate() + 1);
    const next = toLocalDateString(d);
    if (next <= today) jumpToDate(next);
  };

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Timeline</Text>
        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCalendar(v => !v);
          }}
          style={styles.toggleChip}
          haptic="none"
          activeScale={0.93}
          accessibilityRole="button"
          accessibilityLabel={showCalendar ? 'Hide calendar' : 'Show calendar'}
        >
          <Calendar size={13} color={palette.primary} strokeWidth={2.2} />
          <Text style={styles.toggleChipText}>{showCalendar ? 'Hide calendar' : 'Show calendar'}</Text>
        </PressableScale>
      </View>

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
        {/* Calendar heat map */}
        {showCalendar && (
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
        )}

        {/* Day nav card */}
        <View style={styles.dayNavCard}>
          <PressableScale
            onPress={prevDay}
            style={styles.dayNavArrowBtn}
            haptic="light"
            activeScale={0.88}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <ChevronLeft size={18} color={palette.primary} strokeWidth={2.4} />
          </PressableScale>
          <View style={styles.dayNavCenter}>
            <Text style={styles.dayLabel}>
              {isToday
                ? `Today • ${(() => {
                    const parts = (today || '').split('-');
                    const d = parts.length === 3
                      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
                      : new Date();
                    return d.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                  })()}`
                : (() => {
                    const parts = (selectedDate || '').split('-');
                    const d = parts.length === 3
                      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
                      : new Date();
                    return d.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                  })()}
            </Text>
            {!isToday && (
              <PressableScale
                onPress={() => jumpToDate(today)}
                style={styles.todayPill}
                haptic="light"
                activeScale={0.92}
                accessibilityRole="button"
                accessibilityLabel="Jump to Today"
              >
                <Text style={styles.todayPillText}>Today</Text>
              </PressableScale>
            )}
          </View>
          <PressableScale
            onPress={nextDay}
            style={[styles.dayNavArrowBtn, isToday && styles.dim]}
            disabled={isToday}
            haptic="light"
            activeScale={0.88}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <ChevronRight size={18} color={palette.primary} strokeWidth={2.4} />
          </PressableScale>
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
              <RotateCcw size={12} color={palette.primary} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  heading: { ...typography.h2, color: palette.text, fontSize: 24, fontWeight: '800' },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.primary + '14',
    borderWidth: 1,
    borderColor: palette.primary + '2E',
  },
  toggleChipText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },
  calWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: palette.background },
  dayNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dayNavArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  dayNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: { ...typography.bodyBold, color: palette.text, fontSize: 14.5 },
  todayPill: {
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary + '33',
  },
  todayPillText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  dim: { opacity: 0.25 },

  // Search & Filter Toolbar
  filterToolbar: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingBottom: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  typeChipActive: {
    backgroundColor: palette.primary + '18',
    borderColor: palette.primary,
  },
  typeChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textSecondary,
    fontSize: 12,
  },
  typeChipTextActive: {
    color: palette.primary,
    fontWeight: '700',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  filterChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary + '14',
  },
  filterIcon: { fontSize: 13 },
  filterText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  filterTextActive: { color: palette.primary, fontWeight: '700' },
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
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: palette.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
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
    color: palette.primary,
    fontWeight: '700',
    fontSize: 12,
  },

  dayViewWrap: { minHeight: 300 },
}));
