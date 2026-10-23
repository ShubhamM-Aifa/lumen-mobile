/**
 * Edit Reminder Screen
 * Allows editing all properties of an existing reminder:
 * - Name, Icon, Category, Schedule Type (Daily, Interval, Inactivity, Custom Days, One Time)
 * - Timing windows, frequencies, days of week
 * - Notification message, snooze duration, linked quick actions, and enabled state
 * - Direct Archive / Delete action
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { ChevronLeft, Check, Trash2, BellRing } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useReminderStore } from '../../src/store/reminderStore';
import { useConfigStore } from '../../src/store/configStore';
import { ReminderCategory, ReminderScheduleType, WeekDay } from '@lumen/shared';
import { SoundPicker } from '../../src/components/SoundPicker';
import { IconPicker } from '../../src/components/customize/IconPicker';
import { permissionService } from '../../src/services/permissionService';
import { ContextualPermissionModal } from '../../src/components/permissions/ContextualPermissionModal';

const ICONS = ['💧', '🚶', '😴', '🧍', '💊', '🧘', '🥗', '☕', '⏰', '🩺', '✨'];

const CATEGORIES: Array<{ label: string; value: ReminderCategory }> = [
  { label: 'Hydration', value: 'HYDRATION' },
  { label: 'Movement', value: 'MOVEMENT' },
  { label: 'Exercise', value: 'EXERCISE' },
  { label: 'Sleep', value: 'SLEEP' },
  { label: 'Food', value: 'FOOD' },
  { label: 'Medication', value: 'MEDICATION' },
  { label: 'Wellness', value: 'WELLNESS' },
  { label: 'Custom', value: 'CUSTOM' },
];

const SCHEDULE_TYPES: Array<{ label: string; value: ReminderScheduleType }> = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Interval (e.g. every hour)', value: 'INTERVAL' },
  { label: 'Inactivity (Sitting)', value: 'INACTIVITY' },
  { label: 'Custom Days', value: 'CUSTOM_DAYS' },
  { label: 'One Time', value: 'ONE_TIME' },
];

const WEEKDAYS: Array<{ label: string; value: WeekDay }> = [
  { label: 'M', value: 'MON' },
  { label: 'T', value: 'TUE' },
  { label: 'W', value: 'WED' },
  { label: 'T', value: 'THU' },
  { label: 'F', value: 'FRI' },
  { label: 'S', value: 'SAT' },
  { label: 'S', value: 'SUN' },
];

const SNOOZE_OPTIONS = [5, 10, 15, 30];

export default function EditReminderScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reminders, updateReminder, deleteReminder } = useReminderStore();
  const { config } = useConfigStore();

  const reminder = reminders.find(r => r._id === id || r.clientId === id);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💧');
  const [category, setCategory] = useState<ReminderCategory>('HYDRATION');
  const [scheduleType, setScheduleType] = useState<ReminderScheduleType>('INTERVAL');

  // Times
  const [time, setTime] = useState('09:00');
  const [windowStart, setWindowStart] = useState('08:00');
  const [windowEnd, setWindowEnd] = useState('22:00');
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [inactivityMinutes, setInactivityMinutes] = useState('45');
  const [selectedDays, setSelectedDays] = useState<WeekDay[]>(['MON', 'WED', 'FRI']);

  // Content & Snooze & Sound
  const [message, setMessage] = useState('');
  const [snooze, setSnooze] = useState(10);
  const [sound, setSound] = useState(reminder?.sound || 'default');
  const [linkedQuickActionId, setLinkedQuickActionId] = useState<string | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (reminder) {
      setName(reminder.name || '');
      setIcon(reminder.icon || '💧');
      setCategory(reminder.category || 'HYDRATION');
      setScheduleType(reminder.scheduleType || 'DAILY');
      setTime(reminder.targetTime || reminder.schedule || '09:00');
      setWindowStart(reminder.windowStartTime || '08:00');
      setWindowEnd(reminder.windowEndTime || '22:00');
      setIntervalMinutes(String(reminder.intervalMinutes || 60));
      setInactivityMinutes(String(reminder.inactivityThresholdMinutes || reminder.inactivityMinutes || 45));
      setSelectedDays(reminder.daysOfWeek && reminder.daysOfWeek.length > 0 ? reminder.daysOfWeek : ['MON', 'WED', 'FRI']);
      setMessage(reminder.notificationMessage || reminder.message || '');
      setSnooze(reminder.snoozeDurationMinutes || 10);
      setSound(reminder.sound || 'default');
      setLinkedQuickActionId(reminder.linkedQuickActionId);
      setEnabled(reminder.enabled !== undefined ? reminder.enabled : true);
    }
  }, [reminder]);

  if (!reminder) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack('/reminders')}>
            <ChevronLeft size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reminder Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.notFoundCenter}>
          <Text style={styles.notFoundText}>This reminder could not be found or was deleted.</Text>
          <TouchableOpacity style={styles.notFoundBtn} onPress={() => safeGoBack('/reminders')}>
            <Text style={styles.notFoundBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const toggleDay = (day: WeekDay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const [showNotifModal, setShowNotifModal] = useState(false);

  const performSave = async () => {
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await updateReminder(reminder._id, {
        name: name.trim(),
        icon,
        category,
        scheduleType,
        targetTime: time,
        windowStartTime: windowStart,
        windowEndTime: windowEnd,
        intervalMinutes: parseInt(intervalMinutes, 10) || 60,
        inactivityThresholdMinutes: parseInt(inactivityMinutes, 10) || 45,
        daysOfWeek: selectedDays,
        notificationMessage: message.trim() || `Time for ${name.trim()}`,
        snoozeDurationMinutes: snooze,
        sound,
        linkedQuickActionId,
        enabled,
      });

      safeGoBack('/reminders');
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Reminder Name Required', 'Please enter a name for your reminder.');
      return;
    }

    if (enabled) {
      const notifStatus = await permissionService.checkPermission('notifications');
      if (!notifStatus.granted) {
        setShowNotifModal(true);
        return;
      }
    }

    await performSave();
  };

  const handleDelete = () => {
    Alert.alert(
      'Archive Reminder',
      `Archive "${reminder.name}"? You can view or restore it later in the Archived tab.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await deleteReminder(reminder._id);
            safeGoBack('/reminders');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack('/reminders')}>
            <ChevronLeft size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Reminder</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Reminder Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Reminder Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Drink Water, Stand Up, Walk"
            placeholderTextColor={palette.placeholder}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Icon Picker */}
        <View style={styles.section}>
          <IconPicker value={icon} onChange={setIcon} label="Select Icon" />
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.chip, category === cat.value && styles.chipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Schedule Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Schedule Type</Text>
          <View style={styles.scheduleTypesCol}>
            {SCHEDULE_TYPES.map(st => (
              <TouchableOpacity
                key={st.value}
                style={[styles.scheduleTypeCard, scheduleType === st.value && styles.scheduleTypeCardActive]}
                onPress={() => setScheduleType(st.value)}
              >
                <Text style={[styles.scheduleTypeTitle, scheduleType === st.value && styles.scheduleTypeTitleActive]}>
                  {st.label}
                </Text>
                {scheduleType === st.value ? <Check size={18} color={palette.primary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Schedule Parameters */}
        {scheduleType === 'INTERVAL' ? (
          <View style={styles.configBox}>
            <Text style={styles.boxTitle}>Interval Configuration</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.subLabel}>Active Start</Text>
                <TextInput
                  style={styles.smallInput}
                  value={windowStart}
                  onChangeText={setWindowStart}
                  placeholder="08:00"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.subLabel}>Active End</Text>
                <TextInput
                  style={styles.smallInput}
                  value={windowEnd}
                  onChangeText={setWindowEnd}
                  placeholder="22:00"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.subLabel}>Every (mins)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={intervalMinutes}
                  onChangeText={setIntervalMinutes}
                  keyboardType="numeric"
                  placeholder="60"
                />
              </View>
            </View>
          </View>
        ) : null}

        {scheduleType === 'INACTIVITY' ? (
          <View style={styles.configBox}>
            <Text style={styles.boxTitle}>Inactivity Rule</Text>
            <Text style={styles.boxHint}>Remind me if I sit continuously without moving for:</Text>
            <View style={styles.minuteSelectRow}>
              {[30, 45, 60, 90].map(mins => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.minChip, inactivityMinutes === String(mins) && styles.minChipActive]}
                  onPress={() => setInactivityMinutes(String(mins))}
                >
                  <Text style={[styles.minChipText, inactivityMinutes === String(mins) && styles.minChipTextActive]}>
                    {mins}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {scheduleType === 'DAILY' || scheduleType === 'ONE_TIME' ? (
          <View style={styles.section}>
            <Text style={styles.label}>Time (24-hr format)</Text>
            <TextInput
              style={styles.textInput}
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 07:00 or 19:30"
              placeholderTextColor={palette.placeholder}
            />
          </View>
        ) : null}

        {scheduleType === 'CUSTOM_DAYS' ? (
          <View style={styles.section}>
            <Text style={styles.label}>Repeat On Days</Text>
            <View style={styles.daysRow}>
              {WEEKDAYS.map(d => {
                const isSelected = selectedDays.includes(d.value);
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                    onPress={() => toggleDay(d.value)}
                  >
                    <Text style={[styles.dayCircleText, isSelected && styles.dayCircleTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Notification Message */}
        <View style={styles.section}>
          <Text style={styles.label}>Notification Message</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Time to drink a glass of water"
            placeholderTextColor={palette.placeholder}
            value={message}
            onChangeText={setMessage}
          />
        </View>

        {/* Snooze Duration */}
        <View style={styles.section}>
          <Text style={styles.label}>Snooze Duration</Text>
          <View style={styles.snoozeRow}>
            {SNOOZE_OPTIONS.map(mins => (
              <TouchableOpacity
                key={mins}
                style={[styles.snoozeChip, snooze === mins && styles.snoozeChipActive]}
                onPress={() => setSnooze(mins)}
              >
                <Text style={[styles.snoozeChipText, snooze === mins && styles.snoozeChipTextActive]}>
                  {mins} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Alarm Sound Picker */}
        <SoundPicker value={sound} onChange={setSound} />

        {/* Link with Quick-Tap Button */}
        {config?.quickActions && config.quickActions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>Link with Quick-Tap Button (Optional)</Text>
            <Text style={styles.subDesc}>
              Allows logging directly from the interactive notification lock screen button.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.chip, linkedQuickActionId === undefined && styles.chipActive]}
                onPress={() => setLinkedQuickActionId(undefined)}
              >
                <Text style={[styles.chipText, linkedQuickActionId === undefined && styles.chipTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
              {config.quickActions.map(qa => (
                <TouchableOpacity
                  key={qa._id}
                  style={[styles.chip, linkedQuickActionId === qa._id && styles.chipActive]}
                  onPress={() => setLinkedQuickActionId(qa._id)}
                >
                  <Text style={styles.chipEmoji}>{qa.icon}</Text>
                  <Text style={[styles.chipText, linkedQuickActionId === qa._id && styles.chipTextActive]}>
                    {qa.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Active Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Enable Alarm</Text>
            <Text style={styles.toggleSub}>Active alarms trigger notifications & sound</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: palette.border, true: palette.secondary }}
            thumbColor={palette.surface}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.bottomSaveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.bottomSaveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Archive / Delete Button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={16} color={palette.error} />
          <Text style={styles.deleteBtnText}>Archive This Reminder</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <ContextualPermissionModal
        visible={showNotifModal}
        permissionType="notifications"
        onGranted={async () => {
          setShowNotifModal(false);
          await performSave();
        }}
        onDismiss={() => setShowNotifModal(false)}
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
    ...typography.h3,
    fontSize: 18,
    color: palette.text,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.body,
    color: palette.text,
  },
  iconScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  iconChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary + '18',
    borderWidth: 2,
  },
  iconEmoji: {
    fontSize: 22,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipEmoji: {
    fontSize: 16,
  },
  scheduleTypesCol: {
    gap: 8,
  },
  scheduleTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  scheduleTypeCardActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary + '10',
    borderWidth: 1.5,
  },
  scheduleTypeTitle: {
    ...typography.body,
    fontWeight: '600',
    color: palette.text,
  },
  scheduleTypeTitleActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  configBox: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  boxTitle: {
    ...typography.bodyBold,
    color: palette.text,
  },
  boxHint: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputCol: {
    flex: 1,
    gap: 4,
  },
  subLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  smallInput: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...typography.body,
    color: palette.text,
    textAlign: 'center',
  },
  minuteSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  minChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  minChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
  minChipTextActive: {
    color: '#FFFFFF',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  dayCircleActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  dayCircleText: {
    ...typography.bodyBold,
    color: palette.text,
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  snoozeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  snoozeChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  snoozeChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
  snoozeChipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  toggleLabel: {
    ...typography.bodyBold,
    color: palette.text,
  },
  toggleSub: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  bottomSaveBtn: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  bottomSaveBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.error + '12',
    borderWidth: 1,
    borderColor: palette.error + '30',
  },
  deleteBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.error,
  },
  notFoundCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  notFoundText: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  notFoundBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: palette.primary,
  },
  notFoundBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
}));
