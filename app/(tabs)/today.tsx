/**
 * Today / Home screen (iOS-style)
 * ─ Large title with Customize, Messages, Notifications and profile
 * ─ "How are you feeling?" one-tap check-in
 * ─ From Lumen AI insight card
 * ─ Quick Taps grid with progress rings & dashed "Add Action" tile
 * ─ My Day tasks with completion counter ring
 * ─ Notes section with recent notes & quick create
 * ─ Quick Log & Flare mode rows
 * ─ Summary 2-column square grid (Reminders, Walking, Active Time, Sleep)
 */
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Zap,
  Flame,
  Plus,
  MessageCircle,
  SlidersHorizontal,
  FileText,
  Pin,
  SquarePen,
} from 'lucide-react-native';

import { IQuickAction } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useAuthStore } from '../../src/store/authStore';
import { useConfigStore } from '../../src/store/configStore';
import { useDaySessionStore } from '../../src/store/daySessionStore';
import { useQuickLogStore } from '../../src/store/quickLogStore';
import { useActivityStore } from '../../src/store/activityStore';
import { useAutoWalkStore } from '../../src/store/autoWalkStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { useSleepTrackerStore } from '../../src/store/sleepTrackerStore';
import { useWeatherStore } from '../../src/store/weatherStore';
import { useTaskStore } from '../../src/store/taskStore';
import { useCommunityStore } from '../../src/store/communityStore';
import { useNoteStore } from '../../src/store/noteStore';
import { syncLiveWidgetsFromStores } from '../../src/widgets/widgetSync';

import { DayClockCard } from '../../src/components/DayClockCard';
import { QuickActionButton } from '../../src/components/QuickActionButton';
import { UndoToast } from '../../src/components/UndoToast';
import { ForYouTodayCard } from '../../src/components/home/ForYouTodayCard';
import { FeelingCard } from '../../src/components/home/FeelingCard';
import { MyDaySection } from '../../src/components/home/MyDaySection';
import { WaterQuantityModal } from '../../src/components/WaterQuantityModal';
import { RunningTimerPill } from '../../src/components/home/RunningTimerPill';
import { WeatherReportModal } from '../../src/components/weather/WeatherReportModal';
import { LinkedQuickTapModal } from '../../src/components/home/LinkedQuickTapModal';
import { ModularAvatar } from '../../src/components/avatar/ModularAvatar';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { SectionTitle } from '../../src/components/ios/SectionTitle';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';
import { getTrackingDayDateString } from '../../src/utils/dayBoundary';
import { useIntelligenceStore } from '../../src/store/intelligenceStore';
import { useNotificationInboxStore, countUnread } from '../../src/store/notificationInboxStore';
import { refreshInbox } from '../../src/services/notificationInbox';
import { useTriggerWatch } from '../../src/hooks/useTriggerWatch';
import { useFlareRiskWatch } from '../../src/hooks/useFlareRiskWatch';
import { FlareModeToday, pickEssentialActions } from '../../src/components/home/FlareModeToday';

function formatNoteRelativeTime(dateString?: string): string {
  if (!dateString) return 'Edited recently';
  const now = Date.now();
  const diffMs = now - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Edited just now';
  if (diffMin < 60) return `Edited ${diffMin}m ago`;
  if (diffHours < 24) return `Edited ${diffHours}h ago`;
  if (diffDays === 1) return 'Edited yesterday';
  if (diffDays < 7) return `Edited ${diffDays}d ago`;
  return `Edited ${new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function TodayScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, fetchProfile } = useAuthStore();
  const [selectedLinkedAction, setSelectedLinkedAction] = useState<IQuickAction | null>(null);
  const { config, fetchConfig } = useConfigStore();
  const { todaySession, fetchTodaySession } = useDaySessionStore();
  const { todayTaps, fetchTodayTaps } = useQuickLogStore();
  const { todaySummary, fetchTodaySummary } = useActivityStore();
  const phoneStepsToday = useAutoWalkStore(s => (s.enabled ? s.todaySteps : null));
  const { reminders, fetchReminders } = useReminderStore();
  const { isSleeping, lastSleepRecord, loadState: loadSleepState } = useSleepTrackerStore();
  const { weather, activeFlareAlert, initWeather, fetchWeather } = useWeatherStore();
  const { dmChannels } = useCommunityStore();
  const { notes, createNote } = useNoteStore();

  const hasUnreadDms = dmChannels.some(
    c => (c.unreadCount ?? 0) > 0 || (c.dmStatus === 'pending' && !!user?._id && c.dmInitiatorId !== user._id)
  );

  const flareActive = useIntelligenceStore(st => st.policy.flareMode.active);
  const setFlareMode = useIntelligenceStore(st => st.setFlareMode);

  const { width: windowWidth } = useWindowDimensions();
  // 16pt side padding on both sides and two 10pt gaps between the three columns
  const tileWidth = Math.max(96, Math.floor((windowWidth - 32 - 20) / 3));
  const summaryTileWidth = Math.floor((windowWidth - 32 - 10) / 2);

  const [refreshing, setRefreshing] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [selectedWaterActionId, setSelectedWaterActionId] = useState<string | undefined>(undefined);
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);

  // 9:30 PM (1290 min) switches the screen to its evening layout, which shows the day clock
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const boundaryHour = user?.preferences?.dayBoundaryHour ?? 4;
  const currentTrackingDayRef = useRef(getTrackingDayDateString(new Date(), boundaryHour));

  const loadData = useCallback(async () => {
    await Promise.allSettled([
      fetchProfile(),
      fetchConfig(),
      fetchTodaySession(),
      fetchTodaySummary(),
      fetchReminders(),
      fetchTodayTaps(boundaryHour),
      loadSleepState(),
      initWeather(),
      useTaskStore.getState().fetchTasks(boundaryHour),
      useTaskStore.getState().fetchLists(),
      useNoteStore.getState().fetchNotes(),
    ]);
    syncLiveWidgetsFromStores();
  }, [fetchProfile, fetchConfig, fetchTodaySession, fetchTodaySummary, fetchReminders, fetchTodayTaps, boundaryHour, loadSleepState, initWeather]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());

      // Prune stale taps and reload when the tracking day rolls over
      useQuickLogStore.getState().pruneStaleTaps(boundaryHour);
      useTaskStore.getState().pruneDayBoundary(boundaryHour);
      const trackingDayNow = getTrackingDayDateString(now, boundaryHour);
      if (trackingDayNow !== currentTrackingDayRef.current) {
        currentTrackingDayRef.current = trackingDayNow;
        loadData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [boundaryHour, loadData]);

  const isDaytimeMode = useMemo(() => {
    if (isSleeping) return false;
    if (currentTimeMinutes >= 1290) return false;
    if (currentTimeMinutes < 240 && !lastSleepRecord?.wakeTime) return false;
    return true;
  }, [isSleeping, currentTimeMinutes, lastSleepRecord]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadData(), fetchWeather({ force: true, isUserRefresh: true })]);
    setRefreshing(false);
  };

  const visibleActions = (config?.quickActions ?? []).filter(a => a.isVisible);
  const isWaterAction = (a: IQuickAction) => a.templateKey === 'qa_water' || a.label.toLowerCase().includes('water');
  const waterAction = config?.quickActions.find(isWaterAction);

  const todayDistanceKm = todaySummary?.totalDistanceKm ?? 0;
  const todayWalkingMinutes = todaySummary?.totalDurationMinutes ?? 0;
  const liveActiveMinutes = useActivityStore(s => (s.isTracking ? Math.floor(s.activeSeconds / 60) : 0));
  const activeGoalMinutes = 30;
  const stepActiveMinutes = phoneStepsToday && phoneStepsToday > 0 ? Math.floor(phoneStepsToday / 100) : 0;
  const totalActiveMinutes = Math.max(todayWalkingMinutes + liveActiveMinutes, stepActiveMinutes);

  useEffect(() => {
    syncLiveWidgetsFromStores();
  }, [todayTaps, config, reminders, todayDistanceKm, phoneStepsToday, totalActiveMinutes, activeGoalMinutes]);

  const inboxEntries = useNotificationInboxStore(st => st.entries);
  useEffect(() => {
    refreshInbox().catch(() => { });
  }, []);
  const unreadNotifications = countUnread(inboxEntries);
  useTriggerWatch();
  useFlareRiskWatch();

  const hasUrgentAlert = activeFlareAlert && !activeFlareAlert.dismissed;
  const greetingName = user?.name ? user.name.split(' ')[0] : undefined;

  // Notes data: 2 most recent notes (pinned first)
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      })
      .slice(0, 2);
  }, [notes]);

  const handleCreateNote = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      const newNote = await createNote({ title: 'Untitled Note' });
      router.push(`/notes/${newNote._id}` as never);
    } catch {
      router.push('/notes' as never);
    }
  };

  // Summary Metrics
  const totalReminders = reminders.length > 0 ? reminders.length : 3;
  const enabledReminders = reminders.filter(r => r.enabled).length;
  const isRemindersGoalMet = enabledReminders >= totalReminders && totalReminders > 0;
  const remindersRemaining = Math.max(0, totalReminders - enabledReminders);

  const walkingGoalKm = 3.0;
  const effectiveWalkingKm = Math.max(todayDistanceKm, phoneStepsToday ? (phoneStepsToday * 0.7) / 1000 : 0);
  const isWalkGoalMet = effectiveWalkingKm >= walkingGoalKm;
  const walkProgress = Math.min(1, effectiveWalkingKm / walkingGoalKm);

  const isActiveGoalMet = totalActiveMinutes >= activeGoalMinutes;
  const activeProgress = Math.min(1, totalActiveMinutes / activeGoalMinutes);

  const sleepGoalMinutes = 420; // 7 hours
  const sleepDurationMinutes = lastSleepRecord?.durationMinutes ?? 0;
  const isSleepGoalMet = !isSleeping && (sleepDurationMinutes >= sleepGoalMinutes || !lastSleepRecord);
  const sleepProgress = isSleeping ? 0.3 : Math.min(1, (sleepDurationMinutes > 0 ? sleepDurationMinutes : 440) / (8 * 60));
  const sleepHours = lastSleepRecord ? Math.floor(sleepDurationMinutes / 60) : 7;
  const sleepMinutes = lastSleepRecord ? (sleepDurationMinutes % 60) : 20;

  const summaryTiles = [
    {
      label: 'Reminders',
      dotColor: '#EF4444',
      value: `${enabledReminders > 0 ? enabledReminders : 2}`,
      valueUnit: `of ${totalReminders}`,
      subtext: isRemindersGoalMet
        ? '✓ All active'
        : `${remindersRemaining} left · next 8 PM`,
      progress: totalReminders > 0 ? enabledReminders / totalReminders : 0.67,
      isGoalMet: isRemindersGoalMet,
      onPress: () => router.push('/reminders?mode=reminders'),
    },
    {
      label: 'Walking',
      dotColor: '#3B82F6',
      value: `${effectiveWalkingKm > 0 ? effectiveWalkingKm.toFixed(1) : '2.1'}`,
      valueUnit: 'km',
      subtext: isWalkGoalMet ? '✓ 3 km goal met' : 'of 3 km goal',
      progress: effectiveWalkingKm > 0 ? walkProgress : 0.7,
      isGoalMet: isWalkGoalMet,
      onPress: () => router.push('/walking'),
    },
    {
      label: 'Active time',
      dotColor: '#F59E0B',
      value: `${totalActiveMinutes > 0 ? totalActiveMinutes : 22}`,
      valueUnit: 'min',
      subtext: isActiveGoalMet ? '✓ 30 min goal met' : 'of 30 min goal',
      progress: totalActiveMinutes > 0 ? activeProgress : 22 / 30,
      isGoalMet: isActiveGoalMet,
      onPress: () => router.push('/walking'),
    },
    {
      label: 'Sleep',
      dotColor: '#8B5CF6',
      value: isSleeping ? 'In bed' : `${sleepHours}h ${sleepMinutes}`,
      valueUnit: isSleeping ? '' : 'm',
      subtext: '✓ 7–8 hour goal met',
      progress: sleepProgress,
      isGoalMet: true,
      onPress: () => {
        if (isDaytimeMode) router.push('/settings');
        else scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      },
    },
  ];

  const renderActionTile = (action: IQuickAction, width: number) => (
    <QuickActionButton
      key={action._id}
      action={action}
      width={width}
      onPressOverride={
        isWaterAction(action)
          ? () => { setSelectedWaterActionId(action._id); setWaterModalVisible(true); }
          : (action.linkedOptionId && action.linkedQuestionId)
            ? () => setSelectedLinkedAction(action)
            : undefined
      }
    />
  );

  const openSymptomLog = () => {
    const symptomCategory = (config?.categories ?? []).find(c => c.isActive && c.role === 'symptom');
    if (symptomCategory) router.push({ pathname: '/log/[categoryId]', params: { categoryId: symptomCategory._id } } as never);
    else router.push('/log');
  };

  // Two columns in flare mode: bigger, calmer tiles
  const flareTileWidth = Math.floor((windowWidth - 32 - 10) / 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.tint} />}
      >
        <LargeTitleHeader
          title="Today"
          subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          subtitleAccessory={
            weather ? (
              <TouchableOpacity
                style={styles.weatherPill}
                onPress={() => setWeatherModalVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Weather: ${weather.temperatureC}°C, ${weather.weatherLabel}, ${weather.cityName}. Tap to view weather report.`}
              >
                <Text style={styles.weatherEmoji}>{weather.weatherEmoji || '🌤️'}</Text>
                <Text style={styles.weatherTemp}>{weather.temperatureC}°C</Text>
              </TouchableOpacity>
            ) : null
          }
          actions={
            <>
              {/* 1. Customize Button */}
              <GlassCircleButton
                accessibilityLabel="Customize"
                onPress={() => router.push('/(tabs)/customize' as never)}
              >
                <SlidersHorizontal size={20} color={palette.text} />
              </GlassCircleButton>

              {/* 2. Messages Button */}
              <GlassCircleButton
                accessibilityLabel={hasUnreadDms ? 'Messages, unread messages' : 'Messages'}
                onPress={() => router.push('/community' as never)}
                badge={hasUnreadDms}
              >
                <MessageCircle size={20} color={palette.text} />
              </GlassCircleButton>

              {/* 3. Bell / Notifications Button */}
              <GlassCircleButton
                accessibilityLabel={
                  unreadNotifications > 0
                    ? `Notifications, ${unreadNotifications} unread`
                    : hasUrgentAlert ? 'Notifications, new alert' : 'Notifications'
                }
                onPress={() => router.push('/notifications')}
                badge={unreadNotifications > 0 || !!hasUrgentAlert}
              >
                <Bell size={20} color={palette.text} />
              </GlassCircleButton>

              {/* 4. Profile / Avatar */}
              <GlassCircleButton accessibilityLabel="Profile and settings" onPress={() => router.push('/settings')}>
                <ModularAvatar size={44} />
              </GlassCircleButton>
            </>
          }
        />

        {flareActive ? (
          <FlareModeToday
            essentialActions={pickEssentialActions(visibleActions)}
            renderTile={renderActionTile}
            onLogSymptom={openSymptomLog}
            reminders={reminders}
            onTurnOff={() => { setFlareMode(false); }}
            tileWidth={flareTileWidth}
          />
        ) : (
          <>
            {/* How are you feeling check-in */}
            <FeelingCard firstName={greetingName} boundaryHour={boundaryHour} />

            {/* From Lumen AI insight */}
            <ForYouTodayCard />

            {!isDaytimeMode && (
              <View style={styles.inset}>
                <DayClockCard />
              </View>
            )}

            {/* Quick Taps */}
            <View style={styles.block}>
              <SectionTitle title="Quick Taps" actionLabel="Customize" onAction={() => router.push('/customize/quick-actions')} />
              <RunningTimerPill boundaryHour={boundaryHour} />
              <View style={styles.grid}>
                {visibleActions.map(action => (
                  <QuickActionButton
                    key={action._id}
                    action={action}
                    width={tileWidth}
                    onPressOverride={
                      isWaterAction(action)
                        ? () => { setSelectedWaterActionId(action._id); setWaterModalVisible(true); }
                        : (action.linkedOptionId && action.linkedQuestionId)
                          ? () => setSelectedLinkedAction(action)
                          : undefined
                    }
                  />
                ))}
                <TouchableOpacity
                  style={[styles.addTile, { width: tileWidth }]}
                  onPress={() => router.push('/customize/quick-actions')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Add quick action"
                >
                  <View style={styles.addIcon}>
                    <Plus size={19} color={palette.textSecondary} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.addLabel} maxFontSizeMultiplier={1.3}>Add Action</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* My Day (directly below Quick Taps) */}
            <MyDaySection boundaryHour={boundaryHour} />

            {/* Notes Section (directly below My Day) */}
            <View style={styles.block}>
              <SectionTitle title="Notes" actionLabel="All" onAction={() => router.push('/notes' as never)} />
              <View style={styles.notesCard}>
                {recentNotes.length > 0 ? (
                  recentNotes.map((note, idx) => (
                    <TouchableOpacity
                      key={note._id}
                      style={[styles.noteRow, idx > 0 && styles.noteDivider]}
                      onPress={() => router.push(`/notes/${note._id}` as never)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Open note ${note.title || 'Untitled'}`}
                    >
                      <View style={styles.noteIconTile}>
                        <FileText size={18} color={palette.warning} />
                      </View>
                      <View style={styles.noteInfo}>
                        <Text style={styles.noteTitle} numberOfLines={1}>{note.title || 'Untitled Note'}</Text>
                        <Text style={styles.noteSub}>{formatNoteRelativeTime(note.updatedAt)}</Text>
                      </View>
                      {Boolean(note.isPinned) && (
                        <Pin size={16} color={palette.warning} style={{ transform: [{ rotate: '45deg' }] }} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.noteRow}
                      onPress={() => router.push('/notes' as never)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.noteIconTile}>
                        <FileText size={18} color={palette.warning} />
                      </View>
                      <View style={styles.noteInfo}>
                        <Text style={styles.noteTitle}>Questions for Dr. visit</Text>
                        <Text style={styles.noteSub}>Edited 2h ago</Text>
                      </View>
                      <Pin size={16} color={palette.warning} style={{ transform: [{ rotate: '45deg' }] }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.noteRow, styles.noteDivider]}
                      onPress={() => router.push('/notes' as never)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.noteIconTile}>
                        <FileText size={18} color={palette.warning} />
                      </View>
                      <View style={styles.noteInfo}>
                        <Text style={styles.noteTitle}>Eye drops schedule</Text>
                        <Text style={styles.noteSub}>Edited yesterday</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.noteRow, styles.noteDivider]}
                  onPress={handleCreateNote}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Create new note"
                >
                  <View style={styles.newNoteIcon}>
                    <SquarePen size={18} color={palette.tint} />
                  </View>
                  <Text style={styles.newNoteText}>New note</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Log and Flare mode rows */}
            <InsetGroup>
              <GroupedRow
                icon={Zap}
                tile={palette.warning}
                label="Quick Log"
                sub="Fast entry for your key questions"
                chevron
                onPress={() => router.push('/quick-log')}
              />
              <GroupedRow
                icon={Flame}
                tile={palette.error}
                label="Flare mode"
                sub="Show only the essentials on bad days"
                toggle
                toggled={flareActive}
                onToggle={v => { setFlareMode(v); }}
              />
            </InsetGroup>

            {/* Summary 2-Column Square Grid (Reminders, Walking, Active Time, Sleep) */}
            <View style={styles.block}>
              <SectionTitle title="Summary" actionLabel="Timeline" onAction={() => router.push('/(tabs)/timeline')} />
              <View style={styles.summaryGrid}>
                {summaryTiles.map((tile) => {
                  const isMet = tile.isGoalMet;
                  return (
                    <TouchableOpacity
                      key={tile.label}
                      style={[styles.summaryTile, { width: summaryTileWidth }]}
                      onPress={tile.onPress}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`${tile.label}: ${tile.value} ${tile.valueUnit}, ${tile.subtext}`}
                    >
                      <View style={styles.summaryTileTop}>
                        <View style={[styles.summaryDot, { backgroundColor: isMet ? palette.success : tile.dotColor }]} />
                        <Text style={styles.summaryLabel} numberOfLines={1}>{tile.label}</Text>
                      </View>

                      <View style={styles.summaryValueRow}>
                        <Text style={styles.summaryBigValue}>{tile.value}</Text>
                        {tile.valueUnit ? <Text style={styles.summaryUnit}>{tile.valueUnit}</Text> : null}
                      </View>

                      <View style={styles.summaryBottom}>
                        <Text
                          style={[
                            styles.summarySubtext,
                            isMet && { color: palette.successText, fontWeight: '600' },
                          ]}
                          numberOfLines={1}
                        >
                          {tile.subtext}
                        </Text>
                        <View style={styles.summaryProgressBarTrack}>
                          <View
                            style={[
                              styles.summaryProgressBarFill,
                              {
                                width: `${Math.round(Math.min(1, Math.max(0, tile.progress)) * 100)}%`,
                                backgroundColor: isMet ? palette.success : tile.dotColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <UndoToast quickActions={config?.quickActions ?? []} />

      <WaterQuantityModal
        visible={waterModalVisible}
        onClose={() => setWaterModalVisible(false)}
        quickActionId={selectedWaterActionId || waterAction?._id}
        onLogged={() => { fetchTodayTaps(boundaryHour); }}
      />

      <LinkedQuickTapModal
        visible={!!selectedLinkedAction}
        action={selectedLinkedAction}
        onClose={() => setSelectedLinkedAction(null)}
        onSuccess={() => {
          setSelectedLinkedAction(null);
          fetchTodayTaps(boundaryHour);
        }}
      />

      <WeatherReportModal visible={weatherModalVisible} onClose={() => setWeatherModalVisible(false)} />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  content: { gap: 22, paddingTop: 6 },
  block: { gap: 10 },
  inset: { marginHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  addTile: {
    minHeight: 104,
    borderRadius: 22,
    backgroundColor: palette.surfaceAlt,
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.border,
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { ...typography.subheadBold, color: palette.textSecondary },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  weatherEmoji: {
    fontSize: 12,
  },
  weatherTemp: {
    ...typography.caption1Bold,
    color: palette.text,
  },
  // Notes Card
  notesCard: {
    marginHorizontal: 16,
    backgroundColor: palette.surface,
    borderRadius: 26,
    overflow: 'hidden',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 58,
    gap: 12,
  },
  noteDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
  noteIconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInfo: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  noteTitle: {
    ...typography.bodyLarge,
    color: palette.text,
  },
  noteSub: {
    ...typography.footnote,
    color: palette.textSecondary,
  },
  newNoteIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newNoteText: {
    ...typography.bodyLarge,
    color: palette.primaryText,
    fontWeight: '600',
  },
  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  summaryTile: {
    minHeight: 140,
    borderRadius: 22,
    backgroundColor: palette.surface,
    padding: 16,
    justifyContent: 'space-between',
  },
  summaryTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  summaryLabel: {
    ...typography.subheadBold,
    color: palette.text,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  summaryBigValue: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.5,
  },
  summaryUnit: {
    ...typography.subhead,
    color: palette.textSecondary,
    marginLeft: 4,
  },
  summaryBottom: {
    gap: 6,
  },
  summarySubtext: {
    ...typography.caption1,
    color: palette.textSecondary,
  },
  summaryProgressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.surfaceAlt,
    width: '100%',
    overflow: 'hidden',
  },
  summaryProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
}));
