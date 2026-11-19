import { downsample, formatValue, gapPath, isolatedIndexes, niceTicks, valueDomain } from '../chartScale';
import { encodeQuestion, decodeQuestion } from '../../ai/questionToken';
import { refRoute } from '../../ai/refs';
import { tapAnswers, tapTotalAmount, TAP_AMOUNT_OPTION_ID, TAP_TIMER_OPTION_ID } from '../../../store/quickLogStore';
import { reminderSlot } from '../../../services/meds/reminderDose';

describe('chart maths', () => {
  it('makes round ticks that cover the values', () => {
    expect(niceTicks(0, 9.3, 4)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(1830, 9140, 4)).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(niceTicks(5, 5)[0]).toBeLessThan(5);
  });

  it('breaks the line at missing days and dots lone days', () => {
    const vals = [1, 2, null, 4, null, null, 6, 7];
    expect(gapPath(vals, i => i, v => v)).toBe('M0.0,1.0 L1.0,2.0 M3.0,4.0 M6.0,6.0 L7.0,7.0');
    expect(isolatedIndexes(vals)).toEqual([3]);
  });

  it('downsamples long series by averaging buckets', () => {
    const vals = Array.from({ length: 240 }, (_, i) => (i % 2 ? null : i));
    const out = downsample(vals, 120);
    expect(out).toHaveLength(120);
    expect(out[0]).toBe(0);
  });

  it('includes a goal in the range and formats values', () => {
    expect(valueDomain([1000, 1500], [2000], true)).toEqual([0, 2000]);
    expect(valueDomain([null, null])).toBeNull();
    expect(formatValue(null)).toBe('–');
    expect(formatValue(7.25, 1)).toMatch(/^7[.,]3$/);
  });
});

describe('Explore question links', () => {
  it('round-trip a question, and reject junk', () => {
    const q = { target: { kind: 'dose' as const, medicationId: 'a'.repeat(24), status: 'skipped' as const }, direction: 'after' as const, range: '365d' as const };
    const token = encodeQuestion(q);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeQuestion(token)).toEqual(q);
    expect(decodeQuestion('%%%')).toBeNull();
    expect(decodeQuestion(undefined)).toBeNull();
  });

  it('matches the server token format (base64url JSON)', () => {
    const q = { target: { kind: 'flare' as const }, direction: 'before' as const, range: '90d' as const };
    const server = 'eyJ0YXJnZXQiOnsia2luZCI6ImZsYXJlIn0sImRpcmVjdGlvbiI6ImJlZm9yZSIsInJhbmdlIjoiOTBkIn0';
    expect(encodeQuestion(q)).toBe(server);
  });

  it('opens an attached analysis in Insights › Explore', () => {
    expect(refRoute({ kind: 'analysis', id: 'abc_-1' })).toBe('/(tabs)/insights?tab=explore&q=abc_-1');
  });
});

describe('quick tap amounts and timers', () => {
  it('sends the water amount and timer minutes as answers the server understands', () => {
    expect(tapAnswers({ amount: { value: 500, unit: 'ml' } })).toEqual([
      { optionId: TAP_AMOUNT_OPTION_ID, optionLabelSnapshot: '500 ml', values: [{ fieldKey: 'amount', dataType: 'number', value: 500, unit: 'ml' }] },
    ]);
    expect(tapAnswers({ durationSec: 1530 })[0]).toMatchObject({ optionId: TAP_TIMER_OPTION_ID, optionLabelSnapshot: '26 min', values: [{ dataType: 'duration', value: 1530, unit: 's' }] });
    expect(tapAnswers()).toEqual([]);
    expect(tapAnswers({ amount: { value: 0, unit: 'ml' } })).toEqual([]);
  });

  it('totals explicit amounts plus the default for plain taps', () => {
    expect(tapTotalAmount({ id: 'x', quickActionId: 'q', occurredAt: '', lastAt: '', count: 3, synced: true, explicitAmount: 750, explicitCount: 2 }, 250)).toBe(1000);
    expect(tapTotalAmount(undefined, 250)).toBe(0);
  });
});

describe('medicine reminders', () => {
  it('mark the dose time the reminder stands for', () => {
    expect(reminderSlot({ doseSlot: '08:00', targetTime: '09:00' })).toBe('08:00');
    expect(reminderSlot({ targetTime: '21:30' })).toBe('21:30');
    expect(reminderSlot({ targetTime: 'soon' })).toBe('unscheduled');
  });
});
