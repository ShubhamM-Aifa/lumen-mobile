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

const mockHCReadRecords = jest.fn();
const mockHCAggregateRecord = jest.fn();
const mockHCAggregateGroupByDuration = jest.fn();
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 1 },
  getSdkStatus: jest.fn().mockResolvedValue(1),
  initialize: jest.fn().mockResolvedValue(true),
  getGrantedPermissions: jest.fn().mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]),
  requestPermission: jest.fn().mockResolvedValue([{ recordType: 'Steps' }]),
  aggregateRecord: (...a: unknown[]) => mockHCAggregateRecord(...a),
  aggregateGroupByDuration: (...a: unknown[]) => mockHCAggregateGroupByDuration(...a),
  readRecords: (...a: unknown[]) => mockHCReadRecords(...a),
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

describe('Android Health Connect step source', () => {
  let getStepSource: typeof import('../stepSource').getStepSource;
  let setStepSourceForTesting: typeof import('../stepSource').setStepSourceForTesting;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    ({ getStepSource, setStepSourceForTesting } = require('../stepSource'));
  });
  beforeEach(() => {
    mockHCReadRecords.mockReset();
    mockHCAggregateRecord.mockReset();
    mockHCAggregateGroupByDuration.mockReset();
    setStepSourceForTesting(undefined);
  });

  it('reads steps intervals via readRecords and distributes into minutes', async () => {
    // 20-minute walk record from 10:00 to 10:20 with 2000 steps (100 steps/min)
    const walkStart = new Date(T0).toISOString();
    const walkEnd = new Date(T0 + 20 * 60000).toISOString();
    mockHCReadRecords.mockResolvedValueOnce({
      records: [
        {
          startTime: walkStart,
          endTime: walkEnd,
          count: 2000,
          metadata: { dataOrigin: 'com.sec.android.app.shealth' },
        },
      ],
      pageToken: undefined,
    });

    const source = getStepSource()!;
    expect(source.kind).toBe('health_connect');
    const minutes = await source.minuteSteps(new Date(T0), new Date(T0 + 30 * 60000));
    expect(minutes).toHaveLength(20);
    expect(minutes[0]).toEqual({ start: T0, steps: 100 });
    expect(minutes[19]).toEqual({ start: T0 + 19 * 60000, steps: 100 });
  });

  it('falls back to aggregateGroupByDuration if readRecords fails', async () => {
    mockHCReadRecords.mockRejectedValueOnce(new Error('readRecords unavailable'));
    mockHCAggregateGroupByDuration.mockResolvedValueOnce([
      {
        startTime: '2026-10-27T08:00:00',
        endTime: '2026-10-27T08:01:00',
        zoneOffset: '+00:00',
        result: { COUNT_TOTAL: 120 },
      },
    ]);

    const source = getStepSource()!;
    const minutes = await source.minuteSteps(new Date(T0), new Date(T0 + HOUR));
    expect(minutes.length).toBeGreaterThan(0);
    expect(minutes[0].steps).toBe(120);
  });
});
