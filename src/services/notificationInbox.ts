/**
 * Feeds the notification inbox from the system: notifications that arrived while the app was
 * closed are still in the tray, so they are imported when the patient opens the app.
 */
import { useReminderStore } from '../store/reminderStore';
import {
  entryFromCommunity,
  entryFromNotification,
  useNotificationInboxStore,
  CommunityNotificationDto,
} from '../store/notificationInboxStore';
import { api } from '../api/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
} catch {}

/** expo reports delivery time in seconds on iOS and milliseconds on Android. */
function toMillis(date: number | undefined): number {
  if (!date) return Date.now();
  return date < 1e12 ? date * 1000 : date;
}

/** Record one notification (from the foreground listener or the tray) in the inbox. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordNotification(notification: any): Promise<void> {
  const content = notification?.request?.content;
  if (!content) return;
  const reminderId = content.data?.reminderId;
  const category = reminderId
    ? useReminderStore.getState().reminders.find(r => r._id === reminderId)?.category
    : undefined;
  const entry = entryFromNotification(
    {
      identifier: notification.request.identifier,
      title: content.title,
      body: content.body,
      data: content.data,
      at: toMillis(notification.date),
    },
    category,
  );
  if (entry) await useNotificationInboxStore.getState().add([entry]);
}

export async function syncPresentedNotifications(): Promise<void> {
  if (!N || typeof N.getPresentedNotificationsAsync !== 'function') return;
  try {
    const presented = await N.getPresentedNotificationsAsync();
    for (const n of presented ?? []) await recordNotification(n);
  } catch {
    // Not available on this platform; the inbox still fills from the in-app sources.
  }
}

/** Replies to the patient's community messages and @mentions of them, from the server. */
export async function syncCommunityNotifications(): Promise<void> {
  try {
    const items = await api.get<CommunityNotificationDto[]>('/community/notifications');
    if (!Array.isArray(items) || items.length === 0) return;
    await useNotificationInboxStore.getState().add(items.map(entryFromCommunity));
  } catch {
    // Offline or signed out: the inbox keeps what it already has.
  }
}

/** Everything the inbox can learn on its own: the tray, then the server. */
export async function refreshInbox(): Promise<void> {
  await useNotificationInboxStore.getState().load();
  await Promise.all([syncPresentedNotifications(), syncCommunityNotifications()]);
}
