import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { Plus, Bell, Clock, RefreshCw, Trash2, Copy, ChevronLeft, RotateCcw, BellRing, Edit2, AlertTriangle, CloudSun, X, Footprints, ShieldAlert } from 'lucide-react-native';
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
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

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
      case 'MEDICATION': return '#8B5CF6';
      case 'HYDRATION': return '#0284C7';
      case 'MOVEMENT': return '#FF6B35';
      case 'SLEEP': return '#6366F1';
      default: return palette.primary;
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => safeGoBack('/(tabs)/today')}
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRemindersOnly ? 'Reminders' : 'Alerts & Reminders'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestAlarm}
            disabled={isTestingAlarm}
            accessibilityRole="button"
            accessibilityLabel="Test Alarm"
          >
            <BellRing size={15} color={palette.primary} />
            <Text style={styles.testBtnText}>{isTestingAlarm ? 'Testing...' : 'Test Alarm'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/reminders/add')}
            accessibilityRole="button"
            accessibilityLabel="Add reminder"
          >
            <Plus size={22} color={palette.surface} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter Tabs */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {availableTabs.map(tab => {
            const isActive = selectedCategory === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedCategory(tab.value)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {/* Active Weather Flare Warning Notification */}
        {!isRemindersOnly && activeFlareAlert && !activeFlareAlert.dismissed && (selectedCategory === 'ALL' || selectedCategory === 'ALERTS') && (
          <View
            style={[
              styles.weatherAlertBanner,
              {
                borderColor: activeFlareAlert.riskLevel === 'high' ? '#EF444450' : '#F59E0B50',
                backgroundColor: activeFlareAlert.riskLevel === 'high' ? '#EF444410' : '#F59E0B10',
              },
            ]}
          >
            <View style={styles.weatherAlertHeader}>
              <View style={styles.weatherAlertTitleRow}>
                <AlertTriangle
                  size={18}
                  color={activeFlareAlert.riskLevel === 'high' ? '#EF4444' : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.weatherAlertTitle,
                    { color: activeFlareAlert.riskLevel === 'high' ? '#EF4444' : '#F59E0B' },
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
              <CloudSun size={14} color={palette.primary} />
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
                borderColor: '#FF6B3550',
                backgroundColor: '#FF6B3510',
              },
            ]}
          >
            <View style={styles.weatherAlertHeader}>
              <View style={styles.weatherAlertTitleRow}>
                <Footprints size={18} color="#FF6B35" />
                <Text style={[styles.weatherAlertTitle, { color: '#FF6B35' }]}>
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
              <Footprints size={14} color="#FF6B35" />
              <Text style={[styles.weatherAlertDetailText, { color: '#FF6B35' }]}>
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
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(reminder.category) + '18' }]}>
                    <Text style={[styles.categoryBadgeText, { color: getCategoryColor(reminder.category) }]}>
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

                <Switch
                  value={reminder.enabled}
                  onValueChange={() => handleToggle(reminder._id)}
                  trackColor={{ false: palette.border, true: palette.secondary }}
                  thumbColor={palette.surface}
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
                      <RotateCcw size={14} color={palette.secondary} />
                      <Text style={[styles.footerActionText, { color: palette.secondary }]}>Restore reminder</Text>
                    </TouchableOpacity>

                    <View style={styles.footerRight}>
                      <TouchableOpacity
                        style={styles.footerIconBtn}
                        onPress={() => handlePermanentDelete(reminder)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete forever"
                      >
                        <Trash2 size={16} color={palette.error} />
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
                        <Trash2 size={16} color={palette.error} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: palette.primary + '16',
    borderWidth: 1,
    borderColor: palette.primary + '40',
  },
  testBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.primary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.divider,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipActive: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  filterChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  filterChipTextActive: {
    color: palette.surface,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...typography.h3,
    color: palette.text,
    marginTop: 16,
  },
  emptySubtitle: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  reminderCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  reminderTitle: {
    ...typography.h3,
    fontSize: 16,
    color: palette.text,
  },
  reminderSubtitle: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  reminderMessage: {
    ...typography.caption,
    color: palette.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: palette.divider,
    marginTop: 14,
    paddingTop: 10,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerActionText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  footerIconBtn: {
    padding: 4,
  },
  weatherAlertBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
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
  weatherAlertTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    fontWeight: '700',
  },
  weatherAlertMessage: {
    ...typography.caption,
    fontSize: 12.5,
    color: palette.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  weatherAlertDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  weatherAlertDetailText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: palette.primary,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  categoryBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
}));
