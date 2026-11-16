/**
 * Syncs the user's saved reminders with expo-notifications on mount.
 * Sets up action categories and handles user action button taps.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Platform, NativeEventEmitter, NativeModules } from 'react-native';
import { useReminderStore } from '../store/reminderStore';
import {
  syncReminders,
  ensureNotificationChannel,
  setupNotificationCategories,
  handleNotificationActionResponse,
} from '../services/notifications';
import { getPendingAlarm } from '../services/alarmScheduler';
import { recordNotification } from '../services/notificationInbox';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HANDLED_KEY = 'lumen:notif:last_handled_tap_v1';
let lastHandled: string | null = null;

/**
 * A tap is routed once. getLastNotificationResponseAsync keeps returning the launch tap, and the
 * response listener can report the same tap too, so remember which one was handled.
 */
export async function claimTap(response: any): Promise<boolean> {
  const id = `${response?.notification?.request?.identifier ?? ''}:${response?.actionIdentifier ?? ''}:${response?.notification?.date ?? ''}`;
  if (!id || id === '::') return true;
  if (lastHandled === null) lastHandled = await AsyncStorage.getItem(HANDLED_KEY).catch(() => null);
  if (lastHandled === id) return false;
  lastHandled = id;
  AsyncStorage.setItem(HANDLED_KEY, id).catch(() => {});
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
} catch {}

export function useNotificationSync() {
  const { reminders, fetchReminders } = useReminderStore();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await ensureNotificationChannel();
        await setupNotificationCategories();
        if (isMounted) {
          await fetchReminders().catch(() => {});
        }
        // Check for native pending alarm from lock screen / killed launch
        const pendingAlarmId = await getPendingAlarm();
        if (pendingAlarmId) {
          router.push(`/alarm/${pendingAlarmId}`);
          return;
        }
        // Handle tap on notification that launched the app from killed/background state
        if (N && typeof N.getLastNotificationResponseAsync === 'function') {
          const lastResponse = await N.getLastNotificationResponseAsync();
          if (lastResponse && (await claimTap(lastResponse))) {
            const data = lastResponse.notification?.request?.content?.data;
            // A route (e.g. a Lumen AI notification opening its chat) wins over an alarm id.
            if (data?.route) router.push(data.route);
            else if (data?.reminderId) router.push(`/alarm/${data.reminderId}`);
          }
        }
      } catch (err) {
        console.warn('[useNotificationSync] Startup sync error:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (reminders && reminders.length > 0) {
      syncReminders(reminders).catch(() => {});
    }
  }, [reminders]);

  // Listen for native AlarmReceiver full-screen intent events (Android lock screen)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      const { DeviceEventEmitter } = require('react-native');
      const sub = DeviceEventEmitter.addListener('LumenAlarmFired', (reminderId: string) => {
        // Consume the native copy too, or the next cold start would reopen this alarm screen.
        getPendingAlarm().catch(() => null);
        if (reminderId) router.push(`/alarm/${reminderId}`);
      });
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!N) return;

    // Fired when user taps a notification action button
    const responseSub = typeof N.addNotificationResponseReceivedListener === 'function'
      ? N.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification?.request?.content?.data;
          const reminderId = data?.reminderId;
          const targetRoute = data?.route;

          // Default tap (no action button)
          if (response.actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER) {
            if (targetRoute) {
              claimTap(response).then(fresh => { if (fresh) router.push(targetRoute as any); }).catch(() => {});
              return;
            }
            if (reminderId) {
              router.push(`/alarm/${reminderId}`);
              return;
            }
          }
          handleNotificationActionResponse(response).catch(() => {});
        })
      : null;

    // Fired when notification arrives while app is in foreground
    const receivedSub = typeof N.addNotificationReceivedListener === 'function'
      ? N.addNotificationReceivedListener((notification: any) => {
          recordNotification(notification).catch(() => {});
          const reminderId = notification.request?.content?.data?.reminderId;
          if (reminderId) {
            router.push(`/alarm/${reminderId}`);
          }
        })
      : null;

    return () => {
      responseSub?.remove();
      receivedSub?.remove();
    };
  }, []);
}
