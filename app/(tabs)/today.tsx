/**
 * Today / Home screen
 * ─ Day clock-in/out card
 * ─ Walking tracking card (distance, time, START WALKING CTA)
 * ─ Active Reminders card (Water next trigger, Stand monitoring, Bedtime)
 * ─ Quick-tap action grid (with water quantity modal)
 * ─ "Today at a glance" summary
 * ─ "Undo" toast
 * ─ Floating "+ Log" button
 */
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
  Footprints,
  Play,
  Bell,
  ChevronRight,
  Droplets,
  Clock,
  Stethoscope,
  Sun,
  Moon,
  Timer,
  SlidersHorizontal,
  Plus,
} from 'lucide-react-native';

import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useAuthStore } from '../../src/store/authStore';
import { useConfigStore } from '../../src/store/configStore';
import { useDaySessionStore } from '../../src/store/daySessionStore';
import { useQuickLogStore } from '../../src/store/quickLogStore';
import { useActivityStore } from '../../src/store/activityStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { useGlanceConfigStore } from '../../src/store/glanceConfigStore';
import { useSleepTrackerStore } from '../../src/store/sleepTrackerStore';
import { useWeatherStore } from '../../src/store/weatherStore';

import { DayClockCard } from '../../src/components/DayClockCard';
import { QuickActionButton } from '../../src/components/QuickActionButton';
import { LumenIcon } from '../../src/components/common/LumenLogo';
import { UndoToast } from '../../src/components/UndoToast';
import { FlareNowButton } from '../../src/components/FlareNowButton';
import { WaterQuantityModal } from '../../src/components/WaterQuantityModal';
import { WalkingBannerCard } from '../../src/components/walking/WalkingBannerCard';
import { WeatherReportModal } from '../../src/components/weather/WeatherReportModal';

export default function TodayScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, fetchProfile } = useAuthStore();
  const { config, fetchConfig } = useConfigStore();
  const { todaySession, fetchTodaySession } = useDaySessionStore();
  const { todayTaps, fetchTodayTaps, tap } = useQuickLogStore();
  const [activeGlanceIndex, setActiveGlanceIndex] = useState(0);
  const { todaySummary, fetchTodaySummary, isTracking, activePacingAlert } = useActivityStore();
  const { reminders, fetchReminders } = useReminderStore();
  const { fetchGlanceConfig, isMetricEnabled, getActiveCount } = useGlanceConfigStore();
  const { isSleeping, lastSleepRecord, loadState: loadSleepState } = useSleepTrackerStore();
  const {
    weather,
    assessment,
    activeFlareAlert,
    permissionStatus,
    initWeather,
    fetchWeather,
    requestPermissionAndFetch,
  } = useWeatherStore();

  const { width: windowWidth } = useWindowDimensions();
  // Screen padding is 16 on each side (32 total), and two 10px gaps between 3 columns (20 total)
  const quickActionWidth = Math.max(88, Math.floor((windowWidth - 32 - 20) / 3));

  const [refreshing, setRefreshing] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [selectedWaterActionId, setSelectedWaterActionId] = useState<string | undefined>(undefined);
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);

  // Time tracker for dynamic daytime vs evening (9:30 PM = 21:30 = 1290 minutes) card positions
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000); // 30-second live check
    return () => clearInterval(interval);
  }, []);

  // Daytime active mode: Awake (not sleeping) AND before 9:30 PM (21:30 = 1290 minutes)
  const isDaytimeMode = useMemo(() => {
    if (isSleeping) return false;
    // 9:30 PM cutoff: 21 * 60 + 30 = 1290 minutes
    if (currentTimeMinutes >= 1290) return false;
    // Early morning before 4:00 AM if user hasn't woken up today
    if (currentTimeMinutes < 240 && !lastSleepRecord?.wakeTime) return false;
    return true;
  }, [isSleeping, currentTimeMinutes, lastSleepRecord]);

  const loadData = useCallback(async () => {
    await Promise.allSettled([
      fetchProfile(),
      fetchConfig(),
      fetchTodaySession(),
      fetchTodaySummary(),
      fetchReminders(),
      fetchTodayTaps(),
      fetchGlanceConfig(),
      loadSleepState(),
      initWeather(),
    ]);
  }, [fetchProfile, fetchConfig, fetchTodaySession, fetchTodaySummary, fetchReminders, fetchTodayTaps, fetchGlanceConfig, loadSleepState, initWeather]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      loadData(),
      fetchWeather({ force: true, isUserRefresh: true }),
    ]);
    setRefreshing(false);
  };

  const visibleActions = (config?.quickActions ?? []).filter(a => a.isVisible);

  // Water calculations
  const waterAction = config?.quickActions.find(a => a.templateKey === 'qa_water' || a.label.toLowerCase().includes('water'));
  const waterCount  = waterAction ? (todayTaps[waterAction._id]?.count ?? 0) : 0;
  const waterGoal   = waterAction?.dailyGoal ? Math.round(waterAction.dailyGoal / (waterAction.defaultValue ?? 250)) : 8;

  const todayDistanceKm = todaySummary?.totalDistanceKm ?? 0;
  const todayWalkingMinutes = todaySummary?.totalDurationMinutes ?? 0;

  const activeReminders = reminders.filter(r => r.enabled).slice(0, 3);

  const totalTapCount = Object.values(todayTaps).reduce((sum, t) => sum + (t?.count ?? 0), 0);
  const distinctTapCount = Object.values(todayTaps).filter(t => t.count > 0).length;
  const wakeTimeStr = todaySession?.wakeTime
    ? new Date(todaySession.wakeTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const customGoalActions = (config?.quickActions ?? []).filter(
    a => a.isVisible && a.dailyGoal && a.templateKey !== 'qa_water' && !a.label.toLowerCase().includes('water')
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleStartWalking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/walking/active');
  };

  const reminderItem: GlanceItem | null = useMemo(() => {
    if (!isMetricEnabled('reminders')) return null;
    return {
      id: 'reminders',
      icon: Bell,
      value: `${reminders.filter(r => r.enabled).length} active`,
      label: 'Reminders',
      subtitle: reminders.length > 0 ? `${reminders.length} total` : 'None set',
      color: '#9333EA',
      onPress: () => router.push('/reminders?mode=reminders'),
    };
  }, [isMetricEnabled, reminders]);

  const walkingItem: GlanceItem | null = useMemo(() => {
    if (!isMetricEnabled('walking')) return null;
    return {
      id: 'walking',
      icon: Footprints,
      value: `${todayDistanceKm.toFixed(1)} km`,
      label: 'Walking',
      subtitle: isTracking ? 'Tracking live' : `${todayWalkingMinutes} min`,
      color: '#EA580C',
      onPress: handleStartWalking,
    };
  }, [isMetricEnabled, todayDistanceKm, isTracking, todayWalkingMinutes, handleStartWalking]);

  const quickTapItem: GlanceItem | null = useMemo(() => {
    if (!isMetricEnabled('quick_logs')) return null;
    return {
      id: 'quick_logs',
      icon: Stethoscope,
      value: `${totalTapCount} logged`,
      label: 'Quick taps',
      subtitle: `${distinctTapCount} metrics`,
      color: '#E11D48',
      onPress: () => router.push('/(tabs)/timeline'),
    };
  }, [isMetricEnabled, totalTapCount, distinctTapCount]);

  const activeTimeItem: GlanceItem | null = useMemo(() => {
    if (!isMetricEnabled('active_time')) return null;
    return {
      id: 'active_time',
      icon: Timer,
      value: `${todayWalkingMinutes}m`,
      label: 'Active time',
      subtitle: todayWalkingMinutes > 0 ? 'Today' : 'Start now',
      color: '#0EA5E9',
      onPress: handleStartWalking,
    };
  }, [isMetricEnabled, todayWalkingMinutes, handleStartWalking]);

  const sleepItem: GlanceItem | null = useMemo(() => {
    if (!isMetricEnabled('day_session')) return null;
    return {
      id: 'day_session',
      icon: isSleeping ? Moon : (lastSleepRecord ? Moon : (wakeTimeStr ? Sun : Moon)),
      value: isSleeping
        ? 'In bed'
        : lastSleepRecord
          ? `${Math.floor(lastSleepRecord.durationMinutes / 60)}h ${lastSleepRecord.durationMinutes % 60}m`
          : (wakeTimeStr || 'Clock in'),
      label: 'Sleep session',
      subtitle: isSleeping
        ? 'Sleeping now'
        : lastSleepRecord
          ? (lastSleepRecord.durationMinutes >= 420 ? '7–8h goal met' : 'Under 7h goal')
          : (todaySession?.sleepTime ? 'Asleep' : (wakeTimeStr ? 'Active' : 'Not started')),
      color: isSleeping
        ? '#6366F1'
        : lastSleepRecord?.durationMinutes && lastSleepRecord.durationMinutes >= 420
          ? '#10B981'
          : '#6366F1',
      onPress: () => {
        if (isDaytimeMode) {
          router.push('/settings');
        } else {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }
      },
    };
  }, [isMetricEnabled, isSleeping, lastSleepRecord, wakeTimeStr, todaySession, isDaytimeMode]);

  const customGoalItems = useMemo<GlanceItem[]>(() => {
    return customGoalActions.map(action => {
      const count = todayTaps[action._id]?.count ?? 0;
      const target = action.dailyGoal ? Math.round(action.dailyGoal / (action.defaultValue ?? 1)) : 1;
      return {
        id: action._id,
        emoji: action.icon || '🎯',
        value: `${count}/${target}`,
        label: action.label,
        subtitle: `${Math.min(100, Math.round((count / target) * 100))}% goal`,
        color: action.color || palette.primary,
        onPress: () => router.push('/log'),
      };
    });
  }, [customGoalActions, todayTaps, palette.primary]);

  const hasSlide1 = isMetricEnabled('water') || !!reminderItem || !!walkingItem;
  const hasSlide2 = !!quickTapItem || !!activeTimeItem || !!sleepItem || customGoalItems.length > 0;
  const extraCustomItems = customGoalItems.slice(1);
  const extraCustomSlidesCount = Math.ceil(extraCustomItems.length / 2);

  const totalGlancePages = (hasSlide1 ? 1 : 0) + (hasSlide2 ? 1 : 0) + extraCustomSlidesCount;

  const slideWidth = Math.max(280, windowWidth - 32);
  const cardColWidth = Math.max(136, Math.floor((slideWidth - 10) / 2));

  const handleGlanceScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const snapDistance = slideWidth + 12;
    const index = Math.round(offsetX / snapDistance);
    setActiveGlanceIndex(Math.max(0, Math.min(index, Math.max(1, totalGlancePages) - 1)));
  }, [slideWidth, totalGlancePages]);

  const handleQuickWaterAdd = useCallback(async () => {
    if (!waterAction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await tap(waterAction._id);
  }, [waterAction, tap]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <LumenIcon size={18} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Lumen
              </Text>
            </View>
            <Text style={styles.greeting}>{greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.reminderIconBtn}
              onPress={() => router.push('/reminders')}
              accessibilityRole="button"
              accessibilityLabel="Open Reminders & Alerts"
            >
              <Bell size={20} color={palette.text} />
              {activeReminders.length > 0 ||
              (activeFlareAlert && !activeFlareAlert.dismissed) ||
              (activePacingAlert && !activePacingAlert.dismissed) ? (
                <View style={styles.activeNotifDot} />
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileAvatarBtn}
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Open Profile & Settings"
            >
              <LinearGradient
                colors={['#FFA448', '#FF581E']}
                start={{ x: 0.15, y: 0.1 }}
                end={{ x: 0.85, y: 0.95 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {user?.name?.trim()
                    ? user.name
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'U'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daytime Position 1: Walking Tracker Card */}
        {isDaytimeMode && (
          <WalkingBannerCard
            distanceKm={todayDistanceKm}
            durationMinutes={todayWalkingMinutes}
            onPressHistory={() => router.push('/walking')}
            onPressWeather={() => setWeatherModalVisible(true)}
          />
        )}

        {/* Night / Wind-down Position 1: Day clock / Sleep card */}
        {!isDaytimeMode && (
          <DayClockCard />
        )}

        {/* Position 2: Quick Log shortcut */}
        <FlareNowButton />

        {/* Night / Wind-down Position 3: Walking Tracker Card (placed after Quick Log) */}
        {!isDaytimeMode && (
          <WalkingBannerCard
            distanceKm={todayDistanceKm}
            durationMinutes={todayWalkingMinutes}
            onPressHistory={() => router.push('/walking')}
            onPressWeather={() => setWeatherModalVisible(true)}
          />
        )}

        {/* Active Reminders Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Reminders</Text>
            <TouchableOpacity onPress={() => router.push('/reminders?mode=reminders')}>
              <Text style={styles.sectionActionText}>Manage ({reminders.filter(r => r.enabled).length})</Text>
            </TouchableOpacity>
          </View>

          {activeReminders.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyRemindersBox}
              onPress={() => router.push('/reminders/add')}
            >
              <Clock size={20} color={palette.textSecondary} />
              <Text style={styles.emptyRemindersText}>No reminders set. Tap to add water or movement alerts.</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.remindersCard}>
              {activeReminders.map((rem, idx) => (
                <TouchableOpacity
                  key={rem._id}
                  style={[styles.reminderRow, idx < activeReminders.length - 1 && styles.reminderRowBorder]}
                  onPress={() => router.push('/reminders?mode=reminders')}
                >
                  <Text style={styles.reminderEmoji}>{rem.icon || '⏰'}</Text>
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderName}>{rem.name}</Text>
                    <Text style={styles.reminderTiming}>
                      {rem.scheduleType === 'INTERVAL' ? `Every ${rem.intervalMinutes || 60}m` : (rem.targetTime || 'Daily')}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Quick-tap grid */}
        {visibleActions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Quick Taps</Text>
              <TouchableOpacity
                onPress={() => router.push('/customize/quick-actions')}
                style={styles.seeAllBtn}
                accessibilityRole="button"
                accessibilityLabel="Manage quick-tap buttons"
              >
                <Text style={styles.seeAllText}>Manage</Text>
                <ChevronRight size={14} color={palette.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.grid}>
              {visibleActions.map(action => (
                <QuickActionButton
                  key={action._id}
                  action={action}
                  width={quickActionWidth}
                  onPressOverride={
                    action.templateKey === 'qa_water' || action.label.toLowerCase().includes('water')
                      ? () => {
                          setSelectedWaterActionId(action._id);
                          setWaterModalVisible(true);
                        }
                      : undefined
                  }
                />
              ))}
              {visibleActions.length % 3 !== 0 && (
                <View style={[styles.quickActionWrapper, { width: quickActionWidth }]}>
                  <TouchableOpacity
                    style={styles.addQuickActionButton}
                    onPress={() => router.push('/customize/quick-actions')}
                    activeOpacity={0.75}
                    accessibilityLabel="Add quick action"
                    accessibilityRole="button"
                  >
                    <View style={styles.addQuickActionWell}>
                      <Plus size={20} color={palette.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.addQuickActionLabel} numberOfLines={1}>Add action</Text>
                    <Text style={styles.addQuickActionSub} numberOfLines={1}>Customize</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Today at a glance */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today at a glance</Text>
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                onPress={() => router.push('/customize/at-a-glance')}
                style={styles.customizeGlanceBtn}
                accessibilityRole="button"
                accessibilityLabel="Customize Today at a glance metrics"
              >
                <SlidersHorizontal size={13} color={palette.textSecondary} />
                <Text style={styles.customizeGlanceText}>Customize</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/timeline');
                }}
                style={styles.seeAllBtn}
                accessibilityRole="button"
                accessibilityLabel="View full timeline"
              >
                <Text style={styles.seeAllText}>Timeline</Text>
                <ChevronRight size={14} color={palette.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Empty state when all metrics are hidden */}
          {!hasSlide1 && !hasSlide2 ? (
            <TouchableOpacity
              style={styles.emptyGlanceBox}
              onPress={() => router.push('/customize/at-a-glance')}
              activeOpacity={0.75}
            >
              <SlidersHorizontal size={20} color={palette.primary} />
              <Text style={styles.emptyGlanceText}>
                All glance cards are hidden. Tap to choose which metrics appear on your dashboard.
              </Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.glanceSliderContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.glanceSliderScroll}
                  snapToInterval={slideWidth + 12}
                  decelerationRate="fast"
                  onScroll={handleGlanceScroll}
                  scrollEventThrottle={16}
                >
                  {/* Slide 1: Water (left) + Reminder & Walking (right) */}
                  {hasSlide1 && (
                    <View style={[styles.glanceSlide, { width: slideWidth }]}>
                      {isMetricEnabled('water') && (
                        <FeaturedWaterCard
                          width={cardColWidth}
                          count={waterCount}
                          goal={waterGoal}
                          onQuickAdd={handleQuickWaterAdd}
                          onManage={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedWaterActionId(waterAction?._id);
                            setWaterModalVisible(true);
                          }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedWaterActionId(waterAction?._id);
                            setWaterModalVisible(true);
                          }}
                        />
                      )}

                      <View style={[styles.glanceColumn, { width: isMetricEnabled('water') ? cardColWidth : slideWidth }]}>
                        {reminderItem && (
                          <CompactGlanceCard item={reminderItem} width={isMetricEnabled('water') ? cardColWidth : slideWidth} />
                        )}
                        {walkingItem && (
                          <CompactGlanceCard item={walkingItem} width={isMetricEnabled('water') ? cardColWidth : slideWidth} />
                        )}
                      </View>
                    </View>
                  )}

                  {/* Slide 2: Quick tap & Active Time (left) + Sleep session & (Custom Goal or Customize card) (right) */}
                  {hasSlide2 && (
                    <View style={[styles.glanceSlide, { width: slideWidth }]}>
                      {/* Left Column: Quick tap & Active Time */}
                      <View style={[styles.glanceColumn, { width: cardColWidth }]}>
                        {quickTapItem && (
                          <CompactGlanceCard item={quickTapItem} width={cardColWidth} />
                        )}
                        {activeTimeItem && (
                          <CompactGlanceCard item={activeTimeItem} width={cardColWidth} />
                        )}
                      </View>

                      {/* Right Column: Sleep session & (Custom Goal or Customize card) */}
                      <View style={[styles.glanceColumn, { width: cardColWidth }]}>
                        {sleepItem && (
                          <CompactGlanceCard item={sleepItem} width={cardColWidth} />
                        )}
                        {customGoalItems.length > 0 ? (
                          <CompactGlanceCard item={customGoalItems[0]} width={cardColWidth} />
                        ) : (
                          <TouchableOpacity
                            style={[styles.compactGlanceCard, styles.addMetricCard, { width: cardColWidth }]}
                            onPress={() => router.push('/customize/at-a-glance')}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel="Customize glance metrics"
                          >
                            <View style={styles.addMetricTop}>
                              <View style={styles.addMetricIconBox}>
                                <SlidersHorizontal size={14} color={palette.primary} strokeWidth={2.4} />
                              </View>
                              <ChevronRight size={13} color={palette.textDisabled} />
                            </View>
                            <View style={styles.compactCardBottom}>
                              <Text style={styles.compactLabel}>Customize</Text>
                              <Text style={styles.compactSubtitle}>Add more metrics</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Extra Slides if user has multiple custom goal actions */}
                  {extraCustomSlidesCount > 0 &&
                    Array.from({ length: extraCustomSlidesCount }).map((_, slideIdx) => {
                      const pair = extraCustomItems.slice(slideIdx * 2, slideIdx * 2 + 2);
                      return (
                        <View key={`extra-slide-${slideIdx}`} style={[styles.glanceSlide, { width: slideWidth }]}>
                          <View style={[styles.glanceColumn, { width: cardColWidth }]}>
                            {pair[0] && <CompactGlanceCard item={pair[0]} width={cardColWidth} />}
                            {pair[1] && <CompactGlanceCard item={pair[1]} width={cardColWidth} />}
                          </View>
                        </View>
                      );
                    })}
                </ScrollView>
              </View>

              {/* Slider pagination dots */}
              {totalGlancePages > 1 && (
                <View style={styles.glancePaginationRow}>
                  {Array.from({ length: totalGlancePages }).map((_, dotIdx) => (
                    <View
                      key={`glance-dot-${dotIdx}`}
                      style={[
                        styles.glanceDot,
                        activeGlanceIndex === dotIdx && styles.glanceDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Undo toast */}
      <UndoToast quickActions={config?.quickActions ?? []} />

      {/* Water Quantity Modal */}
      <WaterQuantityModal
        visible={waterModalVisible}
        onClose={() => setWaterModalVisible(false)}
        quickActionId={selectedWaterActionId || waterAction?._id}
        onLogged={() => {
          fetchTodayTaps();
        }}
      />

      {/* Weather Report Modal */}
      <WeatherReportModal
        visible={weatherModalVisible}
        onClose={() => setWeatherModalVisible(false)}
      />
    </SafeAreaView>
  );
}

interface GlanceItem {
  id: string;
  icon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  emoji?: string;
  value: string;
  label: string;
  subtitle?: string;
  color: string;
  onPress?: () => void;
}

interface FeaturedWaterCardProps {
  count: number;
  goal: number;
  width?: number;
  onManage: () => void;
  onPress: () => void;
  onQuickAdd?: () => void;
}

function FeaturedWaterCard({ count, goal, onManage, onPress, onQuickAdd, width }: FeaturedWaterCardProps) {
  const { colorScheme, palette } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

  const size = 80;
  const strokeWidth = 6.5;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(1, Math.max(0, count / goal)) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const pct = goal > 0 ? (count / goal) * 100 : 0;
  const pctStr = `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}% goal`;

  const trackColor = isDark ? '#0E749022' : '#E2E8F0';

  return (
    <TouchableOpacity
      style={[styles.featuredWaterCard, width ? { width } : null]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Water progress: ${count} of ${goal} glasses. ${pctStr}`}
    >
      <View style={styles.waterCardTopRow}>
        <View style={styles.waterRingWrapper}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Defs>
              <SvgGradient id="waterProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#22D3EE" />
                <Stop offset="100%" stopColor="#0284C7" />
              </SvgGradient>
            </Defs>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {progress > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="url(#waterProgressGrad)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </Svg>
          <View style={styles.waterRingCenterText}>
            <Text style={styles.waterRingCount}>{`${count}/${goal}`}</Text>
            <Text style={styles.waterRingSubLabel}>Water</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.waterBadgeBox}
          onPress={onQuickAdd || onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quick log 1 glass of water"
        >
          <Droplets size={19} color="#0284C7" strokeWidth={2.2} />
          <View style={styles.waterPlusBadge}>
            <Plus size={8} color="#FFFFFF" strokeWidth={3} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.waterCardBottomRow}>
        <View style={styles.waterMetaCol}>
          <Text style={styles.waterMetaTitle}>Water</Text>
          <View style={[styles.waterGoalPill, pct > 0 && styles.waterGoalPillActive]}>
            <Text style={[styles.waterMetaPercent, pct > 0 && styles.waterMetaPercentActive]}>
              {pctStr}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.waterManageBtn}
          onPress={onManage}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Manage water intake"
        >
          <SlidersHorizontal size={10} color={isDark ? '#CBD5E1' : '#475569'} />
          <Text style={styles.waterManageBtnText}>Manage</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

interface CompactGlanceCardProps {
  item: GlanceItem;
  width?: number;
}

function CompactGlanceCard({ item, width }: CompactGlanceCardProps) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    if (item.onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      item.onPress();
    }
  };

  const IconComp = item.icon;

  return (
    <TouchableOpacity
      style={[
        styles.compactGlanceCard,
        {
          borderColor: isDark ? `${item.color}99` : item.color,
          backgroundColor: isDark ? palette.surface : `${item.color}0A`,
        },
        width ? { width } : null,
      ]}
      onPress={handlePress}
      activeOpacity={item.onPress ? 0.75 : 1}
      disabled={!item.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}: ${item.value}`}
    >
      <View style={styles.compactCardTop}>
        <Text style={styles.compactValue} numberOfLines={1}>
          {item.value}
        </Text>
        <View style={[styles.compactBadgeBox, { backgroundColor: `${item.color}1C` }]}>
          {IconComp ? (
            <IconComp size={15} color={item.color} strokeWidth={2.3} />
          ) : (
            <Text style={styles.compactEmoji}>{item.emoji}</Text>
          )}
        </View>
      </View>

      <View style={styles.compactCardBottom}>
        <Text style={styles.compactLabel} numberOfLines={1}>
          {item.label}
        </Text>
        {item.subtitle ? (
          <Text style={styles.compactSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  greeting: {
    ...typography.h2,
    color: palette.text,
  },
  dateAndWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  weatherChipEmoji: {
    fontSize: 12,
  },
  weatherChipText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: palette.text,
  },
  weatherChipRiskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  date: {
    ...typography.body,
    fontSize: 13,
    color: palette.textSecondary,
  },
  reminderIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activeNotifDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF5E20',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowColor: '#FF5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    color: palette.text,
  },
  sectionActionText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primary,
  },
  walkingCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  walkingStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  walkingMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  walkingMetricVal: {
    ...typography.h2,
    fontSize: 22,
    color: palette.text,
  },
  walkingMetricLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  walkingDivider: {
    width: 1,
    height: 30,
    backgroundColor: palette.divider,
  },
  walkingStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingVertical: 12,
    borderRadius: 9999,
    gap: 8,
  },
  walkingStartText: {
    ...typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  remindersCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  reminderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.divider,
  },
  reminderEmoji: {
    fontSize: 20,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderName: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  reminderTiming: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 1,
  },
  emptyRemindersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyRemindersText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionWrapper: {
    alignItems: 'center',
  },
  addQuickActionButton: {
    width: '100%',
    aspectRatio: 0.92,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#FAF6F1' : palette.surface,
  },
  addQuickActionWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.primary}12`,
    marginBottom: 5,
  },
  addQuickActionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  addQuickActionSub: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customizeGlanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  customizeGlanceText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textSecondary,
    fontSize: 11.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${palette.primary}12`,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${palette.primary}25`,
  },
  seeAllText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primary,
    fontSize: 11.5,
  },
  emptyGlanceBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
  },
  emptyGlanceText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  glanceRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  featuredWaterCard: {
    width: 154,
    height: 176,
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 11,
    justifyContent: 'space-between',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  waterCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  waterRingWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  waterRingCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterRingCount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text,
  },
  waterRingSubLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: palette.textSecondary,
    marginTop: 0.5,
  },
  waterBadgeBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#E0F2FE' : '#0E749022',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  waterPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.surface,
  },
  waterCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  waterMetaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  waterMetaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  waterGoalPill: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  waterGoalPillActive: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  waterMetaPercent: {
    fontSize: 11,
    color: palette.textDisabled,
    fontWeight: '500',
  },
  waterMetaPercentActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  waterManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.surfaceAlt,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 10,
    justifyContent: 'center',
  },
  waterManageBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  glanceSliderContainer: {
    width: '100%',
    marginTop: 4,
  },
  glanceSliderScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  glanceSlide: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  glanceColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  compactGlanceCard: {
    width: 154,
    height: 83,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1.5,
  },
  addMetricCard: {
    borderStyle: 'dashed',
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt === '#F5F0EB' ? '#FAF6F1' : palette.surface,
    borderWidth: 1.5,
  },
  addMetricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMetricIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: `${palette.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactValue: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: palette.text,
    flex: 1,
  },
  compactBadgeBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEmoji: {
    fontSize: 15,
  },
  compactCardBottom: {
    marginTop: 2,
  },
  compactLabel: {
    ...typography.caption,
    fontSize: 11.5,
    color: palette.textSecondary,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  compactSubtitle: {
    ...typography.caption,
    fontSize: 10,
    color: palette.textDisabled,
    fontWeight: '500',
    marginTop: 0.5,
  },
  glancePaginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  glanceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.border,
  },
  glanceDotActive: {
    width: 14,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.primary,
  },
}));
