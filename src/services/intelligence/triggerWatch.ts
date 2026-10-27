/**
 * Trigger watch: when the patient logs something their own history links to a symptom, say so once,
 * in plain observational words, and time a gentle check-in to when the pattern says it shows up.
 *
 * Pure: no I/O and no clock reads, so every rule is unit-testable. It never says what caused a symptom.
 */
import { Candidate } from './budgetEngine';
import type { InsightFinding } from '../../hooks/useInsights';

/** Only things logged in the last day are talked about. */
export const WATCH_LOOKBACK_MS = 24 * 3600000;
/** For a 0 to N hour pattern, check in this long after (an immediate buzz right after logging is noise). */
const IMMEDIATE_WINDOW_CHECK_IN_HOURS = 3;

export interface WatchedEntry {
  _id: string;
  occurredAt: string | Date;
  categoryId?: string;
  quickActionId?: string;
  answers?: Array<{ optionId: string }>;
}

const HOUR = 3600000;
/** How sure the observation sounds to the notification budget; only shown tiers get this far. */
const CONFIDENCE: Record<InsightFinding['tier'], number> = { possible: 0.65, consistent: 0.85 };

/** The ids an entry can match against a stored pattern's trigger. */
export function triggerKeysOf(entry: WatchedEntry): string[] {
  const keys: string[] = [];
  for (const a of entry.answers ?? []) keys.push(`opt_${a.optionId}`);
  if (entry.quickActionId) keys.push(`qa_${entry.quickActionId}`);
  if (entry.categoryId) keys.push(`cat_${entry.categoryId}`);
  return keys;
}

/** A finding looks 0, 1 or 2 days ahead; as hours after the entry that is 0-24, 24-48 or 48-72. */
export function lagWindowOf(lagDays: number): [number, number] {
  const day = Math.max(0, Math.min(2, Math.round(lagDays)));
  return [day * 24, (day + 1) * 24];
}

/** "6–24 h" or "within 6 h". */
export function lagPhrase([lo, hi]: [number, number]): string {
  return lo === 0 ? `within ${hi} h` : `${lo}–${hi} h`;
}

/** "at lunch" for food entries around mealtimes, otherwise "this morning" and so on. */
export function whenPhrase(at: Date, categoryName: string): string {
  const mins = at.getHours() * 60 + at.getMinutes();
  if (/food|meal|eat|drink/i.test(categoryName)) {
    if (mins >= 330 && mins < 630) return 'at breakfast';
    if (mins >= 660 && mins < 870) return 'at lunch';
    if (mins >= 1050 && mins < 1350) return 'at dinner';
  }
  if (mins < 330) return 'late last night';
  if (mins < 720) return 'this morning';
  if (mins < 1020) return 'this afternoon';
  if (mins < 1260) return 'this evening';
  return 'late tonight';
}

/** "Digestive issues have", "Fatigue has". */
export function verbFor(label: string): 'has' | 'have' {
  const last = label.trim().split(/\s+/).pop() ?? '';
  return /s$/i.test(last) && !/ss$/i.test(last) ? 'have' : 'has';
}

function timeOfDay(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * How much a pattern is worth mentioning: how much more often the symptom was logged, times how
 * many days that rests on. A specific option or quick tap reads better than a whole category, so a
 * vaguer match scores lower, and a consistent pattern edges out a possible one.
 */
export function patternScore(f: InsightFinding): number {
  const { exposedWith, exposedTotal, otherWith, otherTotal } = f.counts;
  const gap = Math.max(0.01, (exposedTotal > 0 ? exposedWith / exposedTotal : 0) - (otherTotal > 0 ? otherWith / otherTotal : 0));
  const exposureSpecific = !f.exposureKey.startsWith('cat_');
  const outcomeSpecific = f.outcomeKey.startsWith('opt_');
  return gap * exposedWith * (f.tier === 'consistent' ? 1.2 : 1) * (exposureSpecific ? 1 : 0.8) * (outcomeSpecific ? 1 : 0.8);
}

/** Local calendar day, so a pattern is mentioned at most once a day. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export interface WatchInput {
  findings: InsightFinding[];
  entries: WatchedEntry[];
  now: number;
  /** Ids already spoken about, so each logged entry is mentioned once. */
  seen: ReadonlySet<string>;
}

export function buildTriggerWatchCandidates({ findings, entries, now, seen }: WatchInput): Candidate[] {
  // Only patterns the member can currently see: a possible or consistent tier that is still supported
  const usable = findings.filter(f => f.exposureKey && !f.noLongerSeen && (f.tier === 'possible' || f.tier === 'consistent'));
  if (usable.length === 0) return [];

  const found: Array<{ candidate: Candidate; score: number; at: number }> = [];
  for (const entry of entries) {
    const at = new Date(entry.occurredAt);
    const age = now - at.getTime();
    if (!Number.isFinite(age) || age < 0 || age > WATCH_LOOKBACK_MS) continue;

    const keys = new Set(triggerKeysOf(entry));
    let best: { finding: InsightFinding; window: [number, number] } | null = null;
    for (const finding of usable) {
      if (!keys.has(finding.exposureKey)) continue;
      const window = lagWindowOf(finding.lagDays);
      if (at.getTime() + window[1] * HOUR <= now) continue; // the pattern's window has already passed
      const stronger = !best || patternScore(finding) > patternScore(best.finding);
      if (stronger) best = { finding, window };
    }
    if (!best) continue;

    const { finding, window } = best;
    const id = `tw:${entry._id}:${finding.exposureKey}`;
    const patternKey = `twp:${finding.exposureKey}>${finding.outcomeKey}:${dayKey(now)}`;
    if (seen.has(id) || seen.has(patternKey)) continue;

    const [lo, hi] = window;
    const trigger = finding.exposure.optionLabel;
    const symptom = finding.outcome.optionLabel;
    const checkInHours = lo === 0 ? IMMEDIATE_WINDOW_CHECK_IN_HOURS : lo;
    const { exposedWith, exposedTotal } = finding.counts;

    found.push({ score: patternScore(finding), at: at.getTime(), candidate: {
      id,
      type: 'TRIGGER_WATCH',
      title: `You logged ${trigger} ${whenPhrase(at, finding.exposure.categoryName)}`,
      body: `${symptom} ${verbFor(symptom)} been more common ${lagPhrase(window)} after it.`,
      confidence: CONFIDENCE[finding.tier],
      timeliness: 0.7,
      expiresAt: at.getTime() + hi * HOUR,
      notBefore: Math.max(now, at.getTime() + checkInHours * HOUR),
      inAppNow: true,
      provenance: [
        `You logged ${trigger} at ${timeOfDay(at)} today.`,
        `In your own logs, ${symptom.toLowerCase()} showed up more often ${lagPhrase(window)} after ${trigger.toLowerCase()} (on ${exposedWith} of ${exposedTotal} such days).`,
        'This is a pattern in what you recorded, not a cause. It can change as you log more.',
      ],
      data: { insightId: finding.id, entryId: entry._id, patternKey, route: '/(tabs)/insights' },
    } });
  }

  // One observation per save: the strongest pattern, and for that pattern the most recent entry
  // (its window is the one still ahead). Everything else is left for a later run.
  found.sort((a, b) => b.score - a.score || b.at - a.at);
  return found.length > 0 ? [found[0].candidate] : [];
}
