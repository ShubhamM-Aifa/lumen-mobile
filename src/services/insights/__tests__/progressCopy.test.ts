import {
  compareCaveats, compareFlareLine, compareNotReadyText, compareSeverityLine, compareSymptomRateLine,
  goodBadSummary, regimeShiftLine, trendBody, trendHeadline,
} from '../progressCopy';
import type { TrendData, GoodBadDaysData, RegimeShiftData } from '../../../hooks/useProgress';
import type { CompareData } from '../../../hooks/useCompare';

const trend = (over: Partial<TrendData> = {}): TrendData => ({
  state: 'improving', weeklyValues: [], pValue: 0.02, estimatedChange: -3, weeksNeeded: 0, ...over,
});

describe('trend wording', () => {
  it('has a headline and a body for every state', () => {
    for (const state of ['improving', 'worsening', 'steady', 'mixed', 'not_enough_data'] as const) {
      const t = trend({ state, weeksNeeded: 2 });
      expect(trendHeadline(t).length).toBeGreaterThan(0);
      expect(trendBody(t).length).toBeGreaterThan(0);
    }
  });

  it('says how many weeks are still needed', () => {
    expect(trendBody(trend({ state: 'not_enough_data', weeksNeeded: 1 }))).toContain('1 more week');
    expect(trendBody(trend({ state: 'not_enough_data', weeksNeeded: 4 }))).toContain('4 more weeks');
  });

  it('calls "mixed" normal, not worrying', () => {
    expect(trendBody(trend({ state: 'mixed' }))).toContain('not a sign anything is wrong');
  });
});

describe('regimeShiftLine', () => {
  it('is null with no shift', () => {
    expect(regimeShiftLine(null)).toBeNull();
  });

  it('names the date and direction', () => {
    const shift: RegimeShiftData = { dayKey: '2026-10-12', direction: 'up' };
    const line = regimeShiftLine(shift);
    expect(line).toContain('12 Oct');
    expect(line).toContain('higher');
    expect(regimeShiftLine({ dayKey: '2026-10-12', direction: 'down' })).toContain('lower');
  });
});

describe('goodBadSummary', () => {
  it('asks for more logging when nothing is observed yet', () => {
    expect(goodBadSummary({ good: 0, bad: 0, observed: 0, windowDays: 28 })).toContain('Keep logging');
  });

  it('reports good, bad and in-between counts', () => {
    const s = goodBadSummary({ good: 10, bad: 4, observed: 20, windowDays: 28 });
    expect(s).toContain('10 good');
    expect(s).toContain('4 harder');
    expect(s).toContain('6 in between');
    expect(s).toContain('out of 20 logged days');
  });

  it('leaves out "in between" when there is none', () => {
    expect(goodBadSummary({ good: 10, bad: 10, observed: 20, windowDays: 28 })).not.toContain('in between');
  });
});

const ready = (over: Partial<CompareData> = {}): CompareData => ({
  ready: true, eventDay: '2026-09-01', washoutDays: 7, preDays: 28, postDays: 28,
  symptomDayRate: { value: -0.4, ci95: [-0.6, -0.15] },
  medianShift: { value: -3.2, ci95: [-5, -1.5] },
  flaresPer28: { value: -1, ci95: [-2, 0] },
  startedDuringRoughPatch: false, alreadyImproving: false,
  ...over,
});

describe('compare wording', () => {
  it('reports the symptom-day rate change with its interval, in plain percentages', () => {
    expect(compareSymptomRateLine(ready())).toBe('Days with a symptom logged changed by -40% (uncertainty -60% to -15%).');
  });

  it('reports the severity shift with its direction and interval', () => {
    expect(compareSeverityLine(ready())).toBe('Typical daily severity moved down by 3.2 points (uncertainty -5.0 to -1.5).');
    expect(compareSeverityLine(ready({ medianShift: { value: 2, ci95: [0.5, 3] } }))).toContain('moved up by 2.0');
  });

  it('reports flares per 28 days before and after', () => {
    expect(compareFlareLine(ready({ preFlares: 3, postFlares: 1 }))).toBe('Flares per 28 days: 3 before, 1 after.');
  });

  it('returns nothing when not ready', () => {
    const notReady: CompareData = { ready: false, eventDay: '2026-09-01', washoutDays: 7, preDays: 2, postDays: 0 };
    expect(compareSymptomRateLine(notReady)).toBeNull();
    expect(compareSeverityLine(notReady)).toBeNull();
    expect(compareFlareLine(notReady)).toBeNull();
  });

  it('lists the honesty caveats only when they apply', () => {
    expect(compareCaveats(ready())).toEqual([]);
    expect(compareCaveats(ready({ startedDuringRoughPatch: true }))[0]).toContain('rough patch');
    expect(compareCaveats(ready({ alreadyImproving: true }))[0]).toContain('already trending');
    expect(compareCaveats(ready({ startedDuringRoughPatch: true, alreadyImproving: true }))).toHaveLength(2);
  });

  it('explains each not-ready reason', () => {
    const base = { ready: false as const, eventDay: '2026-09-01', washoutDays: 7 };
    expect(compareNotReadyText({ ...base, preDays: 5, postDays: 0, needed: 14, reason: 'not_enough_pre_data' })).toContain('5 of 14');
    expect(compareNotReadyText({ ...base, preDays: 28, postDays: 0, needed: 7, reason: 'event_too_recent' })).toContain('washout');
    expect(compareNotReadyText({ ...base, preDays: 28, postDays: 3, needed: 14, reason: 'not_enough_post_data' })).toContain('3 of 14');
  });
});

describe('copy lint: no causal, advisory or diagnostic words', () => {
  const BANNED = [
    /\bcaus(e|es|ed|ing)\b/i, /\bbecause\b/i, /\bdue to\b/i, /\bleads? to\b/i, /\bresults? in\b/i,
    /\btriggers?\b/i, /\bmakes? you\b/i, /\bshould\b/i, /\bavoid\b/i, /\bstop\b/i, /\bstart\b/i,
    /\bdiagnos/i, /\bprove[sd]?\b/i, /\bmedicine\b/i, /\bdose\b/i,
  ];

  it('holds for every trend state and shift direction', () => {
    for (const state of ['improving', 'worsening', 'steady', 'mixed', 'not_enough_data'] as const) {
      const t = trend({ state, weeksNeeded: 3 });
      for (const text of [trendHeadline(t), trendBody(t)]) {
        for (const re of BANNED) expect(text).not.toMatch(re);
      }
    }
    for (const direction of ['up', 'down'] as const) {
      for (const re of BANNED) expect(regimeShiftLine({ dayKey: '2026-10-01', direction })).not.toMatch(re);
    }
  });

  it('holds for the compare lines and caveats', () => {
    const texts = [
      compareSymptomRateLine(ready()), compareSeverityLine(ready()), compareFlareLine(ready()),
      ...compareCaveats(ready({ startedDuringRoughPatch: true, alreadyImproving: true })),
      goodBadSummary({ good: 5, bad: 5, observed: 20, windowDays: 28 }),
      compareNotReadyText({ ready: false, eventDay: 'x', washoutDays: 7, preDays: 1, postDays: 0, reason: 'not_enough_pre_data', needed: 14 }),
    ].filter((t): t is string => !!t);
    for (const text of texts) {
      for (const re of BANNED) expect(text).not.toMatch(re);
    }
  });
});
