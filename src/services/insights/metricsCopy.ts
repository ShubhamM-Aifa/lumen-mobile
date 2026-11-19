/**
 * Every sentence the Metrics pane shows. Pure functions; checked by metricsCopy.test.ts.
 * Averages only ever count days with a value, and the text always says how many.
 */
import type { ChangeWord, MetricSummary, TrendWord } from '../../hooks/useAnalytics';
import { formatValue } from '../../utils/charts/chartScale';

export function valueText(s: Pick<MetricSummary, 'value' | 'unit' | 'decimals' | 'summary'>): string {
  if (s.value === null) return '–';
  if (s.summary === 'share') return `${formatValue(s.value, 0)}%`;
  if (s.unit === 'ml' && s.value >= 1000) return `${formatValue(s.value / 1000, 1)} L`;
  if (s.unit === 'h') {
    const h = Math.floor(s.value);
    const m = Math.round((s.value - h) * 60);
    return m === 60 ? `${h + 1}h` : `${h}h ${m}m`;
  }
  const unit = s.unit && !s.unit.startsWith('/') ? ` ${s.unit}` : s.unit;
  return `${formatValue(s.value, s.decimals)}${unit}`;
}

export function coverageText(covered: number, total: number): string {
  if (covered === 0) return `No values in these ${total} days`;
  return `Based on ${covered} of ${total} days`;
}

export function shareLabel(s: Pick<MetricSummary, 'summary'>): string {
  return s.summary === 'share' ? 'of logged days' : 'average per day';
}

export function changeText(change: ChangeWord, prev: MetricSummary['prev'], s: Pick<MetricSummary, 'unit' | 'decimals' | 'summary'>): string {
  switch (change) {
    case 'higher': return `Higher than the period before (${prev?.value === null || !prev ? '–' : valueText({ ...s, value: prev.value })})`;
    case 'lower': return `Lower than the period before (${prev?.value === null || !prev ? '–' : valueText({ ...s, value: prev.value })})`;
    case 'similar': return 'About the same as the period before';
    case 'not_enough': return 'Not enough days to compare with the period before';
  }
}

/** Whether a change is in the direction the member would usually want (for colour only). */
export function changeTone(change: ChangeWord, better: 'higher' | 'lower' | null): 'good' | 'bad' | 'neutral' {
  if (!better || (change !== 'higher' && change !== 'lower')) return 'neutral';
  return change === better ? 'good' : 'bad';
}

export function trendText(t: TrendWord): string {
  switch (t) {
    case 'rising': return 'Going up over recent weeks';
    case 'falling': return 'Going down over recent weeks';
    case 'steady': return 'Steady over recent weeks';
    case 'not_enough': return 'A trend needs about 4 weeks of values';
  }
}

export function goalText(rate: MetricSummary['goalRate'], goal: number | null, s: Pick<MetricSummary, 'unit' | 'decimals' | 'summary'>): string | null {
  if (!rate || goal === null) return null;
  return `Goal of ${valueText({ ...s, value: goal })} reached on ${rate.hit} of ${rate.of} days`;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const METRICS_NOTE = 'Days with nothing logged are left out of averages; they are never counted as zero for sleep, energy, stress or weather.';

export const SCATTER_NOTE = 'A dot is one day. A pattern here shows two numbers moving together in your logs, not that one moves the other.';

export function rhoText(rho: { value: number; p: number } | null, n: number): string {
  if (!rho) return `Needs at least 8 days with both values (${n} so far).`;
  const strength = Math.abs(rho.value) >= 0.5 ? 'clearly' : Math.abs(rho.value) >= 0.3 ? 'somewhat' : 'barely';
  const way = rho.value > 0 ? 'go up together' : 'move in opposite directions';
  const chance = rho.p < 0.05 ? '' : ' This could easily be chance.';
  return `Over ${n} days these ${strength} ${way} (rank correlation ${rho.value.toFixed(2)}).${chance}`;
}
