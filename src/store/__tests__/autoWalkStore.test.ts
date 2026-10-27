import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAutoWalkStore, AUTO_WALK_KEY } from '../autoWalkStore';
import { setStepSourceForTesting, StepSource } from '../../services/activity/stepSource';
import { MINUTE } from '../../services/activity/walkDetection';

const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: jest.fn(),
  },
}));
const mockRegister = jest.fn().mockResolvedValue(undefined);
const mockUnregister = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/activity/backgroundSync', () => ({
  registerAutoWalkTask: () => mockRegister(),
  unregisterAutoWalkTask: () => mockUnregister(),
}));

function source(over: Partial<StepSource> = {}): StepSource {
  return {
    kind: 'ios_motion',
    maxHistoryDays: 7,
    isAvailable: jest.fn().mockResolvedValue(true),
    hasAccess: jest.fn().mockResolvedValue(false),
    requestAccess: jest.fn().mockResolvedValue(true),
    stepsBetween: jest.fn().mockResolvedValue(2500),
    minuteSteps: jest.fn().mockResolvedValue([]),
    ...over,
  };
}

const reset = () => useAutoWalkStore.setState({
  enabled: false, minWalkMinutes: 10, cursor: null, lastSyncAt: null, todaySteps: null, todayKey: null,
  loaded: false, status: 'off', syncing: false, lastFound: 0,
});
const flush = () => new Promise(r => setTimeout(r, 0));

describe('autoWalkStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({});
    mockPut.mockResolvedValue({});
    await AsyncStorage.clear();
    reset();
  });
  afterAll(() => setStepSourceForTesting(undefined));

  it('is off until the member turns it on', async () => {
    await useAutoWalkStore.getState().hydrate();
    expect(useAutoWalkStore.getState().enabled).toBe(false);
    setStepSourceForTesting(source());
    await useAutoWalkStore.getState().sync();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('asks for step access when turned on, then syncs and schedules background checks', async () => {
    // not granted yet, granted once asked
    const s = source({ hasAccess: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true) });
    setStepSourceForTesting(s);
    await expect(useAutoWalkStore.getState().setEnabled(true)).resolves.toBe(true);
    expect(s.requestAccess).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalled();
    await flush();
    await useAutoWalkStore.getState().sync({ force: true });
    expect(mockPut).toHaveBeenCalledWith('/activity-sessions/daily-steps', expect.anything());
    expect(useAutoWalkStore.getState().todaySteps).toBe(2500);
    expect(JSON.parse((await AsyncStorage.getItem(AUTO_WALK_KEY)) as string).enabled).toBe(true);
  });

  it('stays off and says why when access is refused', async () => {
    setStepSourceForTesting(source({ requestAccess: jest.fn().mockResolvedValue(false) }));
    await expect(useAutoWalkStore.getState().setEnabled(true)).resolves.toBe(false);
    expect(useAutoWalkStore.getState()).toMatchObject({ enabled: false, status: 'no_access' });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('stays off where the phone has no step history', async () => {
    setStepSourceForTesting(null);
    await expect(useAutoWalkStore.getState().setEnabled(true)).resolves.toBe(false);
    expect(useAutoWalkStore.getState().status).toBe('unavailable');
  });

  it('turning off stops background checks', async () => {
    setStepSourceForTesting(source({ hasAccess: jest.fn().mockResolvedValue(true) }));
    await useAutoWalkStore.getState().setEnabled(true);
    await useAutoWalkStore.getState().setEnabled(false);
    expect(mockUnregister).toHaveBeenCalled();
    expect(useAutoWalkStore.getState().status).toBe('off');
  });

  it('does not re-read the history when opened again within a few minutes', async () => {
    const s = source({ hasAccess: jest.fn().mockResolvedValue(true) });
    setStepSourceForTesting(s);
    useAutoWalkStore.setState({ loaded: true, enabled: true, status: 'ready' });
    const now = Date.now();
    await useAutoWalkStore.getState().sync({ now });
    await useAutoWalkStore.getState().sync({ now: now + 2 * MINUTE });
    expect(s.minuteSteps).toHaveBeenCalledTimes(1);
    await useAutoWalkStore.getState().sync({ now: now + 6 * MINUTE });
    expect(s.minuteSteps).toHaveBeenCalledTimes(2);
  });

  it('notices when step access was taken back', async () => {
    setStepSourceForTesting(source({ hasAccess: jest.fn().mockResolvedValue(false) }));
    useAutoWalkStore.setState({ loaded: true, enabled: true, status: 'ready' });
    await useAutoWalkStore.getState().sync({ force: true });
    expect(useAutoWalkStore.getState().status).toBe('no_access');
  });

  it('keeps the cursor when a sync fails', async () => {
    const s = source({
      hasAccess: jest.fn().mockResolvedValue(true),
      minuteSteps: jest.fn().mockRejectedValue(new Error('boom')),
    });
    setStepSourceForTesting(s);
    useAutoWalkStore.setState({ loaded: true, enabled: true, status: 'ready', cursor: 1234 });
    await useAutoWalkStore.getState().sync({ force: true });
    expect(useAutoWalkStore.getState()).toMatchObject({ status: 'error', cursor: 1234, syncing: false });
  });

  it('switches the shortest walk between 10 and 5 minutes only', async () => {
    await useAutoWalkStore.getState().setMinWalkMinutes(5);
    expect(useAutoWalkStore.getState().minWalkMinutes).toBe(5);
    await useAutoWalkStore.getState().setMinWalkMinutes(7);
    expect(useAutoWalkStore.getState().minWalkMinutes).toBe(10);
  });
});
