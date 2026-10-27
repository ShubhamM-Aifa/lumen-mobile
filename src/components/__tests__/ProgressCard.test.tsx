import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ProgressCard } from '../insights/ProgressCard';
import type { ProgressData } from '../../hooks/useProgress';

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => Array.from(new Set(t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string)));

const progress = (over: Partial<ProgressData> = {}): ProgressData => ({
  trend: { state: 'improving', weeklyValues: [{ weekKey: '2026-09-07', value: 6 }, { weekKey: '2026-09-14', value: 3 }], pValue: 0.02, estimatedChange: -3, weeksNeeded: 0 },
  goodBadDays: { good: 8, bad: 3, observed: 20, windowDays: 28 },
  recentShift: null,
  ...over,
});

async function render(p: ProgressData): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<ProgressCard progress={p} />); });
  return tree;
}

describe('ProgressCard', () => {
  it('shows the trend headline, body and good/bad summary', async () => {
    const t = texts(await render(progress()));
    expect(t).toContain('Your progress');
    expect(t).toContain('Your logs look better lately');
    expect(t.some(x => x.includes('8 good'))).toBe(true);
    expect(t.some(x => x.includes('3 harder'))).toBe(true);
  });

  it('shows a regime-shift note only when there is one', async () => {
    const withShift = texts(await render(progress({ recentShift: { dayKey: '2026-10-12', direction: 'up' } })));
    expect(withShift.some(t => t.includes('12 Oct'))).toBe(true);
    const without = texts(await render(progress({ recentShift: null })));
    expect(without.some(t => t.includes('running higher'))).toBe(false);
  });

  it('renders the not-enough-data state without crashing', async () => {
    const t = texts(await render(progress({ trend: { state: 'not_enough_data', weeklyValues: [], pValue: null, estimatedChange: null, weeksNeeded: 4 } })));
    expect(t).toContain('Building your trend');
  });
});
