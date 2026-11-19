/**
 * Small, dependency-free chart maths for the SVG charts: "nice" axis ticks, linear scales,
 * line paths that break at missing days (never drawn through a gap), and downsampling.
 */

/** About `count` round tick values covering [min, max] (1, 2, 2.5 or 5 × 10^n steps). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out.map(v => Math.round(v * 1e6) / 1e6);
}

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** SVG path for values with gaps: each run of non-null values is its own segment. */
export function gapPath(values: Array<number | null>, x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

/** Points that have no neighbour on either side (drawn as dots so a lone day is still visible). */
export function isolatedIndexes(values: Array<number | null>): number[] {
  return values.flatMap((v, i) => (v !== null && (values[i - 1] ?? null) === null && (values[i + 1] ?? null) === null ? [i] : []));
}

/** Keeps at most `max` points by averaging buckets (nulls stay null only if a whole bucket is empty). */
export function downsample(values: Array<number | null>, max = 120): Array<number | null> {
  if (values.length <= max) return values;
  const size = values.length / max;
  const out: Array<number | null> = [];
  for (let b = 0; b < max; b++) {
    const chunk = values.slice(Math.floor(b * size), Math.floor((b + 1) * size)).filter((v): v is number => v !== null);
    out.push(chunk.length ? chunk.reduce((a, c) => a + c, 0) / chunk.length : null);
  }
  return out;
}

/** Domain for values (with an optional goal included), padded a little so lines don't touch edges. */
export function valueDomain(values: Array<number | null>, include: Array<number | null | undefined> = [], zeroBased = false): [number, number] | null {
  const nums = [...values, ...include].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (zeroBased) lo = Math.min(0, lo);
  if (lo === hi) { hi = lo + 1; if (!zeroBased) lo -= 1; }
  const ticks = niceTicks(lo, hi);
  return [ticks[0], ticks[ticks.length - 1]];
}

/** "12,500" / "7.5" with the metric's decimals. */
export function formatValue(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}
