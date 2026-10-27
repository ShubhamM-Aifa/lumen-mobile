import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import InsightsScreen from '../../../app/(tabs)/insights';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseInsights = jest.fn();
jest.mock('../../hooks/useInsights', () => ({
  useInsights: () => mockUseInsights(),
  useRecomputeInsights: () => ({ mutate: jest.fn(), isPending: false }),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);

const insight = {
  _id: 'i1',
  trigger: { categoryName: 'Food & Drink', optionLabel: 'Dairy', categoryIcon: '🍽️' },
  symptom: { categoryName: 'Symptom', optionLabel: 'Fatigue', categoryIcon: '🩺' },
  lagWindow: '24-48h',
  lift: 1.9,
  supportCount: 10,
  confidence: 'Medium',
  computedAt: '2026-10-27T10:31:00.000Z',
};

const ready = (over: Record<string, unknown> = {}) => ({
  data: {
    insights: [insight],
    stats: [{ key: 'days-logged', icon: '📅', title: 'Days logged', value: '20 of 30', sub: 'days with at least one entry' }],
    daysOfData: 20,
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
  it('shows stats and patterns once there are 14 days of data', async () => {
    mockUseInsights.mockReturnValue(ready());
    const x = texts(await render());
    expect(x).toContain('At a glance');
    expect(x).toContain('Days logged');
    expect(x).toContain('Observed patterns');
    expect(x).toContain('Dairy');
    expect(x).not.toContain('Building your picture');
  });

  it('shows progress instead of results before 14 days', async () => {
    mockUseInsights.mockReturnValue(ready({ daysOfData: 9, insights: [], stats: [] }));
    const x = texts(await render());
    expect(x).toContain('Building your picture');
    expect(x).toContain('9 / 14 days');
    expect(x).not.toContain('Observed patterns');
  });

  it('says when no patterns were found yet', async () => {
    mockUseInsights.mockReturnValue(ready({ insights: [] }));
    const x = texts(await render());
    expect(x).toContain('No patterns found yet. Keep logging for a few more days.');
  });
});
