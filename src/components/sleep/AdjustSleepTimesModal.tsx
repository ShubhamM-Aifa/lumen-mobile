/**
 * AdjustSleepTimesModal
 * Allows autoimmune patients to fine-tune their bedtime and wake-up times
 * to ensure their 7–8 hour compulsory sleep metric is medically accurate.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Clock, Plus, Minus, X, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useSleepTrackerStore, SleepRecord } from '../../store/sleepTrackerStore';
import { formatGoalHours, goalRangeLabel } from '../../store/sleepTrackerStore';
import { PressableScale } from '../common/PressableScale';

interface AdjustSleepTimesModalProps {
  visible: boolean;
  onClose: () => void;
  sleepRecord: SleepRecord | null;
}

function formatTimeString(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AdjustSleepTimesModal({
  visible,
  onClose,
  sleepRecord,
}: AdjustSleepTimesModalProps) {
  const { palette } = useTheme();
  const { adjustTimes, targetGoalMinutes, minRecoveryMinutes } = useSleepTrackerStore();

  const [bedDate, setBedDate] = useState<Date>(() =>
    sleepRecord?.bedtime ? new Date(sleepRecord.bedtime) : new Date(Date.now() - 8 * 3600000)
  );

  const [wakeDate, setWakeDate] = useState<Date>(() =>
    sleepRecord?.wakeTime ? new Date(sleepRecord.wakeTime) : new Date()
  );

  if (!visible) return null;

  // Calculate live adjusted duration
  const durationMin = Math.max(15, Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000));
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const isGoalMet = durationMin >= minRecoveryMinutes;

  const adjustBed = (deltaMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBedDate(prev => new Date(prev.getTime() + deltaMinutes * 60000));
  };

  const adjustWake = (deltaMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWakeDate(prev => new Date(prev.getTime() + deltaMinutes * 60000));
  };

  const handleSave = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await adjustTimes(bedDate, wakeDate);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Adjust Sleep Times</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                Ensure your {goalRangeLabel(targetGoalMinutes)}h autoimmune sleep progress is accurate
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: palette.surfaceAlt }]}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Adjusted Duration Highlight */}
          <View
            style={[
              styles.durationBadge,
              {
                backgroundColor: isGoalMet ? '#10B98114' : '#F59E0B14',
                borderColor: isGoalMet ? '#10B98133' : '#F59E0B33',
              },
            ]}
          >
            <Text style={[styles.durationVal, { color: isGoalMet ? palette.successText : palette.warningText }]}>
              {hours}h {mins}m
            </Text>
            <Text style={[styles.durationLabel, { color: palette.textSecondary }]}>
              {isGoalMet ? `Autoimmune ${goalRangeLabel(targetGoalMinutes)}h goal achieved` : `Under ${formatGoalHours(minRecoveryMinutes)}h minimum recovery threshold`}
            </Text>
          </View>

          {/* Bedtime Stepper */}
          <View style={[styles.timeRow, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
            <View>
              <Text style={[styles.timeRowLabel, { color: palette.textSecondary }]}>Bedtime (Fell asleep)</Text>
              <Text style={[styles.timeRowVal, { color: palette.text }]}>{formatTimeString(bedDate)}</Text>
            </View>
            <View style={styles.stepperGroup}>
              <TouchableOpacity onPress={() => adjustBed(-15)} style={[styles.stepperBtn, { backgroundColor: palette.surface }]}>
                <Minus size={15} color={palette.text} />
              </TouchableOpacity>
              <Text style={[styles.stepLabel, { color: palette.textSecondary }]}>±15m</Text>
              <TouchableOpacity onPress={() => adjustBed(15)} style={[styles.stepperBtn, { backgroundColor: palette.surface }]}>
                <Plus size={15} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Wake Time Stepper */}
          <View style={[styles.timeRow, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
            <View>
              <Text style={[styles.timeRowLabel, { color: palette.textSecondary }]}>Wake-up time (Awake)</Text>
              <Text style={[styles.timeRowVal, { color: palette.text }]}>{formatTimeString(wakeDate)}</Text>
            </View>
            <View style={styles.stepperGroup}>
              <TouchableOpacity onPress={() => adjustWake(-15)} style={[styles.stepperBtn, { backgroundColor: palette.surface }]}>
                <Minus size={15} color={palette.text} />
              </TouchableOpacity>
              <Text style={[styles.stepLabel, { color: palette.textSecondary }]}>±15m</Text>
              <TouchableOpacity onPress={() => adjustWake(15)} style={[styles.stepperBtn, { backgroundColor: palette.surface }]}>
                <Plus size={15} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <PressableScale
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: palette.primary }]}
            activeScale={0.96}
          >
            <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnText}>Save Adjusted Times</Text>
          </PressableScale>
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
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  durationVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  durationLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  timeRowLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeRowVal: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  saveBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
