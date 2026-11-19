/** Explore and Metrics wording: counts stated plainly, no cause/advice words anywhere. */
import {
  brainstormPrompt, caveatText, checkedText, findingCounts, findingTitle, flagText, headerText, lagPhrase, notEnoughText,
  numericSentence, tierHelp, tierLabel, TOGETHER_NOT_CAUSE,
} from '../exploreCopy';
import {
  changeText, changeTone, coverageText, goalText, METRICS_NOTE, rhoText, SCATTER_NOTE, trendText, valueText,
} from '../metricsCopy';
import type { BinaryFinding, NumericFinding } from '../../../hooks/useAnalytics';

const BANNED = [
  /\bcaus(e|es|ed|ing)\b/i, /\bbecause\b/i, /\bdue to\b/i, /\btriggers?\b/i, /\bmakes? you\b/i, /\bshould\b/i,
  /\bavoid\b/i, /\bstop\b/i, /\bdiagnos/i, /\bprove[sd]?\b/i, /\bresults? in\b/i, /\bmust\b/i, /\bguarantee/i,
];

const f = (over: Partial<BinaryFinding> = {}): BinaryFinding => ({
  key: 'opt_dairy', label: 'Dairy', type: 'item', lag: 1, way: 'more', a: 6, b: 3, c: 8, d: 43,
  rateWith: 0.667, rateOther: 0.157, shrunkRR: 2.4, q: 0.03, tier: 'possible', flags: [], ...over,
});
const n: NumericFinding = { id: 'sleep_hours', label: 'Sleep', unit: 'h', lag: 1, medianWith: 5.8, medianOther: 7.2, shift: -1.3, nWith: 9, nOther: 51, q: 0.02, tier: 'possible' };

function everything(): string[] {
  const out: string[] = [TOGETHER_NOT_CAUSE, METRICS_NOTE, SCATTER_NOTE];
  for (const dir of ['before', 'after'] as const) {
    for (const lag of [0, 1, 2, 'w3'] as const) {
      out.push(lagPhrase(lag, dir), findingTitle(f({ lag }), dir), findingCounts(f({ lag }), 'Weakness', dir), numericSentence({ ...n, lag: lag === 0 ? 0 : 1 }, 'Weakness', dir));
    }
    out.push(findingTitle(f({ way: 'less' }), dir), brainstormPrompt('Weakness', dir));
  }
  for (const t of ['consistent', 'possible', 'none'] as const) out.push(tierLabel(t), tierHelp(t));
  for (const fl of ['logged_together', 'already_before', 'often_after_symptom', 'weak_days'] as const) out.push(flagText(fl));
  for (const c of ['together_not_cause', 'many_checked', 'few_target_days', 'rise_baseline', 'unmarked_left_out', 'period_rtm']) out.push(caveatText(c, { checked: 40, days: 5 }) ?? '');
  out.push(headerText('Weakness', 14, 120), headerText('Weakness', 0, 0), checkedText(40, 2), checkedText(0, 0), notEnoughText('Coffee', 2));
  const s = { unit: 'h', decimals: 1, summary: 'average' as const };
  for (const ch of ['higher', 'lower', 'similar', 'not_enough'] as const) out.push(changeText(ch, { value: 6.5, covered: 20 }, s));
  for (const t of ['rising', 'falling', 'steady', 'not_enough'] as const) out.push(trendText(t));
  out.push(coverageText(18, 30), coverageText(0, 30), goalText({ hit: 12, of: 20 }, 2000, { unit: 'ml', decimals: 0, summary: 'average' }) ?? '');
  out.push(rhoText({ value: 0.42, p: 0.01 }, 40), rhoText({ value: -0.1, p: 0.6 }, 40), rhoText(null, 3));
  return out;
}

describe('Explore and Metrics wording', () => {
  it('never uses cause or advice words', () => {
    for (const text of everything()) {
      for (const re of BANNED) expect({ text, hit: re.test(text) }).toEqual({ text, hit: false });
    }
  });

  it('states counts and percentages the way they are calculated', () => {
    expect(findingCounts(f(), 'Weakness', 'before')).toBe('Weakness on 6 of 9 days after days with Dairy (67%), compared with 8 of 51 other days (16%).');
    expect(findingCounts(f({ lag: 0 }), 'Weakness', 'before')).toBe('Weakness on 6 of 9 days on days with Dairy (67%), compared with 8 of 51 other days (16%).');
    expect(findingCounts(f({ label: 'Fatigue' }), 'Skipped HCQ', 'after')).toBe('Fatigue on 6 of 9 days after Skipped HCQ (67%), compared with 8 of 51 other days (16%).');
    expect(findingTitle(f(), 'before')).toBe('Dairy · the day before');
    expect(findingTitle(f({ lag: 2 }), 'after')).toBe('Dairy · 2 days later');
  });

  it('formats metric values for people', () => {
    expect(valueText({ value: 7.5, unit: 'h', decimals: 1, summary: 'average' })).toBe('7h 30m');
    expect(valueText({ value: 1750, unit: 'ml', decimals: 0, summary: 'average' })).toBe('1.8 L');
    expect(valueText({ value: 25, unit: '%', decimals: 0, summary: 'share' })).toBe('25%');
    expect(valueText({ value: null, unit: 'h', decimals: 1, summary: 'average' })).toBe('–');
    expect(valueText({ value: 6.2, unit: '/10', decimals: 1, summary: 'average' })).toBe('6.2/10');
  });

  it('colours a change by the direction the member prefers', () => {
    expect(changeTone('higher', 'higher')).toBe('good');
    expect(changeTone('higher', 'lower')).toBe('bad');
    expect(changeTone('similar', 'lower')).toBe('neutral');
    expect(changeTone('lower', null)).toBe('neutral');
  });
});
