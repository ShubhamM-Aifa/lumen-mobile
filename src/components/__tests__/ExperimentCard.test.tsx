import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ExperimentCard } from '../insights/ExperimentCard';
import { useEndExperiment } from '../../hooks/useExperiments';
import type { ExperimentData } from '../../hooks/useExperiments';

jest.mock('../../hooks/useExperiments', () => ({ useEndExperiment: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => Array.from(new Set(t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string)));
const button = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

const experiment = (over: Partial<ExperimentData> = {}): ExperimentData => ({
  id: 'e1', exposureKey: 'opt_coffee', exposureLabel: 'Coffee', outcomeKey: 'opt_headache', outcomeLabel: 'Headache',
  startDay: '2026-09-01', endDay: '2026-10-12', washoutDays: 2, isMedicineRelated: false, status: 'active',
  progress: { currentBlockIndex: 2, currentBlock: 'with', dayInBlock: 4, daysElapsed: 18, daysRemaining: 24, readyForAnalysis: false },
  result: null,
  ...over,
});

async function render(e: ExperimentData): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<ExperimentCard experiment={e} />); });
  return tree;
}

describe('ExperimentCard', () => {
  const mutate = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useEndExperiment as jest.Mock).mockReturnValue({ mutate, isPending: false });
  });

  it('shows the title and current-week schedule while running', async () => {
    const tree = await render(experiment());
    const t = texts(tree);
    expect(t.some(x => x.includes('Testing Coffee'))).toBe(true);
    expect(t.some(x => x.includes('Headache'))).toBe(true);
    expect(t.some(x => x.includes('Week 3 of 6'))).toBe(true);
  });

  it('offers to stop early only while active and not yet analysed', async () => {
    const running = await render(experiment());
    expect(button(running, 'Stop this experiment')).toBeDefined();

    const finished = await render(experiment({
      progress: { currentBlockIndex: 5, currentBlock: 'without', dayInBlock: 7, daysElapsed: 42, daysRemaining: 0, readyForAnalysis: true },
      result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 },
    }));
    expect(button(finished, 'Stop this experiment')).toBeUndefined();
  });

  it('shows the result, significance line and fixed disclaimer once there is a result', async () => {
    const tree = await render(experiment({
      progress: { currentBlockIndex: 5, currentBlock: 'without', dayInBlock: 7, daysElapsed: 42, daysRemaining: 0, readyForAnalysis: true },
      result: { withCount: 9, withTotal: 15, withoutCount: 3, withoutTotal: 15, statistic: 0.4, pValue: 0.05, thinBlocks: 0 },
    }));
    const t = texts(tree);
    expect(t.some(x => x.includes('9 of 15 days with Coffee'))).toBe(true);
    expect(t.some(x => x.includes('more common in the weeks with Coffee'))).toBe(true);
    expect(t.some(x => x.includes('not a controlled trial'))).toBe(true);
  });

  it('shows the medicine caveat only when the exposure is a medicine', async () => {
    const withMed = await render(experiment({ isMedicineRelated: true }));
    expect(texts(withMed).some(x => x.includes('Please design and review this with your doctor'))).toBe(true);
    const withoutMed = await render(experiment({ isMedicineRelated: false }));
    expect(texts(withoutMed).some(x => x.includes('Please design and review this with your doctor'))).toBe(false);
  });

  it('asks to confirm before stopping, and only stops on confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      const stop = buttons?.find(b => b.text === 'Stop');
      stop?.onPress?.();
    });
    const tree = await render(experiment());
    await act(async () => { button(tree, 'Stop this experiment').props.onPress(); });
    expect(mutate).toHaveBeenCalledWith({ id: 'e1', status: 'abandoned' });
    jest.restoreAllMocks();
  });
});
