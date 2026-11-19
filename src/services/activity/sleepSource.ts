import { Platform } from 'react-native';
import { api } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { useSleepTrackerStore } from '../../store/sleepTrackerStore';
import { getTrackingDayDateString } from '../../utils/dayBoundary';

export interface SleepSyncResult {
  synced: number;
  latestRecord?: {
    date: string;
    durationMinutes: number;
    bedtime: string;
    wakeTime: string;
  };
}

export async function syncHealthConnectSleep(opts?: { boundaryHour?: number; daysBack?: number }): Promise<SleepSyncResult> {
  if (Platform.OS !== 'android') return { synced: 0 };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const HC = require('react-native-health-connect') as typeof import('react-native-health-connect');
    if ((await HC.getSdkStatus()) !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return { synced: 0 };
    await HC.initialize();

    const granted = await HC.getGrantedPermissions();
    const hasSleepPermission = granted.some(p => p.recordType === 'SleepSession' && p.accessType === 'read');
    if (!hasSleepPermission) return { synced: 0 };

    const daysBack = opts?.daysBack ?? 3;
    const boundaryHour = opts?.boundaryHour ?? 4;
    const now = new Date();
    const from = new Date(now.getTime() - daysBack * 24 * 3600000);

    const res: any = await HC.readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: from.toISOString(),
        endTime: now.toISOString(),
      },
      pageSize: 50,
    });

    const records: any[] = res?.records ?? [];
    if (records.length === 0) return { synced: 0 };

    let syncedCount = 0;
    let latestSleep: { date: string; durationMinutes: number; bedtime: string; wakeTime: string } | undefined;

    for (const rec of records) {
      const startMs = new Date(rec.startTime).getTime();
      const endMs = new Date(rec.endTime).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

      const durationMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
      const sessionDate = getTrackingDayDateString(new Date(endMs), boundaryHour);

      try {
        await api.put('/logs/sleep', {
          wakeTime: rec.endTime,
          bedtime: rec.startTime,
          durationMinutes,
          source: 'device',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
        syncedCount++;
        if (!latestSleep || endMs > new Date(latestSleep.wakeTime).getTime()) {
          latestSleep = {
            date: sessionDate,
            durationMinutes,
            bedtime: rec.startTime,
            wakeTime: rec.endTime,
          };
        }
      } catch {
        // Safe to ignore duplicate or network issue on individual entry
      }
    }

    if (latestSleep) {
      const store = useSleepTrackerStore.getState();
      if (!store.lastSleepRecord || new Date(latestSleep.wakeTime).getTime() > new Date(store.lastSleepRecord.wakeTime).getTime()) {
        store.setLastSleepRecordFromSync(latestSleep);
      }
      try {
        queryClient.invalidateQueries({ queryKey: ['day-entries'] });
        queryClient.invalidateQueries({ queryKey: ['timeline-summary'] });
      } catch {}
    }

    return { synced: syncedCount, latestRecord: latestSleep };
  } catch (err) {
    console.warn('[sleepSource] Health Connect sleep sync failed:', err);
    return { synced: 0 };
  }
}
