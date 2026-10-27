import { buildFlareRiskCandidate } from '../flareRiskWatch';
import type { WarningData } from '../../../hooks/useWarning';

const NOW = Date.now();
const warning = (over: Partial<WarningData> = {}): WarningData => ({
  ready: true, enabledLevel: 1, alert: true, alertLevel: 1, suppressedByFlare: false, disabled: false,
  level1: { enabled: true, gateReason: null, episodeCount: 5, loggedDays: 60, trackRecord: { followed: 3, of: 7 } },
  computedAt: '2026-10-27T04:30:00.000Z',
  ...over,
});

const run = (over: Partial<Parameters<typeof buildFlareRiskCandidate>[0]> = {}) =>
  buildFlareRiskCandidate({ warning: warning(), now: NOW, seen: new Set(), ...over });

describe('buildFlareRiskCandidate', () => {
  it('builds one candidate with the track record as the body, and the right type and route', () => {
    const [c] = run();
    expect(c.type).toBe('FLARE_RISK');
    expect(c.title).toContain('resemble');
    expect(c.body).toBe('A flare followed 3 times out of 7 when this check has gone off before.');
    expect(c.data).toMatchObject({ level: 1, route: '/(tabs)/insights' });
    expect(c.inAppNow).toBe(true);
  });

  it('includes the fixed disclaimer in its provenance', () => {
    const [c] = run();
    expect(c.provenance?.some(p => p.includes('not a diagnosis or a prediction'))).toBe(true);
  });

  it('falls back to the plain body when there is no track record yet', () => {
    const [c] = run({ warning: warning({ level1: { enabled: true, gateReason: null, episodeCount: 5, loggedDays: 60, trackRecord: null } }) });
    expect(c.body).not.toMatch(/followed/);
  });

  it('says nothing when there is no alert', () => {
    expect(run({ warning: warning({ alert: false, alertLevel: null }) })).toEqual([]);
  });

  it('says nothing while suppressed by a current flare', () => {
    expect(run({ warning: warning({ suppressedByFlare: true }) })).toEqual([]);
  });

  it('says nothing once the member has turned the feature off', () => {
    expect(run({ warning: warning({ disabled: true }) })).toEqual([]);
  });

  it('says nothing before the server result is ready', () => {
    expect(run({ warning: warning({ ready: false }) })).toEqual([]);
  });

  it('announces the same computed result only once', () => {
    const [first] = run();
    expect(run({ seen: new Set([first.data?.computedAt as string]) })).toEqual([]);
  });

  it('announces a new result once the server recomputes', () => {
    const [first] = run();
    const seen = new Set([first.data?.computedAt as string]);
    const second = run({ warning: warning({ computedAt: '2026-10-28T04:30:00.000Z' }), seen });
    expect(second).toHaveLength(1);
  });

  it('sounds a little more confident for level 1 than level 0', () => {
    const l1 = run()[0].confidence;
    const l0 = run({ warning: warning({ alertLevel: 0, level1: { enabled: false, gateReason: 'too_few_episodes', episodeCount: 1, loggedDays: 10, trackRecord: null } }) })[0].confidence;
    expect(l0).toBeLessThan(l1);
  });

  it('expires after a day, so a stale card never lingers in the inbox', () => {
    const [c] = run();
    expect(c.expiresAt).toBe(NOW + 24 * 3600000);
  });
});
