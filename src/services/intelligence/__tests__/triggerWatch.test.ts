import {
  buildTriggerWatchCandidates,
  lagPhrase,
  lagWindowOf,
  triggerKeysOf,
  verbFor,
  whenPhrase,
  WatchedEntry,
} from '../triggerWatch';
import type { InsightFinding } from '../../../hooks/useInsights';

const HOUR = 3600000;
// 2026-10-27 14:00 local
const NOW = new Date(2026, 9, 27, 14, 0, 0).getTime();
const at = (hour: number, min = 0) => new Date(2026, 9, 27, hour, min, 0).toISOString();

const finding = (over: Partial<InsightFinding> = {}): InsightFinding => ({
  id: 'f1',
  exposureKey: 'opt_dairy',
  outcomeKey: 'opt_digestive',
  exposure: { categoryName: 'Food & Drink', optionLabel: 'Dairy' },
  outcome: { categoryName: 'Symptoms', optionLabel: 'Digestive issues' },
  lagDays: 1,
  counts: { exposedWith: 9, exposedTotal: 14, otherWith: 6, otherTotal: 31 },
  tier: 'possible',
  noLongerSeen: false,
  weakDays: false,
  ...over,
});

const entry = (over: Partial<WatchedEntry> = {}): WatchedEntry => ({
  _id: 'e1', occurredAt: at(12, 30), answers: [{ optionId: 'dairy' }], ...over,
});

const run = (over: Partial<Parameters<typeof buildTriggerWatchCandidates>[0]> = {}) =>
  buildTriggerWatchCandidates({ findings: [finding()], entries: [entry()], now: NOW, seen: new Set(), ...over });

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

  it('turns a day lag into an hours window and a phrase', () => {
    expect(lagWindowOf(0)).toEqual([0, 24]);
    expect(lagWindowOf(1)).toEqual([24, 48]);
    expect(lagWindowOf(2)).toEqual([48, 72]);
    expect(lagWindowOf(9)).toEqual([48, 72]);
    expect(lagPhrase([24, 48])).toBe('24–48 h');
    expect(lagPhrase([0, 24])).toBe('within 24 h');
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
    expect(c.body).toBe('Digestive issues have been more common 24–48 h after it.');
    expect(c.inAppNow).toBe(true);
    // logged 12:30; the next-day pattern starts 24 h later and ends at 48 h
    expect(c.notBefore).toBe(new Date(2026, 9, 28, 12, 30).getTime());
    expect(c.expiresAt).toBe(new Date(2026, 9, 29, 12, 30).getTime());
    expect(c.data).toMatchObject({ entryId: 'e1', insightId: 'f1', route: '/(tabs)/insights' });
  });

  it('never uses causal wording', () => {
    const [c] = run();
    const text = `${c.title} ${c.body} ${(c.provenance ?? []).join(' ')}`.toLowerCase();
    for (const bad of ['caused', 'causes', 'because of', 'due to', 'will ', 'you should', 'avoid']) {
      expect(text).not.toContain(bad);
    }
    expect(c.provenance?.[2]).toContain('not a cause');
  });

  it('explains itself with day counts, not percentages', () => {
    const [c] = run();
    expect(c.provenance?.[0]).toMatch(/You logged Dairy at .* today\./);
    expect(c.provenance?.[1]).toContain('on 9 of 14 such days');
    expect((c.provenance ?? []).join(' ')).not.toMatch(/%/);
  });

  it('matches quick taps and whole categories as well as options', () => {
    const byQuick = run({ findings: [finding({ exposureKey: 'qa_coffee', exposure: { categoryName: 'Quick tap', optionLabel: 'Coffee' } })], entries: [entry({ answers: [], quickActionId: 'coffee' })] });
    expect(byQuick[0].title).toBe('You logged Coffee this afternoon');
    const byCat = run({ findings: [finding({ exposureKey: 'cat_food' })], entries: [entry({ answers: [], categoryId: 'food' })] });
    expect(byCat).toHaveLength(1);
  });

  it('says nothing about a pattern that is no longer supported', () => {
    expect(run({ findings: [finding({ noLongerSeen: true })] })).toEqual([]);
  });

  it('ignores entries that match no pattern', () => {
    expect(run({ entries: [entry({ answers: [{ optionId: 'rice' }] })] })).toEqual([]);
  });

  it('ignores things logged more than a day ago, or in the future', () => {
    expect(run({ entries: [entry({ occurredAt: new Date(NOW - 25 * HOUR).toISOString() })] })).toEqual([]);
    expect(run({ entries: [entry({ occurredAt: new Date(NOW + HOUR).toISOString() })] })).toEqual([]);
  });

  it('mentions each entry once', () => {
    const [first] = run();
    expect(run({ seen: new Set([first.id]) })).toEqual([]);
  });

  it('picks the strongest pattern for one entry', () => {
    const out = run({
      findings: [
        finding({ id: 'weak', counts: { exposedWith: 6, exposedTotal: 12, otherWith: 8, otherTotal: 30 }, outcome: { categoryName: 'Symptoms', optionLabel: 'Headache' } }),
        finding({ id: 'strong', counts: { exposedWith: 12, exposedTotal: 14, otherWith: 5, otherTotal: 30 } }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].data?.insightId).toBe('strong');
  });

  it('prefers a named option and symptom over a whole category when they are equally strong', () => {
    const both = run({
      findings: [
        finding({ id: 'cat', exposureKey: 'cat_food', outcomeKey: 'cat_symptoms', exposure: { categoryName: 'Trigger', optionLabel: 'Food & Drink' }, outcome: { categoryName: 'Symptom', optionLabel: 'Symptoms' } }),
        finding({ id: 'named' }),
      ],
      entries: [entry({ categoryId: 'food' })],
    });
    expect(both).toHaveLength(1);
    expect(both[0].data?.insightId).toBe('named');
    expect(both[0].title).toBe('You logged Dairy at lunch');
  });

  it('lets a consistent pattern edge out an equally strong possible one', () => {
    const out = run({ findings: [finding({ id: 'possible' }), finding({ id: 'steady', tier: 'consistent', outcomeKey: 'opt_other', outcome: { categoryName: 'Symptoms', optionLabel: 'Fatigue' } })] });
    expect(out[0].data?.insightId).toBe('steady');
  });

  it('speaks once per pattern: two entries of the same food give one observation, for the latest', () => {
    const out = run({ entries: [entry({ _id: 'breakfast', occurredAt: at(8, 0) }), entry({ _id: 'lunch', occurredAt: at(12, 30) })] });
    expect(out).toHaveLength(1);
    expect(out[0].data?.entryId).toBe('lunch');
  });

  it('adds at most one observation per run, the strongest pattern first', () => {
    const coffee = finding({ id: 'coffee', exposureKey: 'qa_coffee', exposure: { categoryName: 'Quick tap', optionLabel: 'Coffee' }, counts: { exposedWith: 6, exposedTotal: 12, otherWith: 5, otherTotal: 30 } });
    const entries = [entry(), entry({ _id: 'e2', answers: [], quickActionId: 'coffee', occurredAt: at(13, 0) })];
    const first = run({ findings: [finding(), coffee], entries });
    expect(first).toHaveLength(1);
    expect(first[0].data?.insightId).toBe('f1');
    // once that one is announced, the next run moves on to the other pattern
    const second = run({ findings: [finding(), coffee], entries, seen: new Set([first[0].id, first[0].data?.patternKey as string]) });
    expect(second[0].data?.insightId).toBe('coffee');
  });

  it('does not repeat a pattern later the same day for a different entry', () => {
    const [first] = run();
    const out = run({ entries: [entry({ _id: 'later', occurredAt: at(13, 30) })], seen: new Set([first.data?.patternKey as string]) });
    expect(out).toEqual([]);
  });

  it('checks in after 3 hours for a same-day pattern instead of straight away', () => {
    const [c] = run({
      findings: [finding({ lagDays: 0 })],
      entries: [entry({ occurredAt: new Date(NOW - 30 * 60000).toISOString() })],
    });
    expect(c.notBefore).toBe(NOW - 30 * 60000 + 3 * HOUR);
    expect(c.body).toContain('within 24 h');
  });

  it('sounds surer for a consistent pattern than a possible one', () => {
    const conf = (tier: InsightFinding['tier']) => run({ findings: [finding({ tier })] })[0].confidence;
    expect(conf('possible')).toBeLessThan(conf('consistent'));
  });

  it('does nothing without patterns or entries', () => {
    expect(run({ findings: [] })).toEqual([]);
    expect(run({ entries: [] })).toEqual([]);
  });
});
