import { detectWalks, strideFromHeight, walkId, MINUTE, MinuteSteps } from '../walkDetection';

const T0 = Date.UTC(2026, 9, 27, 10, 0); // 10:00 UTC
const at = (min: number) => T0 + min * MINUTE;
/** `count` minutes of `steps` each, starting at minute `from`. */
const run = (from: number, count: number, steps = 90): MinuteSteps[] =>
  Array.from({ length: count }, (_, k) => ({ start: at(from + k), steps }));
const detect = (minutes: MinuteSteps[], over: Record<string, unknown> = {}) =>
  detectWalks(minutes, { platform: 'ios', scanEnd: at(180), ...over });

describe('detectWalks', () => {
  it('finds one walk with its steps, length and estimated distance', () => {
    const { walks, resumeAt } = detect(run(0, 15, 100));
    expect(walks).toHaveLength(1);
    expect(walks[0]).toEqual({
      clientId: 'auto:ios:2026-10-27T10:00Z',
      startTime: at(0),
      endTime: at(15),
      steps: 1500,
      distanceMeters: 1050,
    });
    expect(resumeAt).toBe(at(180));
  });

  it('ignores short bursts like walking to the kitchen', () => {
    expect(detect(run(0, 6)).walks).toEqual([]);
  });

  it('honours a 5-minute minimum for members who chose shorter walks', () => {
    expect(detect(run(0, 6), { minWalkMinutes: 5 }).walks).toHaveLength(1);
  });

  it('counts slow walking, but not pottering about', () => {
    expect(detect(run(0, 12, 65)).walks).toHaveLength(1);
    expect(detect(run(0, 12, 40)).walks).toEqual([]);
  });

  it('keeps a walk whole across a short pause, and counts the pause steps', () => {
    const minutes = [...run(0, 6), { start: at(6), steps: 10 }, ...run(8, 6)];
    const { walks } = detect(minutes);
    expect(walks).toHaveLength(1);
    expect(walks[0].startTime).toBe(at(0));
    expect(walks[0].endTime).toBe(at(14));
    expect(walks[0].steps).toBe(6 * 90 + 10 + 6 * 90);
  });

  it('splits two walks separated by a real rest', () => {
    const { walks } = detect([...run(0, 12), ...run(30, 12)]);
    expect(walks.map(w => w.clientId)).toEqual(['auto:ios:2026-10-27T10:00Z', 'auto:ios:2026-10-27T10:30Z']);
  });

  it('leaves a walk that may still be going on for the next scan', () => {
    const { walks, resumeAt } = detect([...run(0, 12), ...run(160, 19)]);
    expect(walks).toHaveLength(1);
    expect(resumeAt).toBe(at(160));
  });

  it('gives the same walk the same id when scanned again', () => {
    const a = detect(run(0, 15)).walks[0].clientId;
    const b = detect([{ start: at(-30), steps: 5 }, ...run(0, 15)], { scanEnd: at(400) }).walks[0].clientId;
    expect(a).toBe(b);
  });

  it('copes with unsorted, duplicate and junk input', () => {
    const minutes = [...run(0, 12)].reverse();
    minutes.push({ start: NaN, steps: 100 }, { start: at(50), steps: -5 });
    const { walks } = detect(minutes);
    expect(walks).toHaveLength(1);
    expect(walks[0].steps).toBe(12 * 90);
  });

  it('finds nothing in an empty day', () => {
    expect(detect([])).toEqual({ walks: [], resumeAt: at(180) });
  });
});

describe('helpers', () => {
  it('estimates stride from height and falls back to an average', () => {
    expect(strideFromHeight(170)).toBe(0.7);
    expect(strideFromHeight(155)).toBe(0.64);
    expect(strideFromHeight(undefined)).toBe(0.7);
    expect(strideFromHeight(20)).toBe(0.7);
  });

  it('builds ids from the start minute in UTC', () => {
    expect(walkId('android', at(3) + 42000)).toBe('auto:android:2026-10-27T10:03Z');
  });
});
