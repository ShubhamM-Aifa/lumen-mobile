import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckCircle2, Footprints, Flame, Timer, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useActivityStore } from '../../src/store/activityStore';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m} min ${s < 10 ? '0' : ''}${s} sec`;
}

function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || !isFinite(paceMinPerKm)) return '--:--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} min/km`;
}

export default function WalkingSummaryScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { history } = useActivityStore();
  const latestSession = history[0];

  const [notes, setNotes] = useState('');

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/today');
  };

  const distanceKm = latestSession ? (latestSession.distanceMeters / 1000).toFixed(2) : '0.00';
  const durationText = latestSession ? formatDuration(latestSession.activeDurationSeconds) : '0 min 00 sec';
  const speedText = latestSession?.averageSpeedKmh ? `${latestSession.averageSpeedKmh.toFixed(2)} km/h` : '--';
  const paceText = latestSession?.averagePaceMinPerKm ? formatPace(latestSession.averagePaceMinPerKm) : '--';
  const stepsText = latestSession?.steps ? latestSession.steps.toLocaleString() : '0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Celebration Header */}
        <View style={styles.header}>
          <CheckCircle2 size={54} color={palette.success} />
          <Text style={styles.title}>Walking Complete!</Text>
          <Text style={styles.subtitle}>Saved directly into your Daily Timeline</Text>
        </View>

        {/* Metrics Card */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Timer size={18} color={palette.textSecondary} />
              <Text style={styles.metricLabel}>Duration</Text>
            </View>
            <Text style={styles.metricValue}>{durationText}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Footprints size={18} color={palette.primaryText} />
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <Text style={styles.metricValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <TrendingUp size={18} color={palette.secondaryText} />
              <Text style={styles.metricLabel}>Average Speed</Text>
            </View>
            <Text style={styles.metricValue}>{speedText}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Flame size={18} color={palette.warningText} />
              <Text style={styles.metricLabel}>Average Pace</Text>
            </View>
            <Text style={styles.metricValue}>{paceText}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <Footprints size={18} color={palette.textSecondary} />
              <Text style={styles.metricLabel}>Total Steps</Text>
            </View>
            <Text style={styles.metricValue}>{stepsText}</Text>
          </View>
        </View>

        {/* Notes Input */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How did you feel? Weather, path, shoes..."
            placeholderTextColor={palette.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Finish CTA */}
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.88}>
          <Text style={styles.doneBtnText}>View in Today's Timeline</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  title: {
    ...typography.h1,
    fontSize: 26,
    color: palette.text,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricLabel: {
    ...typography.body,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.h3,
    fontSize: 16,
    color: palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: palette.divider,
  },
  notesSection: {
    gap: 8,
  },
  notesLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  notesInput: {
    ...typography.body,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
    color: palette.text,
    textAlignVertical: 'top',
  },
  doneBtn: {
    backgroundColor: palette.primary,
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    ...typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
  },
}));
