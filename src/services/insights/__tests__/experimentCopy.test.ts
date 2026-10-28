import {
  EXPERIMENT_DISCLAIMER, MEDICINE_LINE, resultLine, scheduleLine, significanceLine, thinDataLine,
} from '../experimentCopy';
import type { ExperimentData } from '../../../hooks/useExperiments';

const base = (over: Partial<ExperimentData> = {}): ExperimentData => ({
  id: 'e1', exposureKey: 'opt_coffee', exposureLabel: 'Coffee', outcomeKey: 'opt_headache', outcomeLabel: 'Headache',
  startDay: '2026-09-01', endDay: '2026-10-12', washoutDays: 2, isMedicineRelated: false, status: 'active',
  progress: { currentBlockIndex: 2, currentBlock: 'with', dayInBlock: 4, daysElapsed: 18, daysRemaining: 24, readyForAnalysis: false },
  result: null,
  ...over,
});

describe('experiment wording', () => {
  it('describes the current week without revealing the schedule in advance', () => {
    expect(scheduleLine(base())).toBe('Week 3 of 6, day 4 of 7 — this week is with Coffee.');
    expect(scheduleLine(base({ progress: { ...base().progress, currentBlock: 'without' } }))).toContain('without Coffee');
  });

  it('says it has not started yet, and that it is complete', () => {
    expect(scheduleLine(base({ progress: { currentBlockIndex: null, currentBlock: null, dayInBlock: null, daysElapsed: 0, daysRemaining: 42, readyForAnalysis: false } })))
      .toContain('Starts 2026-09-01');
    expect(scheduleLine(base({ progress: { currentBlockIndex: 5, currentBlock: 'with', dayInBlock: 7, daysElapsed: 42, daysRemaining: 1, readyForAnalysis: true } })))
      .toBe('The six weeks are complete.');
  });

  it('reports the result as X of Y days in each kind of week', () => {
    const e = base({ result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 } });
    expect(resultLine(e)).toBe('Headache: 9 of 15 days with Coffee, compared with 3 of 15 days without it.');
  });

  it('is null before there is a result', () => {
    expect(resultLine(base())).toBeNull();
    expect(significanceLine(base())).toBe('');
  });

  it('calls out a real difference only at or under p = 0.05, in the direction observed', () => {
    const sig = base({ result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 } });
    expect(significanceLine(sig)).toContain('more common in the weeks with Coffee');
    const sigDown = base({ result: { withCount: 2, withTotal: 15, withoutCount: 9, withoutTotal: 15, statistic: -0.47, pValue: 0.05, thinBlocks: 0 } });
    expect(significanceLine(sigDown)).toContain('less common in the weeks with Coffee');
    const notSig = base({ result: { withCount: 7, withTotal: 15, withoutCount: 6, withoutTotal: 15, statistic: 0.07, pValue: 0.4, thinBlocks: 0 } });
    expect(significanceLine(notSig)).toContain('could easily be chance');
  });

  it('flags thin weeks only when there are some', () => {
    expect(thinDataLine(base({ result: { withCount: 1, withTotal: 2, withoutCount: 1, withoutTotal: 2, statistic: 0, pValue: 1, thinBlocks: 2 } })))
      .toBe('2 of the 6 weeks had too few logged days to read with confidence.');
    expect(thinDataLine(base({ result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 } })))
      .toBeNull();
  });
});

describe('copy lint: no causal, diagnostic or unprompted dosing words', () => {
  const BANNED = [
    /\bcaus(e|es|ed|ing)\b/i, /\bbecause\b/i, /\bdue to\b/i, /\btriggers?\b/i,
    /\bdiagnos/i, /\bprove[sd]?\b/i, /\bguarantee/i,
  ];

  it('holds across schedule, result, significance and thin-data lines', () => {
    const states = [
      base(),
      base({ progress: { currentBlockIndex: null, currentBlock: null, dayInBlock: null, daysElapsed: 0, daysRemaining: 42, readyForAnalysis: false } }),
      base({ result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 1 } }),
      base({ result: { withCount: 7, withTotal: 15, withoutCount: 6, withoutTotal: 15, statistic: 0.07, pValue: 0.4, thinBlocks: 0 } }),
    ];
    for (const e of states) {
      for (const text of [scheduleLine(e), resultLine(e), significanceLine(e), thinDataLine(e)].filter((t): t is string => !!t)) {
        for (const re of BANNED) expect(text).not.toMatch(re);
      }
    }
  });

  it('the medicine line only ever tells the member to involve their doctor, never to act alone', () => {
    expect(MEDICINE_LINE).toContain('doctor');
    expect(MEDICINE_LINE).not.toMatch(/\bstart\b(?!\s+a\s+medicine\s+based)/i); // no bare instruction to start something
    expect(MEDICINE_LINE).not.toMatch(/\byou should take\b/i);
  });

  it('the fixed disclaimer never oversells the result', () => {
    for (const re of BANNED) expect(EXPERIMENT_DISCLAIMER).not.toMatch(re);
    expect(EXPERIMENT_DISCLAIMER).toContain('not a controlled trial');
  });

  it('never states the result as a percentage promise', () => {
    const e = base({ result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 } });
    expect(resultLine(e)).not.toMatch(/%/);
  });
});
