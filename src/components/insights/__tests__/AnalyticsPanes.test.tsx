/** Metrics and Explore panes render the server's numbers with counts and caveats; dose outbox and timer behave. */
import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../../charts/Charts', () => ({ Sparkline: () => null, LineChart: () => null, BarChart: () => null, ScatterPlot: () => null, DayStrip: () => null }));
jest.mock('../../common/AppDateTimePicker', () => () => null);

const mockAsk = jest.fn();
jest.mock('../../../hooks/useAskLumenAi', () => ({ useAskLumenAi: () => ({ ask: mockAsk, fullAccess: true }) }));

const mockCatalog = {
  firstDay: '2026-06-01', today: '2026-11-19', loggedDays: 120,
  metrics: [{ id: 'sleep_hours', label: 'Sleep', unit: 'h', group: 'sleep', scaleNote: null, days: 80 }],
  items: [{ key: 'opt_weak', label: 'Weakness', icon: null, groupLabel: 'Neuro symptoms', kind: 'option', archived: false, days: 20, lastSeen: '2026-11-18', hasQty: false, unit: null, hasSev: true, outcome: true }],
  medications: [{ id: 'a'.repeat(24), name: 'HCQ', dose: '200', prn: false, active: true, plannedDoses: 100, skippedDoses: 9 }],
  pins: ['sleep_hours'],
};
const mockMetric = {
  id: 'sleep_hours', label: 'Sleep', unit: 'h', decimals: 1, better: 'higher', summary: 'average',
  value: 6.5, median: 6.5, min: 5, max: 8, covered: 18, total: 30, prev: { value: 7.2, covered: 25 }, change: 'lower', shift: -0.7,
  goal: null, goalRate: null, trend: 'steady', series: [{ day: '2026-11-18', v: 6.5 }],
};
const mockAnswer = {
  target: { label: 'Weakness', days: 20, observedDays: 120, firstDay: '2026-06-03', lastDay: '2026-11-18' },
  direction: 'before',
  findings: [{ key: 'opt_dairy', label: 'Dairy', type: 'item', lag: 1, way: 'more', a: 9, b: 6, c: 11, d: 94, rateWith: 0.6, rateOther: 0.105, shrunkRR: 2.8, q: 0.004, tier: 'consistent', flags: ['logged_together'] }],
  numeric: [{ id: 'sleep_hours', label: 'Sleep', unit: 'h', lag: 1, medianWith: 5.6, medianOther: 7.1, shift: -1.4, nWith: 18, nOther: 90, q: 0.03, tier: 'possible' }],
  unclear: [{ key: 'opt_coffee', label: 'Coffee', lag: 0, rateWith: 0.2, rateOther: 0.15, a: 4, b: 16, c: 15, d: 85 }],
  notEnough: [{ key: 'opt_gluten', label: 'Gluten', days: 2 }],
  checkedCount: 34, caveats: ['together_not_cause', 'many_checked'], range: { from: '2025-11-20', to: '2026-11-19' }, token: 'TOKEN123',
};
const mockSetPins = jest.fn();
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalyticsCatalog: () => ({ data: mockCatalog, isLoading: false }),
  useMetrics: () => ({ data: { from: '2026-10-21', to: '2026-11-19', metrics: [mockMetric] }, isLoading: false, isError: false, refetch: jest.fn() }),
  useSetPins: () => ({ mutate: mockSetPins }),
  useExplore: () => ({ data: mockAnswer, isLoading: false, isError: false, refetch: jest.fn() }),
}));

import { MetricsPane } from '../MetricsPane';
import { ExplorePane } from '../ExplorePane';

function texts(tree: ReactTestRenderer): string[] {
  return tree.root.findAll(n => typeof n.props.children === 'string' || Array.isArray(n.props.children))
    .flatMap(n => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
    .filter((c): c is string => typeof c === 'string');
}
const joined = (tree: ReactTestRenderer) => texts(tree).join(' | ');

describe('MetricsPane', () => {
  it('shows each pinned number with coverage and the change, and opens details', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<MetricsPane />); });
    const all = joined(tree);
    expect(all).toContain('6h 30m');
    expect(all).toContain('Based on 18 of 30 days');
    expect(all).toContain('Lower than the period before (7h 12m)');
    const tile = tree.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Sleep: 6h 30m'));
    await act(async () => { tile.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/analytics/metric/[id]', params: { id: 'sleep_hours', range: '30d' } }));
  });
});

describe('ExplorePane', () => {
  it('shows what stood out with counts, flags, numbers and the not-cause line, and brainstorms with Lumen AI', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<ExplorePane />); });
    const all = joined(tree);
    expect(all).toContain('Weakness: 20 of 120 logged days.');
    expect(all).toContain('Dairy · the day before');
    expect(all).toContain('Weakness on 9 of 15 days after days with Dairy (60%), compared with 11 of 105 other days (10%).');
    expect(all).toContain('Consistent');
    expect(all).toMatch(/same hour/);
    expect(all).toContain('Sleep: typically 5.6 h the day before Weakness days, compared with 7.1 h around other days (18 and 90 days).');
    expect(all).toContain('Gluten: 2 days so far.');
    expect(all).toMatch(/don’t show that one thing leads to the other/);
    const ai = tree.root.find(n => n.props.accessibilityLabel === "Find what's linked with Lumen AI");
    await act(async () => { ai.props.onPress(); });
    expect(mockAsk).toHaveBeenCalledWith(
      { kind: 'analysis', id: 'TOKEN123', title: 'Explore: Weakness (before)' },
      expect.stringContaining('“Weakness”'),
    );
  });
});

describe('dose outbox', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('queues a mark made offline and sends it later', async () => {
    jest.resetModules();
    const put = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue({});
    jest.doMock('../../../api/client', () => ({ api: { put }, ApiError: class ApiError extends Error { statusCode = 400; } }));
    jest.doMock('../../../api/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
    jest.doMock('../../../utils/uuid', () => ({ uuidv4: () => 'uuid-1' }));
    const { markDose, flushDoseOutbox } = require('../../../hooks/useDoses');
    expect(await markDose({ medicationId: 'm1', dayKey: '2026-11-19', slot: '08:00', status: 'skipped' })).toBe('queued');
    expect(await flushDoseOutbox()).toBe(1);
    expect(put).toHaveBeenLastCalledWith('/medications/m1/doses', expect.objectContaining({ dayKey: '2026-11-19', slot: '08:00', status: 'skipped', clientId: expect.any(String) }));
    expect(await flushDoseOutbox()).toBe(0);
  });
});

describe('timer quick taps', () => {
  it('logs the elapsed minutes at the start time when stopped', async () => {
    jest.resetModules();
    const tap = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../../../store/quickLogStore', () => ({ useQuickLogStore: { getState: () => ({ tap }) } }));
    const { useQuickTimerStore } = require('../../../store/quickTimerStore');
    const realNow = Date.now;
    const start = new Date('2026-11-19T07:00:00Z').getTime();
    Date.now = () => start;
    jest.useFakeTimers().setSystemTime(start);
    await useQuickTimerStore.getState().start('qa_walk', 'Walk');
    jest.setSystemTime(start + 25 * 60 * 1000);
    const sec = await useQuickTimerStore.getState().stop(4);
    jest.useRealTimers();
    Date.now = realNow;
    expect(sec).toBe(1500);
    expect(tap).toHaveBeenCalledWith('qa_walk', '2026-11-19T07:00:00.000Z', 4, { durationSec: 1500 });
    expect(useQuickTimerStore.getState().running).toBeNull();
  });
});
