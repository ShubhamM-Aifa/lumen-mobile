import { Platform } from 'react-native';

const mockGetStepCount = jest.fn();
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    getStepCountAsync: (...a: unknown[]) => mockGetStepCount(...a),
  },
}));

const HOUR = 3600000;
const T0 = Date.UTC(2026, 9, 27, 8, 0);

describe('iPhone step source', () => {
  let getStepSource: typeof import('../stepSource').getStepSource;
  let setStepSourceForTesting: typeof import('../stepSource').setStepSourceForTesting;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    ({ getStepSource, setStepSourceForTesting } = require('../stepSource'));
  });
  beforeEach(() => {
    mockGetStepCount.mockReset();
    setStepSourceForTesting(undefined);
  });

  it('reads minutes only inside hours that had real walking', async () => {
    // hour 1 quiet (100 steps), hour 2 busy (3000 steps, 50 per minute)
    mockGetStepCount.mockImplementation(async (from: Date, to: Date) => {
      const span = to.getTime() - from.getTime();
      if (span >= HOUR) return { steps: from.getTime() < T0 + HOUR ? 100 : 3000 };
      return { steps: 50 };
    });
    const source = getStepSource()!;
    expect(source.kind).toBe('ios_motion');
    const minutes = await source.minuteSteps(new Date(T0), new Date(T0 + 2 * HOUR));
    expect(minutes).toHaveLength(60);
    expect(minutes[0]).toEqual({ start: T0 + HOUR, steps: 50 });
    // 2 hourly reads + 60 minute reads, nothing for the quiet hour
    expect(mockGetStepCount).toHaveBeenCalledTimes(62);
  });

  it('passes errors on instead of reporting zero steps', async () => {
    mockGetStepCount.mockRejectedValue(new Error('locked'));
    const source = getStepSource()!;
    await expect(source.stepsBetween(new Date(T0), new Date(T0 + HOUR))).rejects.toThrow('locked');
  });

  it('reports access from the motion permission', async () => {
    await expect(getStepSource()!.hasAccess()).resolves.toBe(true);
  });
});
