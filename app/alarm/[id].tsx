/**
 * Full-Screen Lock-Screen Alarm & Reminder Screen for Lumen
 * - Designed to display when a scheduled reminder triggers (even over lock screen).
 * - Live clock with seconds and date.
 * - Pulsing glowing concentric aura ring animation.
 * - Continuous alarm vibration pattern.
 * - Direct "Snooze 10m", "Log / Complete", and "Dismiss" buttons.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell, Check, Clock, Volume2, X } from 'lucide-react-native';

import { useReminderStore } from '../../src/store/reminderStore';
import { useQuickLogStore } from '../../src/store/quickLogStore';
import { snoozeReminder } from '../../src/services/notifications';
import { startAlarmSound, stopSound, getSoundOption } from '../../src/services/soundService';
import { api } from '../../src/api/client';
import { palette } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

const CATEGORY_COLORS: Record<string, string> = {
  HYDRATION: '#4ECDC4',
  MOVEMENT: '#FF6B35',
  EXERCISE: '#FF6B35',
  SLEEP: '#8B5CF6',
  MEDICATION: '#AB47BC',
  SYMPTOM: '#E57373',
  CUSTOM: '#FF6B35',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  HYDRATION: '💧',
  MOVEMENT: '🧍',
  EXERCISE: '🚶',
  SLEEP: '😴',
  MEDICATION: '💊',
  SYMPTOM: '🩺',
  CUSTOM: '🔔',
};

export default function AlarmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reminders } = useReminderStore();
  const reminder = reminders.find(r => r._id === id);

  const [currentTime, setCurrentTime] = useState(new Date());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const auraAnim = useRef(new Animated.Value(0.4)).current;
  const isDismissedRef = useRef(false);

  const categoryColor = reminder?.category ? (CATEGORY_COLORS[reminder.category] || palette.primary) : palette.primary;
  const categoryEmoji = reminder?.icon || (reminder?.category ? CATEGORY_EMOJIS[reminder.category] : '🔔') || '🔔';

  // Live digital clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Continuous pulsating visual animation
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(auraAnim, {
            toValue: 0.9,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auraAnim, {
            toValue: 0.35,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, auraAnim]);

  // Continuous alarm sound playback
  useEffect(() => {
    const soundKey = reminder?.sound || 'default';
    startAlarmSound(soundKey);

    return () => {
      stopSound().catch(() => {});
    };
  }, [reminder?.sound]);

  // Continuous alarm vibration pattern (until dismissed or snoozed)
  useEffect(() => {
    const triggerHaptics = () => {
      if (isDismissedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };

    triggerHaptics();
    const interval = setInterval(triggerHaptics, 1400);

    return () => {
      isDismissedRef.current = true;
      clearInterval(interval);
    };
  }, []);

  // Action: Snooze 10 minutes
  const handleSnooze = async () => {
    isDismissedRef.current = true;
    await stopSound().catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (id) {
      await snoozeReminder(id, 10).catch(() => {});
      api.post(`/reminders/${id}/event`, {
        status: 'SNOOZED',
        actionTaken: 'snooze_10',
      }).catch(() => {});
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/today');
    }
  };

  // Action: Complete / Log
  const handleComplete = async () => {
    isDismissedRef.current = true;
    await stopSound().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (reminder?.linkedQuickActionId) {
      useQuickLogStore.getState().tap(reminder.linkedQuickActionId);
    }

    if (id) {
      api.post(`/reminders/${id}/event`, {
        status: 'COMPLETED',
        actionTaken: 'alarm_complete_tap',
      }).catch(() => {});
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/today');
    }
  };

  // Action: Dismiss
  const handleDismiss = () => {
    isDismissedRef.current = true;
    stopSound().catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (id) {
      api.post(`/reminders/${id}/event`, {
        status: 'DISMISSED',
        actionTaken: 'alarm_dismiss_tap',
      }).catch(() => {});
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/today');
    }
  };

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0907" />

      {/* Top Bar with Live Indicator */}
      <View style={styles.topBar}>
        <View style={styles.liveBadge}>
          <Volume2 size={16} color={categoryColor} />
          <Text style={[styles.liveText, { color: categoryColor }]}>ALARM ACTIVE</Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Alarm"
        >
          <X size={20} color="#E8E0D8" />
        </TouchableOpacity>
      </View>

      {/* Clock Header */}
      <View style={styles.clockSection}>
        <Text style={styles.clockText}>{timeString}</Text>
        <Text style={styles.dateText}>{dateString}</Text>
      </View>

      {/* Pulsing Icon Centerpiece */}
      <View style={styles.iconContainer}>
        {/* Outer Aura Ring */}
        <Animated.View
          style={[
            styles.auraRing,
            {
              borderColor: categoryColor,
              transform: [{ scale: pulseAnim }],
              opacity: auraAnim,
            },
          ]}
        />
        {/* Middle Pulse Ring */}
        <Animated.View
          style={[
            styles.middleRing,
            {
              backgroundColor: `${categoryColor}25`,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        {/* Center Icon Box */}
        <View style={[styles.iconCircle, { borderColor: categoryColor }]}>
          <Text style={styles.emojiText}>{categoryEmoji}</Text>
        </View>
      </View>

      {/* Reminder Details */}
      <View style={styles.infoSection}>
        <Text style={styles.reminderTitle}>
          {reminder?.name || 'Scheduled Reminder'}
        </Text>
        <Text style={styles.reminderMessage}>
          {reminder?.notificationMessage || reminder?.message || 'Time to complete your wellness check-in.'}
        </Text>
        {reminder?.sound && reminder.sound !== 'default' && (
          <View style={styles.soundBadge}>
            <Volume2 size={13} color="#FFFFFF99" />
            <Text style={styles.soundBadgeText}>
              {getSoundOption(reminder.sound).icon} {getSoundOption(reminder.sound).label}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Action Controls */}
      <View style={styles.actionsContainer}>
        {/* Snooze Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.snoozeBtn]}
          onPress={handleSnooze}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Snooze 10 minutes"
        >
          <Clock size={20} color="#FFFFFF" />
          <Text style={styles.snoozeBtnText}>Snooze 10m</Text>
        </TouchableOpacity>

        {/* Complete / Quick Log Button */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.completeBtn, { backgroundColor: categoryColor }]}
          onPress={handleComplete}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Complete Reminder"
        >
          <Check size={20} color="#FFFFFF" strokeWidth={3} />
          <Text style={styles.completeBtnText}>
            {reminder?.category === 'HYDRATION' ? 'Drink & Log' : 'Done'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dismiss Slide / Tap Footer */}
      <TouchableOpacity
        style={styles.dismissFooter}
        onPress={handleDismiss}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Dismiss Alarm"
      >
        <Text style={styles.dismissFooterText}>Tap to Dismiss</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0C0A',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'android' ? 12 : 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  liveText: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 11,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  clockText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  dateText: {
    ...typography.body,
    color: '#A0968C',
    marginTop: 4,
    fontSize: 15,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    marginVertical: 10,
  },
  auraRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
  },
  middleRing: {
    position: 'absolute',
    width: 135,
    height: 135,
    borderRadius: 70,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E1914',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  emojiText: {
    fontSize: 44,
  },
  infoSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  reminderTitle: {
    ...typography.h2,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  reminderMessage: {
    ...typography.body,
    fontSize: 15,
    color: '#C4B8AE',
    textAlign: 'center',
    lineHeight: 22,
  },
  soundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF14',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF22',
  },
  soundBadgeText: {
    ...typography.caption,
    color: '#E8E0D8',
    fontWeight: '600',
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  snoozeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  snoozeBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 16,
  },
  completeBtn: {
    backgroundColor: palette.primary,
  },
  completeBtnText: {
    ...typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 16,
  },
  dismissFooter: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: Platform.OS === 'android' ? 36 : 14,
  },
  dismissFooterText: {
    ...typography.caption,
    color: '#8A8075',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
