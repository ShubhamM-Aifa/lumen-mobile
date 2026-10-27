/**
 * Turns the server's early-warning state into (at most) one notification-budget candidate. The
 * two-day hysteresis and the flare/refractory suppression already happened server-side; this only
 * decides whether the member has already seen this particular result, and writes its wording.
 *
 * Pure: no I/O, no clock reads, so every rule is unit-testable.
 */
import { Candidate } from './budgetEngine';
import type { WarningData } from '../../hooks/useWarning';
import { trackRecordLine, warningBody, warningHeadline, DISCLAIMER_LINE } from '../insights/warningCopy';

/** A level-1 (resemblance) card is read as more certain than a level-0 (statistical) one. */
const CONFIDENCE: Record<0 | 1, number> = { 0: 0.5, 1: 0.65 };

export interface FlareRiskInput {
  warning: WarningData;
  now: number;
  /** computedAt values already shown, so the same result is not announced twice. */
  seen: ReadonlySet<string>;
}

export function buildFlareRiskCandidate({ warning, now, seen }: FlareRiskInput): Candidate[] {
  if (!warning.ready || !warning.alert || warning.alertLevel === null || warning.alertLevel === undefined) return [];
  if (warning.disabled || warning.suppressedByFlare) return [];
  const computedAt = warning.computedAt;
  if (!computedAt || seen.has(computedAt)) return [];

  const level = warning.alertLevel;
  const provenance = [warningBody(warning)];
  const track = trackRecordLine(warning);
  if (track) provenance.push(track);
  provenance.push(DISCLAIMER_LINE);

  return [{
    id: `flare-risk:${computedAt}`,
    type: 'FLARE_RISK',
    title: warningHeadline(warning),
    body: track ?? warningBody(warning),
    confidence: CONFIDENCE[level],
    timeliness: 0.6,
    expiresAt: now + 24 * 3600000,
    inAppNow: true,
    provenance,
    data: { level, computedAt, route: '/(tabs)/insights' },
  }];
}
