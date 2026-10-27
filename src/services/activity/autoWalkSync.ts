/**
 * One automatic walk sync: read the phone's step history since the last sync, find walks, save
 * them, and save the daily step totals. Runs when Lumen opens and from the background task.
 *
 * Safe to repeat: walk ids come from their start minute and the server saves each walk once.
 * The cursor only moves forward after the walks were saved, so a failed sync is simply retried.
 */
import { StepSource } from './stepSource';
import { detectWalks, DetectedWalk, MINUTE } from './walkDetection';
import { getDayBoundaryWindow, getTrackingDayDateString } from '../../utils/dayBoundary';

const DAY = 24 * 60 * MINUTE;

export interface SyncDeps {
  source: StepSource;
  post: (path: string, body: unknown) => Promise<unknown>;
  put: (path: string, body: unknown) => Promise<unknown>;
  now: number;
  /** Where the last sync stopped; null on the first sync. */
  cursor: number | null;
  minWalkMinutes: number;
  strideMeters?: number;
  timezone: string;
  /** The member's Day Reset Boundary: the hour their tracking day starts. */
  boundaryHour: number;
}

export interface SyncOutcome {
  cursor: number;
  walks: DetectedWalk[];
  /** Steps so far today, or null when they could not be read. */
  todaySteps: number | null;
}

/** Start of the tracking day `ms` falls in (the Day Reset Boundary, not midnight). */
export function startOfTrackingDay(ms: number, boundaryHour: number): number {
  return getDayBoundaryWindow(boundaryHour, new Date(ms)).start.getTime();
}

/** YYYY-MM-DD of the tracking day `ms` falls in. */
export function trackingDayKey(ms: number, boundaryHour: number): string {
  return getTrackingDayDateString(new Date(ms), boundaryHour);
}

export async function runAutoWalkSync(deps: SyncDeps): Promise<SyncOutcome> {
  const { source, now } = deps;
  const oldest = now - source.maxHistoryDays * DAY;
  const from = Math.max(deps.cursor ?? oldest, oldest);

  const minutes = await source.minuteSteps(new Date(from), new Date(now));
  const { walks, resumeAt } = detectWalks(minutes, {
    platform: source.kind === 'ios_motion' ? 'ios' : 'android',
    scanEnd: now,
    minWalkMinutes: deps.minWalkMinutes,
    strideMeters: deps.strideMeters,
  });

  if (walks.length > 0) {
    await deps.post('/activity-sessions/auto', {
      walks: walks.map(w => ({
        clientId: w.clientId,
        startTime: new Date(w.startTime).toISOString(),
        endTime: new Date(w.endTime).toISOString(),
        steps: w.steps,
        distanceMeters: w.distanceMeters,
        timezone: deps.timezone,
      })),
    });
  }

  // Daily totals for every tracking day the scan touched (usually just today). A day runs from
  // one Day Reset Boundary to the next; the extra 3 h step keeps daylight-saving days in order.
  const h = deps.boundaryHour;
  const days: Array<{ date: string; steps: number; source: StepSource['kind'] }> = [];
  let todaySteps: number | null = null;
  for (let dayStart = startOfTrackingDay(from, h); dayStart <= now; dayStart = startOfTrackingDay(dayStart + DAY + 3 * 3600000, h)) {
    const dayEnd = Math.min(startOfTrackingDay(dayStart + DAY + 3 * 3600000, h), now);
    try {
      const steps = await source.stepsBetween(new Date(dayStart), new Date(dayEnd));
      days.push({ date: trackingDayKey(dayStart, h), steps, source: source.kind });
      if (dayEnd === now) todaySteps = steps;
    } catch {
      // leave that day as it was rather than saving a zero
    }
  }
  if (days.length > 0) {
    try {
      await deps.put('/activity-sessions/daily-steps', { days });
    } catch {
      // totals are refreshed on every sync, so a miss here heals itself
    }
  }

  return { cursor: resumeAt, walks, todaySteps };
}
