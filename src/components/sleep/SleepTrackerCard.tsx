/**
 * SleepTrackerCard
 * Dedicated Autoimmune Sleep Tracking & Progress Card:
 * - Compulsory 7–8 hour target for immune modulation & cytokine suppression
 * - Live tracking from "Going to bed" to "Tap when you're awake"
 * - Multi-stage progress bar showing progress toward 7h (minimum) and 8h (optimal)
 * - 1-tap sleep quality check-in upon waking
 * - Seamless daytime summary & evening bedtime transition
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Moon,
  Sun,
  Sunrise,
  ShieldCheck,
  Clock,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import {
  useSleepTrackerStore,
  SleepRecord,
  SleepQuality,
} from '../../store/sleepTrackerStore';
import { formatGoalHours, goalRangeLabel } from '../../store/sleepTrackerStore';
import { useDaySessionStore } from '../../store/daySessionStore';
import { PressableScale } from '../common/PressableScale';
import { SleepQualityModal } from './SleepQualityModal';
import { AdjustSleepTimesModal } from './AdjustSleepTimesModal';

export interface SleepTrackerCardProps {
  style?: StyleProp<ViewStyle>;
}

function formatClockTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDurationHhMm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

const QUALITY_CONFIG: Record<
  SleepQuality,
  {
    emoji: string;
    label: string;
    lightBg: string;
    darkBg: string;
    lightBorder: string;
    darkBorder: string;
    lightText: string;
    darkText: string;
  }
> = {
  RESTFUL: {
    emoji: '😴',
    label: 'Restful',
    lightBg: '#10B98114',
    darkBg: '#10B98126',
    lightBorder: '#10B98140',
    darkBorder: '#10B98160',
    lightText: '#047857',
    darkText: '#34D399',
  },
  GOOD: {
    emoji: '😊',
    label: 'Good',
    lightBg: '#06B6D414',
    darkBg: '#06B6D426',
    lightBorder: '#06B6D440',
    darkBorder: '#06B6D460',
    lightText: '#0E7490',
    darkText: '#38BDF8',
  },
  FAIR: {
    emoji: '😐',
    label: 'Fair',
    lightBg: '#F59E0B14',
    darkBg: '#F59E0B26',
    lightBorder: '#F59E0B40',
    darkBorder: '#F59E0B60',
    lightText: '#B45309',
    darkText: '#FBBF24',
  },
  POOR: {
    emoji: '😫',
    label: 'Restless',
    lightBg: '#EF444414',
    darkBg: '#EF444426',
    lightBorder: '#EF444440',
    darkBorder: '#EF444460',
    lightText: '#DC2626',
    darkText: '#F87171',
  },
};

export function SleepTrackerCard({ style }: SleepTrackerCardProps) {
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const {
    isSleeping,
    activeSleepStart,
    lastSleepRecord,
    targetGoalMinutes,
    minRecoveryMinutes,
    isLoaded,
    loadState,
    startSleep,
    wakeUp,
    recordSleepQuality,
  } = useSleepTrackerStore();

  const { todaySession, recordWakeUp, recordGoToBed } = useDaySessionStore();

  // Local modals
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<SleepRecord | null>(null);

  // Live timer tick for active sleep (updates every 30 seconds)
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (!isSleeping) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [isSleeping]);

  // Live elapsed sleep minutes
  const liveElapsedMinutes = useMemo(() => {
    if (!isSleeping || !activeSleepStart) return 0;
    const startMs = new Date(activeSleepStart).getTime();
    if (isNaN(startMs)) return 0;
    return Math.max(0, Math.round((nowMs - startMs) / 60000));
  }, [isSleeping, activeSleepStart, nowMs]);

  // Handle "Go to bed"
  const handleStartSleep = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await startSleep();
  };

  // Handle "Tap when you're awake"
  const handleWakeUp = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const completedRecord = await wakeUp();
    setPendingRecord(completedRecord);
    // Directly navigate to Morning Check-in, where Autoimmune Sleep Recovery
    // and morning check-in questions are displayed together!
    router.push('/check-in?type=morning');
  };

  // Handle quality selection
  const handleSelectQuality = async (quality: SleepQuality) => {
    await recordSleepQuality(quality);
  };

  // Active Sleep Mode (While sleeping / in bed)
  if (isSleeping) {
    const elapsedHours = Math.floor(liveElapsedMinutes / 60);
    const elapsedMins = liveElapsedMinutes % 60;
    const progressPct = Math.min(100, Math.round((liveElapsedMinutes / targetGoalMinutes) * 100));
    const isBaselineMet = liveElapsedMinutes >= minRecoveryMinutes;
    const isGoalMet = liveElapsedMinutes >= targetGoalMinutes;

    return (
      <LinearGradient
        colors={['#0F172A', '#1E1B4B', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardContainer, styles.activeSleepCard, style]}
      >
        <View style={styles.cardContent}>
          {/* Top Status Row */}
          <View style={styles.topStatusRow}>
            <View style={styles.sleepingBadge}>
              <Moon size={15} color="#A5B4FC" style={{ marginRight: 6 }} />
              <Text style={styles.sleepingBadgeText}>Sleep in Progress</Text>
            </View>
            <Text style={styles.liveBedtimeText}>
              Bedtime: {formatClockTime(activeSleepStart || undefined)}
            </Text>
          </View>

          {/* Live Sleep Duration & Target */}
          <View style={styles.liveTimerSection}>
            <Text style={styles.liveDurationText}>
              {elapsedHours}h {elapsedMins}m
            </Text>
            <Text style={styles.liveTargetSubtitle}>
              of {targetGoalMinutes / 60}h compulsory autoimmune goal
            </Text>
          </View>

          {/* Progress Bar towards 7–8h Autoimmune Recovery */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarTrackDark}>
              <LinearGradient
                colors={isBaselineMet ? ['#10B981', '#06B6D4'] : ['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.progressBarFill, { width: `${Math.max(5, progressPct)}%` }]}
              />
              {/* On-target marker */}
              <View style={[styles.targetMarkerTick, { left: `${Math.round((minRecoveryMinutes / targetGoalMinutes) * 1000) / 10}%` }]} />
            </View>

            <View style={styles.progressLabelsRow}>
              <Text style={styles.progressMetaText}>{progressPct}% achieved</Text>
              <Text style={[styles.progressMetaText, isBaselineMet && { color: '#34D399', fontWeight: '700' }]}>
                {isBaselineMet ? `✓ ${formatGoalHours(minRecoveryMinutes)}h Threshold Reached` : `${formatGoalHours(minRecoveryMinutes)}h Autoimmune Goal`}
              </Text>
            </View>
          </View>

          {/* Autoimmune Health Insight */}
          <View style={styles.insightBoxDark}>
            {isGoalMet ? (
              <>
                <Sparkles size={14} color="#FBBF24" style={{ marginRight: 6 }} />
                <Text style={styles.insightTextDark}>
                  Optimal 8-hour restorative sleep reached! Cytokines suppressed.
                </Text>
              </>
            ) : isBaselineMet ? (
              <>
                <ShieldCheck size={14} color="#34D399" style={{ marginRight: 6 }} />
                <Text style={styles.insightTextDark}>
                  Autoimmune recovery threshold met ({formatGoalHours(minRecoveryMinutes)}h+). Feel free to wake up refreshed!
                </Text>
              </>
            ) : (
              <>
                <Clock size={14} color="#A5B4FC" style={{ marginRight: 6 }} />
                <Text style={styles.insightTextDark}>
                  Deep cellular repair active. Aiming for {goalRangeLabel(targetGoalMinutes)} hours to prevent flares.
                </Text>
              </>
            )}
          </View>

          {/* Primary Action: TAP WHEN YOU'RE AWAKE */}
          <PressableScale
            style={styles.wakeUpButton}
            onPress={handleWakeUp}
            haptic="medium"
            activeScale={0.96}
            accessibilityRole="button"
            accessibilityLabel="Tap when you are awake"
          >
            <View style={styles.wakeUpButtonContent}>
              <Sun size={20} color="#EA580C" style={{ marginRight: 8 }} />
              <Text style={styles.wakeUpButtonText}>Tap when you're awake</Text>
            </View>
          </PressableScale>

          {/* Optional Evening Check-in link */}
          <TouchableOpacity
            style={styles.eveningCheckinOptionalBtn}
            onPress={() => router.push('/check-in?type=evening')}
            activeOpacity={0.7}
          >
            <Moon size={13} color="#A5B4FC" style={{ marginRight: 6 }} />
            <Text style={styles.eveningCheckinOptionalText}>Evening Check-in (Optional)</Text>
          </TouchableOpacity>
        </View>

        {/* Quality Check-in Modal */}
        <SleepQualityModal
          visible={qualityModalVisible}
          onClose={() => setQualityModalVisible(false)}
          sleepRecord={pendingRecord || lastSleepRecord}
          onSelectQuality={handleSelectQuality}
          onOpenAdjustTimes={() => setAdjustModalVisible(true)}
        />

        {/* Adjust Times Modal */}
        <AdjustSleepTimesModal
          visible={adjustModalVisible}
          onClose={() => setAdjustModalVisible(false)}
          sleepRecord={pendingRecord || lastSleepRecord}
        />
      </LinearGradient>
    );
  }

  // State 2: Awake / Day Completed Sleep Summary
  const sleepRecord = lastSleepRecord;
  const hasCompletedRecord = !!sleepRecord;
  const durationMin = sleepRecord?.durationMinutes ?? 0;
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const progressPct = Math.min(100, Math.round((durationMin / targetGoalMinutes) * 100));
  const isGoalMet = durationMin >= minRecoveryMinutes;

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: palette.surface },
        style,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Top Header */}
        <View style={styles.summaryHeaderRow}>
          <View style={styles.titleWithIcon}>
            <View
              style={[
                styles.iconBadgeSun,
                { backgroundColor: isGoalMet ? '#10B98118' : '#F59E0B18' },
              ]}
            >
              {isGoalMet ? (
                <ShieldCheck size={20} color={palette.successText} />
              ) : (
                <Sunrise size={20} color={palette.warningText} />
              )}
            </View>
            <View>
              <Text style={[styles.cardTitleText, { color: palette.text }]}>
                {hasCompletedRecord ? "Last Night's Sleep" : "Sleep & Day Session"}
              </Text>
              <Text style={[styles.cardSubtitleText, { color: palette.textSecondary }]}>
                Autoimmune Recovery ({goalRangeLabel(targetGoalMinutes)}h Target)
              </Text>
            </View>
          </View>

          {hasCompletedRecord && (
            <View
              style={[
                styles.statusChip,
                { backgroundColor: isGoalMet ? palette.success + '26' : palette.warning + '26' },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: isGoalMet ? palette.successText : palette.warningText },
                ]}
              >
                {isGoalMet ? `${goalRangeLabel(targetGoalMinutes)}h Goal Met` : `Under ${formatGoalHours(minRecoveryMinutes)}h Goal`}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        {hasCompletedRecord ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: palette.text }]}>
                  {hours}h {mins}m
                </Text>
                <Text style={[styles.statSub, { color: palette.textSecondary }]}>
                  {formatClockTime(sleepRecord.bedtime)} → {formatClockTime(sleepRecord.wakeTime)}
                </Text>
              </View>

              {sleepRecord.quality && (() => {
                const qConf = QUALITY_CONFIG[sleepRecord.quality];
                if (!qConf) return null;
                const pillBg = isDark ? qConf.darkBg : qConf.lightBg;
                const pillTextColor = isDark ? qConf.darkText : qConf.lightText;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setPendingRecord(sleepRecord);
                      setQualityModalVisible(true);
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.qualityPill,
                      { backgroundColor: pillBg },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Sleep quality: ${qConf.label}. Tap to adjust.`}
                  >
                    <Text style={styles.qualityEmoji}>{qConf.emoji}</Text>
                    <Text style={[styles.qualityPillText, { color: pillTextColor }]}>
                      {qConf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Progress Bar toward 8h goal */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarTrackLight, { backgroundColor: palette.surfaceAlt }]}>
                <LinearGradient
                  colors={isGoalMet ? ['#10B981', '#06B6D4'] : ['#F59E0B', '#F97316']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.progressBarFill, { width: `${Math.max(5, progressPct)}%` }]}
                />
                {/* On-target tick */}
                <View
                  style={[
                    styles.targetMarkerTickLight,
                    {
                      left: `${Math.round((minRecoveryMinutes / targetGoalMinutes) * 1000) / 10}%`,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
                    },
                  ]}
                />
              </View>

              <View style={styles.progressLabelsRow}>
                <Text style={[styles.progressMetaTextLight, { color: palette.textSecondary }]}>
                  {progressPct}% of 8h restorative goal
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPendingRecord(sleepRecord);
                    setAdjustModalVisible(true);
                  }}
                  style={styles.adjustTimesBtn}
                >
                  <Sliders size={12} color={palette.primaryText} style={{ marginRight: 4 }} />
                  <Text style={[styles.adjustTimesText, { color: palette.primaryText }]}>Adjust</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Autoimmune Clinical Guidance */}
            <View
              style={[
                styles.insightBoxLight,
                { backgroundColor: isGoalMet ? palette.success + '1F' : palette.warning + '1F' },
              ]}
            >
              {isGoalMet ? (
                <ShieldCheck size={15} color={palette.successText} style={{ marginRight: 7 }} />
              ) : (
                <AlertTriangle size={15} color={palette.warningText} style={{ marginRight: 7 }} />
              )}
              <Text
                style={[
                  styles.insightTextLight,
                  {
                    color: isGoalMet ? palette.successText : palette.warningText,
                  },
                ]}
              >
                {isGoalMet
                  ? `${goalRangeLabel(targetGoalMinutes)} hours of restorative sleep lowers pro-inflammatory cytokines, protecting against autoimmune flares today.`
                  : `Under ${formatGoalHours(minRecoveryMinutes)} hours increases systemic inflammation. Take rest breaks and stay hydrated today to prevent a flare.`}
              </Text>
            </View>
          </>
        ) : (
          /* Empty / First-time state */
          <View style={styles.emptyStateWrap}>
            <Text style={[styles.emptyPromptText, { color: palette.textSecondary }]}>
              Tracking {goalRangeLabel(targetGoalMinutes)} hours of restorative sleep is compulsory for managing autoimmune inflammation.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPendingRecord(null);
                setAdjustModalVisible(true);
              }}
              style={styles.manualLogLink}
            >
              <Text style={[styles.manualLogLinkText, { color: palette.primaryText }]}>
                + Log last night's sleep manually
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Daytime Actions: Morning check-in & Going to bed */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.checkinLinkBtn, { backgroundColor: palette.surfaceAlt }]}
            onPress={() => router.push('/check-in?type=morning')}
            accessibilityRole="button"
            accessibilityLabel="Open Morning Check-in"
          >
            <Sunrise size={16} color={palette.primaryText} style={{ marginRight: 6 }} />
            <Text style={[styles.checkinLinkText, { color: palette.primaryText }]}>Morning Check-in</Text>
          </TouchableOpacity>

          <PressableScale
            style={[styles.goToBedBtnHalf, { backgroundColor: palette.surfaceAlt }]}
            onPress={handleStartSleep}
            haptic="medium"
            activeScale={0.97}
            accessibilityRole="button"
            accessibilityLabel="Record going to bed"
          >
            <View style={styles.goToBedButtonContent}>
              <Moon size={16} color={palette.text} style={{ marginRight: 6 }} />
              <Text style={[styles.goToBedButtonText, { color: palette.text }]}>Going to Bed</Text>
            </View>
          </PressableScale>
        </View>
      </View>

      {/* Quality Check-in Modal */}
      <SleepQualityModal
        visible={qualityModalVisible}
        onClose={() => setQualityModalVisible(false)}
        sleepRecord={pendingRecord || lastSleepRecord}
        onSelectQuality={handleSelectQuality}
        onOpenAdjustTimes={() => setAdjustModalVisible(true)}
      />

      {/* Adjust Times Modal */}
      <AdjustSleepTimesModal
        visible={adjustModalVisible}
        onClose={() => setAdjustModalVisible(false)}
        sleepRecord={pendingRecord || lastSleepRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContent: {
    padding: 16,
  },
  // Active Sleep Mode Styles
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sleepingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312E8180',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4338CA80',
  },
  sleepingBadgeText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  liveBedtimeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  liveTimerSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  liveDurationText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  liveTargetSubtitle: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 4,
  },
  progressContainer: {
    marginVertical: 10,
  },
  progressBarTrackDark: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarTrackLight: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  targetMarkerTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  targetMarkerTickLight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressMetaText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '500',
  },
  progressMetaTextLight: {
    fontSize: 12,
    fontWeight: '500',
  },
  insightBoxDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  insightTextDark: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  wakeUpButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  wakeUpButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeUpButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  activeSleepCard: {
    borderWidth: 1,
    borderColor: '#4338CA60',
  },
  eveningCheckinOptionalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 6,
  },
  eveningCheckinOptionalText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '600',
  },
  // Awake Summary Styles
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadgeSun: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  statusChip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statCol: {},
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 18,
    gap: 6,
  },
  qualityEmoji: {
    fontSize: 13,
  },
  qualityPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  adjustTimesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  adjustTimesText: {
    fontSize: 13,
    fontWeight: '700',
  },
  insightBoxLight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  insightTextLight: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  emptyStateWrap: {
    paddingVertical: 10,
  },
  emptyPromptText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  manualLogLink: {
    marginTop: 8,
    paddingVertical: 4,
  },
  manualLogLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  checkinLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    minHeight: 48,
  },
  checkinLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  goToBedBtnHalf: {
    flex: 1,
    borderRadius: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToBedButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  goToBedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToBedButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
