import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { WarningCard } from '../insights/WarningCard';
import { useWarningFeedback } from '../../hooks/useWarning';
import type { WarningData } from '../../hooks/useWarning';

jest.mock('../../hooks/useWarning', () => ({ useWarningFeedback: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => Array.from(new Set(t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string)));
const button = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

const warning = (over: Partial<WarningData> = {}): WarningData => ({
  ready: true, enabledLevel: 1, alert: true, alertLevel: 1, suppressedByFlare: false, disabled: false,
  level1: { enabled: true, gateReason: null, episodeCount: 5, loggedDays: 60, trackRecord: { followed: 3, of: 7 } },
  computedAt: '2026-10-27T04:30:00.000Z',
  ...over,
});

async function render(w: WarningData): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<WarningCard warning={w} />); });
  return tree;
}

describe('WarningCard', () => {
  const mutate = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useWarningFeedback as jest.Mock).mockReturnValue({ mutate, isPending: false });
  });

  it('shows the headline, track record and fixed disclaimer when there is an active alert', async () => {
    const tree = await render(warning());
    const t = texts(tree);
    expect(t.some(x => x.includes('resemble'))).toBe(true);
    expect(t).toContain('A flare followed 3 times out of 7 when this check has gone off before.');
    expect(t.some(x => x.includes('not a diagnosis or a prediction'))).toBe(true);
  });

  it('shows the three feedback buttons only when there is an active alert', async () => {
    const activeTree = await render(warning());
    expect(button(activeTree, 'Helpful')).toBeDefined();
    expect(button(activeTree, 'Not this time')).toBeDefined();
    expect(button(activeTree, 'Stop these')).toBeDefined();

    const calmTree = await render(warning({ alert: false, alertLevel: null }));
    expect(button(calmTree, 'Helpful')).toBeUndefined();
  });

  it('sends the right feedback action for each button', async () => {
    const tree = await render(warning());
    await act(async () => { button(tree, 'Not this time').props.onPress(); });
    expect(mutate).toHaveBeenCalledWith('not_this_time');
    await act(async () => { button(tree, 'Stop these').props.onPress(); });
    expect(mutate).toHaveBeenCalledWith('stop');
  });

  it('renders nothing once the member has disabled the feature', async () => {
    const tree = await render(warning({ disabled: true }));
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing before the server result is ready', async () => {
    const tree = await render(warning({ ready: false }));
    expect(tree.toJSON()).toBeNull();
  });

  it('explains the level-1 gate instead of a track record when it is not enabled yet', async () => {
    const tree = await render(warning({
      alertLevel: 0,
      level1: { enabled: false, gateReason: 'too_few_episodes', episodeCount: 2, loggedDays: 50, trackRecord: null },
    }));
    const t = texts(tree);
    expect(t.some(x => x.includes('2 so far'))).toBe(true);
    expect(t.some(x => x.startsWith('A flare followed'))).toBe(false);
  });
});
