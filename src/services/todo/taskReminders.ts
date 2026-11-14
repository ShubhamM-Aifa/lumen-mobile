/**
 * Local notifications for task reminders. Each incomplete task with a future `reminderTime` gets one
 * notification with the identifier `task-<id>`; tapping it opens the task, and the "Mark complete"
 * button completes it without opening the app.
 *
 * `syncTaskReminders` is idempotent: it removes every task notification that is no longer wanted and
 * (re)schedules the rest, so it can run after any change.
 */
import { Platform } from 'react-native';
import { ITask } from '../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Notifs = any;

export const TASK_NOTIFICATION_PREFIX = 'task-';

export function taskNotificationId(taskId: string): string {
  return `${TASK_NOTIFICATION_PREFIX}${taskId}`;
}

function loadNotifications(): Notifs | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/** Tasks that should have a notification right now. */
export function tasksNeedingReminder(tasks: ITask[], now: number = Date.now()): ITask[] {
  return tasks.filter((t) => {
    if (t.isCompleted || !t.reminderTime) return false;
    const at = new Date(t.reminderTime).getTime();
    return !isNaN(at) && at > now;
  });
}

let syncing: Promise<void> | null = null;
let again = false;
let latest: ITask[] = [];

async function runSync(tasks: ITask[]): Promise<void> {
  const N = loadNotifications();
  if (!N || typeof N.scheduleNotificationAsync !== 'function') return;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const notif = require('../notifications');
  const wanted = tasksNeedingReminder(tasks);

  try {
    const scheduled: Array<{ identifier: string }> = (await N.getAllScheduledNotificationsAsync?.()) ?? [];
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(TASK_NOTIFICATION_PREFIX))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {
    /* nothing scheduled yet */
  }

  if (wanted.length === 0) return;
  try {
    await notif.ensureNotificationChannel();
  } catch {
    /* scheduling below still works on iOS */
  }

  for (const task of wanted) {
    try {
      await N.scheduleNotificationAsync({
        identifier: taskNotificationId(task._id),
        content: {
          title: task.title,
          body: task.dueDate ? 'Task reminder' : 'Reminder',
          data: { taskId: task._id, route: `/todo/task/${task._id}` },
          categoryIdentifier: notif.NOTIF_CATEGORIES.TASK,
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: notif.CHANNEL_ID_HEADS_UP } : {}),
        },
        trigger: { type: notif.TRIGGER_TYPES.DATE, date: new Date(task.reminderTime as string) },
      });
    } catch (err) {
      console.warn('[taskReminders] could not schedule', task._id, err);
    }
  }
}

/** Re-sync every task reminder. Calls made while a sync is running are collapsed into one follow-up run. */
export function syncTaskReminders(tasks: ITask[]): Promise<void> {
  latest = tasks;
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        again = false;
        await runSync(latest);
      } while (again);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  const N = loadNotifications();
  try {
    await N?.cancelScheduledNotificationAsync?.(taskNotificationId(taskId));
  } catch {
    /* already gone */
  }
}

/** Asks for notification permission the first time a reminder is set. Never throws. */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestNotificationPermissions } = require('../notifications');
    return !!(await requestNotificationPermissions());
  } catch {
    return false;
  }
}
