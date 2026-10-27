/**
 * Today / Home screen (iOS-style)
 * ─ Large title with notifications and profile
 * ─ "How are you feeling?" one-tap check-in
 * ─ Flare mode / observations (hidden when empty)
 * ─ Day clock (evening and while asleep)
 * ─ Quick Taps grid (water quantity modal, linked quick-tap modal, undo toast)
 * ─ Summary list (follows "Today at a glance" settings)
 * ─ My Day tasks
 */
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Bell,
  Droplets,
  Footprints,
  Moon,
  Sun,
  Timer,
  Stethoscope,
  Zap,
  Flame,
  Plus,
  Target,
  Cloud,
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
import { useGlanceConfigStore, GlanceMetricKey } from '../../src/store/glanceConfigStore';
import { useSleepTrackerStore } from '../../src/store/sleepTrackerStore';
import { useWeatherStore } from '../../src/store/weatherStore';
import { useTaskStore } from '../../src/store/taskStore';

import { DayClockCard } from '../../src/components/DayClockCard';
import { QuickActionButton } from '../../src/components/QuickActionButton';
import { UndoToast } from '../../src/components/UndoToast';
import { ForYouTodayCard } from '../../src/components/home/ForYouTodayCard';
import { FeelingCard } from '../../src/components/home/FeelingCard';
import { MyDaySection } from '../../src/components/home/MyDaySection';
import { WaterQuantityModal } from '../../src/components/WaterQuantityModal';
import { WeatherReportModal } from '../../src/components/weather/WeatherReportModal';
import { LinkedQuickTapModal } from '../../src/components/home/LinkedQuickTapModal';
import { ModularAvatar } from '../../src/components/avatar/ModularAvatar';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { SectionTitle } from '../../src/components/ios/SectionTitle';
import { InsetGroup, GroupedRow, RowProps } from '../../src/components/ios/InsetGroup';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';
import { getTrackingDayDateString } from '../../src/utils/dayBoundary';
import { useIntelligenceStore } from '../../src/store/intelligenceStore';
import { useNotificationInboxStore, countUnread } from '../../src/store/notificationInboxStore';
import { refreshInbox } from '../../src/services/notificationInbox';
import { useTriggerWatch } from '../../src/hooks/useTriggerWatch';
import { FlareModeToday, pickEssentialActions } from '../../src/components/home/FlareModeToday';

export default function TodayScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, fetchProfile } = useAuthStore();
  const [selectedLinkedAction, setSelectedLinkedAction] = useState<IQuickAction | null>(null);
  const { config, fetchConfig } = useConfigStore();
  const { todaySession, fetchTodaySession } = useDaySessionStore();
  const { todayTaps, fetchTodayTaps } = useQuickLogStore();
  const { todaySummary, fetchTodaySummary, isTracking, activePacingAlert } = useActivityStore();
  const phoneStepsToday = useAutoWalkStore(s => (s.enabled ? s.todaySteps : null));
  const { reminders, fetchReminders } = useReminderStore();
  const { fetchGlanceConfig, isMetricEnabled, compactOrder } = useGlanceConfigStore();
  const { isSleeping, lastSleepRecord, loadState: loadSleepState } = useSleepTrackerStore();
  const { weather, activeFlareAlert, initWeather, fetchWeather } = useWeatherStore();

  const flareActive = useIntelligenceStore(st => st.policy.flareMode.active);
  const setFlareMode = useIntelligenceStore(st => st.setFlareMode);

  const { width: windowWidth } = useWindowDimensions();
  // 16pt side padding on both sides and two 10pt gaps between the three columns
  const tileWidth = Math.max(96, Math.floor((windowWidth - 32 - 20) / 3));

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
      fetchGlanceConfig(),
      loadSleepState(),
      initWeather(),
      useTaskStore.getState().fetchTasks(),
      useTaskStore.getState().fetchLists(),
    ]);
  }, [fetchProfile, fetchConfig, fetchTodaySession, fetchTodaySummary, fetchReminders, fetchTodayTaps, boundaryHour, fetchGlanceConfig, loadSleepState, initWeather]);

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
  const waterCount = waterAction ? (todayTaps[waterAction._id]?.count ?? 0) : 0;
  const waterGoal = waterAction?.dailyGoal ? Math.round(waterAction.dailyGoal / (waterAction.defaultValue ?? 250)) : 8;

  const todayDistanceKm = todaySummary?.totalDistanceKm ?? 0;
  const todayWalkingMinutes = todaySummary?.totalDurationMinutes ?? 0;
  const enabledReminders = reminders.filter(r => r.enabled).length;
  const totalTapCount = Object.values(todayTaps).reduce((sum, t) => sum + (t?.count ?? 0), 0);
  const distinctTapCount = Object.values(todayTaps).filter(t => t.count > 0).length;
  const wakeTimeStr = todaySession?.wakeTime
    ? new Date(todaySession.wakeTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const customGoalActions = (config?.quickActions ?? []).filter(
    a => a.isVisible && a.dailyGoal && !isWaterAction(a),
  );

  const inboxEntries = useNotificationInboxStore(st => st.entries);
  useEffect(() => {
    refreshInbox().catch(() => {});
  }, []);
  const unreadNotifications = countUnread(inboxEntries);
  useTriggerWatch();

  const hasUrgentAlert =
    (activeFlareAlert && !activeFlareAlert.dismissed) || (activePacingAlert && !activePacingAlert.dismissed);

  const sleepValue = isSleeping
    ? 'In bed'
    : lastSleepRecord
      ? `${Math.floor(lastSleepRecord.durationMinutes / 60)}h ${lastSleepRecord.durationMinutes % 60}m`
      : (wakeTimeStr || 'Clock in');
  const sleepSub = isSleeping
    ? 'Sleeping now'
    : lastSleepRecord
      ? (lastSleepRecord.durationMinutes >= 420 ? '7 to 8 hour goal met' : 'Under the 7 hour goal')
      : (todaySession?.sleepTime ? 'Asleep' : (wakeTimeStr ? 'Awake' : 'Not started'));

  // One summary row per glance metric; the user's "Today at a glance" settings decide which show and in what order.
  const rowFor = (key: GlanceMetricKey): RowProps | null => {
    if (!isMetricEnabled(key)) return null;
    switch (key) {
      case 'water':
        return {
          icon: Droplets, tile: palette.catHabits, label: 'Water', value: `${waterCount} of ${waterGoal}`,
          onPress: () => { setSelectedWaterActionId(waterAction?._id); setWaterModalVisible(true); },
        };
      case 'walking':
        return {
          icon: Footprints, tile: palette.catFood, label: 'Walking',
          sub: isTracking
            ? 'Tracking live'
            : phoneStepsToday !== null
              ? `${phoneStepsToday.toLocaleString()} steps · ${todayWalkingMinutes} min`
              : `${todayWalkingMinutes} min`,
          value: `${todayDistanceKm.toFixed(1)} km`, chevron: true, onPress: () => router.push('/walking'),
        };
      case 'active_time':
        return { icon: Timer, tile: palette.secondary, label: 'Active Time', value: `${todayWalkingMinutes} min` };
      case 'day_session':
        return {
          icon: isSleeping || lastSleepRecord || !wakeTimeStr ? Moon : Sun,
          tile: palette.catMood, label: 'Sleep', sub: sleepSub, value: sleepValue, chevron: true,
          onPress: () => {
            if (isDaytimeMode) router.push('/settings');
            else scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          },
        };
      case 'reminders':
        return {
          icon: Bell, tile: palette.catSymptom, label: 'Reminders', value: `${enabledReminders} on`, chevron: true,
          onPress: () => router.push('/reminders?mode=reminders'),
        };
      case 'quick_logs':
        return {
          icon: Stethoscope, tile: palette.catVitals, label: 'Quick taps',
          sub: `${distinctTapCount} ${distinctTapCount === 1 ? 'metric' : 'metrics'}`, value: `${totalTapCount} logged`,
          chevron: true, onPress: () => router.push('/(tabs)/timeline'),
        };
      default:
        return null;
    }
  };

  const summaryRows: RowProps[] = [
    ...(['water', ...compactOrder.filter(k => k !== 'water')] as GlanceMetricKey[])
      .map(rowFor)
      .filter((r): r is RowProps => r !== null),
    ...customGoalActions.map<RowProps>(action => {
      const count = todayTaps[action._id]?.count ?? 0;
      const target = action.dailyGoal ? Math.round(action.dailyGoal / (action.defaultValue ?? 1)) : 1;
      return {
        icon: Target, tile: action.color || palette.primary, label: action.label,
        sub: `${Math.min(100, Math.round((count / target) * 100))}% of goal`, value: `${count} of ${target}`,
        onPress: () => router.push('/log'),
      };
    }),
    ...(weather
      ? [{
          icon: Cloud, tile: palette.catHabits, label: 'Weather', sub: weather.cityName,
          value: `${weather.temperatureC}°C`, chevron: true, onPress: () => setWeatherModalVisible(true),
        } as RowProps]
      : []),
  ];

  const greetingName = user?.name ? user.name.split(' ')[0] : undefined;

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
          subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          actions={
            <>
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
          <FeelingCard firstName={greetingName} boundaryHour={boundaryHour} />

          <ForYouTodayCard />

          {!isDaytimeMode && (
            <View style={styles.inset}>
              <DayClockCard />
            </View>
          )}

          <View style={styles.block}>
            <SectionTitle title="Quick Taps" actionLabel="Customize" onAction={() => router.push('/customize/quick-actions')} />
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

          {summaryRows.length > 0 ? (
            <View style={styles.block}>
              <SectionTitle title="Summary" actionLabel="Timeline" onAction={() => router.push('/(tabs)/timeline')} />
              <InsetGroup>
                {summaryRows.map(r => <GroupedRow key={r.label} {...r} />)}
              </InsetGroup>
            </View>
          ) : (
            <InsetGroup>
              <GroupedRow label="All summary cards are hidden" sub="Choose what appears here" chevron onPress={() => router.push('/customize/at-a-glance')} />
            </InsetGroup>
          )}

          <MyDaySection boundaryHour={boundaryHour} />
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
}));
