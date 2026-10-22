import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { ChevronLeft, Check } from 'lucide-react-native';
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

export default function AddReminderScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { addReminder } = useReminderStore();
  const { config } = useConfigStore();

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
  const [message, setMessage] = useState('Time to hydrate and stretch');
  const [snooze, setSnooze] = useState(10);
  const [sound, setSound] = useState('default');
  const [linkedQuickActionId, setLinkedQuickActionId] = useState<string | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await addReminder({
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack('/reminders')}>
          <ChevronLeft size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Reminder</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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

        {/* Linked Quick Action */}
        <View style={styles.section}>
          <Text style={styles.label}>Link to Quick Action (Optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, !linkedQuickActionId && styles.chipActive]}
              onPress={() => setLinkedQuickActionId(undefined)}
            >
              <Text style={[styles.chipText, !linkedQuickActionId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {(config?.quickActions || []).map(qa => (
              <TouchableOpacity
                key={qa._id}
                style={[styles.chip, linkedQuickActionId === qa._id && styles.chipActive]}
                onPress={() => setLinkedQuickActionId(qa._id)}
              >
                <Text style={[styles.chipText, linkedQuickActionId === qa._id && styles.chipTextActive]}>
                  {qa.icon} {qa.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Enabled Toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Enable Reminder Now</Text>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: palette.border, true: palette.secondary }}
            thumbColor={palette.surface}
          />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

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
    ...typography.h2,
    color: palette.text,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: palette.primary,
    borderRadius: 8,
  },
  saveBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  label: {
    ...typography.h3,
    fontSize: 14,
    color: palette.text,
  },
  subLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    ...typography.body,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
  },
  iconScroll: {
    gap: 10,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipActive: {
    borderColor: palette.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  iconEmoji: {
    fontSize: 24,
  },
  chipsRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  scheduleTypesCol: {
    gap: 8,
  },
  scheduleTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scheduleTypeCardActive: {
    borderColor: palette.primary,
    backgroundColor: 'rgba(255, 107, 53, 0.04)',
  },
  scheduleTypeTitle: {
    ...typography.body,
    color: palette.text,
  },
  scheduleTypeTitleActive: {
    fontWeight: '700',
    color: palette.primary,
  },
  configBox: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  boxTitle: {
    ...typography.h3,
    fontSize: 14,
    color: palette.text,
  },
  boxHint: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  smallInput: {
    ...typography.body,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    color: palette.text,
  },
  minuteSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  minChipActive: {
    borderColor: palette.secondary,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  minChipText: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  minChipTextActive: {
    color: palette.secondary,
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
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary,
  },
  dayCircleText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  dayCircleTextActive: {
    color: '#09090E',
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  snoozeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  snoozeChipActive: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  snoozeChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  snoozeChipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '600',
    color: palette.text,
  },
}));
