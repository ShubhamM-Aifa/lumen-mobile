/**
 * Background check for new walks, so they appear even on days Lumen is not opened.
 * The phone decides when this runs (Android about hourly at best; iPhone usually less often,
 * often overnight while charging). Opening Lumen always syncs too, so nothing depends on it.
 *
 * The task must be defined when the JS bundle loads, so this file is imported from the root layout.
 */
import { Platform } from 'react-native';

export const AUTO_WALK_TASK = 'lumen-auto-walk-sync';
/** Minutes. The phone treats this as a lower bound, not a schedule. */
const INTERVAL_MINUTES = 60;

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function modules() {
  return {
    TaskManager: require('expo-task-manager') as typeof import('expo-task-manager'),
    BackgroundTask: require('expo-background-task') as typeof import('expo-background-task'),
  };
}

if (supported) {
  try {
    const { TaskManager, BackgroundTask } = modules();
    TaskManager.defineTask(AUTO_WALK_TASK, async () => {
      try {
        const { useAutoWalkStore } = require('../../store/autoWalkStore') as typeof import('../../store/autoWalkStore');
        await useAutoWalkStore.getState().sync({ force: true });
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    // a build without the native module just skips background syncs
  }
}

export async function registerAutoWalkTask(): Promise<void> {
  if (!supported) return;
  const { TaskManager, BackgroundTask } = modules();
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(AUTO_WALK_TASK)) return;
  await BackgroundTask.registerTaskAsync(AUTO_WALK_TASK, { minimumInterval: INTERVAL_MINUTES });
}

export async function unregisterAutoWalkTask(): Promise<void> {
  if (!supported) return;
  const { TaskManager, BackgroundTask } = modules();
  if (await TaskManager.isTaskRegisteredAsync(AUTO_WALK_TASK)) {
    await BackgroundTask.unregisterTaskAsync(AUTO_WALK_TASK);
  }
}
