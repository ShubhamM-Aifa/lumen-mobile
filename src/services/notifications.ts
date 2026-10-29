/**
 * Production Notification & Reminder Service for Lumen.
 * - Manages local notification scheduling (One-time, Daily, Weekly, Custom Days, Interval, Inactivity, Snooze).
 * - Interactive action categories (Water quick log, Start walking, Stand up, Bedtime).
 * - Background action response handling that integrates directly into the Tracking Engine.
 * - Guaranteed Android notification channel initialization with High Importance & Sound.
 * - Test alarm function for instant verification.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { router } from 'expo-router';
import { IReminder, WeekDay } from '@lumen/shared';
import { api } from '../api/client';
import { useQuickLogStore } from '../store/quickLogStore';
import {
  scheduleNativeAlarm,
  cancelNativeAlarm,
  getAlarmCapabilities,
  type AlarmCapabilities,
} from './alarmScheduler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: N?.AndroidNotificationPriority?.MAX ?? 'max',
    }),
  });
} catch {
  // Graceful fallback for environments where expo-notifications is not available
}

const MAPPING_KEY = 'lumen:notif:mapping_v2'; // { reminderId: string[] (notificationIds) }
// Channel settings (notably sound) are immutable after Android creates a channel.
// v4 is deliberately new so installs that created the old silent/default channel
// receive the native alarm audio configuration below.
export const CHANNEL_ID_ALARM = 'lumen_alarm_clock_v4';
export const CHANNEL_ID_CLINICAL = 'lumen_clinical_flare_v2';
export const CHANNEL_ID_HABITS = 'lumen_habits_v2';
export const CHANNEL_ID_PACING = 'lumen_pacing_v2';
// Intelligent-notification channels. Android freezes importance and sound at creation,
// so these are separate from the habits channel above (which is MAX with sound).
export const CHANNEL_ID_SAFETY = 'lumen_safety_v1';        // MAX, alarm audio, bypasses DND
export const CHANNEL_ID_HEADS_UP = 'lumen_heads_up_v1';    // HIGH, default sound, respects DND
export const CHANNEL_ID_INSIGHTS = 'lumen_insights_v1';    // LOW, silent
export const CHANNEL_ID_WALK_ACTIVE = 'lumen_walk_active_v2'; // LOW, silent, public lockscreen for live activity
export const NOTIFICATION_ID_WALK_ACTIVE = 'lumen_active_walk_session';
export const CHANNEL_ID = CHANNEL_ID_ALARM; // Default high-priority alarm channel

export const TRIGGER_TYPES = {
  DATE: N?.SchedulableTriggerInputTypes?.DATE ?? 'date',
  DAILY: N?.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
  WEEKLY: N?.SchedulableTriggerInputTypes?.WEEKLY ?? 'weekly',
  TIME_INTERVAL: N?.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval',
};

let lastNotificationError: string | null = null;
export function getLastNotificationError(): string | null {
  return lastNotificationError;
}

export const NOTIF_CATEGORIES = {
  FLARE: 'lumen_category_flare',
  PACING: 'lumen_category_pacing',
  MEDS: 'lumen_category_meds',
  WATER: 'lumen_category_water',
  WALK: 'lumen_category_walk',
  STAND: 'lumen_category_stand',
  SLEEP: 'lumen_category_sleep',
  DEFAULT: 'lumen_category_default',
};

export const NOTIF_ACTIONS = {
  VIEW_FLARE: 'action_view_flare',
  LOG_SYMPTOM: 'action_log_symptom',
  RESTING_NOW: 'action_resting_now',
  VIEW_WALK: 'action_view_walk',
  MARK_MED_TAKEN: 'action_mark_med_taken',
  LOG_250ML: 'action_log_250ml',
  LOG_500ML: 'action_log_500ml',
  START_WALK: 'action_start_walk',
  IM_MOVING: 'action_im_moving',
  START_SLEEP: 'action_start_sleep',
  SNOOZE_10: 'action_snooze_10',
  SNOOZE_15: 'action_snooze_15',
  SNOOZE_30: 'action_snooze_30',
  DISMISS: 'action_dismiss',
};

/**
 * Configure actionable interactive categories in native OS.
 */
export async function setupNotificationCategories(): Promise<void> {
  if (!N || typeof N.setNotificationCategoryAsync !== 'function') return;

  const createCategorySafe = async (id: string, actions: any[]) => {
    try {
      await N.setNotificationCategoryAsync(id, actions);
    } catch (e) {
      console.warn(`[Notifications] Failed to register category ${id}:`, e);
    }
  };

  try {
    await Promise.allSettled([
      createCategorySafe(NOTIF_CATEGORIES.FLARE, [
        { identifier: NOTIF_ACTIONS.VIEW_FLARE, buttonTitle: 'View Report', options: { opensAppToForeground: true } },
        { identifier: NOTIF_ACTIONS.LOG_SYMPTOM, buttonTitle: 'Log Symptom', options: { opensAppToForeground: true } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.PACING, [
        { identifier: NOTIF_ACTIONS.RESTING_NOW, buttonTitle: 'Resting Now', options: { opensAppToForeground: false } },
        { identifier: NOTIF_ACTIONS.VIEW_WALK, buttonTitle: 'View Walk', options: { opensAppToForeground: true } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.MEDS, [
        { identifier: NOTIF_ACTIONS.MARK_MED_TAKEN, buttonTitle: 'Mark Taken', options: { opensAppToForeground: false } },
        { identifier: NOTIF_ACTIONS.SNOOZE_15, buttonTitle: 'Snooze 15m', options: { opensAppToForeground: false } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.WATER, [
        { identifier: NOTIF_ACTIONS.LOG_250ML, buttonTitle: '+250 ml', options: { opensAppToForeground: false } },
        { identifier: NOTIF_ACTIONS.LOG_500ML, buttonTitle: '+500 ml', options: { opensAppToForeground: false } },
        { identifier: NOTIF_ACTIONS.SNOOZE_30, buttonTitle: 'Snooze 30m', options: { opensAppToForeground: false } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.WALK, [
        { identifier: NOTIF_ACTIONS.START_WALK, buttonTitle: 'Start Walking', options: { opensAppToForeground: true } },
        { identifier: NOTIF_ACTIONS.SNOOZE_15, buttonTitle: 'Snooze 15m', options: { opensAppToForeground: false } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.STAND, [
        { identifier: NOTIF_ACTIONS.IM_MOVING, buttonTitle: "I'm Moving", options: { opensAppToForeground: false } },
        { identifier: NOTIF_ACTIONS.SNOOZE_10, buttonTitle: 'Snooze 10m', options: { opensAppToForeground: false } },
      ]),
      createCategorySafe(NOTIF_CATEGORIES.SLEEP, [
        { identifier: NOTIF_ACTIONS.START_SLEEP, buttonTitle: 'Start Sleep', options: { opensAppToForeground: true } },
        { identifier: NOTIF_ACTIONS.SNOOZE_30, buttonTitle: 'Wind-down +30m', options: { opensAppToForeground: false } },
      ]),
    ]);
  } catch (err) {
    console.warn('[Notifications] Failed to setup categories:', err);
  }
}

/**
 * Ensure dedicated Android notification channels exist:
 * 1. Clinical & Flare Alerts (MAX priority, high-visibility chime, vibration)
 * 2. Daily Habits & Reminders (HIGH priority)
 * 3. Spoon Theory & Activity Pacing (HIGH priority)
 * 4. General Reminders (legacy backwards-compatible fallback)
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (!N || Platform.OS !== 'android' || typeof N.setNotificationChannelAsync !== 'function') return;

  const createChannelSafe = async (id: string, config: any) => {
    try {
      await N.setNotificationChannelAsync(id, config);
    } catch (e) {
      console.warn(`[Notifications] Failed to create channel ${id} with custom config, trying fallback:`, e);
      try {
        // Strip audioAttributes which may throw IllegalArgumentException on Samsung OneUI
        const { audioAttributes, ...fallbackConfig } = config;
        await N.setNotificationChannelAsync(id, fallbackConfig);
      } catch (e2) {
        console.warn(`[Notifications] Fallback channel creation failed for ${id}:`, e2);
      }
    }
  };

  const alarmAudioAttributes = {
    usage: N.AndroidAudioUsage?.ALARM ?? 4,
    contentType: N.AndroidAudioContentType?.SONIFICATION ?? 4,
  };

  try {
    await Promise.allSettled([
      // 1. Dedicated Alarm & Reminder Channel (MAX importance, Alarm Audio Stream, bypass DND, public lockscreen)
      createChannelSafe(CHANNEL_ID_ALARM, {
        name: 'Lumen Alarms & Reminders',
        description: 'Audible alarm ringing and lock-screen popups for health routines and scheduled reminders',
        importance: N.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        sound: 'default',
        enableLights: true,
        lightColor: '#FF6B35',
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
        audioAttributes: {
          usage: N.AndroidAudioUsage?.ALARM ?? 4,
          contentType: N.AndroidAudioContentType?.SONIFICATION ?? 4,
          flags: { enforceAudibility: true },
        },
      }),
      // 2. Clinical Channel (MAX importance, high alert chime & vibration)
      createChannelSafe(CHANNEL_ID_CLINICAL, {
        name: 'Clinical & Flare Alerts',
        description: 'Critical atmospheric pressure drops, extreme UV warnings, and urgent medication timing',
        importance: N.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
        enableLights: true,
        lightColor: '#EF4444',
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
        audioAttributes: alarmAudioAttributes,
      }),
      // 3. Habits & Reminders Channel (MAX importance so it alarms on lock screen)
      createChannelSafe(CHANNEL_ID_HABITS, {
        name: 'Habits & Health Reminders',
        description: 'Scheduled reminders for hydration, movement, and sleep session tracking',
        importance: N.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
        enableLights: true,
        lightColor: '#FF6B35',
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
        audioAttributes: alarmAudioAttributes,
      }),
      // 4. Activity Pacing Channel
      createChannelSafe(CHANNEL_ID_PACING, {
        name: 'Activity Pacing & Spoon Theory',
        description: 'Milestones and post-exertional malaise fatigue prevention advice',
        importance: N.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 300, 150, 300],
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
      }),
      // 5. Safety escalation: only ever carries "contact your care team" messages
      createChannelSafe(CHANNEL_ID_SAFETY, {
        name: 'Safety alerts',
        description: 'Rare messages asking you to contact your care team about a value you logged',
        importance: N.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'default',
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
        audioAttributes: alarmAudioAttributes,
      }),
      // 6. Gentle heads-ups (flare watch). Audible but never overrides Do Not Disturb.
      createChannelSafe(CHANNEL_ID_HEADS_UP, {
        name: 'Gentle heads-ups',
        description: 'Occasional pattern observations from your own logs',
        importance: N.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 150, 250],
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PRIVATE ?? 0,
      }),
      // 7. Quiet insights: check-ins and suggestions, no sound or vibration
      createChannelSafe(CHANNEL_ID_INSIGHTS, {
        name: 'Quiet insights',
        description: 'Silent check-ins and suggestions based on your patterns',
        importance: N.AndroidImportance?.LOW ?? 2,
        sound: null,
        enableVibrate: false,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PRIVATE ?? 0,
      }),
      // 8. Legacy channel alias for backwards compatibility
      createChannelSafe('lumen_reminders_v1', {
        name: 'General Reminders',
        description: 'Lumen daily reminders and health alerts',
        importance: N.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
      }),
      // 9. Ongoing Live Walk Activity (silent, public lockscreen for Samsung / Android)
      createChannelSafe(CHANNEL_ID_WALK_ACTIVE, {
        name: 'Live Walk Activity',
        description: 'Ongoing walk duration, distance, and steps on your lock screen',
        importance: N.AndroidImportance?.LOW ?? 2,
        sound: null,
        enableVibrate: false,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
      }),
    ]);
  } catch (err) {
    console.warn('[Notifications] Failed to ensure Android notification channels:', err);
  }
}

/**
 * Request notification permissions and register the Android channel.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!N) return false;
  try {
    await ensureNotificationChannel();

    const perm = await N.getPermissionsAsync();
    if (perm?.status === 'granted' || perm?.granted === true) {
      await setupNotificationCategories();
      return true;
    }

    const res = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (res?.status !== 'granted' && res?.granted !== true) return false;

    await ensureNotificationChannel();
    await setupNotificationCategories();
    return true;
  } catch (err) {
    console.warn('[Notifications] Error requesting permissions:', err);
    return false;
  }
}

async function loadMapping(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(MAPPING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveMapping(map: Record<string, string[]>): Promise<void> {
  try {
    await AsyncStorage.setItem(MAPPING_KEY, JSON.stringify(map));
  } catch {}
}

const WEEKDAY_TO_NUMBER: Record<WeekDay, number> = {
  SUN: 1,
  MON: 2,
  TUE: 3,
  WED: 4,
  THU: 5,
  FRI: 6,
  SAT: 7,
};

function resolveCategory(category: string): string {
  switch (category) {
    case 'HYDRATION': return NOTIF_CATEGORIES.WATER;
    case 'MOVEMENT': return NOTIF_CATEGORIES.STAND;
    case 'EXERCISE': return NOTIF_CATEGORIES.WALK;
    case 'SLEEP': return NOTIF_CATEGORIES.SLEEP;
    case 'MEDICATION': return NOTIF_CATEGORIES.MEDS;
    default: return NOTIF_CATEGORIES.DEFAULT;
  }
}

function resolveChannel(category: string): string {
  // Always use the alarm channel — it has VISIBILITY_PUBLIC, bypassDnd, and MAX importance
  if (category === 'MEDICATION') return CHANNEL_ID_CLINICAL;
  if (category === 'EXERCISE') return CHANNEL_ID_PACING;
  return CHANNEL_ID_HABITS;
}

function parseTime(timeStr?: string, defaultH = 9, defaultM = 0): { hour: number; minute: number } {
  if (!timeStr) return { hour: defaultH, minute: defaultM };
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return {
    hour: isNaN(h) ? defaultH : Math.min(23, Math.max(0, h)),
    minute: isNaN(m) ? defaultM : Math.min(59, Math.max(0, m)),
  };
}

function toMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function nextOccurrenceAt(timesOfDayMinutes: number[], daysOfWeek?: number[]): number {
  const now = new Date();
  const allowedDays = daysOfWeek && daysOfWeek.length > 0 ? new Set(daysOfWeek) : null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDay = new Date(now);
    candidateDay.setDate(now.getDate() + offset);
    // JS Sunday=0, whereas Android/Expo weekday values use Sunday=1.
    if (allowedDays && !allowedDays.has(candidateDay.getDay() + 1)) continue;
    for (const minuteOfDay of timesOfDayMinutes) {
      const candidate = new Date(candidateDay);
      candidate.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
      if (candidate.getTime() > now.getTime()) return candidate.getTime();
    }
  }
  // A non-empty schedule always has an occurrence within a week. This is a safe fallback.
  return now.getTime() + 24 * 60 * 60 * 1000;
}

/**
 * Schedule a reminder into native notification triggers with sound, vibration, and channels.
 */
export async function scheduleReminder(reminder: IReminder): Promise<void> {
  if (!N) return;

  await ensureNotificationChannel();
  const map = await loadMapping();

  // Cancel any existing scheduled notifications for this reminder ID
  if (map[reminder._id] && Array.isArray(map[reminder._id])) {
    for (const notifId of map[reminder._id]) {
      await N.cancelScheduledNotificationAsync(notifId).catch(() => {});
    }
    delete map[reminder._id];
  }
  // Also cancel any native exact alarm
  await cancelNativeAlarm(reminder._id);

  // If reminder is disabled or archived, save cleared mapping and exit
  if ((!reminder.enabled && reminder.isActive !== true) || !!reminder.archivedAt) {
    await saveMapping(map);
    return;
  }

  const categoryId = resolveCategory(reminder.category);
  const channelId = resolveChannel(reminder.category);
  const scheduledIds: string[] = [];

  const commonContent = {
    title: reminder.notificationTitle || reminder.name,
    body: reminder.notificationMessage || reminder.message || 'Scheduled Reminder',
    data: { reminderId: reminder._id, linkedQuickActionId: reminder.linkedQuickActionId },
    categoryIdentifier: categoryId,
    sound: 'default',
    priority: N?.AndroidNotificationPriority?.MAX ?? 'max',
    vibrate: [0, 500, 250, 500, 250, 500],
    channelId,
    ...(Platform.OS === 'android' ? {
      channelId,
      sticky: false,
      autoDismiss: true,
      fullScreenIntent: true,
      lockscreenVisibility: N?.AndroidNotificationVisibility?.PUBLIC ?? 1,
    } : {}),
  };

  try {
    const scheduleType = reminder.scheduleType || 'DAILY';

    // 1. ONE-TIME
    if (scheduleType === 'ONE_TIME' && (reminder.targetDate || reminder.targetTime)) {
      const dateStr = reminder.targetDate || new Date().toISOString().slice(0, 10);
      const { hour, minute } = parseTime(reminder.targetTime, 9, 0);
      const targetDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);

      if (targetDate.getTime() <= Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const id = await N.scheduleNotificationAsync({
        content: commonContent,
        trigger: {
          type: TRIGGER_TYPES.DATE,
          date: targetDate,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
      });
      scheduledIds.push(id);
      // Schedule native exact alarm for lock-screen delivery
      await scheduleNativeAlarm(
        reminder._id,
        commonContent.title,
        commonContent.body,
        targetDate.getTime(),
      );
    }
    // 2. DAILY
    else if (scheduleType === 'DAILY' || (reminder.type === 'time' && reminder.schedule)) {
      const { hour, minute } = parseTime(reminder.targetTime || reminder.schedule, 9, 0);

      const id = await N.scheduleNotificationAsync({
        content: commonContent,
        trigger: {
          type: TRIGGER_TYPES.DAILY,
          hour,
          minute,
          repeats: true,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
      });
      scheduledIds.push(id);
      // Schedule native exact alarm for today (or tomorrow if time passed)
      await scheduleNativeAlarm(
        reminder._id,
        commonContent.title,
        commonContent.body,
        nextOccurrenceAt([toMinuteOfDay(hour, minute)]),
        { timesOfDayMinutes: [toMinuteOfDay(hour, minute)] },
      );
    }
    // 3. WEEKLY / CUSTOM DAYS
    else if ((scheduleType === 'WEEKLY' || scheduleType === 'CUSTOM_DAYS') && reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
      const { hour, minute } = parseTime(reminder.targetTime, 9, 0);

      for (const day of reminder.daysOfWeek) {
        const weekday = WEEKDAY_TO_NUMBER[day] || 2;
        const id = await N.scheduleNotificationAsync({
          content: {
            ...commonContent,
            body: reminder.notificationMessage || 'Time for your scheduled routine',
          },
          trigger: {
            type: TRIGGER_TYPES.WEEKLY,
            weekday,
            hour,
            minute,
            repeats: true,
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
        });
        scheduledIds.push(id);
      }
      const timeOfDay = toMinuteOfDay(hour, minute);
      const daysOfWeek = reminder.daysOfWeek.map(day => WEEKDAY_TO_NUMBER[day] || 2);
      await scheduleNativeAlarm(
        reminder._id,
        commonContent.title,
        commonContent.body,
        nextOccurrenceAt([timeOfDay], daysOfWeek),
        { timesOfDayMinutes: [timeOfDay], daysOfWeek },
      );
    }
    // 4. INTERVAL (e.g. 08:00 to 22:00 every X minutes)
    else if (scheduleType === 'INTERVAL') {
      const intervalMin = Math.max(15, reminder.intervalMinutes || 60);
      const { hour: startH, minute: startM } = parseTime(reminder.windowStartTime, 8, 0);
      const { hour: endH, minute: endM } = parseTime(reminder.windowEndTime, 22, 0);

      const startTotalMinutes = startH * 60 + startM;
      const endTotalMinutes = endH * 60 + endM;

      const timesOfDayMinutes: number[] = [];
      for (let m = startTotalMinutes; m <= endTotalMinutes; m += intervalMin) {
        const slotHour = Math.floor(m / 60);
        const slotMinute = m % 60;

        const id = await N.scheduleNotificationAsync({
          content: {
            ...commonContent,
            body: reminder.notificationMessage || 'Hydration & Movement check-in',
          },
          trigger: {
            type: TRIGGER_TYPES.DAILY,
            hour: slotHour,
            minute: slotMinute,
            repeats: true,
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
        });
        scheduledIds.push(id);
        timesOfDayMinutes.push(m);
      }
      if (timesOfDayMinutes.length > 0) {
        await scheduleNativeAlarm(
          reminder._id,
          commonContent.title,
          commonContent.body,
          nextOccurrenceAt(timesOfDayMinutes),
          { timesOfDayMinutes },
        );
      }
    }
    // 5. INACTIVITY / STAND
    else if (scheduleType === 'INACTIVITY' || reminder.type === 'inactivity') {
      const thresholdMinutes = reminder.inactivityThresholdMinutes || reminder.inactivityMinutes || 45;
      const seconds = Math.max(60, thresholdMinutes * 60);

      const id = await N.scheduleNotificationAsync({
        content: {
          ...commonContent,
          title: reminder.notificationTitle || 'Time to Stand & Move',
          body: reminder.notificationMessage || 'You’ve been resting for a while. Take a light movement break.',
          categoryIdentifier: NOTIF_CATEGORIES.STAND,
        },
        trigger: {
          type: TRIGGER_TYPES.TIME_INTERVAL,
          seconds,
          repeats: true,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
      });
      scheduledIds.push(id);
    }

    if (scheduledIds.length > 0) {
      map[reminder._id] = scheduledIds;
    }
  } catch (err) {
    console.warn('[Notifications] Scheduling error for reminder:', reminder.name, err);
  }

  await saveMapping(map);
}

/**
 * Snooze a reminder by scheduling an audible notification in X minutes.
 */
export async function snoozeReminder(
  reminderId: string,
  snoozeMinutes: number = 10,
  title?: string,
  message?: string
): Promise<void> {
  if (!N) return;

  await ensureNotificationChannel();

  try {
    await N.scheduleNotificationAsync({
      content: {
        title: title ? `⏱ (Snoozed) ${title}` : '⏱ Reminder Snoozed',
        body: message || `Snoozed for ${snoozeMinutes} minutes`,
        data: { reminderId, isSnoozed: true },
        sound: 'default',
        priority: 'max',
        vibrate: [0, 250, 250, 250],
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: TRIGGER_TYPES.TIME_INTERVAL,
        seconds: Math.max(1, snoozeMinutes * 60),
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    // A snoozed reminder is also an alarm: use AlarmManager so it can wake a
    // locked device instead of relying solely on a background notification.
    await scheduleNativeAlarm(
      reminderId,
      title ? `⏱ (Snoozed) ${title}` : '⏱ Reminder Snoozed',
      message || `Snoozed for ${snoozeMinutes} minutes`,
      Date.now() + Math.max(1, snoozeMinutes * 60) * 1000,
    );

    // Notify backend
    api.post(`/reminders/${reminderId}/snooze`, { snoozeMinutes }).catch(() => {});
  } catch (err) {
    console.warn('[Notifications] Snooze error:', err);
  }
}

/**
 * Fires a test notification in 3 seconds so the user can verify sound, banner, and lockscreen alert.
 * Has robust multi-tier fallback for Samsung OneUI / Android background scheduling restrictions.
 */
export async function sendTestReminderNotification(): Promise<boolean> {
  if (!N) {
    lastNotificationError = 'Notifications module not found or not supported in this runtime.';
    return false;
  }

  lastNotificationError = null;

  try {
    await requestNotificationPermissions();
    await ensureNotificationChannel();
  } catch (initErr: any) {
    console.warn('[Notifications] Warning during test init:', initErr);
  }

  const testContent = {
    title: '🔔 Lumen Alarm Test',
    body: 'Your reminder alarms, sound, and lock-screen alerts are working properly! 🎉',
    sound: 'default',
    priority: N?.AndroidNotificationPriority?.MAX ?? 'max',
    vibrate: [0, 500, 250, 500, 250, 500],
    categoryIdentifier: NOTIF_CATEGORIES.WATER,
    data: { test: true, reminderId: 'test_alarm' },
  };

  // Strategy 1: Attempt standard 3-second scheduled trigger with dedicated channel
  try {
    await N.scheduleNotificationAsync({
      content: {
        ...testContent,
        channelId: CHANNEL_ID,
      },
      trigger: {
        type: TRIGGER_TYPES.TIME_INTERVAL,
        seconds: 3,
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    await scheduleNativeAlarm(
      'test_alarm',
      '🔔 Lumen Alarm Test',
      'Your reminder alarms, sound, and lock-screen alerts are working properly!',
      Date.now() + 3_000,
    );
    return true;
  } catch (schedErr: any) {
    console.warn('[Notifications] 3-second trigger failed, falling back to immediate channel trigger:', schedErr);
    lastNotificationError = schedErr?.message || null;

    // Strategy 2: Immediate channel dispatch (bypasses exact alarm restrictions on Android 13/14)
    try {
      await N.scheduleNotificationAsync({
        content: {
          ...testContent,
          channelId: CHANNEL_ID,
        },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      });
      lastNotificationError = null;
      return true;
    } catch (immediateErr: any) {
      console.warn('[Notifications] Immediate channel trigger failed, falling back to basic trigger:', immediateErr);

      // Strategy 3: Pure immediate dispatch (null trigger)
      try {
        await N.scheduleNotificationAsync({
          content: testContent,
          trigger: null,
        });
        lastNotificationError = null;
        return true;
      } catch (finalErr: any) {
        lastNotificationError = finalErr?.message || immediateErr?.message || schedErr?.message || 'Could not trigger test alarm.';
        console.error('[Notifications] Failed all test notification strategies:', finalErr);
        return false;
      }
    }
  }
}

/**
 * Diagnostic check of notification and alarm system.
 */
export async function checkNotificationAlarmStatus(): Promise<{
  isSupported: boolean;
  hasPermission: boolean;
  channelConfigured: boolean;
  scheduledCount: number;
}> {
  if (!N) {
    return {
      isSupported: false,
      hasPermission: false,
      channelConfigured: false,
      scheduledCount: 0,
    };
  }

  try {
    const { status } = await N.getPermissionsAsync();
    const hasPermission = status === 'granted';

    let channelConfigured = true;
    if (Platform.OS === 'android' && typeof N.getNotificationChannelAsync === 'function') {
      const channel = await N.getNotificationChannelAsync(CHANNEL_ID);
      channelConfigured = !!channel;
    }

    const scheduled = typeof N.getAllScheduledNotificationsAsync === 'function'
      ? await N.getAllScheduledNotificationsAsync()
      : [];

    return {
      isSupported: true,
      hasPermission,
      channelConfigured,
      scheduledCount: scheduled.length,
    };
  } catch {
    return {
      isSupported: true,
      hasPermission: false,
      channelConfigured: false,
      scheduledCount: 0,
    };
  }
}

/** Exposes the two Android system grants that local notifications cannot request. */
export async function getAlarmDeliveryCapabilities(): Promise<AlarmCapabilities> {
  return getAlarmCapabilities();
}

/**
 * Cancels all scheduled native notifications for a given reminder ID.
 */
export async function cancelReminder(reminderId: string): Promise<void> {
  const map = await loadMapping();
  if (map[reminderId] && Array.isArray(map[reminderId])) {
    if (N && typeof N.cancelScheduledNotificationAsync === 'function') {
      for (const id of map[reminderId]) {
        await N.cancelScheduledNotificationAsync(id).catch(() => {});
      }
    }
    delete map[reminderId];
    await saveMapping(map);
  }
  await cancelNativeAlarm(reminderId);
}

/**
 * Cancels all scheduled native notifications across all reminders and clears the mapping.
 * Used during account deletion and full data reset.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    if (N && typeof N.cancelAllScheduledNotificationsAsync === 'function') {
      await N.cancelAllScheduledNotificationsAsync().catch(() => {});
    }
    await AsyncStorage.removeItem(MAPPING_KEY).catch(() => {});
  } catch (err) {
    console.warn('[Notifications] Failed to cancel all notifications:', err);
  }
}

/**
 * Handle notification action button interactions.
 */
export async function handleNotificationActionResponse(response: any): Promise<void> {
  const actionIdentifier = response.actionIdentifier;
  const data = response.notification.request.content.data || {};
  const reminderId = data.reminderId;

  // Log action completion to backend
  if (reminderId) {
    api.post(`/reminders/${reminderId}/event`, {
      status: 'COMPLETED',
      actionTaken: actionIdentifier,
    }).catch(() => {});
  }

  switch (actionIdentifier) {
    case NOTIF_ACTIONS.VIEW_FLARE:
      router.push('/(tabs)/today');
      break;

    case NOTIF_ACTIONS.LOG_SYMPTOM:
      router.push('/quick-log');
      break;

    case NOTIF_ACTIONS.RESTING_NOW:
      // Acknowledged resting in background to prevent PEM crash
      break;

    case NOTIF_ACTIONS.VIEW_WALK:
      router.push('/walking');
      break;

    case NOTIF_ACTIONS.MARK_MED_TAKEN:
      if (reminderId) {
        // Log med event as taken
        api.post(`/reminders/${reminderId}/event`, {
          status: 'COMPLETED',
          actionTaken: 'TAKEN',
        }).catch(() => {});
      }
      break;

    case NOTIF_ACTIONS.LOG_250ML:
      if (data.linkedQuickActionId) {
        useQuickLogStore.getState().tap(data.linkedQuickActionId);
      }
      break;

    case NOTIF_ACTIONS.LOG_500ML:
      if (data.linkedQuickActionId) {
        useQuickLogStore.getState().tap(data.linkedQuickActionId);
        useQuickLogStore.getState().tap(data.linkedQuickActionId);
      }
      break;

    case NOTIF_ACTIONS.START_WALK:
      router.push('/walking/active');
      break;

    case NOTIF_ACTIONS.START_SLEEP:
      router.push('/(tabs)/today');
      break;

    case NOTIF_ACTIONS.IM_MOVING:
      if (data.linkedQuickActionId) {
        useQuickLogStore.getState().tap(data.linkedQuickActionId);
      }
      break;

    case NOTIF_ACTIONS.SNOOZE_10:
      if (reminderId) {
        await snoozeReminder(reminderId, 10);
      }
      break;

    case NOTIF_ACTIONS.SNOOZE_15:
      if (reminderId) {
        await snoozeReminder(reminderId, 15);
      }
      break;

    case NOTIF_ACTIONS.SNOOZE_30:
      if (reminderId) {
        await snoozeReminder(reminderId, 30);
      }
      break;

    default:
      if (data?.type === 'WEATHER_FLARE_ALERT') {
        router.push('/reminders');
      } else if (data?.type === 'PACING_ALERT') {
        router.push('/walking');
      } else if (reminderId) {
        router.push(`/alarm/${reminderId}`);
      } else if (data?.linkedQuickActionId) {
        router.push('/(tabs)/today');
      }
      break;
  }
}

/**
 * Dispatches an immediate high-priority native notification for weather flare risks
 * (e.g. "High Flare Trigger Potential", barometric pressure drops, extreme UV warnings).
 */
export async function sendWeatherFlareNotification(
  title: string,
  body: string,
  riskLevel: 'moderate' | 'high'
): Promise<string | null> {
  if (!N || typeof N.scheduleNotificationAsync !== 'function') return null;

  try {
    await ensureNotificationChannel();
    const id = await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'WEATHER_FLARE_ALERT', riskLevel },
        categoryIdentifier: NOTIF_CATEGORIES.FLARE,
        sound: 'default',
        priority: 'max',
        vibrate: [0, 450, 150, 450],
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID_CLINICAL } : {}),
      },
      trigger: null, // triggers immediately
    });
    return id;
  } catch (err) {
    console.warn('[Notifications] Failed to send weather flare notification:', err);
    return null;
  }
}

/**
 * Dispatches a Spoon Theory pacing warning when walking or activity exceeds safe thresholds.
 * Helps prevent post-exertional malaise (PEM) and next-day fatigue crashes.
 */
export async function sendPacingAlertNotification(
  title: string,
  body: string,
  distanceKm: number
): Promise<string | null> {
  if (!N || typeof N.scheduleNotificationAsync !== 'function') return null;

  try {
    await ensureNotificationChannel();
    const id = await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'PACING_ALERT', distanceKm },
        categoryIdentifier: NOTIF_CATEGORIES.PACING,
        sound: 'default',
        priority: 'high',
        vibrate: [0, 300, 150, 300],
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID_PACING } : {}),
      },
      trigger: null,
    });
    return id;
  } catch (err) {
    console.warn('[Notifications] Failed to send pacing notification:', err);
    return null;
  }
}

export async function syncReminders(reminders: IReminder[]): Promise<void> {
  for (const r of reminders) {
    await scheduleReminder(r);
  }
}

/**
 * Schedules one intelligent notification. Content is health-derived, so the lock screen
 * shows only a generic title on the quiet channels (PRIVATE visibility is set on the channel).
 * `deliverAt` null means immediately. Returns the notification id, or null if it could not be scheduled.
 */
export async function scheduleIntelligentNotification(opts: {
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
  deliverAt?: number | null;
}): Promise<string | null> {
  if (!N || typeof N.scheduleNotificationAsync !== 'function') return null;
  try {
    await ensureNotificationChannel();
    const silent = opts.channelId === CHANNEL_ID_INSIGHTS;
    return await N.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data,
        sound: silent ? false : 'default',
        ...(Platform.OS === 'android' ? { channelId: opts.channelId } : {}),
      },
      trigger: opts.deliverAt && opts.deliverAt > Date.now()
        ? { type: TRIGGER_TYPES.DATE, date: new Date(opts.deliverAt) }
        : null,
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule intelligent notification:', err);
    return null;
  }
}

export interface WalkLiveNotificationParams {
  title?: string;
  activeSeconds: number;
  distanceMeters: number;
  steps: number;
  averagePaceMinPerKm?: number;
  isPaused?: boolean;
}

/**
 * Ongoing lock screen notification for active walking sessions (Samsung OneUI / Android & iOS).
 * Displays live updating duration, distance in km, and step count directly on the lock screen.
 */
export async function showWalkLiveNotification(params: WalkLiveNotificationParams): Promise<void> {
  if (!N || typeof N.scheduleNotificationAsync !== 'function') return;

  try {
    await ensureNotificationChannel();

    const safeSec = Math.max(0, Math.floor(params.activeSeconds || 0));
    const h = Math.floor(safeSec / 3600);
    const m = Math.floor((safeSec % 3600) / 60);
    const s = safeSec % 60;
    const hh = h > 0 ? `${h}:` : '';
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    const timeStr = `${hh}${mm}:${ss}`;

    const distKm = (params.distanceMeters / 1000).toFixed(2);
    const stepsFormatted = (params.steps || 0).toLocaleString();

    const title = params.isPaused
      ? '⏸️ Walk Paused · Lumen'
      : `🚶‍♂️ ${params.title || 'Outdoor Walk'} · Lumen`;

    const body = `⏱️ ${timeStr}  |  📍 ${distKm} km  |  👣 ${stepsFormatted} steps`;

    await N.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID_WALK_ACTIVE,
      content: {
        title,
        body,
        sound: null,
        data: {
          type: 'WALK_ACTIVE',
          route: '/walking/active',
        },
        sticky: true,
        autoDismiss: false,
        ...(Platform.OS === 'android'
          ? {
              channelId: CHANNEL_ID_WALK_ACTIVE,
              priority: N.AndroidNotificationPriority?.LOW ?? 'low',
              color: '#FF6B35',
            }
          : {}),
      },
      trigger: null,
    });
  } catch (err) {
    // Non-fatal, do not break in-app tracking
    console.warn('[Notifications] Could not show live walk notification:', err);
  }
}

/**
 * Dismisses the ongoing walk lock screen notification when session ends or is discarded.
 */
export async function dismissWalkLiveNotification(): Promise<void> {
  if (!N || typeof N.dismissNotificationAsync !== 'function') return;
  try {
    await N.dismissNotificationAsync(NOTIFICATION_ID_WALK_ACTIVE);
  } catch {}
}

