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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack('/(tabs)/today')}>
          <ChevronLeft size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walking Tracker</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {/* Today's Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroBadge}>
              <Footprints size={14} color={palette.primary} />
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
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.88}>
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
              <View style={[styles.statIconCircle, { backgroundColor: 'rgba(255, 107, 53, 0.12)' }]}>
                <Flame size={18} color={palette.primary} />
              </View>
              <Text style={styles.statVal}>{todaySummary?.averagePaceMinPerKm ? `${todaySummary.averagePaceMinPerKm.toFixed(1)}` : '--'}</Text>
              <Text style={styles.statLabel}>Avg Pace (min/km)</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: 'rgba(78, 205, 196, 0.12)' }]}>
                <TrendingUp size={18} color={palette.secondary} />
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
                    <Footprints size={20} color={palette.primary} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    ...typography.h2,
    color: palette.text,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  heroCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
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
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroBadgeText: {
    ...typography.caption,
    fontWeight: '800',
    color: palette.primary,
  },
  heroGoalText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
  },
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
  heroDistanceUnit: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
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
    paddingVertical: 16,
    borderRadius: 9999,
    gap: 8,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  startBtnText: {
    ...typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.h3,
    color: palette.text,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
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
  statLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    gap: 8,
  },
  emptyHistoryText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  historyDate: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
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
