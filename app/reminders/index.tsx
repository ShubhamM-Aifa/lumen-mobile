import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { Plus, Bell, Clock, Trash2, Copy, ChevronLeft, RotateCcw, BellRing, Edit2, AlertTriangle, CloudSun, X, Footprints, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useReminderStore } from '../../src/store/reminderStore';
import { useWeatherStore } from '../../src/store/weatherStore';
import { useActivityStore } from '../../src/store/activityStore';
import {
  sendTestReminderNotification,
  getLastNotificationError,
  getAlarmDeliveryCapabilities,
} from '../../src/services/notifications';
import { openExactAlarmSettings, openFullScreenIntentSettings } from '../../src/services/alarmScheduler';
import { IReminder, ReminderCategory } from '@lumen/shared';
import { permissionService } from '../../src/services/permissionService';
import { ContextualPermissionModal } from '../../src/components/permissions/ContextualPermissionModal';
import { WeatherReportModal } from '../../src/components/weather/WeatherReportModal';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { FilterChip } from '../../src/components/ios/FilterChip';
import { InsetGroup, GroupedRow } from '../../src/components/ios/InsetGroup';

const TAB_SPACE = 24;

type ReminderTabValue = ReminderCategory | 'ALL' | 'ALERTS' | 'ARCHIVED';

const CATEGORY_TABS: Array<{ label: string; value: ReminderTabValue }> = [
  { label: 'All', value: 'ALL' },
  { label: '🚨 Clinical Alerts', value: 'ALERTS' },
  { label: 'Hydration', value: 'HYDRATION' },
  { label: 'Movement', value: 'MOVEMENT' },
  { label: 'Sleep', value: 'SLEEP' },
  { label: 'Meds', value: 'MEDICATION' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export default function RemindersScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const {
    reminders,
    isLoading,
    fetchReminders,
    toggleReminder,
    deleteReminder,
    unarchiveReminder,
    permanentDeleteReminder,
    duplicateReminder,
    snooze,
    purgeGhostReminders,
  } = useReminderStore();
  const { activeFlareAlert, dismissFlareAlert } = useWeatherStore();
  const { activePacingAlert, dismissPacingAlert } = useActivityStore();

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRemindersOnly = mode === 'reminders';

  const [selectedCategory, setSelectedCategory] = useState<ReminderTabValue>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);

  const availableTabs = React.useMemo(() => {
    if (isRemindersOnly) {
      return CATEGORY_TABS.filter(t => t.value !== 'ALERTS');
    }
    return CATEGORY_TABS;
  }, [isRemindersOnly]);

  useEffect(() => {
    if (isRemindersOnly && selectedCategory === 'ALERTS') {
      setSelectedCategory('ALL');
    }
  }, [isRemindersOnly, selectedCategory]);

  useEffect(() => {
    fetchReminders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReminders();
    setRefreshing(false);
  };

  const [isTestingAlarm, setIsTestingAlarm] = useState(false);
  const [isPurgingAlarms, setIsPurgingAlarms] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const handlePurgeStaleAlarms = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPurgingAlarms(true);
    try {
      await purgeGhostReminders();
      await fetchReminders();
      Alert.alert(
        'Alarms Cleaned & Resynced',
        'All rogue, ghost notifications and background alarms have been purged. Only your active reminders are now scheduled.'
      );
    } catch {
      Alert.alert('Notice', 'Alarms resynced with active reminders.');
    } finally {
      setIsPurgingAlarms(false);
    }
  };

  const runTestAlarm = async () => {
    const capabilities = await getAlarmDeliveryCapabilities();
    if (!capabilities.exactAlarmsAllowed) {
      Alert.alert(
        'Allow Alarms & Reminders',
        'Android has blocked exact alarms for Lumen. Enable “Alarms & reminders” so scheduled reminders ring on time, then run the test again.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { openExactAlarmSettings().catch(() => {}); } },
        ],
      );
      return;
    }
    if (!capabilities.fullScreenIntentAllowed) {
      Alert.alert(
        'Allow Full-Screen Alarms',
        'Android has blocked Lumen from showing alarms over the lock screen. Enable “Full-screen notifications” for Lumen, then run the test again.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { openFullScreenIntentSettings().catch(() => {}); } },
        ],
      );
      return;
    }
    setIsTestingAlarm(true);
    const success = await sendTestReminderNotification();
    setIsTestingAlarm(false);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🔔 Alarm Test Triggered',
        'Your reminder alarm is firing with sound and vibration! You can lock your phone or leave the app open.',
        [{ text: 'Got it!' }]
      );
    } else {
      const errorMsg = getLastNotificationError();
      Alert.alert(
        'Test Failed',
        errorMsg
          ? `Could not trigger test alarm:\n\n${errorMsg}`
          : 'Could not schedule test alarm. Ensure notification permissions are granted in phone settings.'
      );
    }
  };

  const handleTestAlarm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const notifStatus = await permissionService.checkPermission('notifications');
    if (!notifStatus.granted) {
      setShowNotifModal(true);
      return;
    }
    await runTestAlarm();
  };

  const handleToggle = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const item = reminders.find(r => r._id === id);
    if (item && !item.enabled) {
      const notifStatus = await permissionService.checkPermission('notifications');
      if (!notifStatus.granted) {
        setPendingToggleId(id);
        setShowNotifModal(true);
        return;
      }
    }
    toggleReminder(id);
  };

  const handleDelete = (reminder: IReminder) => {
    Alert.alert(
      'Archive Reminder',
      `Archive "${reminder.name}"? You can view or restore it in the Archived tab.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteReminder(reminder._id);
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (reminder: IReminder) => {
    Alert.alert(
      'Delete Forever',
      `Permanently remove "${reminder.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            permanentDeleteReminder(reminder._id);
          },
        },
      ]
    );
  };

  const handleRestore = (reminder: IReminder) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    unarchiveReminder(reminder._id);
    Alert.alert('Restored', `Reminder "${reminder.name}" is active again.`);
  };

  const filteredReminders = reminders.filter(r => {
    const isArchived = !!r.archivedAt;
    if (selectedCategory === 'ARCHIVED') return isArchived;
    if (isArchived) return false;
    if (selectedCategory === 'ALL' || selectedCategory === 'ALERTS') return true;
    return r.category === selectedCategory;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'MEDICATION': return palette.catMeds;
      case 'HYDRATION': return palette.tint;
      case 'MOVEMENT': return palette.warning;
      case 'SLEEP': return '#5856D6';
      default: return palette.tint;
    }
  };

  const formatScheduleText = (r: IReminder) => {
    if (r.scheduleType === 'INTERVAL') {
      return `Every ${r.intervalMinutes || 60}m (${r.windowStartTime || '08:00'} – ${r.windowEndTime || '22:00'})`;
    }
    if (r.scheduleType === 'WEEKLY' || r.scheduleType === 'CUSTOM_DAYS') {
      const days = r.daysOfWeek?.join(', ') || 'Selected days';
      return `${days} at ${r.targetTime || '09:00'}`;
    }
    if (r.scheduleType === 'INACTIVITY') {
      return `After ${r.inactivityThresholdMinutes || 45}m inactivity`;
    }
    if (r.scheduleType === 'ONE_TIME') {
      return `Once on ${r.targetDate || 'date'} at ${r.targetTime || '09:00'}`;
    }
    return `Every day at ${r.targetTime || r.schedule || '09:00'}`;
  };

  const activeReminders = reminders.filter(r => !r.archivedAt);
  const onCount = activeReminders.filter(r => r.enabled).length;
  const summaryText =
    activeReminders.length === 0
      ? 'Nothing scheduled yet'
      : `${onCount} on · ${activeReminders.length - onCount} off`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <LargeTitleHeader
          title={isRemindersOnly ? 'Reminders' : 'Alerts & Reminders'}
          subtitle={summaryText}
          leading={
            <GlassCircleButton accessibilityLabel="Back" onPress={() => safeGoBack('/(tabs)/today')}>
              <ChevronLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
          actions={
            <GlassCircleButton accessibilityLabel="Add reminder" onPress={() => router.push('/reminders/add')}>
              <Plus size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {availableTabs.map(tab => (
            <FilterChip
              key={tab.value}
              label={tab.label}
              selected={selectedCategory === tab.value}
              onPress={() => setSelectedCategory(tab.value)}
            />
          ))}
        </ScrollView>

        {/* Active Weather Flare Warning Notification */}
        {!isRemindersOnly && activeFlareAlert && !activeFlareAlert.dismissed && (selectedCategory === 'ALL' || selectedCategory === 'ALERTS') && (
          <View
            style={[
              styles.weatherAlertBanner,
              {
                backgroundColor: (activeFlareAlert.riskLevel === 'high' ? palette.error : palette.warning) + '1F',
              },
            ]}
          >
            <View style={styles.weatherAlertHeader}>
              <View style={styles.weatherAlertTitleRow}>
                <AlertTriangle
                  size={18}
                  color={activeFlareAlert.riskLevel === 'high' ? palette.errorText : palette.warningText}
                />
                <Text
                  style={[
                    styles.weatherAlertTitle,
                    { color: activeFlareAlert.riskLevel === 'high' ? palette.errorText : palette.warningText },
                  ]}
                >
                  {activeFlareAlert.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  dismissFlareAlert();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss weather alert"
              >
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.weatherAlertMessage}>
              {activeFlareAlert.message}
            </Text>

            <TouchableOpacity
              style={styles.weatherAlertDetailBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setWeatherModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="View full weather report"
            >
              <CloudSun size={14} color={palette.primaryText} />
              <Text style={styles.weatherAlertDetailText}>
                View Atmospheric Pressure & UV Report
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Spoon Theory Activity Pacing Alert */}
        {!isRemindersOnly && activePacingAlert && !activePacingAlert.dismissed && (selectedCategory === 'ALL' || selectedCategory === 'ALERTS') && (
          <View
            style={[
              styles.weatherAlertBanner,
              {
                backgroundColor: palette.warning + '1F',
              },
            ]}
          >
            <View style={styles.weatherAlertHeader}>
              <View style={styles.weatherAlertTitleRow}>
                <Footprints size={18} color={palette.warningText} />
                <Text style={[styles.weatherAlertTitle, { color: palette.warningText }]}>
                  Spoon Theory Pacing Alert ({activePacingAlert.distanceKm} km)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  dismissPacingAlert();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss pacing alert"
              >
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.weatherAlertMessage}>
              {activePacingAlert.message}
            </Text>

            <TouchableOpacity
              style={styles.weatherAlertDetailBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/walking');
              }}
              accessibilityRole="button"
              accessibilityLabel="View walking activity"
            >
              <Footprints size={14} color={palette.warningText} />
              <Text style={[styles.weatherAlertDetailText, { color: palette.warningText }]}>
                View Walking Summary
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {filteredReminders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={48} color={palette.placeholder} />
            <Text style={styles.emptyTitle}>No reminders scheduled</Text>
            <Text style={styles.emptySubtitle}>
              Tap the "+" button to set your hydration, movement, or bedtime schedules.
            </Text>
          </View>
        ) : (
          filteredReminders.map(reminder => (
            <View key={reminder._id} style={styles.reminderCard}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => router.push(`/reminders/${reminder._id}`)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Edit reminder ${reminder.name}`}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>{reminder.icon || '⏰'}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.categoryBadge}>
                    <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(reminder.category) }]} />
                    <Text style={styles.categoryBadgeText} maxFontSizeMultiplier={1.3}>
                      {reminder.category}
                    </Text>
                  </View>
                  <Text style={styles.reminderTitle} numberOfLines={1}>
                    {reminder.name}
                  </Text>
                  <Text style={styles.reminderSubtitle} numberOfLines={1}>
                    {formatScheduleText(reminder)}
                  </Text>
                  {reminder.notificationMessage ? (
                    <Text style={styles.reminderMessage} numberOfLines={1}>
                      "{reminder.notificationMessage}"
                    </Text>
                  ) : null}
                </View>

                <AppleSwitch
                  value={reminder.enabled}
                  onValueChange={() => handleToggle(reminder._id)}
                  activeColor={palette.success || '#34C759'}
                  accessibilityLabel={`${reminder.name} reminder on or off`}
                />
              </TouchableOpacity>

              {/* Card Footer Actions */}
              <View style={styles.cardFooter}>
                {reminder.archivedAt ? (
                  <>
                    <TouchableOpacity
                      style={styles.footerAction}
                      onPress={() => handleRestore(reminder)}
                      accessibilityRole="button"
                      accessibilityLabel="Restore reminder"
                    >
                      <RotateCcw size={14} color={palette.secondaryText} />
                      <Text style={[styles.footerActionText, { color: palette.secondaryText }]}>Restore reminder</Text>
                    </TouchableOpacity>

                    <View style={styles.footerRight}>
                      <TouchableOpacity
                        style={styles.footerIconBtn}
                        onPress={() => handlePermanentDelete(reminder)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete forever"
                      >
                        <Trash2 size={16} color={palette.errorText} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.footerAction}
                      onPress={() => snooze(reminder._id, reminder.snoozeDurationMinutes)}
                    >
                      <Clock size={14} color={palette.textSecondary} />
                      <Text style={styles.footerActionText}>Snooze {reminder.snoozeDurationMinutes || 10}m</Text>
                    </TouchableOpacity>

                    <View style={styles.footerRight}>
                      <TouchableOpacity
                        style={styles.footerIconBtn}
                        onPress={() => router.push(`/reminders/${reminder._id}`)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit reminder"
                      >
                        <Edit2 size={16} color={palette.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.footerIconBtn}
                        onPress={() => duplicateReminder(reminder._id)}
                        accessibilityLabel="Duplicate"
                      >
                        <Copy size={16} color={palette.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.footerIconBtn}
                        onPress={() => handleDelete(reminder)}
                        accessibilityLabel="Archive"
                      >
                        <Trash2 size={16} color={palette.errorText} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))
        )}

        {selectedCategory !== 'ARCHIVED' ? (
          <InsetGroup footer="Rings an alarm now so you can check sound, vibration and lock-screen delivery. Use Clean & Resync if any old notifications or ghost alarms persist.">
            <GroupedRow
              icon={BellRing}
              tile={palette.warning}
              label={isTestingAlarm ? 'Testing…' : 'Test Alarm'}
              accessibilityLabel="Test Alarm"
              chevron
              onPress={isTestingAlarm ? undefined : handleTestAlarm}
            />
            <GroupedRow
              icon={RefreshCw}
              tile={palette.tint}
              label={isPurgingAlarms ? 'Cleaning…' : 'Clean & Resync Alarms'}
              accessibilityLabel="Clean & Resync Alarms"
              chevron
              onPress={isPurgingAlarms ? undefined : handlePurgeStaleAlarms}
            />
          </InsetGroup>
        ) : null}

        <View style={{ height: TAB_SPACE }} />
      </ScrollView>

      <ContextualPermissionModal
        visible={showNotifModal}
        permissionType="notifications"
        onGranted={async () => {
          setShowNotifModal(false);
          if (pendingToggleId) {
            toggleReminder(pendingToggleId);
            setPendingToggleId(null);
          } else {
            await runTestAlarm();
          }
        }}
        onDismiss={() => {
          setShowNotifModal(false);
          setPendingToggleId(null);
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

const useStyles = createThemedStyles(palette => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  list: {
    flex: 1,
  },
  listContent: { paddingTop: 6, gap: 14, paddingBottom: 24 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { ...typography.title2, color: palette.text, marginTop: 16 },
  emptySubtitle: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center', marginTop: 6 },
  reminderCard: {
    marginHorizontal: 16,
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  cardInfo: {
    flex: 1,
  },
  reminderTitle: { ...typography.headline, color: palette.text },
  reminderSubtitle: { ...typography.footnote, color: palette.primaryText, fontWeight: '600', marginTop: 2 },
  reminderMessage: { ...typography.footnote, color: palette.textSecondary, fontStyle: 'italic', marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    marginTop: 12,
    paddingTop: 4,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  footerActionText: { ...typography.footnote, color: palette.textSecondary, fontWeight: '600' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  footerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weatherAlertBanner: { marginHorizontal: 16, borderRadius: 26, padding: 16 },
  weatherAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weatherAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  weatherAlertTitle: { ...typography.headline },
  weatherAlertMessage: { ...typography.subhead, color: palette.text, marginBottom: 10 },
  weatherAlertDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 18,
  },
  weatherAlertDetailText: { ...typography.subheadBold, color: palette.primaryText },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginBottom: 2 },
  categoryBadgeText: { ...typography.footnote, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
}));
