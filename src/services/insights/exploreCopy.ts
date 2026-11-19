/**
 * Every sentence the Explore pane shows. Pure functions, no clock or I/O.
 * Rules (checked by exploreCopy.test.ts): plain counts, never cause words, never advice to
 * start, stop or change anything; the "together, not cause" line is always available.
 */
import type { BinaryFinding, ExploreDirection, Flag, LagKey, NumericFinding, Tier } from '../../hooks/useAnalytics';

export const TOGETHER_NOT_CAUSE = 'These show what tends to happen around it in your logs. They don’t show that one thing leads to the other.';

export function lagPhrase(lag: LagKey, direction: ExploreDirection): string {
  if (lag === 0) return 'same day';
  if (lag === 'w3') return direction === 'before' ? 'in the 3 days before' : 'in the 3 days after';
  if (direction === 'before') return lag === 1 ? 'the day before' : `${lag} days before`;
  return lag === 1 ? 'the next day' : `${lag} days later`;
}

const pctOf = (a: number, n: number) => (n > 0 ? Math.round((a / n) * 100) : 0);

export function tierLabel(tier: Tier): string {
  return tier === 'consistent' ? 'Consistent' : tier === 'possible' ? 'Possible' : 'No clear difference';
}

export function tierHelp(tier: Tier): string {
  return tier === 'consistent'
    ? 'Showed up in both halves of your history and held up when Lumen shuffled the days.'
    : 'Stands out, but with fewer days behind it. Worth watching.';
}

/** Card title, e.g. "Dairy · the day before" or "Less often: Walk · same day". */
export function findingTitle(f: Pick<BinaryFinding, 'label' | 'lag' | 'way'>, direction: ExploreDirection): string {
  return `${f.way === 'less' ? 'Less often: ' : ''}${f.label} · ${lagPhrase(f.lag, direction)}`;
}

/**
 * The counts behind a card.
 * Before: how often the picked thing showed up after this item, vs other days.
 * After: how often this item showed up after the picked thing, vs after other days.
 */
export function findingCounts(f: Pick<BinaryFinding, 'a' | 'b' | 'c' | 'd' | 'label' | 'lag'>, targetLabel: string, direction: ExploreDirection): string {
  const withN = f.a + f.b;
  const otherN = f.c + f.d;
  if (direction === 'before') {
    const when = f.lag === 0 ? `on days with ${f.label}` : `after days with ${f.label}`;
    return `${targetLabel} on ${f.a} of ${withN} days ${when} (${pctOf(f.a, withN)}%), compared with ${f.c} of ${otherN} other days (${pctOf(f.c, otherN)}%).`;
  }
  const when = f.lag === 0 ? `days with ${targetLabel}` : `days after ${targetLabel}`;
  return `${f.label} on ${f.a} of ${withN} ${when} (${pctOf(f.a, withN)}%), compared with ${f.c} of ${otherN} other days (${pctOf(f.c, otherN)}%).`;
}

export function flagText(flag: Flag): string {
  switch (flag) {
    case 'logged_together': return 'Usually logged in the same hour, so it may be part of the same moment rather than something before it.';
    case 'already_before': return 'It was already more common the day before, so it may not follow on from this.';
    case 'often_after_symptom': return 'Often logged soon after a symptom; those times were left out here.';
    case 'weak_days': return 'Some of these days had only light logging.';
  }
}

export function numericSentence(n: NumericFinding, targetLabel: string, direction: ExploreDirection): string {
  const unit = n.unit ? ` ${n.unit}` : '';
  const when = n.lag === 0 ? 'on' : direction === 'before' ? 'the day before' : 'the day after';
  return `${n.label}: typically ${n.medianWith}${unit} ${when} ${targetLabel} days, compared with ${n.medianOther}${unit} ${n.lag === 0 ? 'on' : 'around'} other days (${n.nWith} and ${n.nOther} days).`;
}

export function headerText(label: string, days: number, observed: number): string {
  if (observed === 0) return `No logged days to compare yet.`;
  return `${label}: ${days} of ${observed} logged day${observed === 1 ? '' : 's'}.`;
}

export function checkedText(checked: number, found: number): string {
  if (checked === 0) return 'Not enough logged days to compare anything yet.';
  return `Lumen compared ${checked} thing${checked === 1 ? '' : 's'}. ${found === 0 ? 'Nothing stood out clearly.' : `${found} stood out.`}`;
}

export function caveatText(code: string, ctx: { checked: number; days: number }): string | null {
  switch (code) {
    case 'together_not_cause': return TOGETHER_NOT_CAUSE;
    case 'many_checked': return `With ${ctx.checked} comparisons, one or two can look linked just by chance. “Consistent” ones are the most reliable.`;
    case 'few_target_days': return `Only ${ctx.days} day${ctx.days === 1 ? '' : 's'} so far, so treat this as a first look.`;
    case 'rise_baseline': return '“Higher than usual” compares each day with your own previous two weeks.';
    case 'unmarked_left_out': return 'Doses you didn’t mark are left out of both groups. Days when every planned dose was taken are the comparison.';
    case 'period_rtm': return 'A stretch you picked for being hard often looks better afterwards on its own, so keep that in mind.';
    default: return null;
  }
}

export function notEnoughText(label: string, days: number): string {
  return `${label}: ${days} day${days === 1 ? '' : 's'} so far.`;
}

/** What "Find what's linked" asks Lumen AI. */
export function brainstormPrompt(targetLabel: string, direction: ExploreDirection): string {
  return direction === 'before'
    ? `Looking at the attached Explore results, what might be linked with “${targetLabel}” in my logs, what could explain it, and what could I test with a 6-week experiment or ask my doctor about?`
    : `Looking at the attached Explore results, what tends to follow “${targetLabel}” in my logs, what could explain it, and what could I test or ask my doctor about?`;
}
