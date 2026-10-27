import {
  decide,
  isInQuietHours,
  quietHoursEnd,
  score,
  countsAgainstBudget,
  Candidate,
  PolicySnapshot,
} from '../budgetEngine';

// 2026-10-23 14:00 local, outside default quiet hours
const NOON_ISH = new Date(2026, 9, 23, 14, 0, 0).getTime();
const NIGHT = new Date(2026, 9, 23, 23, 30, 0).getTime();

function policy(over: Partial<PolicySnapshot> = {}): PolicySnapshot {
  return {
    masterEnabled: true,
    dailyBudget: 2,
    quietHours: { enabled: true, start: '22:00', end: '07:00' },
    flareModeActive: false,
    capabilities: { adaptiveTiming: true, flareRisk: true, triggerWatch: true, pacing: true, safety: true },
    mutedUntil: null,
    suppressedTypes: [],
    ...over,
  };
}

function cand(id: string, type: Candidate['type'], over: Partial<Candidate> = {}): Candidate {
  return { id, type, title: id, body: id, confidence: 1, timeliness: 1, ...over };
}

const ctx = (now = NOON_ISH, sentToday = 0) => ({ now, sentToday });

describe('quiet hours', () => {
  it('handles a window that wraps midnight', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    expect(isInQuietHours(new Date(2026, 9, 23, 23, 0).getTime(), q)).toBe(true);
    expect(isInQuietHours(new Date(2026, 9, 23, 3, 0).getTime(), q)).toBe(true);
    expect(isInQuietHours(new Date(2026, 9, 23, 7, 0).getTime(), q)).toBe(false);
    expect(isInQuietHours(NOON_ISH, q)).toBe(false);
  });

  it('is never active when disabled', () => {
    expect(isInQuietHours(NIGHT, { enabled: false, start: '22:00', end: '07:00' })).toBe(false);
  });

  it('computes the next window end across midnight', () => {
    const end = quietHoursEnd(NIGHT, { enabled: true, start: '22:00', end: '07:00' });
    expect(new Date(end).getDate()).toBe(24);
    expect(new Date(end).getHours()).toBe(7);
  });
});

describe('decide', () => {
  it('delivers safety through flare mode, quiet hours, mute and an exhausted budget', () => {
    const p = policy({ flareModeActive: true, mutedUntil: NIGHT + 1e9, masterEnabled: false });
    const d = decide([cand('s', 'SAFETY')], p, ctx(NIGHT, 99));
    expect(d.deliverNow.map(c => c.id)).toEqual(['s']);
  });

  it('drops safety when the patient has not consented to it', () => {
    const p = policy({ capabilities: { ...policy().capabilities, safety: false } });
    const d = decide([cand('s', 'SAFETY')], p, ctx());
    expect(d.deliverNow).toHaveLength(0);
    expect(d.dropped[0].reason).toBe('capability_off');
  });

  it('keeps medication flowing during flare mode and quiet hours', () => {
    const d = decide([cand('m', 'MEDICATION')], policy({ flareModeActive: true }), ctx(NIGHT));
    expect(d.deliverNow.map(c => c.id)).toEqual(['m']);
  });

  it('silences everything except safety and medication in flare mode', () => {
    const d = decide(
      [cand('a', 'PACING'), cand('b', 'FLARE_RISK'), cand('c', 'TRIGGER_WATCH')],
      policy({ flareModeActive: true }),
      ctx(),
    );
    expect(d.deliverNow).toHaveLength(0);
    expect(d.dropped.every(x => x.reason === 'flare_mode')).toBe(true);
    expect(d.inApp).toHaveLength(0);
  });

  it('delivers only the top-scoring items within the daily budget', () => {
    const d = decide(
      [cand('watch', 'TRIGGER_WATCH'), cand('pace', 'PACING'), cand('risk', 'FLARE_RISK')],
      policy({ dailyBudget: 2 }),
      ctx(),
    );
    expect(d.deliverNow.map(c => c.id)).toEqual(['pace', 'risk']);
    expect(d.inApp).toEqual([{ candidate: expect.objectContaining({ id: 'watch' }), reason: 'budget' }]);
  });

  it('subtracts what was already sent today', () => {
    const d = decide([cand('a', 'PACING'), cand('b', 'FLARE_RISK')], policy({ dailyBudget: 2 }), ctx(NOON_ISH, 1));
    expect(d.deliverNow).toHaveLength(1);
    expect(d.inApp).toHaveLength(1);
  });

  it('weights confidence and timeliness, not just type', () => {
    const lowConfidencePacing = cand('p', 'PACING', { confidence: 0.2 });
    const strongRisk = cand('r', 'FLARE_RISK', { confidence: 0.9 });
    expect(score(strongRisk)).toBeGreaterThan(score(lowConfidencePacing));
    const d = decide([lowConfidencePacing, strongRisk], policy({ dailyBudget: 1 }), ctx());
    expect(d.deliverNow.map(c => c.id)).toEqual(['r']);
  });

  it('defers during quiet hours, or moves a stale item in-app', () => {
    const fresh = cand('fresh', 'FLARE_RISK');
    const stale = cand('stale', 'PACING', { expiresAt: NIGHT + 60 * 60 * 1000 });
    const d = decide([fresh, stale], policy(), ctx(NIGHT));
    expect(d.deferred.map(x => x.candidate.id)).toEqual(['fresh']);
    expect(new Date(d.deferred[0].deliverAt).getHours()).toBe(7);
    expect(d.inApp).toEqual([{ candidate: expect.objectContaining({ id: 'stale' }), reason: 'quiet_hours_stale' }]);
  });

  it('respects mute, master switch, disabled capabilities and suppressed types', () => {
    expect(decide([cand('a', 'PACING')], policy({ mutedUntil: NOON_ISH + 1000 }), ctx()).dropped[0].reason).toBe('muted');
    expect(decide([cand('a', 'PACING')], policy({ masterEnabled: false }), ctx()).dropped[0].reason).toBe('master_off');
    expect(
      decide([cand('a', 'PACING')], policy({ capabilities: { ...policy().capabilities, pacing: false } }), ctx()).dropped[0].reason,
    ).toBe('capability_off');
    expect(decide([cand('a', 'PACING')], policy({ suppressedTypes: ['PACING'] }), ctx()).dropped[0].reason).toBe('type_suppressed');
  });

  it('lets an expired mute lapse', () => {
    const d = decide([cand('a', 'PACING')], policy({ mutedUntil: NOON_ISH - 1 }), ctx());
    expect(d.deliverNow).toHaveLength(1);
  });

  it('drops expired candidates', () => {
    const d = decide([cand('a', 'PACING', { expiresAt: NOON_ISH - 1 })], policy(), ctx());
    expect(d.dropped[0].reason).toBe('expired');
  });
});

describe('countsAgainstBudget', () => {
  it('exempts safety and medication', () => {
    expect(countsAgainstBudget('SAFETY')).toBe(false);
    expect(countsAgainstBudget('MEDICATION')).toBe(false);
    expect(countsAgainstBudget('FLARE_RISK')).toBe(true);
  });
});

describe('notBefore (a check-in timed to a pattern)', () => {
  const HOUR = 3600000;

  it('defers to the requested time instead of delivering now', () => {
    const at = NOON_ISH + 6 * HOUR; // 20:00, outside quiet hours
    const d = decide([cand('w', 'TRIGGER_WATCH', { notBefore: at, expiresAt: NOON_ISH + 24 * HOUR })], policy(), ctx());
    expect(d.deliverNow).toEqual([]);
    expect(d.deferred).toEqual([{ candidate: expect.objectContaining({ id: 'w' }), deliverAt: at }]);
  });

  it('moves a time that lands in quiet hours to when they end', () => {
    const at = NOON_ISH + 10 * HOUR; // 00:00
    const d = decide([cand('w', 'TRIGGER_WATCH', { notBefore: at, expiresAt: NOON_ISH + 30 * HOUR })], policy(), ctx());
    expect(d.deferred).toHaveLength(1);
    expect(new Date(d.deferred[0].deliverAt).getHours()).toBe(7);
  });

  it('keeps it in-app only if the window would be over by then', () => {
    const at = NOON_ISH + 10 * HOUR; // lands in quiet hours, which end at 07:00
    const d = decide([cand('w', 'TRIGGER_WATCH', { notBefore: at, expiresAt: NOON_ISH + 12 * HOUR })], policy(), ctx());
    expect(d.deferred).toEqual([]);
    expect(d.inApp).toEqual([{ candidate: expect.objectContaining({ id: 'w' }), reason: 'quiet_hours_stale' }]);
  });

  it('still respects the master switch, flare mode and the capability toggle', () => {
    const at = NOON_ISH + 6 * HOUR;
    const w = cand('w', 'TRIGGER_WATCH', { notBefore: at });
    expect(decide([w], policy({ masterEnabled: false }), ctx()).dropped[0].reason).toBe('master_off');
    expect(decide([w], policy({ flareModeActive: true }), ctx()).dropped[0].reason).toBe('flare_mode');
    expect(decide([w], policy({ capabilities: { adaptiveTiming: true, flareRisk: true, triggerWatch: false, pacing: true, safety: true } }), ctx()).dropped[0].reason).toBe('capability_off');
  });

  it('ignores a notBefore that has already passed', () => {
    const d = decide([cand('w', 'TRIGGER_WATCH', { notBefore: NOON_ISH - HOUR })], policy(), ctx());
    expect(d.deliverNow.map(c => c.id)).toEqual(['w']);
  });
});
