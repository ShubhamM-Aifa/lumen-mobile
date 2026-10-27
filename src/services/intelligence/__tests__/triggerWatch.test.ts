import {
  buildTriggerWatchCandidates,
  lagPhrase,
  parseLagWindow,
  triggerKeysOf,
  verbFor,
  whenPhrase,
  WatchedEntry,
} from '../triggerWatch';
import type { InsightResult } from '../../../components/insights/InsightCard';

const HOUR = 3600000;
// 2026-10-27 14:00 local
const NOW = new Date(2026, 9, 27, 14, 0, 0).getTime();
const at = (hour: number, min = 0) => new Date(2026, 9, 27, hour, min, 0).toISOString();

const insight = (over: Partial<InsightResult> = {}): InsightResult => ({
  _id: 'i1',
  triggerId: 'opt_dairy',
  symptomId: 'opt_digestive',
  trigger: { categoryName: 'Food & Drink', optionLabel: 'Dairy' },
  symptom: { categoryName: 'Symptoms', optionLabel: 'Digestive issues' },
  lagWindow: '6-24h',
  lift: 1.8,
  supportCount: 9,
  confidence: 'Medium',
  computedAt: '2026-10-27T03:00:00.000Z',
  ...over,
});

const entry = (over: Partial<WatchedEntry> = {}): WatchedEntry => ({
  _id: 'e1', occurredAt: at(12, 30), answers: [{ optionId: 'dairy' }], ...over,
});

const run = (over: Partial<Parameters<typeof buildTriggerWatchCandidates>[0]> = {}) =>
  buildTriggerWatchCandidates({ insights: [insight()], entries: [entry()], now: NOW, seen: new Set(), ...over });

describe('wording helpers', () => {
  it('describes the time the way a person would', () => {
    expect(whenPhrase(new Date(2026, 9, 27, 12, 30), 'Food & Drink')).toBe('at lunch');
    expect(whenPhrase(new Date(2026, 9, 27, 8, 0), 'Food')).toBe('at breakfast');
    expect(whenPhrase(new Date(2026, 9, 27, 19, 30), 'Meals')).toBe('at dinner');
    expect(whenPhrase(new Date(2026, 9, 27, 12, 30), 'Habits')).toBe('this afternoon');
    expect(whenPhrase(new Date(2026, 9, 27, 9, 0), 'Habits')).toBe('this morning');
    expect(whenPhrase(new Date(2026, 9, 27, 18, 0), 'Habits')).toBe('this evening');
    expect(whenPhrase(new Date(2026, 9, 27, 23, 0), 'Habits')).toBe('late tonight');
  });

  it('matches the verb to the symptom name', () => {
    expect(verbFor('Digestive issues')).toBe('have');
    expect(verbFor('Fatigue')).toBe('has');
    expect(verbFor('Joint pain')).toBe('has');
    expect(verbFor('Headaches')).toBe('have');
    expect(verbFor('Stress')).toBe('has');
  });

  it('formats lag windows', () => {
    expect(parseLagWindow('6-24h')).toEqual([6, 24]);
    expect(parseLagWindow('nonsense')).toBeNull();
    expect(lagPhrase([6, 24])).toBe('6–24 h');
    expect(lagPhrase([0, 6])).toBe('within 6 h');
  });

  it('lists every id an entry can match on', () => {
    expect(triggerKeysOf({ _id: 'x', occurredAt: at(9), categoryId: 'c1', quickActionId: 'q1', answers: [{ optionId: 'o1' }] }))
      .toEqual(['opt_o1', 'qa_q1', 'cat_c1']);
  });
});

describe('buildTriggerWatchCandidates', () => {
  it('writes the observation in careful words and times the check-in to the pattern', () => {
    const [c] = run();
    expect(c.type).toBe('TRIGGER_WATCH');
    expect(c.title).toBe('You logged Dairy at lunch');
    expect(c.body).toBe('Digestive issues have been more common 6–24 h after it.');
    expect(c.inAppNow).toBe(true);
    // logged 12:30, pattern starts at 6 h, ends at 24 h
    expect(c.notBefore).toBe(new Date(2026, 9, 27, 18, 30).getTime());
    expect(c.expiresAt).toBe(new Date(2026, 9, 28, 12, 30).getTime());
    expect(c.data).toMatchObject({ entryId: 'e1', insightId: 'i1', route: '/(tabs)/insights' });
  });

  it('never uses causal wording', () => {
    const [c] = run();
    const text = `${c.title} ${c.body} ${(c.provenance ?? []).join(' ')}`.toLowerCase();
    for (const bad of ['caused', 'causes', 'because of', 'due to', 'will ', 'you should', 'avoid']) {
      expect(text).not.toContain(bad);
    }
    expect(c.provenance?.[2]).toContain('not a cause');
  });

  it('explains itself without percentages', () => {
    const [c] = run();
    expect(c.provenance?.[0]).toMatch(/You logged Dairy at .* today\./);
    expect(c.provenance?.[1]).toContain('seen 9 times');
    expect((c.provenance ?? []).join(' ')).not.toMatch(/%/);
  });

  it('matches quick taps and whole categories as well as options', () => {
    const byQuick = run({ insights: [insight({ triggerId: 'qa_coffee', trigger: { categoryName: 'Quick tap', optionLabel: 'Coffee' } })], entries: [entry({ answers: [], quickActionId: 'coffee' })] });
    expect(byQuick[0].title).toBe('You logged Coffee this afternoon');
    const byCat = run({ insights: [insight({ triggerId: 'cat_food' })], entries: [entry({ answers: [], categoryId: 'food' })] });
    expect(byCat).toHaveLength(1);
  });

  it('says nothing about weak patterns', () => {
    expect(run({ insights: [insight({ lift: 1.25 })] })).toEqual([]);
  });

  it('ignores entries that match no pattern', () => {
    expect(run({ entries: [entry({ answers: [{ optionId: 'rice' }] })] })).toEqual([]);
  });

  it('ignores things logged more than a day ago, or in the future', () => {
    expect(run({ entries: [entry({ occurredAt: new Date(NOW - 25 * HOUR).toISOString() })] })).toEqual([]);
    expect(run({ entries: [entry({ occurredAt: new Date(NOW + HOUR).toISOString() })] })).toEqual([]);
  });

  it("ignores a pattern whose window has already passed", () => {
    // logged 8 h ago, the pattern only runs 0-6 h after
    const out = run({
      insights: [insight({ lagWindow: '0-6h' })],
      entries: [entry({ occurredAt: new Date(NOW - 8 * HOUR).toISOString() })],
    });
    expect(out).toEqual([]);
  });

  it('mentions each entry once', () => {
    const [first] = run();
    expect(run({ seen: new Set([first.id]) })).toEqual([]);
  });

  it('picks the strongest pattern for one entry', () => {
    const out = run({
      insights: [
        insight({ _id: 'weak', lift: 1.4, supportCount: 5, symptom: { categoryName: 'Symptoms', optionLabel: 'Headache' } }),
        insight({ _id: 'strong', lift: 2.1, supportCount: 12 }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].data?.insightId).toBe('strong');
  });

  it('prefers a named option and symptom over a whole category when they are equally strong', () => {
    const out = run({
      insights: [
        insight({ _id: 'cat', triggerId: 'cat_food', symptomId: 'cat_symptoms', trigger: { categoryName: 'Trigger', optionLabel: 'Food & Drink' }, symptom: { categoryName: 'Symptom', optionLabel: 'Symptoms' } }),
        insight({ _id: 'named', symptomId: 'opt_digestive' }),
      ],
      entries: [entry({ categoryId: 'food' })].map(e => ({ ...e, answers: [{ optionId: 'dairy' }] })),
    });
    // the entry matches only the option pattern here, so craft one that matches both:
    const both = run({
      insights: [
        insight({ _id: 'cat', triggerId: 'cat_food', symptomId: 'cat_symptoms', trigger: { categoryName: 'Trigger', optionLabel: 'Food & Drink' }, symptom: { categoryName: 'Symptom', optionLabel: 'Symptoms' } }),
        insight({ _id: 'named', symptomId: 'opt_digestive' }),
      ],
      entries: [entry({ categoryId: 'food' })],
    });
    expect(out[0].data?.insightId).toBe('named');
    expect(both).toHaveLength(1);
    expect(both[0].data?.insightId).toBe('named');
    expect(both[0].title).toBe('You logged Dairy at lunch');
  });

  it('speaks once per pattern: two entries of the same food give one observation, for the latest', () => {
    const out = run({ entries: [entry({ _id: 'breakfast', occurredAt: at(8, 0) }), entry({ _id: 'lunch', occurredAt: at(12, 30) })] });
    expect(out).toHaveLength(1);
    expect(out[0].data?.entryId).toBe('lunch');
  });

  it('adds at most one observation per run, the strongest pattern first', () => {
    const coffee = insight({ _id: 'coffee', triggerId: 'qa_coffee', trigger: { categoryName: 'Quick tap', optionLabel: 'Coffee' }, lift: 1.5, supportCount: 6 });
    const entries = [entry(), entry({ _id: 'e2', answers: [], quickActionId: 'coffee', occurredAt: at(13, 0) })];
    const first = run({ insights: [insight(), coffee], entries });
    expect(first).toHaveLength(1);
    expect(first[0].data?.insightId).toBe('i1');
    // once that one is announced, the next run moves on to the other pattern
    const second = run({ insights: [insight(), coffee], entries, seen: new Set([first[0].id, first[0].data?.patternKey as string]) });
    expect(second[0].data?.insightId).toBe('coffee');
  });

  it('does not repeat a pattern later the same day for a different entry', () => {
    const [first] = run();
    const out = run({ entries: [entry({ _id: 'later', occurredAt: at(13, 30) })], seen: new Set([first.data?.patternKey as string]) });
    expect(out).toEqual([]);
  });

  it('checks in after 3 hours for a 0-6 h pattern instead of straight away', () => {
    const [c] = run({
      insights: [insight({ lagWindow: '0-6h' })],
      entries: [entry({ occurredAt: new Date(NOW - 30 * 60000).toISOString() })],
    });
    expect(c.notBefore).toBe(NOW - 30 * 60000 + 3 * HOUR);
    expect(c.body).toContain('within 6 h');
  });

  it('scales confidence with how often the pattern was seen', () => {
    const conf = (confidence: InsightResult['confidence']) => run({ insights: [insight({ confidence })] })[0].confidence;
    expect(conf('Low')).toBeLessThan(conf('Medium'));
    expect(conf('Medium')).toBeLessThan(conf('High'));
  });

  it('does nothing without patterns or entries', () => {
    expect(run({ insights: [] })).toEqual([]);
    expect(run({ entries: [] })).toEqual([]);
  });
});
