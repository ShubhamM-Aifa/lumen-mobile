import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { ChevronLeft, Play, Footprints, Flame, Timer, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { typography } from '../../src/theme/typography';
import { useActivityStore } from '../../src/store/activityStore';
import { IActivitySession } from '@lumen/shared';
import { permissionService } from '../../src/services/permissionService';
import { ContextualPermissionModal } from '../../src/components/permissions/ContextualPermissionModal';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toISOString().slice(0, 10);
  const entryDate = iso.slice(0, 10);
  if (entryDate === today) return 'Today';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function WalkingDashboardScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const {
    history,
    todaySummary,
    fetchHistory,
    fetchTodaySummary,
    isTracking,
  } = useActivityStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchTodaySummary();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory(), fetchTodaySummary()]);
    setRefreshing(false);
  };

  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleStart = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const locStatus = await permissionService.checkPermission('location');
    if (locStatus.granted) {
      router.push('/walking/active');
    } else {
      setShowLocationModal(true);
    }
  };

  const todayDistanceKm = todaySummary?.totalDistanceKm ?? 0;
  const todayMinutes = todaySummary?.totalDurationMinutes ?? 0;
  const todaySteps = todaySummary?.totalSteps ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <LargeTitleHeader
          title="Walking"
          subtitle={isTracking ? 'A walk is in progress' : 'Gentle pacing, tracked quietly'}
          leading={
            <GlassCircleButton accessibilityLabel="Back" onPress={() => safeGoBack('/(tabs)/today')}>
              <ChevronLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        {/* Today's Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroBadge}>
              <Footprints size={14} color={palette.primaryText} />
              <Text style={styles.heroBadgeText}>TODAY</Text>
            </View>
            <Text style={styles.heroGoalText}>Goal: 5.0 km</Text>
          </View>

          <View style={styles.heroMainRow}>
            <View>
              <Text style={styles.heroDistanceNum}>{todayDistanceKm.toFixed(2)}</Text>
              <Text style={styles.heroDistanceUnit}>Kilometers</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroTimeNum}>{todayMinutes}</Text>
              <Text style={styles.heroDistanceUnit}>Minutes</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroStepsNum}>{todaySteps}</Text>
              <Text style={styles.heroDistanceUnit}>Steps</Text>
            </View>
          </View>

          {/* Start Walking Primary CTA */}
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={isTracking ? 'Resume walking' : 'Start walking'}>
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.startBtnText}>
              {isTracking ? 'RESUME WALKING' : 'START WALKING'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Performance Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.warning + '26' }]}>
                <Flame size={18} color={palette.warningText} />
              </View>
              <Text style={styles.statVal}>{todaySummary?.averagePaceMinPerKm ? `${todaySummary.averagePaceMinPerKm.toFixed(1)}` : '--'}</Text>
              <Text style={styles.statLabel}>Avg Pace (min/km)</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: palette.secondary + '26' }]}>
                <TrendingUp size={18} color={palette.secondaryText} />
              </View>
              <Text style={styles.statVal}>{todaySummary?.averageSpeedKmh ? `${todaySummary.averageSpeedKmh.toFixed(1)} km/h` : '--'}</Text>
              <Text style={styles.statLabel}>Avg Speed</Text>
            </View>
          </View>
        </View>

        {/* Walking History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Footprints size={36} color={palette.placeholder} />
              <Text style={styles.emptyHistoryText}>No walking sessions recorded yet.</Text>
            </View>
          ) : (
            history.map((session: IActivitySession) => (
              <View key={session._id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <View style={styles.historyIconWrap}>
                    <Footprints size={20} color={palette.primaryText} />
                  </View>
                  <View>
                    <Text style={styles.historyTitle}>{session.title || 'Outdoor Walk'}</Text>
                    <Text style={styles.historyDate}>{formatDate(session.startTime)} • {formatDuration(session.activeDurationSeconds)}</Text>
                  </View>
                </View>

                <View style={styles.historyRight}>
                  <Text style={styles.historyKm}>{(session.distanceMeters / 1000).toFixed(2)} km</Text>
                  <Text style={styles.historySteps}>{session.steps || 0} steps</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContextualPermissionModal
        visible={showLocationModal}
        permissionType="location"
        onGranted={() => {
          setShowLocationModal(false);
          router.push('/walking/active');
        }}
        onDismiss={() => setShowLocationModal(false)}
      />
    </SafeAreaView>
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
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24, gap: 20 },
  heroCard: { backgroundColor: palette.surface, borderRadius: 26, padding: 20 },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.tint + '1F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroBadgeText: { ...typography.footnote, fontWeight: '700', color: palette.primaryText, letterSpacing: 0.4 },
  heroGoalText: { ...typography.footnote, color: palette.textSecondary },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  heroDistanceNum: {
    ...typography.h1,
    fontSize: 32,
    color: palette.text,
    textAlign: 'center',
  },
  heroTimeNum: {
    ...typography.h1,
    fontSize: 32,
    color: palette.text,
    textAlign: 'center',
  },
  heroStepsNum: {
    ...typography.h1,
    fontSize: 32,
    color: palette.text,
    textAlign: 'center',
  },
  heroDistanceUnit: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center', marginTop: 2 },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: palette.divider,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    minHeight: 54,
    borderRadius: 27,
    gap: 8,
  },
  startBtnText: { ...typography.headline, color: '#FFFFFF' },
  section: {
    gap: 12,
  },
  sectionTitle: { ...typography.title2, color: palette.text },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: { flex: 1, backgroundColor: palette.surface, borderRadius: 26, padding: 16 },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statVal: {
    ...typography.h2,
    fontSize: 20,
    color: palette.text,
  },
  statLabel: { ...typography.footnote, color: palette.textSecondary, marginTop: 2 },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: palette.surface,
    borderRadius: 26,
    gap: 8,
  },
  emptyHistoryText: { ...typography.subhead, color: palette.textSecondary },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { ...typography.bodyLarge, color: palette.text },
  historyDate: { ...typography.footnote, color: palette.textSecondary, marginTop: 2 },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyKm: {
    ...typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  historySteps: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
}));
