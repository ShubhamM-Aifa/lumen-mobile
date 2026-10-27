/**
 * MorningSleepCheckinBanner
 * Rendered at the top of the Morning Check-In modal:
 * - Shows last night's sleep duration & progress bar towards 7–8h compulsory autoimmune goal
 * - Clinical autoimmune insight on cytokine suppression and flare prevention
 * - 1-tap "How restorative was your sleep?" selector
 * - Allows adjusting bedtime / wake-up times directly inside check-in
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Sunrise,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import {
  useSleepTrackerStore,
  SleepQuality,
  SleepRecord,
} from '../../store/sleepTrackerStore';
import { formatGoalHours, goalRangeLabel } from '../../store/sleepTrackerStore';
import { PressableScale } from '../common/PressableScale';
import { AdjustSleepTimesModal } from './AdjustSleepTimesModal';

interface MorningSleepCheckinBannerProps {
  onQualityChange?: (quality: SleepQuality) => void;
  selectedQuality?: SleepQuality | null;
}

function formatClockTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface QualityOption {
  key: SleepQuality;
  emoji: string;
  label: string;
  badge: string;
  color: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    key: 'RESTFUL',
    emoji: '😴',
    label: 'Restful',
    badge: 'Deep Recovery',
    color: '#10B981',
  },
  {
    key: 'GOOD',
    emoji: '😊',
    label: 'Good',
    badge: 'Refreshed',
    color: '#06B6D4',
  },
  {
    key: 'FAIR',
    emoji: '😐',
    label: 'Fair',
    badge: 'Light Sleep',
    color: '#F59E0B',
  },
  {
    key: 'POOR',
    emoji: '😫',
    label: 'Restless',
    badge: 'High Flare Risk',
    color: '#EF4444',
  },
];

export function MorningSleepCheckinBanner({
  onQualityChange,
  selectedQuality: propQuality,
}: MorningSleepCheckinBannerProps) {
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const qualityText: Record<string, string> = { RESTFUL: palette.successText, GOOD: palette.secondaryText, FAIR: palette.warningText, POOR: palette.errorText };
  const {
    lastSleepRecord,
    targetGoalMinutes,
    minRecoveryMinutes,
    recordSleepQuality,
  } = useSleepTrackerStore();

  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [internalQuality, setInternalQuality] = useState<SleepQuality | null>(
    propQuality ?? lastSleepRecord?.quality ?? null
  );

  const activeQuality = propQuality ?? internalQuality;

  const hasRecord = !!lastSleepRecord;
  const durationMin = lastSleepRecord?.durationMinutes ?? 0;
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const progressPct = Math.min(100, Math.round((durationMin / targetGoalMinutes) * 100));
  const isGoalMet = hasRecord && durationMin >= minRecoveryMinutes;

  const handleSelect = async (opt: QualityOption) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInternalQuality(opt.key);
    recordSleepQuality(opt.key);
    onQualityChange?.(opt.key);
  };

  return (
    <View style={[styles.bannerContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={[styles.iconBadge, { backgroundColor: isGoalMet ? '#10B98118' : '#F59E0B18' }]}>
            <Sunrise size={18} color={isGoalMet ? palette.successText : palette.warningText} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.titleText, { color: palette.text }]}>Autoimmune Sleep Recovery</Text>
            <Text style={[styles.subtitleText, { color: palette.textSecondary }]}>
              Compulsory {goalRangeLabel(targetGoalMinutes)}h Target for Inflammation Control
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            hasRecord
              ? {
                  backgroundColor: isGoalMet ? '#10B98118' : '#F59E0B18',
                  borderColor: isGoalMet ? '#10B98140' : '#F59E0B40',
                }
              : { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.statusPillText, { color: !hasRecord ? palette.textSecondary : isGoalMet ? palette.successText : palette.warningText }]}>
            {!hasRecord
              ? 'Not recorded yet'
              : isGoalMet ? `✓ ${goalRangeLabel(targetGoalMinutes)}h Target Met` : `Under ${formatGoalHours(minRecoveryMinutes)}h Goal`}
          </Text>
        </View>
      </View>

      {/* Duration & Times */}
      <View style={styles.scoreRow}>
        <View style={styles.durationCol}>
          <Text style={[styles.durationVal, { color: palette.text }]}>
            {hours}h {mins}m{' '}
            <Text style={[styles.durationSub, { color: palette.textSecondary }]}>
              / {targetGoalMinutes / 60}h goal
            </Text>
          </Text>
          {lastSleepRecord && (
            <Text style={[styles.timeRangeText, { color: palette.textSecondary }]}>
              {formatClockTime(lastSleepRecord.bedtime)} → {formatClockTime(lastSleepRecord.wakeTime)}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setAdjustModalVisible(true)}
          style={[styles.adjustBtn, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
        >
          <Sliders size={12} color={palette.primaryText} style={{ marginRight: 4 }} />
          <Text style={[styles.adjustBtnText, { color: palette.primaryText }]}>Adjust times</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar with 7h marker */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressTrack, { backgroundColor: palette.surfaceAlt }]}>
          <LinearGradient
            colors={isGoalMet ? ['#10B981', '#06B6D4'] : ['#F59E0B', '#F97316']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${hasRecord ? Math.max(6, progressPct) : 0}%` }]}
          />
          {/* On-target threshold marker */}
          <View
            style={[
              styles.targetTick,
              {
                left: `${Math.round((minRecoveryMinutes / targetGoalMinutes) * 1000) / 10}%`,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressPctText, { color: palette.textSecondary }]}>
            {progressPct}% achieved
          </Text>
          <Text style={[styles.progressTargetText, isGoalMet ? { color: palette.successText } : { color: palette.textSecondary }]}>
            {formatGoalHours(minRecoveryMinutes)}h Autoimmune Baseline
          </Text>
        </View>
      </View>

      {/* Clinical Guidance Box */}
      {!hasRecord ? (
        <Text style={[styles.insightText, { color: palette.textSecondary, marginBottom: 12 }]}>
          No sleep recorded for last night yet. Tap Adjust times to add it.
        </Text>
      ) : (
      <View
        style={[
          styles.insightBox,
          {
            backgroundColor: isGoalMet
              ? (isDark ? '#10B98118' : '#10B9810F')
              : (isDark ? '#F59E0B18' : '#F59E0B0F'),
            borderColor: isGoalMet
              ? (isDark ? '#10B98140' : '#10B98126')
              : (isDark ? '#F59E0B40' : '#F59E0B26'),
          },
        ]}
      >
        {isGoalMet ? (
          <ShieldCheck size={14} color={palette.successText} style={{ marginRight: 6 }} />
        ) : (
          <AlertTriangle size={14} color={palette.warningText} style={{ marginRight: 6 }} />
        )}
        <Text
          style={[
            styles.insightText,
            {
              color: isGoalMet
                ? palette.successText
                : palette.warningText,
            },
          ]}
        >
          {isGoalMet
            ? `Restorative ${goalRangeLabel(targetGoalMinutes)}h sleep suppresses pro-inflammatory cytokines (IL-6, TNF-α) to protect against flare-ups.`
            : `Under ${formatGoalHours(minRecoveryMinutes)}h increases immune fatigue. Take extra rest breaks and stay hydrated today to prevent a flare.`}
        </Text>
      </View>
      )}

      {/* "How restorative was your sleep?" Prompt */}
      <View style={styles.qualitySection}>
        <Text style={[styles.qualityPromptTitle, { color: palette.text }]}>
          How restorative was your sleep?
        </Text>
        <Text style={[styles.qualityPromptSub, { color: palette.textSecondary }]}>
          Tap to link your sleep depth with autoimmune flare tracking.
        </Text>

        <View style={styles.qualityGrid}>
          {QUALITY_OPTIONS.map(opt => {
            const isSelected = activeQuality === opt.key;
            return (
              <PressableScale
                key={opt.key}
                onPress={() => handleSelect(opt)}
                activeScale={0.96}
                haptic="light"
                style={[
                  styles.qualityCard,
                  {
                    backgroundColor: isSelected ? `${opt.color}18` : palette.surfaceAlt,
                    borderColor: isSelected ? opt.color : palette.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.qualityEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.qualityLabel,
                    { color: isSelected ? qualityText[opt.key] : palette.text },
                    isSelected && { fontWeight: '800' },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={[styles.qualityBadge, { color: isSelected ? qualityText[opt.key] : palette.textSecondary }]}>
                  {opt.badge}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Adjust Sleep Times Modal */}
      <AdjustSleepTimesModal
        visible={adjustModalVisible}
        onClose={() => setAdjustModalVisible(false)}
        sleepRecord={lastSleepRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    rowGap: 8,
    columnGap: 8,
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
  },
  titleCol: { flexShrink: 1 },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  durationCol: {},
  durationVal: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  durationSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeRangeText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  adjustBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressWrap: {
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  targetTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressPctText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressTargetText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  insightText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    fontWeight: '500',
  },
  qualitySection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 12,
  },
  qualityPromptTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  qualityPromptSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  qualityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityCard: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  qualityEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  qualityLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  qualityBadge: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});
