import { NativeModules, Platform } from 'react-native';

const { AlarmScheduler } = NativeModules;

export interface NativeAlarmSchedule {
  /** Minutes after midnight at which this alarm may run. */
  timesOfDayMinutes?: number[];
  /** Calendar weekday values: 1 (Sunday) through 7 (Saturday). */
  daysOfWeek?: number[];
}

export interface AlarmCapabilities {
  exactAlarmsAllowed: boolean;
  fullScreenIntentAllowed: boolean;
}

/**
 * Schedule a native Android exact alarm via AlarmManager.
 * Falls back silently on iOS or if module unavailable.
 */
export async function scheduleNativeAlarm(
  reminderId: string,
  title: string,
  body: string,
  triggerAtMs: number,
  schedule?: NativeAlarmSchedule,
): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmScheduler) return;
  try {
    await AlarmScheduler.scheduleAlarm(
      reminderId,
      title,
      body,
      triggerAtMs,
      schedule?.timesOfDayMinutes ?? [],
      schedule?.daysOfWeek ?? [],
    );
  } catch (e) {
    console.warn('[AlarmScheduler] scheduleAlarm failed:', e);
  }
}

/** Android 12+ exact-alarm and Android 14+ full-screen intent access. */
export async function getAlarmCapabilities(): Promise<AlarmCapabilities> {
  if (Platform.OS !== 'android' || !AlarmScheduler?.getCapabilities) {
    return { exactAlarmsAllowed: true, fullScreenIntentAllowed: true };
  }
  try {
    return await AlarmScheduler.getCapabilities();
  } catch {
    return { exactAlarmsAllowed: false, fullScreenIntentAllowed: false };
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS === 'android' && AlarmScheduler?.openExactAlarmSettings) {
    await AlarmScheduler.openExactAlarmSettings();
  }
}

export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS === 'android' && AlarmScheduler?.openFullScreenIntentSettings) {
    await AlarmScheduler.openFullScreenIntentSettings();
  }
}

export async function cancelNativeAlarm(reminderId: string): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmScheduler) return;
  try {
    await AlarmScheduler.cancelAlarm(reminderId);
  } catch (e) {
    console.warn('[AlarmScheduler] cancelAlarm failed:', e);
  }
}

export async function getPendingAlarm(): Promise<string | null> {
  if (Platform.OS !== 'android' || !AlarmScheduler?.getPendingAlarm) {
    return null;
  }
  try {
    return await AlarmScheduler.getPendingAlarm();
  } catch {
    return null;
  }
}
