/**
 * The words on the progress and "did it help?" cards, in one place so one test can check all of
 * them. Same rules as insightCopy.ts: no cause, no "should", no diagnosis; plain numbers over
 * percentages; the 2-point/30% bar is called a "noticeable change for many people", not a medical
 * threshold, because it comes from pain-scale research and is being reused here for other symptoms.
 */
import type { TrendData, GoodBadDaysData, RegimeShiftData } from '../../hooks/useProgress';
import type { CompareData } from '../../hooks/useCompare';

export function trendHeadline(trend: TrendData): string {
  switch (trend.state) {
    case 'improving': return 'Your logs look better lately';
    case 'worsening': return 'Your logs look harder lately';
    case 'steady': return 'Holding steady';
    case 'mixed': return 'No clear direction yet';
    case 'not_enough_data': return 'Building your trend';
  }
}

export function trendBody(trend: TrendData): string {
  switch (trend.state) {
    case 'improving':
      return 'Your weekly numbers have come down by a noticeable amount for many people. Keep logging to see if it continues.';
    case 'worsening':
      return 'Your weekly numbers have gone up by a noticeable amount for many people. This is worth mentioning to your doctor.';
    case 'steady':
      return 'Your weekly numbers have stayed in a similar range for a while.';
    case 'mixed':
      return 'Your weeks have moved around without a clear direction. That is common and not a sign anything is wrong.';
    case 'not_enough_data': {
      const n = trend.weeksNeeded;
      return `A trend needs ${trend.weeksNeeded >= 0 ? n : 0} more ${n === 1 ? 'week' : 'weeks'} of logging with at least a few days each.`;
    }
  }
}

export function regimeShiftLine(shift: RegimeShiftData | null): string | null {
  if (!shift) return null;
  const d = new Date(`${shift.dayKey}T12:00:00Z`);
  const when = Number.isNaN(d.getTime()) ? 'recently' : `since about ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
  return shift.direction === 'up'
    ? `Your day-to-day numbers ${when} have been running higher than before.`
    : `Your day-to-day numbers ${when} have been running lower than before.`;
}

export function goodBadSummary(gbd: GoodBadDaysData): string {
  if (gbd.observed === 0) return 'Keep logging to build up a picture of your good and bad days.';
  const neutral = gbd.observed - gbd.good - gbd.bad;
  const parts = [`${gbd.good} good`, `${gbd.bad} harder`];
  if (neutral > 0) parts.push(`${neutral} in between`);
  return `In the last ${gbd.windowDays} days: ${parts.join(', ')} (out of ${gbd.observed} logged days).`;
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;

/** "Days with a symptom logged changed by -40% (uncertainty -60% to -15%)." */
export function compareSymptomRateLine(c: CompareData): string | null {
  if (!c.ready || !c.symptomDayRate) return null;
  return `Days with a symptom logged changed by ${pct(c.symptomDayRate.value)} (uncertainty ${pct(c.symptomDayRate.ci95[0])} to ${pct(c.symptomDayRate.ci95[1])}).`;
}

export function compareSeverityLine(c: CompareData): string | null {
  if (!c.ready || !c.medianShift) return null;
  const v = c.medianShift.value;
  const dir = v < 0 ? 'down' : v > 0 ? 'up' : 'unchanged';
  return `Typical daily severity moved ${dir} by ${Math.abs(v).toFixed(1)} points (uncertainty ${c.medianShift.ci95[0].toFixed(1)} to ${c.medianShift.ci95[1].toFixed(1)}).`;
}

export function compareFlareLine(c: CompareData): string | null {
  if (!c.ready || !c.flaresPer28) return null;
  return `Flares per 28 days: ${c.preFlares ?? 0} before, ${c.postFlares ?? 0} after.`;
}

export function compareCaveats(c: CompareData): string[] {
  if (!c.ready) return [];
  const out: string[] = [];
  if (c.startedDuringRoughPatch) out.push('You started during a rough patch; some of this change may have happened anyway.');
  if (c.alreadyImproving) out.push('Your logs were already trending that way before this change.');
  return out;
}

export function compareNotReadyText(c: CompareData): string {
  switch (c.reason) {
    case 'not_enough_pre_data':
      return `Not enough logged days before this date yet (${c.preDays} of ${c.needed ?? 14} needed).`;
    case 'event_too_recent':
      return `Still in the washout period. Check back after ${c.needed ?? c.washoutDays} days have passed.`;
    case 'not_enough_post_data':
      return `Not enough logged days since this date yet (${c.postDays} of ${c.needed ?? 14} needed).`;
    default:
      return 'Not enough data yet to compare.';
  }
}
