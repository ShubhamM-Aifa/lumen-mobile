import {
  headline, inSentence, notSeenSince, progressText, rates, statLine, tierLabel, tierNote, TOGETHER_NOT_CAUSE,
} from '../insightCopy';
import type { InsightFinding } from '../../../hooks/useInsights';

const finding = (over: Partial<InsightFinding> = {}): InsightFinding => ({
  id: 'f1',
  exposureKey: 'opt_dairy',
  outcomeKey: 'opt_pain',
  exposure: { categoryName: 'Food & Drink', optionLabel: 'Dairy' },
  outcome: { categoryName: 'Symptoms', optionLabel: 'Joint pain' },
  lagDays: 1,
  counts: { exposedWith: 9, exposedTotal: 14, otherWith: 6, otherTotal: 31 },
  tier: 'possible',
  noLongerSeen: false,
  weakDays: false,
  ...over,
});

describe('insight card wording', () => {
  it('says what was logged, with the counts', () => {
    expect(headline(finding())).toBe('The day after Dairy, joint pain was logged more often.');
    expect(statLine(finding())).toBe('9 of 14 days after Dairy, compared with 6 of 31 other days.');
  });

  it('words the three lags differently', () => {
    expect(headline(finding({ lagDays: 0 }))).toBe('On days with Dairy, joint pain was logged more often.');
    expect(headline(finding({ lagDays: 2 }))).toBe('Two days after Dairy, joint pain was logged more often.');
    expect(statLine(finding({ lagDays: 0 }))).toBe('9 of 14 days with Dairy, compared with 6 of 31 other days.');
  });

  it('keeps acronyms in capitals mid-sentence', () => {
    expect(inSentence('IBS flare')).toBe('IBS flare');
    expect(inSentence('Joint pain')).toBe('joint pain');
    expect(inSentence('X')).toBe('x');
  });

  it('labels the two tiers and always carries a caveat', () => {
    expect(tierLabel('possible')).toBe('Possible link');
    expect(tierLabel('consistent')).toBe('Consistent pattern');
    expect(tierNote('possible')).toContain('could be chance');
  });

  it('works out the two rates for the bars, and survives empty groups', () => {
    expect(rates(finding())).toEqual({ withRate: 9 / 14, otherRate: 6 / 31 });
    expect(rates(finding({ counts: { exposedWith: 0, exposedTotal: 0, otherWith: 0, otherTotal: 0 } }))).toEqual({ withRate: 0, otherRate: 0 });
  });

  it('names when a pattern stopped showing', () => {
    expect(notSeenSince('2026-10-12')).toBe('Not seen since 12 Oct');
    expect(notSeenSince(undefined)).toBe('Not seen in your latest logs');
    expect(notSeenSince('nonsense')).toBe('Not seen in your latest logs');
  });

  it('explains progress and the empty state calmly', () => {
    expect(progressText(10, 30).body).toContain('20 more days');
    expect(progressText(29, 30).body).toContain('1 more day before');
    expect(progressText(1, 30).body).toContain('1 logged day so far');
    expect(progressText(40, 30).title).toBe('No patterns yet');
    expect(progressText(40, 30).body).toContain('not a sign anything is wrong');
  });
});

describe('copy lint: no causal or advisory words anywhere on an insight card', () => {
  // Plain words a card must never contain. User-typed item names are not part of the card's own copy.
  const BANNED = [
    /\bcaus(e|es|ed|ing)\b/i, /\bbecause\b/i, /\bdue to\b/i, /\bleads? to\b/i, /\bresults? in\b/i,
    /\btriggers?\b/i, /\bmakes? you\b/i, /\bresponsible for\b/i, /\bshould\b/i, /\bavoid\b/i, /\bstop\b/i,
    /\bdiagnos/i, /\bprove[sd]?\b/i,
  ];

  const everything = (f: InsightFinding) => [
    headline(f), statLine(f), tierLabel(f.tier), tierNote(f.tier), notSeenSince(f.lastShownDay),
  ];
  const samples: InsightFinding[] = [0, 1, 2].flatMap(lagDays =>
    (['possible', 'consistent'] as const).map(tier => finding({ lagDays, tier })));

  it('holds for every lag and tier', () => {
    for (const f of samples) {
      for (const text of everything(f)) {
        for (const re of BANNED) expect(text).not.toMatch(re);
      }
    }
  });

  it('holds for the fixed lines and the progress and empty states', () => {
    const fixed = [TOGETHER_NOT_CAUSE, ...[0, 10, 29, 30, 60].flatMap(n => Object.values(progressText(n, 30)))];
    for (const text of fixed) {
      // "does not show that one causes the other" is the one allowed use: it denies causation
      const withoutDenial = text.replace('does not show that one causes the other', '');
      for (const re of BANNED) expect(withoutDenial).not.toMatch(re);
    }
    expect(TOGETHER_NOT_CAUSE).toContain('does not show that one causes the other');
  });

  it('never states a percentage gap as a promise', () => {
    for (const f of samples) {
      expect(headline(f)).not.toMatch(/%|times more|x more/);
    }
  });
});
