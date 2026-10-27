/**
 * SleepQualityModal
 * 1-tap sleep quality check-in presented upon waking up.
 * Helps patients with autoimmune disorders quickly log restorative sleep depth
 * to link restorative rest with flare risk and symptom management on the Timeline.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Moon, Sparkles, X, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { SleepRecord, SleepQuality, useSleepTrackerStore } from '../../store/sleepTrackerStore';
import { formatGoalHours, goalRangeLabel } from '../../store/sleepTrackerStore';
import { PressableScale } from '../common/PressableScale';

interface SleepQualityModalProps {
  visible: boolean;
  onClose: () => void;
  sleepRecord: SleepRecord | null;
  onSelectQuality: (quality: SleepQuality) => void;
  onOpenAdjustTimes?: () => void;
}

interface QualityOption {
  key: SleepQuality;
  emoji: string;
  label: string;
  desc: string;
  badge: string;
  color: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    key: 'RESTFUL',
    emoji: '😴',
    label: 'Restful & Deep',
    desc: 'Deep uninterrupted sleep • High immune cell repair',
    badge: 'Low Flare Risk',
    color: '#10B981',
  },
  {
    key: 'GOOD',
    emoji: '😊',
    label: 'Good & Refreshed',
    desc: 'Woke up energized with minimal morning stiffness',
    badge: 'Restored',
    color: '#06B6D4',
  },
  {
    key: 'FAIR',
    emoji: '😐',
    label: 'Fair / Light',
    desc: 'Woke up a few times or felt slightly unrested',
    badge: 'Moderate',
    color: '#F59E0B',
  },
  {
    key: 'POOR',
    emoji: '😫',
    label: 'Restless / Broken',
    desc: 'Frequent waking, pain, stiffness, or high fatigue',
    badge: 'High Flare Caution',
    color: '#EF4444',
  },
];

export function SleepQualityModal({
  visible,
  onClose,
  sleepRecord,
  onSelectQuality,
  onOpenAdjustTimes,
}: SleepQualityModalProps) {
  const { palette } = useTheme();
  const qualityText: Record<string, string> = { RESTFUL: palette.successText, GOOD: palette.secondaryText, FAIR: palette.warningText, POOR: palette.errorText };
  const { minRecoveryMinutes, targetGoalMinutes } = useSleepTrackerStore();

  if (!visible || !sleepRecord) return null;

  const durationMin = sleepRecord.durationMinutes;
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const durationStr = `${hours}h ${mins}m`;
  const pct = Math.min(100, Math.round((durationMin / targetGoalMinutes) * 100));
  const isGoalMet = durationMin >= minRecoveryMinutes;

  const handleSelect = async (opt: QualityOption) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelectQuality(opt.key);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerGreeting, { color: palette.text }]}>Good morning! ☀️</Text>
              <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
                Autoimmune Sleep Recovery
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: palette.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Sleep Score Banner */}
          <View
            style={[
              styles.summaryBanner,
              {
                backgroundColor: isGoalMet ? '#10B98114' : '#F59E0B14',
                borderColor: isGoalMet ? '#10B98133' : '#F59E0B33',
              },
            ]}
          >
            <View style={styles.summaryTopRow}>
              <View style={styles.durationGroup}>
                <Text style={[styles.durationVal, { color: palette.text }]}>{durationStr}</Text>
                <Text style={[styles.durationSub, { color: palette.textSecondary }]}>
                  of {targetGoalMinutes / 60}h goal
                </Text>
              </View>

              <View
                style={[
                  styles.goalBadge,
                  { backgroundColor: isGoalMet ? '#10B98126' : '#F59E0B26' },
                ]}
              >
                <ShieldCheck size={13} color={isGoalMet ? palette.successText : palette.warningText} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.goalBadgeText,
                    { color: isGoalMet ? palette.successText : palette.warningText },
                  ]}
                >
                  {isGoalMet ? `${goalRangeLabel(targetGoalMinutes)}h Target Met` : `Under ${formatGoalHours(minRecoveryMinutes)}h Minimum`}
                </Text>
              </View>
            </View>

            {/* Mini Progress Bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: isGoalMet ? '#10B981' : '#F59E0B',
                  },
                ]}
              />
              {/* On-target tick */}
              <View style={[styles.targetTick, { left: `${Math.round((minRecoveryMinutes / targetGoalMinutes) * 1000) / 10}%` }]} />
            </View>
            <Text style={[styles.progressCaption, { color: palette.textSecondary }]}>
              {pct}% of 8-hour target achieved
            </Text>
          </View>

          {/* Prompt */}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            How restorative was your sleep?
          </Text>
          <Text style={[styles.sectionDesc, { color: palette.textSecondary }]}>
            1-tap check-in helps correlate immune fatigue with flare risk on your timeline.
          </Text>

          {/* 4 Quality Options */}
          <View style={styles.optionsWrap}>
            {QUALITY_OPTIONS.map(opt => (
              <PressableScale
                key={opt.key}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                  },
                ]}
                onPress={() => handleSelect(opt)}
                activeScale={0.97}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <View style={[styles.emojiWrap, { backgroundColor: `${opt.color}18` }]}>
                  <Text style={styles.emojiText}>{opt.emoji}</Text>
                </View>

                <View style={styles.optionContent}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionLabel, { color: palette.text }]}>{opt.label}</Text>
                    <View style={[styles.flarePill, { backgroundColor: `${opt.color}1F` }]}>
                      <Text style={[styles.flarePillText, { color: qualityText[opt.key] }]}>{opt.badge}</Text>
                    </View>
                  </View>
                  <Text style={[styles.optionDesc, { color: palette.textSecondary }]}>
                    {opt.desc}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>

          {/* Footer: Adjust Bedtime/Wake time */}
          {onOpenAdjustTimes && (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onOpenAdjustTimes();
              }}
              style={styles.adjustLink}
            >
              <Text style={[styles.adjustLinkText, { color: palette.primaryText }]}>
                Need to adjust bedtime or wake-up time?
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  durationGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  durationVal: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  durationSub: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  progressCaption: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 14,
  },
  optionsWrap: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  emojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 20,
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  flarePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  flarePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  adjustLink: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  adjustLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
