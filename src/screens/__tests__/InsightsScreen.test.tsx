import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import InsightsScreen, { HIDDEN_FINDINGS_KEY } from '../../../app/(tabs)/insights';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseInsights = jest.fn();
jest.mock('../../hooks/useInsights', () => ({
  useInsights: () => mockUseInsights(),
  useRecomputeInsights: () => ({ mutate: jest.fn(), isPending: false }),
}));

// Progress, early warning and "did it help?" have their own test files; here they just need to not crash the screen
jest.mock('../../hooks/useProgress', () => ({ useProgress: () => ({ data: undefined }) }));
jest.mock('../../hooks/useWarning', () => ({ useWarning: () => ({ data: undefined }), useWarningFeedback: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('../../components/insights/CompareSection', () => ({ CompareSection: () => null }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);

const finding = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  exposureKey: `opt_${id}`,
  outcomeKey: 'opt_pain',
  exposure: { categoryName: 'Food & Drink', optionLabel: `Food ${id}`, categoryIcon: '🍽️' },
  outcome: { categoryName: 'Symptom', optionLabel: 'Fatigue', categoryIcon: '🩺' },
  lagDays: 1,
  counts: { exposedWith: 9, exposedTotal: 14, otherWith: 6, otherTotal: 31 },
  tier: 'possible',
  noLongerSeen: false,
  weakDays: false,
  ...over,
});

const ready = (over: Record<string, unknown> = {}) => ({
  data: {
    findings: [finding('dairy')],
    stats: [{ key: 'days-logged', icon: '📅', title: 'Days logged', value: '20 of 30', sub: 'days with at least one entry' }],
    progress: { observedDays: 40, daysNeeded: 30 },
    daysOfData: 40,
    lastComputedAt: '2026-10-27T10:31:00.000Z',
    ...over,
  },
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
});

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<InsightsScreen />); });
  return tree;
}

describe('Insights screen', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('shows stats and the pattern with its counts and a "not a cause" line', async () => {
    mockUseInsights.mockReturnValue(ready());
    const x = texts(await render());
    expect(x).toContain('At a glance');
    expect(x).toContain('Days logged');
    expect(x).toContain('Patterns in your logs');
    expect(x).toContain('The day after Food dairy, fatigue was logged more often.');
    expect(x).toContain('9 of 14 days after Food dairy, compared with 6 of 31 other days.');
    expect(x).toContain('Possible link');
    expect(x.some(t => t.startsWith('These happened together in your logs'))).toBe(true);
    expect(x).not.toContain('Building your picture');
  });

  it('shows progress toward being able to compare, not a 14-day gate', async () => {
    mockUseInsights.mockReturnValue(ready({ daysOfData: 9, findings: [], stats: [], progress: { observedDays: 9, daysNeeded: 30 } }));
    const x = texts(await render());
    expect(x).toContain('Building your picture');
    expect(x).toContain('9 / 30 logged days');
    expect(x).not.toContain('Patterns in your logs');
    expect(x).not.toContain('At a glance');
  });

  it('says calmly that there are no patterns yet once there is enough data', async () => {
    mockUseInsights.mockReturnValue(ready({ findings: [] }));
    const x = texts(await render());
    expect(x).toContain('No patterns yet');
    expect(x.some(t => t.includes('not a sign anything is wrong'))).toBe(true);
  });

  it('shows three patterns first and the rest behind "See more"', async () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(id => finding(id));
    mockUseInsights.mockReturnValue(ready({ findings: five }));
    const tree = await render();
    let x = texts(tree);
    expect(new Set(x.filter(t => t.startsWith('The day after Food '))).size).toBe(3);
    expect(x).toContain('See 2 more');
    const more = tree.root.findAll(n => typeof n.props.onPress === 'function' && texts_of(n).includes('See 2 more'))[0];
    await act(async () => { (more.props.onPress as () => void)(); });
    x = texts(tree);
    expect(new Set(x.filter(t => t.startsWith('The day after Food '))).size).toBe(5);
    expect(x).toContain('Show fewer');
  });

  it('filters by tier', async () => {
    mockUseInsights.mockReturnValue(ready({ findings: [finding('a', { tier: 'consistent' }), finding('b')] }));
    const tree = await render();
    const chip = tree.root.findAll(n => typeof n.props.onPress === 'function' && texts_of(n).includes('Consistent'))[0];
    await act(async () => { (chip.props.onPress as () => void)(); });
    const x = texts(tree);
    expect(x).toContain('The day after Food a, fatigue was logged more often.');
    expect(x).not.toContain('The day after Food b, fatigue was logged more often.');
  });

  it('hides a pattern marked "Not useful" and remembers it', async () => {
    mockUseInsights.mockReturnValue(ready({ findings: [finding('dairy')] }));
    const tree = await render();
    const btn = tree.root.findAll(n => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string' && (n.props.accessibilityLabel as string).startsWith('Not useful'))[0];
    await act(async () => { (btn.props.onPress as () => void)(); });
    expect(texts(tree)).not.toContain('The day after Food dairy, fatigue was logged more often.');
    expect(JSON.parse((await AsyncStorage.getItem(HIDDEN_FINDINGS_KEY)) as string)).toEqual(['dairy']);

    const again = await render();
    expect(texts(again)).not.toContain('The day after Food dairy, fatigue was logged more often.');
  });

  it('keeps patterns that stopped showing out of the main list, behind "Not seen lately"', async () => {
    mockUseInsights.mockReturnValue(ready({ findings: [finding('old', { noLongerSeen: true, lastShownDay: '2026-10-12' })] }));
    const tree = await render();
    let x = texts(tree);
    expect(x).toContain('Not seen lately');
    expect(x).not.toContain('The day after Food old, fatigue was logged more often.');
    const header = tree.root.findAll(n => typeof n.props.onPress === 'function' && texts_of(n).includes('Not seen lately'))[0];
    await act(async () => { (header.props.onPress as () => void)(); });
    x = texts(tree);
    expect(x).toContain('The day after Food old, fatigue was logged more often.');
    expect(x.some(t => t.startsWith('Not seen since 12 Oct'))).toBe(true);
  });
});

/** All plain text under a node. */
function texts_of(node: { findAll: (p: (n: { props: Record<string, unknown> }) => boolean) => Array<{ props: Record<string, unknown> }> }): string[] {
  return node.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
}
