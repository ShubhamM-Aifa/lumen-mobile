import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useSleepTrackerStore,
  clampSleepGoal,
  recoveryFloorFor,
  formatGoalHours,
  goalRangeLabel,
  SLEEP_GOAL_MIN_MINUTES,
  SLEEP_GOAL_MAX_MINUTES,
} from '../sleepTrackerStore';

jest.mock('../daySessionStore', () => ({
  useDaySessionStore: { getState: () => ({ todaySession: null, recordGoToBed: jest.fn() }) },
}));
jest.mock('../../api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock('../../api/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('../../services/logLocationService', () => ({ logLocationService: {} }));

const reset = () =>
  useSleepTrackerStore.setState({ targetGoalMinutes: 480, minRecoveryMinutes: 420, isLoaded: false });

describe('sleep goal helpers', () => {
  it('snaps to half hours and stays between 6 and 10 hours', () => {
    expect(clampSleepGoal(470)).toBe(480);
    expect(clampSleepGoal(100)).toBe(SLEEP_GOAL_MIN_MINUTES);
    expect(clampSleepGoal(5000)).toBe(SLEEP_GOAL_MAX_MINUTES);
  });

  it('keeps the on-target floor one hour under the goal', () => {
    expect(recoveryFloorFor(480)).toBe(420);
    expect(recoveryFloorFor(540)).toBe(480);
  });

  it('labels hours and ranges', () => {
    expect(formatGoalHours(480)).toBe('8');
    expect(formatGoalHours(450)).toBe('7.5');
    expect(goalRangeLabel(480)).toBe('7–8');
    expect(goalRangeLabel(540)).toBe('8–9');
    expect(goalRangeLabel(450)).toBe('6.5–7.5');
  });
});

describe('sleep goal setting', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    reset();
  });

  it('defaults to the old 8 hour goal with a 7 hour floor', () => {
    const s = useSleepTrackerStore.getState();
    expect(s.targetGoalMinutes).toBe(480);
    expect(s.minRecoveryMinutes).toBe(420);
  });

  it('updates the goal and the floor together', async () => {
    await useSleepTrackerStore.getState().setTargetGoalMinutes(540);
    const s = useSleepTrackerStore.getState();
    expect(s.targetGoalMinutes).toBe(540);
    expect(s.minRecoveryMinutes).toBe(480);
  });

  it('refuses goals outside the range', async () => {
    await useSleepTrackerStore.getState().setTargetGoalMinutes(60);
    expect(useSleepTrackerStore.getState().targetGoalMinutes).toBe(SLEEP_GOAL_MIN_MINUTES);
    await useSleepTrackerStore.getState().setTargetGoalMinutes(9999);
    expect(useSleepTrackerStore.getState().targetGoalMinutes).toBe(SLEEP_GOAL_MAX_MINUTES);
  });

  it('is remembered after the app restarts', async () => {
    await useSleepTrackerStore.getState().setTargetGoalMinutes(510);
    reset();
    expect(useSleepTrackerStore.getState().targetGoalMinutes).toBe(480);
    await useSleepTrackerStore.getState().loadState();
    const s = useSleepTrackerStore.getState();
    expect(s.targetGoalMinutes).toBe(510);
    expect(s.minRecoveryMinutes).toBe(450);
    expect(s.isLoaded).toBe(true);
  });

  it('ignores a corrupt saved value', async () => {
    await AsyncStorage.setItem('lumen:sleep_goal_minutes_v1', 'abc');
    await useSleepTrackerStore.getState().loadState();
    expect(useSleepTrackerStore.getState().targetGoalMinutes).toBe(480);
  });

  it('stamps new sleep records with the current goal', async () => {
    await useSleepTrackerStore.getState().setTargetGoalMinutes(540);
    const rec = await useSleepTrackerStore.getState().wakeUp();
    expect(rec.targetGoalMinutes).toBe(540);
  });
});
