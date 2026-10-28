/**
 * Words for the "test it for 6 weeks" experiment card. Same rules as the rest of Insights: plain
 * counts over percentages, no cause language, and anything touching a medicine routes to "discuss
 * with your doctor" rather than reading as a self-test result.
 */
import type { ExperimentData } from '../../hooks/useExperiments';

export function scheduleLine(e: ExperimentData): string {
  const p = e.progress;
  if (p.currentBlockIndex === null && !p.readyForAnalysis) {
    return `Starts ${e.startDay}. Six 7-day blocks, picked in a random order you won't see in advance.`;
  }
  if (p.readyForAnalysis) return 'The six weeks are complete.';
  const block = p.currentBlock === 'with' ? `with ${e.exposureLabel}` : `without ${e.exposureLabel}`;
  return `Week ${(p.currentBlockIndex ?? 0) + 1} of 6, day ${p.dayInBlock} of 7 — this week is ${block}.`;
}

export function resultLine(e: ExperimentData): string | null {
  if (!e.result) return null;
  const { withCount, withTotal, withoutCount, withoutTotal } = e.result;
  return `${e.outcomeLabel}: ${withCount} of ${withTotal} days with ${e.exposureLabel}, compared with ${withoutCount} of ${withoutTotal} days without it.`;
}

export function significanceLine(e: ExperimentData): string {
  if (!e.result) return '';
  if (e.result.pValue <= 0.05) {
    return e.result.statistic > 0
      ? `${e.outcomeLabel} was more common in the weeks with ${e.exposureLabel}. This pattern would be unusual by chance alone.`
      : `${e.outcomeLabel} was less common in the weeks with ${e.exposureLabel}. This pattern would be unusual by chance alone.`;
  }
  return 'The difference between the two kinds of week could easily be chance.';
}

export function thinDataLine(e: ExperimentData): string | null {
  if (!e.result || e.result.thinBlocks === 0) return null;
  return `${e.result.thinBlocks} of the 6 weeks had too few logged days to read with confidence.`;
}

export const MEDICINE_LINE = "This involves a medicine. Please design and review this with your doctor before changing anything, and never stop or start a medicine based on this test alone.";

export const EXPERIMENT_DISCLAIMER = 'This is one self-experiment, not a controlled trial. It can still be swayed by anything else that changed over the six weeks.';
