import { useReminderStore } from '../reminderStore';
import { useActivityStore } from '../activityStore';

// Mock dependencies
jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockImplementation((url, body) => Promise.resolve({ _id: 'mock_server_id', ...body })),
    put: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../services/notifications', () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  snoozeReminder: jest.fn().mockResolvedValue(undefined),
  sendPacingAlertNotification: jest.fn().mockResolvedValue('mock_pacing_id'),
  sendWeatherFlareNotification: jest.fn().mockResolvedValue('mock_flare_id'),
  showWalkLiveNotification: jest.fn().mockResolvedValue(undefined),
  dismissWalkLiveNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/locationService', () => ({
  locationService: {
    startTracking: jest.fn().mockResolvedValue(true),
    pauseTracking: jest.fn().mockResolvedValue(undefined),
    resumeTracking: jest.fn().mockResolvedValue(true),
    stopTracking: jest.fn().mockResolvedValue({ distanceMeters: 3420, steps: 4820 }),
    getBackgroundLocation: jest.fn().mockResolvedValue(null),
  },
}));

describe('Reminder Engine & Activity Tracking Store Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reminder Store', () => {
    it('creates a new interval water reminder and stores locally', async () => {
      const reminder = await useReminderStore.getState().addReminder({
        name: 'Drink Water',
        icon: '💧',
        category: 'HYDRATION',
        scheduleType: 'INTERVAL',
        windowStartTime: '08:00',
        windowEndTime: '22:00',
        intervalMinutes: 60,
        notificationMessage: 'Time to drink water',
        snoozeDurationMinutes: 10,
        linkedQuickActionId: 'qa_water',
      });

      expect(reminder).toBeDefined();
      expect(reminder.name).toBe('Drink Water');
      expect(reminder.scheduleType).toBe('INTERVAL');
      expect(reminder.intervalMinutes).toBe(60);

      const all = useReminderStore.getState().reminders;
      expect(all.some(r => r.name === 'Drink Water')).toBe(true);
    });

    it('toggles reminder enabled status', async () => {
      const reminder = await useReminderStore.getState().addReminder({
        name: 'Bedtime',
        icon: '😴',
        category: 'SLEEP',
        scheduleType: 'DAILY',
        targetTime: '22:30',
        notificationMessage: 'Time to prepare for sleep',
      });

      expect(reminder.enabled).toBe(true);
      await useReminderStore.getState().toggleReminder(reminder._id);

      const updated = useReminderStore.getState().reminders.find(r => r._id === reminder._id || r.clientId === reminder.clientId);
      expect(updated?.enabled).toBe(false);
    });

    it('duplicates an existing reminder configuration cleanly', async () => {
      const original = await useReminderStore.getState().addReminder({
        name: 'Morning Stretch',
        icon: '🧘',
        category: 'WELLNESS',
        scheduleType: 'DAILY',
        targetTime: '07:30',
        notificationMessage: 'Morning stretch routine',
      });

      await useReminderStore.getState().duplicateReminder(original._id);

      const all = useReminderStore.getState().reminders;
      const copies = all.filter(r => r.name.includes('Morning Stretch'));
      expect(copies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Activity & Walking Tracker Store', () => {
    it('starts an active walking session with clean initial metrics', async () => {
      const started = await useActivityStore.getState().startWalking('Morning Park Walk');
      expect(started).toBe(true);

      const state = useActivityStore.getState();
      expect(state.isTracking).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.activeSession).toBeDefined();
      expect(state.activeSession?.activityType).toBe('WALKING');
      expect(state.distanceMeters).toBe(0);
    });

    it('pauses and resumes active walking session', async () => {
      await useActivityStore.getState().startWalking('City Walk');
      expect(useActivityStore.getState().isPaused).toBe(false);

      await useActivityStore.getState().pauseWalking();
      expect(useActivityStore.getState().isPaused).toBe(true);

      await useActivityStore.getState().resumeWalking();
      expect(useActivityStore.getState().isPaused).toBe(false);
    });

    it('stops active walking session and saves completed metrics', async () => {
      await useActivityStore.getState().startWalking('Track Walk');
      const completed = await useActivityStore.getState().stopWalking('Great brisk morning walk');

      expect(completed).toBeDefined();
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.distanceMeters).toBe(3420);
      expect(completed?.steps).toBe(4820);
      expect(completed?.notes).toBe('Great brisk morning walk');

      const history = useActivityStore.getState().history;
      expect(history.length).toBeGreaterThan(0);
      expect(useActivityStore.getState().isTracking).toBe(false);
    });
  });
});
