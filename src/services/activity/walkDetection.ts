/**
 * Finds walks in the steps the phone counted on its own, so nobody has to press "Start walking".
 *
 * Input is steps per minute. A minute counts as walking at MIN_CADENCE steps or more (slow walking,
 * on purpose: many members walk slowly on a bad day). Short pauses, like a road crossing, are
 * allowed inside a walk. A walk has to last a while before it is saved (10 min, or 5 for members
 * who chose shorter walks).
 *
 * Pure: no I/O and no clock reads.
 */

export interface MinuteSteps {
  /** Start of the minute, ms since epoch. */
  start: number;
  steps: number;
}

export interface DetectedWalk {
  /** Stable id from the start minute, so finding the same walk again does not save it twice. */
  clientId: string;
  startTime: number;
  endTime: number;
  steps: number;
  distanceMeters: number;
}

export interface DetectOptions {
  /** "ios" or "android"; part of the id. */
  platform: string;
  /** The scan covers minutes up to here; a walk still going on at this point is left for later. */
  scanEnd: number;
  minWalkMinutes?: number;
  minCadence?: number;
  maxPauseMinutes?: number;
  /** A walk whose last step is this close to scanEnd may still be going on. */
  settleMinutes?: number;
  strideMeters?: number;
}

export interface DetectResult {
  walks: DetectedWalk[];
  /** Where the next scan should start: scanEnd, or the start of a walk that may still be going on. */
  resumeAt: number;
}

export const MINUTE = 60000;
export const MIN_CADENCE = 60;
export const DEFAULT_MIN_WALK_MINUTES = 10;
export const MAX_PAUSE_MINUTES = 2;
export const SETTLE_MINUTES = 3;
/** Average adult stride (about 0.414 x height for a 1.69 m person). */
export const DEFAULT_STRIDE_METERS = 0.7;

/** Step length estimated from height, the usual rule of thumb (0.413-0.415 x height). */
export function strideFromHeight(heightCm?: number | null): number {
  if (!heightCm || heightCm < 100 || heightCm > 230) return DEFAULT_STRIDE_METERS;
  return Math.round(heightCm * 0.414) / 100;
}

const minuteOf = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/** "auto:ios:2026-10-27T10:03Z" */
export function walkId(platform: string, startTime: number): string {
  return `auto:${platform}:${new Date(minuteOf(startTime)).toISOString().slice(0, 16)}Z`;
}

export function detectWalks(minutes: MinuteSteps[], opts: DetectOptions): DetectResult {
  const minWalk = opts.minWalkMinutes ?? DEFAULT_MIN_WALK_MINUTES;
  const cadence = opts.minCadence ?? MIN_CADENCE;
  const maxPause = opts.maxPauseMinutes ?? MAX_PAUSE_MINUTES;
  const settle = opts.settleMinutes ?? SETTLE_MINUTES;
  const stride = opts.strideMeters ?? DEFAULT_STRIDE_METERS;

  // One value per minute, so gaps in the input read as zero steps.
  const byMinute = new Map<number, number>();
  for (const m of minutes) {
    if (!Number.isFinite(m.start) || !Number.isFinite(m.steps) || m.steps <= 0) continue;
    const key = minuteOf(m.start);
    byMinute.set(key, (byMinute.get(key) ?? 0) + m.steps);
  }
  const active = Array.from(byMinute.entries())
    .filter(([, steps]) => steps >= cadence)
    .map(([start]) => start)
    .sort((a, b) => a - b);

  const walks: DetectedWalk[] = [];
  let resumeAt = opts.scanEnd;

  let i = 0;
  while (i < active.length) {
    const first = active[i];
    let last = first;
    let j = i + 1;
    // Allow up to maxPause quiet minutes between walking minutes.
    while (j < active.length && active[j] - last <= (maxPause + 1) * MINUTE) {
      last = active[j];
      j++;
    }
    const endTime = last + MINUTE;
    const lengthMinutes = (endTime - first) / MINUTE;

    if (endTime > opts.scanEnd - settle * MINUTE) {
      // Probably still walking: look at it again next time, from its start.
      resumeAt = Math.min(resumeAt, first);
    } else if (lengthMinutes >= minWalk) {
      let steps = 0;
      for (let t = first; t < endTime; t += MINUTE) steps += byMinute.get(t) ?? 0;
      walks.push({
        clientId: walkId(opts.platform, first),
        startTime: first,
        endTime,
        steps,
        distanceMeters: Math.round(steps * stride),
      });
    }
    i = j;
  }

  return { walks, resumeAt };
}
