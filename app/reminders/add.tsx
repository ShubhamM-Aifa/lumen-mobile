import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { ScreenTopBar, HeaderTextButton } from '../../src/components/ios/ScreenTopBar';
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenTopBar
          title="Add Reminder"
          sheet
          backLabel="Back"
          onBack={() => safeGoBack('/reminders')}
          right={<HeaderTextButton label="Save" accessibilityLabel="Save reminder" prominent onPress={handleSave} />}
        />

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
                {scheduleType === st.value ? <Check size={18} color={palette.primaryText} /> : null}
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
          <AppleSwitch
            value={enabled}
            onValueChange={setEnabled}
            activeColor={palette.success || '#34C759'}
            accessibilityLabel="Enable Reminder Now"
          />
        </View>

        <View style={{ height: 60 }} />
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
  content: {
    flex: 1,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 18 },
  section: { gap: 7 },
  label: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 4 },
  subLabel: { ...typography.footnote, color: palette.textSecondary, marginBottom: 4 },
  textInput: {
    ...typography.bodyLarge,
    backgroundColor: palette.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 48,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipActive: { backgroundColor: palette.tint + '33' },
  iconEmoji: {
    fontSize: 24,
  },
  chipsRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: palette.primary },
  chipText: { ...typography.subhead, color: palette.text },
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
    paddingHorizontal: 16,
    minHeight: 52,
    borderRadius: 22,
  },
  scheduleTypeCardActive: { backgroundColor: palette.tint + '1F' },
  scheduleTypeTitle: { ...typography.bodyLarge, color: palette.text },
  scheduleTypeTitleActive: { fontWeight: '600', color: palette.primaryText },
  configBox: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 12 },
  boxTitle: { ...typography.headline, color: palette.text },
  boxHint: { ...typography.footnote, color: palette.textSecondary },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  smallInput: {
    ...typography.bodyLarge,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 10,
    minHeight: 44,
    textAlign: 'center',
    color: palette.text,
  },
  minuteSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.surfaceAlt,
  },
  minChipActive: { backgroundColor: palette.success + '2E' },
  minChipText: { ...typography.headline, color: palette.text },
  minChipTextActive: { color: palette.successText },
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
  },
  dayCircleActive: { backgroundColor: palette.primary },
  dayCircleText: { ...typography.subheadBold, color: palette.textSecondary },
  dayCircleTextActive: { color: '#FFFFFF' },
  snoozeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  snoozeChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.surface,
  },
  snoozeChipActive: { backgroundColor: palette.primary },
  snoozeChipText: { ...typography.subheadBold, color: palette.textSecondary },
  snoozeChipTextActive: { color: '#FFFFFF' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 26,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  toggleLabel: { ...typography.bodyLarge, color: palette.text },
}));
