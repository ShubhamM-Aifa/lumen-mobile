import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import {
  Pause,
  Play,
  Square,
  Footprints,
  ChevronLeft,
  Flame,
  Gauge,
  MapPin,
  Clock,
  Navigation,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { typography } from '../../src/theme/typography';
import { useActivityStore } from '../../src/store/activityStore';
import { permissionService } from '../../src/services/permissionService';
import { ContextualPermissionModal } from '../../src/components/permissions/ContextualPermissionModal';

function formatTimer(totalSeconds: number = 0): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = safeSec % 60;

  const hh = h > 0 ? `${String(h).padStart(2, '0')}:` : '';
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${hh}${mm}:${ss}`;
}

function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0 || !isFinite(paceMinPerKm)) return '--:--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function ActiveWalkingScreen() {
  const {
    isTracking,
    isPaused,
    activeSeconds,
    distanceMeters,
    steps,
    currentSpeedKmh,
    averagePaceMinPerKm,
    startWalking,
    pauseWalking,
    resumeWalking,
    stopWalking,
    discardWalking,
    recalculateActiveTime,
  } = useActivityStore();

  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    async function initSession() {
      if (!isTracking) {
        const loc = await permissionService.checkPermission('location');
        if (!loc.granted) {
          setShowLocationModal(true);
        } else {
          startWalking('Outdoor Walk');
        }
      }
    }
    initSession();

    // Ensure timer updates immediately when phone wakes up or screen unlocks
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        recalculateActiveTime();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const handlePauseResume = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPaused) {
      await resumeWalking();
    } else {
      await pauseWalking();
    }
  };

  const handleMinimize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeGoBack('/(tabs)/today');
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Finish Walking Session',
      'Would you like to complete and save this walk to your daily timeline?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardWalking();
            safeGoBack('/walking');
          },
        },
        {
          text: 'Save Walk',
          style: 'default',
          onPress: async () => {
            const completed = await stopWalking();
            if (completed) {
              router.replace('/walking/summary');
            } else {
              safeGoBack('/walking');
            }
          },
        },
      ]
    );
  };

  const distanceKm = (distanceMeters / 1000).toFixed(2);
  const speedDisplay = (currentSpeedKmh || 0).toFixed(1);
  const estimatedCalories = Math.round(
    steps * 0.042 + (activeSeconds / 60) * 3.8
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.minimizeBtn}
          onPress={handleMinimize}
          accessibilityRole="button"
          accessibilityLabel="Minimize walk"
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#94A3B8" />
          <Text style={styles.minimizeText}>Home</Text>
        </TouchableOpacity>

        <View style={[styles.statusPill, isPaused && styles.statusPillPaused]}>
          <View style={[styles.pulseDot, isPaused && styles.pulseDotPaused]} />
          <Text style={styles.statusPillText}>
            {isPaused ? 'PAUSED' : 'LIVE TRACKING'}
          </Text>
        </View>

        <View style={styles.gpsIndicator}>
          <Navigation size={13} color="#10B981" />
          <Text style={styles.gpsText}>GPS</Text>
        </View>
      </View>

      {/* Hero Timer Card */}
      <View style={styles.heroTimerCard}>
        <View style={styles.timerHeaderRow}>
          <Clock size={14} color="#FF6B35" />
          <Text style={styles.timerHeaderLabel}>ACTIVE DURATION</Text>
        </View>
        <Text
          style={[
            styles.timerDisplay,
            activeSeconds >= 3600 && styles.timerDisplayLong,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatTimer(activeSeconds)}
        </Text>
        <View style={styles.speedSubRow}>
          <Text style={styles.speedSubText}>
            Current speed: <Text style={styles.speedSubHighlight}>{speedDisplay} km/h</Text>
          </Text>
        </View>
      </View>

      {/* Main Metrics 2x2 Dashboard */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Distance */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#FF6B351A' }]}>
              <MapPin size={16} color="#FF6B35" />
            </View>
            <Text style={styles.metricCardLabel}>DISTANCE</Text>
          </View>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricLargeNumber}>{distanceKm}</Text>
            <Text style={styles.metricUnit}>km</Text>
          </View>
        </View>

        {/* Metric 2: Avg Pace */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#0284C71A' }]}>
              <Gauge size={16} color="#0284C7" />
            </View>
            <Text style={styles.metricCardLabel}>AVG PACE</Text>
          </View>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricLargeNumber}>{formatPace(averagePaceMinPerKm)}</Text>
            <Text style={styles.metricUnit}>/km</Text>
          </View>
        </View>

        {/* Metric 3: Steps */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#10B9811A' }]}>
              <Footprints size={16} color="#10B981" />
            </View>
            <Text style={styles.metricCardLabel}>TOTAL STEPS</Text>
          </View>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricLargeNumber}>{steps.toLocaleString()}</Text>
            <Text style={styles.metricUnit}>steps</Text>
          </View>
        </View>

        {/* Metric 4: Est. Calories */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#F59E0B1A' }]}>
              <Flame size={16} color="#F59E0B" />
            </View>
            <Text style={styles.metricCardLabel}>CALORIES</Text>
          </View>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricLargeNumber}>{estimatedCalories}</Text>
            <Text style={styles.metricUnit}>kcal</Text>
          </View>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomArea}>
        <View style={styles.controlsRow}>
          {/* Pause / Resume Button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isPaused ? styles.resumeBtn : styles.pauseBtn,
            ]}
            onPress={handlePauseResume}
            activeOpacity={0.85}
          >
            {isPaused ? (
              <>
                <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.btnText}>RESUME</Text>
              </>
            ) : (
              <>
                <Pause size={22} color="#FFFFFF" />
                <Text style={styles.btnText}>PAUSE</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Stop / Finish Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.stopBtn]}
            onPress={handleStop}
            activeOpacity={0.85}
          >
            <Square size={20} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.btnText}>FINISH</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ContextualPermissionModal
        visible={showLocationModal}
        permissionType="location"
        onGranted={() => {
          setShowLocationModal(false);
          startWalking('Outdoor Walk');
        }}
        onDismiss={() => {
          setShowLocationModal(false);
          safeGoBack('/walking');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0D14',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  minimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  minimizeText: {
    ...typography.caption,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  pulseDotPaused: {
    backgroundColor: '#F59E0B',
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  gpsText: {
    ...typography.caption,
    color: '#10B981',
    fontWeight: '700',
    fontSize: 11,
  },
  heroTimerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timerHeaderLabel: {
    ...typography.caption,
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  timerDisplay: {
    fontSize: 56,
    lineHeight: 68,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
    marginVertical: 4,
  },
  timerDisplayLong: {
    fontSize: 44,
    lineHeight: 54,
    letterSpacing: 0.8,
  },
  speedSubRow: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speedSubText: {
    ...typography.caption,
    color: '#94A3B8',
    fontSize: 12,
  },
  speedSubHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 8,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardLabel: {
    ...typography.caption,
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  metricLargeNumber: {
    ...typography.h1,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    ...typography.caption,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
  },
  bottomArea: {
    marginTop: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  pauseBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  resumeBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
  },
  stopBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.35,
  },
  btnText: {
    ...typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontSize: 15,
  },
});
