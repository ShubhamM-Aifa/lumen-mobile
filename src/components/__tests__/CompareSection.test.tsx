import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { CompareSection } from '../insights/CompareSection';
import { useCompare } from '../../hooks/useCompare';

jest.mock('../../hooks/useCompare', () => ({ useCompare: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => Array.from(new Set(t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string)));

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<CompareSection />); });
  return tree;
}

describe('CompareSection', () => {
  it('prompts for a date before anything has been compared', async () => {
    (useCompare as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false, data: undefined });
    const t = texts(await render());
    expect(t).toContain('Did a change help?');
    expect(t).toContain('Pick a date');
  });

  it('shows a loading state while comparing', async () => {
    (useCompare as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: true, data: undefined });
    const tree = await render();
    expect(tree.root.findAllByType(require('react-native').ActivityIndicator)).toHaveLength(1);
  });

  it('shows the not-ready explanation when there is not enough data', async () => {
    (useCompare as jest.Mock).mockReturnValue({
      mutate: jest.fn(), isPending: false,
      data: { ready: false, reason: 'not_enough_pre_data', eventDay: '2026-09-01', washoutDays: 7, preDays: 5, postDays: 0, needed: 14 },
    });
    const t = texts(await render());
    expect(t.some(x => x.includes('5 of 14'))).toBe(true);
  });

  it('shows the comparison lines and caveats once ready', async () => {
    (useCompare as jest.Mock).mockReturnValue({
      mutate: jest.fn(), isPending: false,
      data: {
        ready: true, eventDay: '2026-09-01', washoutDays: 7, preDays: 28, postDays: 28, preFlares: 3, postFlares: 1,
        symptomDayRate: { value: -0.4, ci95: [-0.6, -0.15] },
        medianShift: { value: -3.2, ci95: [-5, -1.5] },
        flaresPer28: { value: -2, ci95: [-3, -1] },
        startedDuringRoughPatch: true, alreadyImproving: false,
      },
    });
    const t = texts(await render());
    expect(t.some(x => x.includes('moved down by 3.2'))).toBe(true);
    expect(t.some(x => x.includes('Flares per 28 days: 3 before, 1 after'))).toBe(true);
    expect(t.some(x => x.includes('rough patch'))).toBe(true);
    expect(t.some(x => x.includes('not a controlled test'))).toBe(true);
  });
});
