/**
 * The words on an Insights card, in one place so one test can check all of them.
 *
 * Rules: say what was logged ("on 9 of 14 days"), never what caused what; "linked", "came with",
 * "was logged more often", never a cause; keep sentences short for a tired reader.
 * Pure: no I/O, no clock.
 */
import type { InsightFinding } from '../../hooks/useInsights';

/** Shown on every card, always visible. */
export const TOGETHER_NOT_CAUSE = 'These happened together in your logs. That does not show that one causes the other.';

/** Lower-case the first letter of a label mid-sentence, but leave acronyms (IBS, GERD) alone. */
export function inSentence(label: string): string {
  const t = label.trim();
  if (t.length < 2) return t.toLowerCase();
  return t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase() ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

/** "The day after", "Two days after", or "On days with". */
function lead(lagDays: number): string {
  if (lagDays <= 0) return 'On days with';
  if (lagDays === 1) return 'The day after';
  return 'Two days after';
}

/** One plain sentence about the pattern. */
export function headline(f: InsightFinding): string {
  const exposure = f.exposure.optionLabel.trim();
  const outcome = inSentence(f.outcome.optionLabel);
  return `${lead(f.lagDays)} ${exposure}, ${outcome} was logged more often.`;
}

/** "9 of 14 days after Dairy, compared with 6 of 31 other days." */
export function statLine(f: InsightFinding): string {
  const { exposedWith, exposedTotal, otherWith, otherTotal } = f.counts;
  const what = f.lagDays <= 0 ? 'days with' : 'days after';
  return `${exposedWith} of ${exposedTotal} ${what} ${f.exposure.optionLabel.trim()}, compared with ${otherWith} of ${otherTotal} other days.`;
}

export function tierLabel(tier: InsightFinding['tier']): string {
  return tier === 'consistent' ? 'Consistent pattern' : 'Possible link';
}

/** How sure to sound; the possible tier always carries the "chance" caveat. */
export function tierNote(tier: InsightFinding['tier']): string {
  return tier === 'consistent'
    ? 'It has held up across your logs so far. Keep logging to see if it continues.'
    : 'This could be chance. It needs more days to be sure.';
}

export function rates(f: InsightFinding): { withRate: number; otherRate: number } {
  const { exposedWith, exposedTotal, otherWith, otherTotal } = f.counts;
  return {
    withRate: exposedTotal > 0 ? exposedWith / exposedTotal : 0,
    otherRate: otherTotal > 0 ? otherWith / otherTotal : 0,
  };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "Not seen since 12 Oct", from a YYYY-MM-DD day. */
export function notSeenSince(day?: string): string {
  if (!day) return 'Not seen in your latest logs';
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'Not seen in your latest logs';
  return `Not seen since ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

/** How many more days until patterns can be tested, for the "building your picture" card. */
export function progressText(observedDays: number, daysNeeded: number): { title: string; body: string } {
  if (observedDays < daysNeeded) {
    const left = daysNeeded - observedDays;
    return {
      title: 'Building your picture',
      body: `Patterns usually need 6 to 8 weeks of regular logging. You have ${observedDays} logged ${observedDays === 1 ? 'day' : 'days'} so far; ${left} more ${left === 1 ? 'day' : 'days'} before Lumen starts comparing.`,
    };
  }
  return {
    title: 'No patterns yet',
    body: 'That is normal and is not a sign anything is wrong. Lumen only shows a pattern after it has held up on two different days, so it can take weeks.',
  };
}
