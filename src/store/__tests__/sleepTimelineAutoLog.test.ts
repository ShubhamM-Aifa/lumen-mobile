import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSleepTrackerStore } from '../sleepTrackerStore';
import { api } from '../../api/client';
import { queryClient } from '../../api/queryClient';

const mockRecordWakeUp = jest.fn();
const mockRecordGoToBed = jest.fn();
jest.mock('../daySessionStore', () => ({
  useDaySessionStore: {
    getState: () => ({
      todaySession: null,
      recordWakeUp: mockRecordWakeUp,
      recordGoToBed: mockRecordGoToBed,
    }),
  },
}));

jest.mock('../../api/client', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ success: true }),
    get: jest.fn().mockResolvedValue({ success: true }),
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

describe('sleep timeline auto-logging', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    useSleepTrackerStore.setState({
      isSleeping: false,
      activeSleepStart: null,
      lastSleepRecord: null,
      targetGoalMinutes: 480,
      minRecoveryMinutes: 420,
      isLoaded: true,
    });
  });

  it('automatically logs sleep to Timeline on wakeUp without requiring manual modal', async () => {
    const bedtime = new Date('2026-11-16T22:30:00.000Z');
    const wakeTime = new Date('2026-11-17T06:30:00.000Z');

    await useSleepTrackerStore.getState().startSleep(bedtime);
    expect(useSleepTrackerStore.getState().isSleeping).toBe(true);

    const record = await useSleepTrackerStore.getState().wakeUp(wakeTime);
    expect(record.durationMinutes).toBe(480); // 8 hours
    expect(useSleepTrackerStore.getState().isSleeping).toBe(false);

    // Verify daySessionStore was synced
    expect(mockRecordWakeUp).toHaveBeenCalledWith(wakeTime);

    // Verify api.post('/logs') was called with source: 'sleep'
    expect(api.post).toHaveBeenCalledWith(
      '/logs',
      expect.objectContaining({
        clientId: expect.stringMatching(/^sleep:\d{4}-\d{2}-\d{2}$/),
        source: 'sleep',
        occurredAt: wakeTime.toISOString(),
        note: expect.stringContaining('Sleep: 8h 0m'),
      })
    );

    // Verify timeline query invalidation
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['day-entries'] });
  });

  it('enriches the sleep timeline entry when sleep quality is rated', async () => {
    const wakeTime = new Date('2026-11-17T06:30:00.000Z');
    await useSleepTrackerStore.getState().wakeUp(wakeTime);
    jest.clearAllMocks();

    await useSleepTrackerStore.getState().recordSleepQuality('RESTFUL');

    expect(api.post).toHaveBeenCalledWith(
      '/logs',
      expect.objectContaining({
        clientId: expect.stringMatching(/^sleep:\d{4}-\d{2}-\d{2}$/),
        source: 'sleep',
        note: expect.stringContaining('Restful'),
      })
    );
  });
});

