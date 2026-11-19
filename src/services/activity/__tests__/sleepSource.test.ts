import { Platform } from 'react-native';
import { syncHealthConnectSleep } from '../sleepSource';
import { api } from '../../../api/client';
import { useSleepTrackerStore } from '../../../store/sleepTrackerStore';

const mockReadRecords = jest.fn();
const mockGetSdkStatus = jest.fn();
const mockInitialize = jest.fn();
const mockGetGrantedPermissions = jest.fn();

jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 1 },
  getSdkStatus: () => mockGetSdkStatus(),
  initialize: () => mockInitialize(),
  getGrantedPermissions: () => mockGetGrantedPermissions(),
  readRecords: (...a: unknown[]) => mockReadRecords(...a),
}));

jest.mock('../../../api/client', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ success: true }),
    put: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../../api/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

describe('syncHealthConnectSleep', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSdkStatus.mockResolvedValue(1);
    mockInitialize.mockResolvedValue(true);
    mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'SleepSession', accessType: 'read' }]);
  });

  it('reads SleepSession from Health Connect and logs to timeline', async () => {
    const bedtime = '2026-11-16T23:00:00.000Z';
    const wakeTime = '2026-11-17T06:30:00.000Z';

    mockReadRecords.mockResolvedValueOnce({
      records: [
        {
          startTime: bedtime,
          endTime: wakeTime,
          metadata: { id: 'hc-sleep-123' },
        },
      ],
    });

    const result = await syncHealthConnectSleep();
    expect(result.synced).toBe(1);
    expect(result.latestRecord).toBeDefined();
    expect(result.latestRecord?.durationMinutes).toBe(450); // 7h 30m

    // Verify timeline log entry creation
    expect(api.put).toHaveBeenCalledWith(
      '/logs/sleep',
      expect.objectContaining({ wakeTime, bedtime, durationMinutes: 450, source: 'device' })
    );

    // Verify sleep store lastSleepRecord update
    expect(useSleepTrackerStore.getState().lastSleepRecord?.durationMinutes).toBe(450);
  });

  it('skips sync if SleepSession permission is not granted', async () => {
    mockGetGrantedPermissions.mockResolvedValueOnce([{ recordType: 'Steps', accessType: 'read' }]);
    const result = await syncHealthConnectSleep();
    expect(result.synced).toBe(0);
    expect(mockReadRecords).not.toHaveBeenCalled();
  });
});

