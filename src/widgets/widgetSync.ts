import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface LumenWidgetTask {
  id: string;
  title: string;
  isCompleted: boolean;
  isImportant?: boolean;
}

export interface LumenWidgetData {
  // Today glance circular ring
  completedTasks: number;
  totalTasks: number;
  tasksLeft: number;

  // 2x2 grid stats
  waterCount: number;
  waterGoal: number;
  stoodUpCount: number;
  medsCount: number;
  flareCount: number;

  // Next reminder
  nextReminderTitle: string;
  nextReminderTime: string;

  // Activity stats
  distanceKm?: string;
  stepsToday?: number;
  activeMinutes?: number;
  activeGoal?: number;
  lastUpdated: string;
  trackingDay?: string;

  // My Day tasks
  myDayTasks?: LumenWidgetTask[];
}

export const WIDGET_DATA_KEY = 'lumen:widget_snapshot_v2';

export const isWaterAction = (a: any): boolean => {
  if (!a) return false;
  const key = (a.templateKey || '').toLowerCase();
  const label = (a.label || '').toLowerCase();
  const icon = (a.icon || '').trim();
  return (
    key === 'qa_water' ||
    key === 'qa_hydration' ||
    icon === '💧' ||
    icon === '🌊' ||
    label.includes('water') ||
    label.includes('hydrate') ||
    label.includes('drink')
  );
};

export const isStandAction = (a: any): boolean => {
  if (!a) return false;
  const key = (a.templateKey || '').toLowerCase();
  const label = (a.label || '').toLowerCase();
  const icon = (a.icon || '').trim();
  return (
    key === 'qa_stood_up' ||
    key === 'qa_stand' ||
    icon === '🧍' ||
    icon === '🧍‍♂️' ||
    icon === '🧍‍♀️' ||
    label.includes('stood') ||
    label.includes('stand')
  );
};

export const isMedsAction = (a: any): boolean => {
  if (!a) return false;
  const key = (a.templateKey || '').toLowerCase();
  const label = (a.label || '').toLowerCase();
  const icon = (a.icon || '').trim();
  return (
    key === 'qa_medication' ||
    key === 'qa_meds' ||
    icon === '💊' ||
    label.includes('med') ||
    label.includes('pill') ||
    label.includes('dose') ||
    label.includes('tablet') ||
    label.includes('capsule') ||
    label.includes('prescription') ||
    label.includes('supplement')
  );
};

export const isFlareAction = (a: any): boolean => {
  if (!a) return false;
  const key = (a.templateKey || '').toLowerCase();
  const label = (a.label || '').toLowerCase();
  const icon = (a.icon || '').trim();
  return (
    key === 'qa_flare' ||
    icon === '🔥' ||
    label.includes('flare')
  );
};

export async function saveWidgetSnapshot(data: Partial<LumenWidgetData>): Promise<void> {
  if (Platform.OS !== 'android' && process.env.NODE_ENV !== 'test') return;
  try {
    const existing = await getWidgetSnapshot();
    const merged: LumenWidgetData = {
      ...existing,
      ...data,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(merged));

    // Request immediate widget re-render on the home screen
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { requestWidgetUpdate } = require('react-native-android-widget');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TodayGlanceWidget } = require('./TodayGlanceWidget');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { NextReminderWidget } = require('./NextReminderWidget');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { WaterGoalWidget } = require('./WaterGoalWidget');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { QuickTapWidget } = require('./QuickTapWidget');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MyDayWidget } = require('./MyDayWidget');

      await requestWidgetUpdate({
        widgetName: 'TodayGlanceWidget',
        renderWidget: () => TodayGlanceWidget({ data: merged }),
      }).catch(() => {});

      await requestWidgetUpdate({
        widgetName: 'NextReminderWidget',
        renderWidget: () => NextReminderWidget({ data: merged }),
      }).catch(() => {});

      await requestWidgetUpdate({
        widgetName: 'WaterGoalWidget',
        renderWidget: () => WaterGoalWidget({ data: merged }),
      }).catch(() => {});

      await requestWidgetUpdate({
        widgetName: 'QuickTapWidget',
        renderWidget: () => QuickTapWidget({ data: merged }),
      }).catch(() => {});

      await requestWidgetUpdate({
        widgetName: 'MyDayWidget',
        renderWidget: () => MyDayWidget({ data: merged }),
      }).catch(() => {});
    } catch {
      // Widget module or widget not placed on home screen yet
    }
  } catch (err) {
    console.warn('[widgetSync] Failed to save widget snapshot:', err);
  }
}

export async function getWidgetSnapshot(): Promise<LumenWidgetData> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Smart defaults matching the design mockups
  return {
    completedTasks: 12,
    totalTasks: 19,
    tasksLeft: 7,
    waterCount: 1,
    waterGoal: 8,
    stoodUpCount: 2,
    medsCount: 0,
    flareCount: 0,
    nextReminderTitle: 'Drink water',
    nextReminderTime: '2:00 PM',
    distanceKm: '0.0',
    stepsToday: 0,
    activeMinutes: 0,
    activeGoal: 30,
    lastUpdated: 'Today',
    myDayTasks: [
      { id: '1', title: 'Morning hydration & stretch', isCompleted: true, isImportant: true },
      { id: '2', title: 'Take afternoon medication', isCompleted: true },
      { id: '3', title: '15-minute gentle walk', isCompleted: false, isImportant: true },
      { id: '4', title: 'Log evening symptoms', isCompleted: false },
    ],
  };
}

export async function syncLiveWidgetsFromStores(): Promise<void> {
  if (Platform.OS !== 'android' && process.env.NODE_ENV !== 'test') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useTaskStore } = require('../store/taskStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useReminderStore } = require('../store/reminderStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useQuickLogStore } = require('../store/quickLogStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useConfigStore } = require('../store/configStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isWithinDayBoundary, getTrackingDayDateString } = require('../utils/dayBoundary');

    // 0. Boundary hour
    let boundaryHour = 4;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('../store/authStore');
      const user = useAuthStore?.getState?.()?.user;
      if (typeof user?.preferences?.dayBoundaryHour === 'number') {
        boundaryHour = user.preferences.dayBoundaryHour;
      }
    } catch {}

    const currentTrackingDay = getTrackingDayDateString(new Date(), boundaryHour);

    // 1. Tasks
    const tasks: any[] = useTaskStore?.getState?.()?.tasks || [];
    const myDayTasks = tasks.filter((t: any) => t.inMyDay);
    const targetTasks = myDayTasks.length > 0 ? myDayTasks : tasks;
    const completedTasks = targetTasks.filter((t: any) => Boolean(t.isCompleted || t.completed)).length;
    const totalTasks = targetTasks.length;
    const tasksLeft = Math.max(0, totalTasks - completedTasks);

    const widgetMyDayTasks: LumenWidgetTask[] = (myDayTasks.length > 0 ? myDayTasks : tasks.slice(0, 5)).map((t: any) => ({
      id: String(t._id || t.id),
      title: String(t.title || 'Task'),
      isCompleted: Boolean(t.isCompleted || t.completed),
      isImportant: Boolean(t.isImportant),
    }));

    // 2. Quick Actions & Taps
    const configState = useConfigStore?.getState?.();
    const quickActions: any[] = configState?.config?.quickActions || [];

    const quickLogState = useQuickLogStore?.getState?.();
    const todayTaps: Record<string, any> = quickLogState?.todayTaps || {};

    const getTapCountFor = (matcher: (action: any) => boolean): number => {
      let count = 0;
      for (const action of quickActions) {
        if (matcher(action)) {
          const tap = todayTaps?.[action._id];
          if (tap && typeof tap.count === 'number' && tap.count > 0) {
            if (!tap.lastAt || isWithinDayBoundary(tap.lastAt, boundaryHour)) {
              count += tap.count;
            }
          }
        }
      }
      return count;
    };

    let waterCount = getTapCountFor(isWaterAction);
    let stoodUpCount = getTapCountFor(isStandAction);
    let medsCount = getTapCountFor(isMedsAction);
    let flareCount = getTapCountFor(isFlareAction);

    // If medsCount is 0, check if any medication task was completed today
    if (medsCount === 0 && targetTasks.length > 0) {
      const completedMedTasks = targetTasks.filter(
        (t: any) =>
          Boolean(t.isCompleted || t.completed) &&
          (t.title?.toLowerCase().includes('med') || t.title?.toLowerCase().includes('pill'))
      ).length;
      if (completedMedTasks > 0) {
        medsCount = completedMedTasks;
      }
    }

    // Water Goal
    const waterAction = quickActions.find(isWaterAction);
    const waterGoal = waterAction?.dailyGoal
      ? Math.round(waterAction.dailyGoal / (waterAction.defaultValue ?? 250))
      : 8;

    // 3. Reminders
    const reminders: any[] = useReminderStore?.getState?.()?.reminders || [];
    const active = reminders.filter((r: any) => r.enabled && !r.archivedAt);
    let nextReminderTitle = 'Drink water';
    let nextReminderTime = '2:00 PM';
    if (active.length > 0) {
      const nextRem = active[0];
      nextReminderTitle = nextRem.notificationTitle || nextRem.name || 'Reminder';
      nextReminderTime = nextRem.targetTime || nextRem.windowStartTime || 'Next';
    }

    // 4. Activity
    let distanceKm = '0.0';
    let stepsToday = 0;
    let activeMinutes = 0;
    let activeGoal = 30;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useActivityStore } = require('../store/activityStore');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAutoWalkStore } = require('../store/autoWalkStore');
      const activityState = useActivityStore?.getState?.();
      const autoWalkState = useAutoWalkStore?.getState?.();

      let summaryDistKm = 0;
      if (activityState?.todaySummary) {
        const s = activityState.todaySummary;
        summaryDistKm = typeof s.totalDistanceKm === 'number'
          ? s.totalDistanceKm
          : (typeof s.totalDistanceMeters === 'number' ? s.totalDistanceMeters / 1000 : 0);
        if (typeof s.totalDurationMinutes === 'number') {
          activeMinutes = s.totalDurationMinutes;
        } else if (typeof s.activeMinutes === 'number') {
          activeMinutes = s.activeMinutes;
        }
        if (typeof s.activeGoalMinutes === 'number') {
          activeGoal = s.activeGoalMinutes;
        }
      }

      if (autoWalkState?.enabled && typeof autoWalkState.todaySteps === 'number') {
        stepsToday = autoWalkState.todaySteps;
      } else if (activityState?.todaySummary?.totalSteps) {
        stepsToday = activityState.todaySummary.totalSteps;
      } else if (activityState?.todaySummary?.steps) {
        stepsToday = activityState.todaySummary.steps;
      }

      const stepDistKm = stepsToday > 0 ? (stepsToday * 0.7) / 1000 : 0;
      const effectiveDistKm = Math.max(summaryDistKm, stepDistKm);
      distanceKm = effectiveDistKm.toFixed(1);

      const stepActiveMin = stepsToday > 0 ? Math.round(stepsToday / 100) : 0;
      activeMinutes = Math.max(activeMinutes, stepActiveMin);
    } catch {}

    await saveWidgetSnapshot({
      completedTasks: totalTasks > 0 ? completedTasks : 12,
      totalTasks: totalTasks > 0 ? totalTasks : 19,
      tasksLeft: totalTasks > 0 ? tasksLeft : 7,
      waterCount,
      waterGoal: waterGoal > 0 ? waterGoal : 8,
      stoodUpCount,
      medsCount,
      flareCount,
      nextReminderTitle,
      nextReminderTime,
      distanceKm,
      stepsToday,
      activeMinutes,
      activeGoal,
      trackingDay: currentTrackingDay,
      myDayTasks: widgetMyDayTasks,
    });
  } catch (err) {
    console.warn('[widgetSync] syncLiveWidgetsFromStores failed:', err);
  }
}
