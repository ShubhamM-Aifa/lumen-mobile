/**
 * Notification budget engine. Pure: no I/O, no clock reads, so every rule is unit-testable.
 *
 * Resolution order for each candidate:
 *   1. SAFETY and MEDICATION bypass everything below.
 *   2. Master switch, flare mode, mute, capability and type suppression drop the candidate.
 *   3. Quiet hours defer it to the end of the window, or move it in-app if it would be stale by then.
 *   4. Survivors are scored and the top (dailyBudget - sentToday) are delivered.
 *   5. The rest are only shown in the in-app "For you today" card.
 */

export type NotificationType =
  | 'SAFETY'
  | 'MEDICATION'
  | 'PACING'
  | 'FLARE_RISK'
  | 'TRIGGER_WATCH'
  | 'HYGIENE';

export type IntelligenceCapability =
  | 'adaptiveTiming'
  | 'flareRisk'
  | 'triggerWatch'
  | 'pacing'
  | 'safety';

export interface Candidate {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** 0-1, how sure the analysis is. */
  confidence: number;
  /** 0-1, how much the moment matters. */
  timeliness: number;
  /** Epoch ms after which the message is no longer useful. */
  expiresAt?: number;
  /** Plain-language signals shown under "Why did I get this?". */
  provenance?: string[];
  data?: Record<string, unknown>;
}

export interface PolicySnapshot {
  masterEnabled: boolean;
  dailyBudget: number;
  quietHours: { enabled: boolean; start: string; end: string };
  flareModeActive: boolean;
  capabilities: Record<IntelligenceCapability, boolean>;
  mutedUntil: number | null;
  suppressedTypes: NotificationType[];
}

export type DropReason =
  | 'master_off'
  | 'flare_mode'
  | 'muted'
  | 'capability_off'
  | 'type_suppressed'
  | 'expired';

export type InAppReason = 'budget' | 'quiet_hours_stale';

export interface Decision {
  deliverNow: Candidate[];
  deferred: Array<{ candidate: Candidate; deliverAt: number }>;
  inApp: Array<{ candidate: Candidate; reason: InAppReason }>;
  dropped: Array<{ candidate: Candidate; reason: DropReason }>;
}

export const CLINICAL_WEIGHT: Record<Exclude<NotificationType, 'SAFETY'>, number> = {
  MEDICATION: 1.0,
  PACING: 0.8,
  FLARE_RISK: 0.7,
  TRIGGER_WATCH: 0.5,
  HYGIENE: 0.1,
};

const CAPABILITY_FOR_TYPE: Partial<Record<NotificationType, IntelligenceCapability>> = {
  SAFETY: 'safety',
  PACING: 'pacing',
  FLARE_RISK: 'flareRisk',
  TRIGGER_WATCH: 'triggerWatch',
  HYGIENE: 'adaptiveTiming',
};

export function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h % 24) * 60 + (m % 60);
}

function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function isInQuietHours(ts: number, q: PolicySnapshot['quietHours']): boolean {
  if (!q.enabled) return false;
  const start = parseHHMM(q.start);
  const end = parseHHMM(q.end);
  if (start === end) return false;
  const now = minutesOfDay(ts);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** The next time the quiet window closes, strictly after `ts`. */
export function quietHoursEnd(ts: number, q: PolicySnapshot['quietHours']): number {
  const end = parseHHMM(q.end);
  const d = new Date(ts);
  d.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (d.getTime() <= ts) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function score(c: Candidate): number {
  if (c.type === 'SAFETY') return Number.POSITIVE_INFINITY;
  return CLINICAL_WEIGHT[c.type] * clamp01(c.confidence) * clamp01(c.timeliness);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function decide(
  candidates: Candidate[],
  policy: PolicySnapshot,
  ctx: { now: number; sentToday: number },
): Decision {
  const out: Decision = { deliverNow: [], deferred: [], inApp: [], dropped: [] };
  const budgeted: Candidate[] = [];

  for (const c of candidates) {
    if (c.expiresAt !== undefined && c.expiresAt <= ctx.now) {
      out.dropped.push({ candidate: c, reason: 'expired' });
      continue;
    }

    if (c.type === 'SAFETY') {
      if (policy.capabilities.safety) out.deliverNow.push(c);
      else out.dropped.push({ candidate: c, reason: 'capability_off' });
      continue;
    }
    if (c.type === 'MEDICATION') {
      out.deliverNow.push(c);
      continue;
    }

    if (!policy.masterEnabled) { out.dropped.push({ candidate: c, reason: 'master_off' }); continue; }
    if (policy.flareModeActive) { out.dropped.push({ candidate: c, reason: 'flare_mode' }); continue; }
    if (policy.mutedUntil !== null && policy.mutedUntil > ctx.now) {
      out.dropped.push({ candidate: c, reason: 'muted' });
      continue;
    }
    const cap = CAPABILITY_FOR_TYPE[c.type];
    if (cap && !policy.capabilities[cap]) { out.dropped.push({ candidate: c, reason: 'capability_off' }); continue; }
    if (policy.suppressedTypes.includes(c.type)) { out.dropped.push({ candidate: c, reason: 'type_suppressed' }); continue; }

    if (isInQuietHours(ctx.now, policy.quietHours)) {
      const opensAt = quietHoursEnd(ctx.now, policy.quietHours);
      if (c.expiresAt !== undefined && c.expiresAt <= opensAt) {
        out.inApp.push({ candidate: c, reason: 'quiet_hours_stale' });
      } else {
        out.deferred.push({ candidate: c, deliverAt: opensAt });
      }
      continue;
    }

    budgeted.push(c);
  }

  const remaining = Math.max(0, policy.dailyBudget - ctx.sentToday);
  budgeted.sort((a, b) => score(b) - score(a));
  budgeted.forEach((c, i) => {
    if (i < remaining) out.deliverNow.push(c);
    else out.inApp.push({ candidate: c, reason: 'budget' });
  });

  return out;
}

/** Types that spend the daily budget. SAFETY and MEDICATION never do. */
export function countsAgainstBudget(type: NotificationType): boolean {
  return type !== 'SAFETY' && type !== 'MEDICATION';
}
