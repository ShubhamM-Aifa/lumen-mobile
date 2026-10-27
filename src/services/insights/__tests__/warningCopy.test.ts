import { DISCLAIMER_LINE, level1GateLine, trackRecordLine, warningBody, warningHeadline } from '../warningCopy';
import type { WarningData } from '../../../hooks/useWarning';

const base = (over: Partial<WarningData> = {}): WarningData => ({
  ready: true, enabledLevel: 1, alert: true, alertLevel: 1, suppressedByFlare: false, disabled: false,
  level1: { enabled: true, gateReason: null, episodeCount: 5, loggedDays: 60, trackRecord: { followed: 3, of: 7 } },
  ...over,
});

describe('warning card wording', () => {
  it('has a headline and body for level 1, level 0 and no alert', () => {
    expect(warningHeadline(base())).toContain('resemble');
    expect(warningHeadline(base({ alertLevel: 0 }))).toContain('Higher than');
    expect(warningHeadline(base({ alertLevel: null, alert: false }))).toContain('Nothing unusual');
    for (const w of [base(), base({ alertLevel: 0 }), base({ alertLevel: null })]) {
      expect(warningBody(w).length).toBeGreaterThan(0);
    }
  });

  it('gives the natural-frequency track record only for level 1, and only with data', () => {
    expect(trackRecordLine(base())).toBe('A flare followed 3 times out of 7 when this check has gone off before.');
    expect(trackRecordLine(base({ level1: { enabled: true, gateReason: null, episodeCount: 5, loggedDays: 60, trackRecord: { followed: 1, of: 1 } } })))
      .toBe('A flare followed 1 time out of 1 when this check has gone off before.');
    expect(trackRecordLine(base({ level1: { enabled: false, gateReason: 'too_few_episodes', episodeCount: 1, loggedDays: 10, trackRecord: null } }))).toBeNull();
    expect(trackRecordLine(base({ level1: undefined }))).toBeNull();
  });

  it('explains why level 1 is not on yet, by reason', () => {
    expect(level1GateLine(base({ level1: { enabled: false, gateReason: 'too_few_episodes', episodeCount: 2, loggedDays: 50, trackRecord: null } })))
      .toContain('2 so far');
    expect(level1GateLine(base({ level1: { enabled: false, gateReason: 'too_few_logged_days', episodeCount: 5, loggedDays: 20, trackRecord: null } })))
      .toContain('20 so far');
    expect(level1GateLine(base())).toBeNull(); // already enabled
  });
});

describe('copy lint: no diagnosis, prediction or treatment-change words', () => {
  const BANNED = [
    /\bcaus(e|es|ed|ing)\b/i, /\bbecause\b/i, /\bdue to\b/i, /\bwill have\b/i, /\byou have\b/i,
    /\bdiagnos/i, /\bpredict/i, /\bguarantee/i, /\bshould\b/i, /\bmust\b/i,
    /\bstop taking\b/i, /\bstart taking\b/i, /\bincrease your\b/i, /\breduce your\b/i,
  ];

  it('holds across every headline, body and track-record line', () => {
    const states: WarningData[] = [
      base(), base({ alertLevel: 0 }), base({ alertLevel: null, alert: false }),
      base({ level1: { enabled: false, gateReason: 'too_few_episodes', episodeCount: 1, loggedDays: 10, trackRecord: null } }),
    ];
    for (const w of states) {
      for (const text of [warningHeadline(w), warningBody(w), trackRecordLine(w), level1GateLine(w)].filter((t): t is string => !!t)) {
        // "not a prediction" denies prediction; the lint allows that denial through
        const cleaned = text.replace('not a prediction', '');
        for (const re of BANNED) expect(cleaned).not.toMatch(re);
      }
    }
  });

  it('holds for the fixed disclaimer, which only denies prediction/diagnosis/dosing', () => {
    // "not a diagnosis or a prediction" and "never change a medicine" are denials, which this lint allows through
    const denialFree = DISCLAIMER_LINE
      .replace('not a diagnosis or a prediction', '')
      .replace('never change a medicine based on this alone', '');
    for (const re of BANNED) expect(denialFree).not.toMatch(re);
  });

  it('never states the track record as a future-looking percentage promise', () => {
    expect(trackRecordLine(base())).not.toMatch(/%/);
    expect(trackRecordLine(base())).not.toMatch(/\bwill\b/i);
  });
});
