import { runAutoWalkSync, trackingDayKey, startOfTrackingDay, SyncDeps } from '../autoWalkSync';
import { StepSource } from '../stepSource';
import { MINUTE, MinuteSteps } from '../walkDetection';

const NOW = new Date(2026, 9, 27, 14, 0).getTime(); // 2:00 PM local
const DAY = 24 * 60 * MINUTE;
const walkAt = (start: number, minutes: number, steps = 95): MinuteSteps[] =>
  Array.from({ length: minutes }, (_, k) => ({ start: start + k * MINUTE, steps }));

function fakeSource(minutes: MinuteSteps[], over: Partial<StepSource> = {}): StepSource & { minuteSteps: jest.Mock; stepsBetween: jest.Mock } {
  return {
    kind: 'ios_motion',
    maxHistoryDays: 7,
    isAvailable: async () => true,
    hasAccess: async () => true,
    requestAccess: async () => true,
    minuteSteps: jest.fn(async (from: Date, to: Date) => minutes.filter(m => m.start >= from.getTime() && m.start < to.getTime())),
    stepsBetween: jest.fn(async () => 4321),
    ...over,
  } as never;
}

const deps = (source: StepSource, over: Partial<SyncDeps> = {}): SyncDeps & { post: jest.Mock; put: jest.Mock } => ({
  source,
  post: jest.fn().mockResolvedValue({}),
  put: jest.fn().mockResolvedValue({}),
  now: NOW,
  cursor: null,
  minWalkMinutes: 10,
  timezone: 'Asia/Kolkata',
  boundaryHour: 4,
  ...over,
}) as never;

describe('runAutoWalkSync', () => {
  it('finds a walk, sends it with its id and time zone, and moves the cursor to now', async () => {
    const walkStart = new Date(2026, 9, 27, 9, 0).getTime();
    const d = deps(fakeSource(walkAt(walkStart, 20)), { cursor: startOfTrackingDay(NOW, 4) });
    const out = await runAutoWalkSync(d);
    expect(out.walks).toHaveLength(1);
    expect(d.post).toHaveBeenCalledWith('/activity-sessions/auto', {
      walks: [expect.objectContaining({
        clientId: expect.stringMatching(/^auto:ios:/),
        steps: 20 * 95,
        distanceMeters: Math.round(20 * 95 * 0.7),
        timezone: 'Asia/Kolkata',
      })],
    });
    expect(out.cursor).toBe(NOW);
  });

  it('looks back a week on the first sync', async () => {
    const source = fakeSource([]);
    await runAutoWalkSync(deps(source));
    const [from] = source.minuteSteps.mock.calls[0];
    expect(from.getTime()).toBe(NOW - 7 * DAY);
  });

  it('sends no walks when there are none, but still saves today’s steps', async () => {
    const d = deps(fakeSource([]), { cursor: NOW - 30 * MINUTE });
    const out = await runAutoWalkSync(d);
    expect(d.post).not.toHaveBeenCalled();
    expect(d.put).toHaveBeenCalledWith('/activity-sessions/daily-steps', {
      days: [{ date: trackingDayKey(NOW, 4), steps: 4321, source: 'ios_motion' }],
    });
    expect(out.todaySteps).toBe(4321);
  });

  it('saves a total for every day since the last sync', async () => {
    const d = deps(fakeSource([]), { cursor: NOW - DAY });
    await runAutoWalkSync(d);
    const days = d.put.mock.calls[0][1].days.map((x: { date: string }) => x.date);
    expect(days).toEqual([trackingDayKey(NOW - DAY, 4), trackingDayKey(NOW, 4)]);
  });

  it('counts today from the Day Reset Boundary, not from midnight', async () => {
    const source = fakeSource([]);
    await runAutoWalkSync(deps(source, { cursor: NOW - 30 * MINUTE, boundaryHour: 4 }));
    const [from, to] = source.stepsBetween.mock.calls[0];
    expect(from.getTime()).toBe(new Date(2026, 9, 27, 4, 0).getTime());
    expect(to.getTime()).toBe(NOW);
  });

  it('keeps steps after midnight on the day before the boundary', async () => {
    const lateNight = new Date(2026, 9, 28, 1, 30).getTime(); // 1:30 AM, boundary 4 AM
    const source = fakeSource([]);
    const d = deps(source, { now: lateNight, cursor: lateNight - 10 * MINUTE });
    const out = await runAutoWalkSync(d);
    expect(d.put.mock.calls[0][1].days).toEqual([{ date: '2026-10-27', steps: 4321, source: 'ios_motion' }]);
    expect(source.stepsBetween.mock.calls[0][0].getTime()).toBe(new Date(2026, 9, 27, 4, 0).getTime());
    expect(out.todaySteps).toBe(4321);
  });

  it('keeps the cursor at a walk that may still be going on', async () => {
    const walkStart = NOW - 12 * MINUTE;
    const d = deps(fakeSource(walkAt(walkStart, 12)), { cursor: NOW - 60 * MINUTE });
    const out = await runAutoWalkSync(d);
    expect(out.walks).toEqual([]);
    expect(out.cursor).toBe(walkStart);
  });

  it('does not move on when the walks could not be saved, so the next sync retries', async () => {
    const walkStart = new Date(2026, 9, 27, 9, 0).getTime();
    const d = deps(fakeSource(walkAt(walkStart, 20)), { cursor: startOfTrackingDay(NOW, 4) });
    d.post.mockRejectedValue(new Error('offline'));
    await expect(runAutoWalkSync(d)).rejects.toThrow('offline');
  });

  it('never saves a zero for a day it could not read', async () => {
    const source = fakeSource([], { stepsBetween: jest.fn().mockRejectedValue(new Error('locked')) } as never);
    const d = deps(source, { cursor: NOW - 10 * MINUTE });
    const out = await runAutoWalkSync(d);
    expect(d.put).not.toHaveBeenCalled();
    expect(out.todaySteps).toBeNull();
  });

  it('uses the shorter minimum when the member chose it', async () => {
    const walkStart = new Date(2026, 9, 27, 9, 0).getTime();
    const source = fakeSource(walkAt(walkStart, 6));
    expect((await runAutoWalkSync(deps(source, { cursor: startOfTrackingDay(NOW, 4) }))).walks).toHaveLength(0);
    expect((await runAutoWalkSync(deps(source, { cursor: startOfTrackingDay(NOW, 4), minWalkMinutes: 5 }))).walks).toHaveLength(1);
  });

  it('labels Android walks by platform', async () => {
    const walkStart = new Date(2026, 9, 27, 9, 0).getTime();
    const d = deps(fakeSource(walkAt(walkStart, 15), { kind: 'health_connect' }), { cursor: startOfTrackingDay(NOW, 4) });
    const out = await runAutoWalkSync(d);
    expect(out.walks[0].clientId).toMatch(/^auto:android:/);
    expect(d.put.mock.calls[0][1].days[0].source).toBe('health_connect');
  });
});
