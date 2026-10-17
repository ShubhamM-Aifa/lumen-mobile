/**
 * Tests for quickLogStore with Day Reset Boundary support.
 */
import { useQuickLogStore } from '../quickLogStore';
import { api } from '../../api/client';
import { getDayBoundaryWindow } from '../../utils/dayBoundary';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../api/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

jest.mock('../../services/logLocationService', () => ({
  logLocationService: {
    getFastLocationSnapshot: jest.fn().mockResolvedValue(null),
  },
}));

describe('quickLogStore with Day Reset Boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useQuickLogStore.getState().resetToday();
    (api.post as jest.Mock).mockResolvedValue({ _id: 'srv-123' });
    (api.get as jest.Mock).mockResolvedValue([]);
    (api.delete as jest.Mock).mockResolvedValue({});
  });

  it('increments tap count when taps occur within the same day boundary window', async () => {
    // 10:00 AM today and 11:30 AM today (boundaryHour = 4)
    const t1 = new Date(2026, 9, 17, 10, 0, 0).toISOString();
    const t2 = new Date(2026, 9, 17, 11, 30, 0).toISOString();

    await useQuickLogStore.getState().tap('qa-water', t1, 4);
    let state = useQuickLogStore.getState();
    expect(state.todayTaps['qa-water']).toBeDefined();
    expect(state.todayTaps['qa-water'].count).toBe(1);

    await useQuickLogStore.getState().tap('qa-water', t2, 4);
    state = useQuickLogStore.getState();
    expect(state.todayTaps['qa-water'].count).toBe(2);
  });

  it('treats late-night taps (e.g. 2:30 AM) as belonging to the session started at 4 AM yesterday', async () => {
    // Boundary hour = 4
    // Yesterday 22:00 (10 PM) and today 02:30 (2:30 AM) belong to the SAME tracking day
    const yesterdayNight = new Date(2026, 9, 16, 22, 0, 0).toISOString();
    const earlyMorning = new Date(2026, 9, 17, 2, 30, 0).toISOString();

    await useQuickLogStore.getState().tap('qa-med', yesterdayNight, 4);
    let state = useQuickLogStore.getState();
    expect(state.todayTaps['qa-med'].count).toBe(1);

    await useQuickLogStore.getState().tap('qa-med', earlyMorning, 4);
    state = useQuickLogStore.getState();
    // Since 2:30 AM is before 4 AM boundary, it belongs to the 2026-10-16 tracking day window
    expect(state.todayTaps['qa-med'].count).toBe(2);
  });

  it('resets tap count to 1 when a tap occurs after crossing the day boundary hour', async () => {
    // Boundary hour = 4
    // Tap 1: 03:50 AM (tracking day 2026-10-16)
    // Tap 2: 04:10 AM (crossing boundary! tracking day 2026-10-17)
    const beforeBoundary = new Date(2026, 9, 17, 3, 50, 0).toISOString();
    const afterBoundary = new Date(2026, 9, 17, 4, 10, 0).toISOString();

    await useQuickLogStore.getState().tap('qa-coffee', beforeBoundary, 4);
    let state = useQuickLogStore.getState();
    expect(state.todayTaps['qa-coffee'].count).toBe(1);

    await useQuickLogStore.getState().tap('qa-coffee', afterBoundary, 4);
    state = useQuickLogStore.getState();
    // After crossing 4 AM, count resets to 1 for the new day
    expect(state.todayTaps['qa-coffee'].count).toBe(1);
  });

  it('pruneStaleTaps removes entries that are outside the active day boundary window', () => {
    const yesterday = new Date(2026, 9, 15, 12, 0, 0).toISOString();
    useQuickLogStore.setState({
      todayTaps: {
        'qa-old': {
          id: 'old-1',
          quickActionId: 'qa-old',
          occurredAt: yesterday,
          count: 3,
          lastAt: yesterday,
          synced: true,
        },
      },
    });

    useQuickLogStore.getState().pruneStaleTaps(4);
    expect(useQuickLogStore.getState().todayTaps['qa-old']).toBeUndefined();
  });

  it('fetchTodayTaps queries logs matching the day boundary window and updates tapsMap', async () => {
    const boundaryHour = 4;
    const now = new Date();
    const { start, end } = getDayBoundaryWindow(boundaryHour, now);

    const midWindow = new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();

    (api.get as jest.Mock).mockResolvedValue([
      {
        _id: 'log-1',
        source: 'quick_action',
        quickActionId: 'qa-stretch',
        occurredAt: midWindow,
      },
      {
        _id: 'log-2',
        source: 'quick_action',
        quickActionId: 'qa-stretch',
        occurredAt: midWindow,
      },
    ]);

    await useQuickLogStore.getState().fetchTodayTaps(boundaryHour);

    expect(api.get).toHaveBeenCalledWith('/logs', {
      params: {
        from: start.toISOString(),
        to: end.toISOString(),
        limit: 500,
      },
    });

    const state = useQuickLogStore.getState();
    expect(state.todayTaps['qa-stretch']).toBeDefined();
    expect(state.todayTaps['qa-stretch'].count).toBe(2);
  });

  it('undo decrements the count of the last tapped action', async () => {
    const t = new Date(2026, 9, 17, 12, 0, 0).toISOString();
    await useQuickLogStore.getState().tap('qa-water', t, 4);
    await useQuickLogStore.getState().tap('qa-water', t, 4);
    expect(useQuickLogStore.getState().todayTaps['qa-water'].count).toBe(2);

    useQuickLogStore.getState().undo();
    expect(useQuickLogStore.getState().todayTaps['qa-water'].count).toBe(1);
    expect(api.delete).toHaveBeenCalledWith('/logs/srv-123');
  });
});
