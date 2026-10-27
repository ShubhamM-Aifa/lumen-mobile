/**
 * Words for the early-warning card. Same rules as the rest of Insights: no diagnosis, nothing
 * that tells the member what to do medically, and the card always shows its own track record
 * rather than a bare confidence number, because about half of these will not be followed by a
 * flare even at the best published accuracy.
 */
import type { WarningData } from '../../hooks/useWarning';

export function warningHeadline(w: WarningData): string {
  if (w.alertLevel === 1) return 'The last few days resemble your pre-flare days';
  if (w.alertLevel === 0) return 'Higher than your usual the last couple of days';
  return 'Nothing unusual right now';
}

export function warningBody(w: WarningData): string {
  if (w.alertLevel === 1) {
    return 'Your symptoms, steps and sleep over the last week look similar to how things were just before some of your past flares.';
  }
  if (w.alertLevel === 0) {
    return 'Your recent numbers are running higher than your own usual range. This is a simple statistical check, not a prediction.';
  }
  return 'Your recent logs do not show the kind of shift that came before past flares.';
}

/** "A flare followed 3 times out of 7 when it looked like this before." Only level 1 has this. */
export function trackRecordLine(w: WarningData): string | null {
  const tr = w.level1?.trackRecord;
  if (!tr || tr.of === 0) return null;
  return `A flare followed ${tr.followed} time${tr.followed === 1 ? '' : 's'} out of ${tr.of} when this check has gone off before.`;
}

export function level1GateLine(w: WarningData): string | null {
  const l1 = w.level1;
  if (!l1 || l1.enabled) return null;
  if (l1.gateReason === 'too_few_episodes') {
    return `The resemblance check needs a few more confirmed flares before it can turn on (${l1.episodeCount} so far).`;
  }
  if (l1.gateReason === 'too_few_logged_days') {
    return `The resemblance check needs more logged days before it can turn on (${l1.loggedDays} so far).`;
  }
  return 'The resemblance check has not yet proven itself reliable enough on your own history to turn on.';
}

export const DISCLAIMER_LINE = 'This is a pattern in your own logs, not a diagnosis or a prediction. Please discuss any concerns with your doctor, and never change a medicine based on this alone.';
