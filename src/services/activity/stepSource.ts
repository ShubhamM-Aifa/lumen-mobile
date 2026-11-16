/**
 * Reads the steps the phone already counted on its own, with Lumen closed:
 * - iPhone: Core Motion keeps the last 7 days (expo-sensors Pedometer, iOS only for history).
 * - Android: Health Connect, which counts phone steps itself on Android 14+ and holds steps from
 *   Samsung Health, Fitbit and other apps that write there.
 * No GPS, no background service, no extra battery.
 */
import { Platform } from 'react-native';
import { MinuteSteps, MINUTE } from './walkDetection';

export type StepSourceKind = 'ios_motion' | 'health_connect';

export interface StepSource {
  kind: StepSourceKind;
  /** How far back this source can look. */
  maxHistoryDays: number;
  isAvailable(): Promise<boolean>;
  hasAccess(): Promise<boolean>;
  requestAccess(): Promise<boolean>;
  stepsBetween(from: Date, to: Date): Promise<number>;
  minuteSteps(from: Date, to: Date): Promise<MinuteSteps[]>;
}

const HOUR = 60 * MINUTE;
/** An hour with fewer steps than this cannot hold a walk, so its minutes are not read one by one. */
const HOUR_SKIP_BELOW = 250;

// ── iPhone ────────────────────────────────────────────────────────────────

function iosMotionSource(): StepSource {
  // Required lazily so web and tests never load the native module
  const { Pedometer } = require('expo-sensors') as typeof import('expo-sensors');
  // Errors are thrown, not read as zero: a failed read must not save a day of 0 steps.
  const count = async (from: number, to: number) => {
    const r = await Pedometer.getStepCountAsync(new Date(from), new Date(to));
    return r?.steps ?? 0;
  };
  return {
    kind: 'ios_motion',
    maxHistoryDays: 7,
    isAvailable: async () => {
      try { return await Pedometer.isAvailableAsync(); } catch { return false; }
    },
    hasAccess: async () => {
      try { return (await Pedometer.getPermissionsAsync()).granted; } catch { return false; }
    },
    requestAccess: async () => {
      try { return (await Pedometer.requestPermissionsAsync()).granted; } catch { return false; }
    },
    stepsBetween: (from, to) => count(from.getTime(), to.getTime()),
    // Hour by hour first, then minute by minute only inside hours that had real walking.
    minuteSteps: async (from, to) => {
      const out: MinuteSteps[] = [];
      const end = to.getTime();
      for (let h = Math.floor(from.getTime() / MINUTE) * MINUTE; h < end; h += HOUR) {
        const hourEnd = Math.min(h + HOUR, end);
        if ((await count(h, hourEnd)) < HOUR_SKIP_BELOW) continue;
        const starts: number[] = [];
        for (let m = h; m < hourEnd; m += MINUTE) starts.push(m);
        const steps = await Promise.all(starts.map(m => count(m, Math.min(m + MINUTE, hourEnd))));
        starts.forEach((start, k) => { if (steps[k] > 0) out.push({ start, steps: steps[k] }); });
      }
      return out;
    },
  };
}

// ── Android ───────────────────────────────────────────────────────────────

const READ_STEPS = { accessType: 'read', recordType: 'Steps' } as const;
const READ_IN_BACKGROUND = { accessType: 'read', recordType: 'BackgroundAccessPermission' } as const;

function healthConnectSource(): StepSource {
  const HC = require('react-native-health-connect') as typeof import('react-native-health-connect');
  let ready: Promise<boolean> | null = null;
  const init = () => {
    if (!ready) {
      ready = (async () => {
        try {
          if ((await HC.getSdkStatus()) !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
          return await HC.initialize();
        } catch {
          return false;
        }
      })();
    }
    return ready;
  };
  const between = (from: Date, to: Date) => ({ operator: 'between' as const, startTime: from.toISOString(), endTime: to.toISOString() });
  return {
    kind: 'health_connect',
    // Health Connect gives 30 days from the first grant; a week is plenty for walks.
    maxHistoryDays: 7,
    isAvailable: init,
    hasAccess: async () => {
      if (!(await init())) return false;
      try {
        const granted = await HC.getGrantedPermissions();
        return granted.some(p => p.recordType === 'Steps' && p.accessType === 'read');
      } catch {
        return false;
      }
    },
    requestAccess: async () => {
      if (!(await init())) return false;
      try {
        const granted = await HC.requestPermission([READ_STEPS, READ_IN_BACKGROUND]);
        return granted.some(p => p.recordType === 'Steps');
      } catch {
        return false;
      }
    },
    stepsBetween: async (from, to) => {
      if (!(await init())) throw new Error('Health Connect is not available');
      const r = await HC.aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(from, to) });
      return r?.COUNT_TOTAL ?? 0;
    },
    // Health Connect: reads detailed Steps records so continuous walks are accurately measured.
    // aggregateGroupByDuration does not interpolate intervals and dumps multi-minute intervals into minute 0.
    minuteSteps: async (from, to) => {
      if (!(await init())) throw new Error('Health Connect is not available');
      const out: MinuteSteps[] = [];

      // 1. Primary: read actual StepsRecord intervals
      try {
        const records: any[] = [];
        let pageToken: string | undefined = undefined;
        for (let page = 0; page < 20; page++) {
          const res: any = await HC.readRecords('Steps', {
            timeRangeFilter: between(from, to),
            pageSize: 1000,
            pageToken,
          });
          if (Array.isArray(res?.records)) {
            records.push(...res.records);
          }
          if (!res?.pageToken) break;
          pageToken = res.pageToken;
        }

        if (records.length > 0) {
          // Group by dataOrigin to merge overlapping sources (e.g. watch + phone) by taking max per minute
          const originMinuteMap = new Map<string, Map<number, number>>();
          for (const rec of records) {
            const startMs = new Date(rec.startTime).getTime();
            const endMs = new Date(rec.endTime).getTime();
            const count = Number(rec.count) || 0;
            if (count <= 0 || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
              continue;
            }
            const origin = rec.metadata?.dataOrigin || 'default';
            if (!originMinuteMap.has(origin)) {
              originMinuteMap.set(origin, new Map());
            }
            const minMap = originMinuteMap.get(origin)!;
            const durationMins = Math.max(1, Math.round((endMs - startMs) / MINUTE));
            const rate = count / durationMins;
            const startBucket = Math.floor(startMs / MINUTE) * MINUTE;
            for (let m = 0; m < durationMins; m++) {
              const bucketTime = startBucket + m * MINUTE;
              if (bucketTime >= from.getTime() && bucketTime < to.getTime()) {
                minMap.set(bucketTime, (minMap.get(bucketTime) ?? 0) + rate);
              }
            }
          }

          const mergedMinutes = new Map<number, number>();
          for (const minMap of originMinuteMap.values()) {
            for (const [minute, steps] of minMap.entries()) {
              mergedMinutes.set(minute, Math.max(mergedMinutes.get(minute) ?? 0, Math.round(steps)));
            }
          }

          for (const [start, steps] of mergedMinutes.entries()) {
            if (steps > 0) {
              out.push({ start, steps });
            }
          }

          out.sort((a, b) => a.start - b.start);
          return out;
        }
      } catch (err) {
        console.warn('[stepSource] readRecords fallback to aggregateGroupByDuration:', err);
      }

      // 2. Fallback: aggregateGroupByDuration with timezone-safe parsing
      const DAY = 24 * HOUR;
      for (let s = from.getTime(); s < to.getTime(); s += DAY) {
        const e = Math.min(s + DAY, to.getTime());
        const groups = await HC.aggregateGroupByDuration({
          recordType: 'Steps',
          timeRangeFilter: between(new Date(s), new Date(e)),
          timeRangeSlicer: { duration: 'MINUTES', length: 1 },
        });
        for (const g of groups) {
          const steps = g.result?.COUNT_TOTAL ?? 0;
          if (steps > 0) {
            const rawG = g as unknown as { startTime: string; zoneOffset?: string };
            const timeStr = (rawG.zoneOffset && !rawG.startTime.includes('+') && !rawG.startTime.includes('Z'))
              ? `${rawG.startTime}${rawG.zoneOffset}`
              : rawG.startTime;
            out.push({ start: new Date(timeStr).getTime(), steps });
          }
        }
      }
      return out;
    },
  };
}

let cached: StepSource | null | undefined;

/** The step source for this phone, or null where there is none (web). */
export function getStepSource(): StepSource | null {
  if (cached !== undefined) return cached;
  cached = Platform.OS === 'ios' ? iosMotionSource() : Platform.OS === 'android' ? healthConnectSource() : null;
  return cached;
}

/** For tests. */
export function setStepSourceForTesting(source: StepSource | null | undefined): void {
  cached = source;
}
