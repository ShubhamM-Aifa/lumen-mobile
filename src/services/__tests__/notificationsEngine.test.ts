import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../api/client';
import { useQuickLogStore } from '../../store/quickLogStore';
import {
  CHANNEL_ID_ALARM,
  CHANNEL_ID_CLINICAL,
  CHANNEL_ID_HABITS,
  CHANNEL_ID_PACING,
  CHANNEL_ID_SAFETY,
  CHANNEL_ID_HEADS_UP,
  CHANNEL_ID_INSIGHTS,
  CHANNEL_ID_WALK_ACTIVE,
  NOTIF_CATEGORIES,
  NOTIF_ACTIONS,
  ensureNotificationChannel,
  setupNotificationCategories,
  sendWeatherFlareNotification,
  sendPacingAlertNotification,
  scheduleReminder,
  snoozeReminder,
  cancelReminder,
  sendTestReminderNotification,
  checkNotificationAlarmStatus,
  handleNotificationActionResponse,
} from '../notifications';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({ success: true }),
    put: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock expo-notifications
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('mock_notif_123');
const mockCancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockSetNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);
const mockGetNotificationChannelAsync = jest.fn().mockResolvedValue({ id: CHANNEL_ID_HABITS });
const mockSetNotificationCategoryAsync = jest.fn().mockResolvedValue(undefined);
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetAllScheduledNotificationsAsync = jest.fn().mockResolvedValue([{ identifier: 'notif_1' }]);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: any[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: any[]) => mockCancelScheduledNotificationAsync(...args),
  setNotificationChannelAsync: (...args: any[]) => mockSetNotificationChannelAsync(...args),
  getNotificationChannelAsync: (...args: any[]) => mockGetNotificationChannelAsync(...args),
  setNotificationCategoryAsync: (...args: any[]) => mockSetNotificationCategoryAsync(...args),
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
  getAllScheduledNotificationsAsync: (...args: any[]) => mockGetAllScheduledNotificationsAsync(...args),
  setNotificationHandler: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
  },
  AndroidNotificationVisibility: {
    PUBLIC: 1,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
  },
}));

describe('Lumen Notification Engine & Clinical Alert Architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  describe('1. Native Android Channels Initialization', () => {
    it('creates all specialized notification channels on Android', async () => {
      await ensureNotificationChannel();

      expect(mockSetNotificationChannelAsync).toHaveBeenCalledTimes(9);

      // Intelligent-notification channels: only safety may bypass Do Not Disturb,
      // and the insights channel must stay silent.
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_SAFETY,
        expect.objectContaining({ importance: 5, bypassDnd: true }),
      );
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_HEADS_UP,
        expect.not.objectContaining({ bypassDnd: true }),
      );
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_INSIGHTS,
        expect.objectContaining({ importance: 2, sound: null, enableVibrate: false }),
      );
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_WALK_ACTIVE,
        expect.objectContaining({ importance: 2, sound: null, enableVibrate: false }),
      );

      // Alarm Channel
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_ALARM,
        expect.objectContaining({
          name: 'Lumen Alarms & Reminders',
          importance: 5,
          bypassDnd: true,
          enableVibrate: true,
          vibrationPattern: [0, 500, 250, 500, 250, 500],
        })
      );

      // Clinical Channel
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_CLINICAL,
        expect.objectContaining({
          name: 'Clinical & Flare Alerts',
          importance: 5,
          bypassDnd: true,
          enableVibrate: true,
          vibrationPattern: [0, 400, 200, 400],
        })
      );

      // Habits Channel
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_HABITS,
        expect.objectContaining({
          name: 'Habits & Health Reminders',
          importance: 5,
          bypassDnd: true,
          enableVibrate: true,
          vibrationPattern: [0, 400, 200, 400],
        })
      );

      // Activity Pacing Channel
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        CHANNEL_ID_PACING,
        expect.objectContaining({
          name: 'Activity Pacing & Spoon Theory',
          importance: 4,
          vibrationPattern: [0, 300, 150, 300],
        })
      );

      // Legacy fallback channel
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        'lumen_reminders_v1',
        expect.objectContaining({
          name: 'General Reminders',
          importance: 4,
        })
      );
    });

    it('bypasses channel creation safely on iOS', async () => {
      Platform.OS = 'ios';
      await ensureNotificationChannel();
      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('2. Interactive Action Categories', () => {
    it('registers all 7 actionable notification categories', async () => {
      await setupNotificationCategories();

      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledTimes(7);

      // Flare Alert Category
      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIF_CATEGORIES.FLARE,
        expect.arrayContaining([
          expect.objectContaining({ identifier: NOTIF_ACTIONS.VIEW_FLARE, options: { opensAppToForeground: true } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.LOG_SYMPTOM, options: { opensAppToForeground: true } }),
        ])
      );

      // Pacing Category
      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIF_CATEGORIES.PACING,
        expect.arrayContaining([
          expect.objectContaining({ identifier: NOTIF_ACTIONS.RESTING_NOW, options: { opensAppToForeground: false } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.VIEW_WALK, options: { opensAppToForeground: true } }),
        ])
      );

      // Meds Category
      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIF_CATEGORIES.MEDS,
        expect.arrayContaining([
          expect.objectContaining({ identifier: NOTIF_ACTIONS.MARK_MED_TAKEN, options: { opensAppToForeground: false } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.SNOOZE_15, options: { opensAppToForeground: false } }),
        ])
      );

      // Water Category
      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIF_CATEGORIES.WATER,
        expect.arrayContaining([
          expect.objectContaining({ identifier: NOTIF_ACTIONS.LOG_250ML, options: { opensAppToForeground: false } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.LOG_500ML, options: { opensAppToForeground: false } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.SNOOZE_30, options: { opensAppToForeground: false } }),
        ])
      );

      // Sleep Category
      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        NOTIF_CATEGORIES.SLEEP,
        expect.arrayContaining([
          expect.objectContaining({ identifier: NOTIF_ACTIONS.START_SLEEP, options: { opensAppToForeground: true } }),
          expect.objectContaining({ identifier: NOTIF_ACTIONS.SNOOZE_30, options: { opensAppToForeground: false } }),
        ])
      );
    });
  });

  describe('3. Clinical Weather Flare Alert Notification', () => {
    it('dispatches an immediate high-priority notification to the clinical channel', async () => {
      const id = await sendWeatherFlareNotification(
        '⚠️ Atmospheric Pressure Drop Alert',
        'Barometric pressure dropped by 8 hPa. High flare trigger potential today.',
        'high'
      );

      expect(id).toBe('mock_notif_123');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '⚠️ Atmospheric Pressure Drop Alert',
            body: expect.stringContaining('High flare trigger potential'),
            categoryIdentifier: NOTIF_CATEGORIES.FLARE,
            channelId: CHANNEL_ID_CLINICAL,
            data: { type: 'WEATHER_FLARE_ALERT', riskLevel: 'high' },
          }),
          trigger: null,
        })
      );
    });
  });

  describe('4. Spoon Theory Activity Pacing Alert Notification', () => {
    it('dispatches an immediate pacing alert to the pacing channel', async () => {
      const id = await sendPacingAlertNotification(
        '🏃 Spoon Theory Pacing Alert',
        'You reached 3.2 km today. Take a 15-minute rest now to protect tomorrow’s energy.',
        3.2
      );

      expect(id).toBe('mock_notif_123');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '🏃 Spoon Theory Pacing Alert',
            body: expect.stringContaining('Take a 15-minute rest now'),
            categoryIdentifier: NOTIF_CATEGORIES.PACING,
            channelId: CHANNEL_ID_PACING,
            data: { type: 'PACING_ALERT', distanceKm: 3.2 },
          }),
          trigger: null,
        })
      );
    });
  });

  describe('5. Reminder Scheduling Engine & Channel Resolution', () => {
    it('routes MEDICATION reminder to clinical channel with MAX priority and MEDS category', async () => {
      await scheduleReminder({
        _id: 'rem_med_1',
        name: 'Morning Biologics / Prednisone',
        category: 'MEDICATION' as any,
        scheduleType: 'DAILY' as any,
        targetTime: '08:00',
        enabled: true,
        notificationTitle: 'Take Morning Medication',
        notificationMessage: 'Anti-inflammatory regimen',
      } as any);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Take Morning Medication',
            categoryIdentifier: NOTIF_CATEGORIES.MEDS,
            channelId: CHANNEL_ID_CLINICAL,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 8,
            minute: 0,
            channelId: CHANNEL_ID_CLINICAL,
          }),
        })
      );
    });

    it('routes EXERCISE walking reminder to pacing channel', async () => {
      await scheduleReminder({
        _id: 'rem_walk_1',
        name: 'Gentle Walk',
        category: 'EXERCISE' as any,
        scheduleType: 'DAILY' as any,
        targetTime: '17:00',
        enabled: true,
      } as any);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            categoryIdentifier: NOTIF_CATEGORIES.WALK,
            channelId: CHANNEL_ID_PACING,
          }),
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 17,
            minute: 0,
            channelId: CHANNEL_ID_PACING,
          }),
        })
      );
    });

    it('routes HYDRATION interval reminder to habits channel across time window', async () => {
      await scheduleReminder({
        _id: 'rem_water_1',
        name: 'Drink Water Window',
        category: 'HYDRATION' as any,
        scheduleType: 'INTERVAL' as any,
        windowStartTime: '09:00',
        windowEndTime: '12:00',
        intervalMinutes: 60, // 09:00, 10:00, 11:00, 12:00 = 4 triggers
        enabled: true,
      } as any);

      // Should have scheduled 4 interval notifications
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(4);
    });

    it('cancels scheduled notifications when reminder is archived or disabled', async () => {
      // First schedule
      await scheduleReminder({
        _id: 'rem_cancel_test',
        name: 'Active Test',
        category: 'SLEEP' as any,
        scheduleType: 'DAILY' as any,
        targetTime: '23:00',
        enabled: true,
      } as any);

      mockCancelScheduledNotificationAsync.mockClear();

      // Now disable
      await scheduleReminder({
        _id: 'rem_cancel_test',
        name: 'Active Test',
        category: 'SLEEP' as any,
        scheduleType: 'DAILY' as any,
        targetTime: '23:00',
        enabled: false,
      } as any);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('mock_notif_123');
    });
  });

  describe('6. Snooze & Test Alarm Verification', () => {
    it('snoozes a reminder for 15 minutes and updates backend', async () => {
      await snoozeReminder('rem_med_1', 15, 'Medication', 'Take after food');

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '⏱ (Snoozed) Medication',
            data: expect.objectContaining({ reminderId: 'rem_med_1', isSnoozed: true }),
          }),
          trigger: expect.objectContaining({
            type: 'timeInterval',
            seconds: 900,
          }),
        })
      );

      expect(api.post).toHaveBeenCalledWith('/reminders/rem_med_1/snooze', { snoozeMinutes: 15 });
    });

    it('sends an instant 3-second test notification alarm', async () => {
      const success = await sendTestReminderNotification();

      expect(success).toBe(true);
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '🔔 Lumen Alarm Test',
            categoryIdentifier: NOTIF_CATEGORIES.WATER,
          }),
          trigger: expect.objectContaining({
            type: 'timeInterval',
            seconds: 3,
          }),
        })
      );
    });

    it('checks diagnostic alarm status cleanly', async () => {
      const status = await checkNotificationAlarmStatus();

      expect(status.isSupported).toBe(true);
      expect(status.hasPermission).toBe(true);
      expect(status.channelConfigured).toBe(true);
      expect(status.scheduledCount).toBe(1);
    });
  });

  describe('7. Action Button Response Routing', () => {
    it('handles VIEW_FLARE action by navigating to Today screen', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.VIEW_FLARE,
        notification: { request: { content: { data: {} } } },
      });

      expect(router.push).toHaveBeenCalledWith('/(tabs)/today');
    });

    it('handles LOG_SYMPTOM action by navigating to Quick Log questionnaire', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.LOG_SYMPTOM,
        notification: { request: { content: { data: {} } } },
      });

      expect(router.push).toHaveBeenCalledWith('/quick-log');
    });

    it('handles VIEW_WALK action by navigating to Walking screen', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.VIEW_WALK,
        notification: { request: { content: { data: {} } } },
      });

      expect(router.push).toHaveBeenCalledWith('/walking');
    });

    it('handles MARK_MED_TAKEN action by posting event to backend', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.MARK_MED_TAKEN,
        notification: { request: { content: { data: { reminderId: 'med_999' } } } },
      });

      expect(api.post).toHaveBeenCalledWith('/reminders/med_999/event', {
        status: 'COMPLETED',
        actionTaken: 'TAKEN',
      });
    });

    it('handles LOG_250ML action by logging 1 increment to quick log store', async () => {
      const tapSpy = jest.spyOn(useQuickLogStore.getState(), 'tap');

      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.LOG_250ML,
        notification: { request: { content: { data: { linkedQuickActionId: 'qa_water' } } } },
      });

      expect(tapSpy).toHaveBeenCalledWith('qa_water');
      tapSpy.mockRestore();
    });

    it('handles LOG_500ML action by logging 2 increments to quick log store', async () => {
      const tapSpy = jest.spyOn(useQuickLogStore.getState(), 'tap');

      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.LOG_500ML,
        notification: { request: { content: { data: { linkedQuickActionId: 'qa_water' } } } },
      });

      expect(tapSpy).toHaveBeenCalledTimes(2);
      expect(tapSpy).toHaveBeenCalledWith('qa_water');
      tapSpy.mockRestore();
    });

    it('handles START_WALK action by navigating to Active Walking screen', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: NOTIF_ACTIONS.START_WALK,
        notification: { request: { content: { data: {} } } },
      });

      expect(router.push).toHaveBeenCalledWith('/walking/active');
    });

    it('handles notification body tap for WEATHER_FLARE_ALERT by opening /reminders hub', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: 'default',
        notification: { request: { content: { data: { type: 'WEATHER_FLARE_ALERT' } } } },
      });

      expect(router.push).toHaveBeenCalledWith('/reminders');
    });

    it('handles notification body tap for PACING_ALERT by opening /walking', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: 'default',
        notification: { request: { content: { data: { type: 'PACING_ALERT' } } } },
      });

      expect(router.push).toHaveBeenCalledWith('/walking');
    });

    it('handles notification body tap for a Reminder by opening /alarm/:id screen', async () => {
      await handleNotificationActionResponse({
        actionIdentifier: 'default',
        notification: { request: { content: { data: { reminderId: 'rem_123' } } } },
      });

      expect(router.push).toHaveBeenCalledWith('/alarm/rem_123');
    });
  });
});
