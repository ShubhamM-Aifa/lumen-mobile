import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
}

export const WIDGET_DATA_KEY = 'lumen:widget_snapshot_v2';

export async function saveWidgetSnapshot(data: Partial<LumenWidgetData>): Promise<void> {
  if (Platform.OS !== 'android') return;
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
  };
}

export function syncLiveWidgetsFromStores(): void {
  if (Platform.OS !== 'android') return;
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

    const isWater = (a: any) => {
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

    const isStand = (a: any) => {
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

    const isMeds = (a: any) => {
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

    const isFlare = (a: any) => {
      const key = (a.templateKey || '').toLowerCase();
      const label = (a.label || '').toLowerCase();
      const icon = (a.icon || '').trim();
      return (
        key === 'qa_flare' ||
        icon === '🔥' ||
        label.includes('flare')
      );
    };

    let waterCount = getTapCountFor(isWater);
    let stoodUpCount = getTapCountFor(isStand);
    let medsCount = getTapCountFor(isMeds);
    let flareCount = getTapCountFor(isFlare);

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
    const waterAction = quickActions.find(isWater);
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

      if (activityState?.todaySummary) {
        const s = activityState.todaySummary;
        if (typeof s.distanceMeters === 'number') {
          distanceKm = (s.distanceMeters / 1000).toFixed(1);
        }
        if (typeof s.activeMinutes === 'number') {
          activeMinutes = s.activeMinutes;
        }
        if (typeof s.activeGoalMinutes === 'number') {
          activeGoal = s.activeGoalMinutes;
        }
      }

      if (autoWalkState?.enabled && typeof autoWalkState.todaySteps === 'number') {
        stepsToday = autoWalkState.todaySteps;
      } else if (activityState?.todaySummary?.steps) {
        stepsToday = activityState.todaySummary.steps;
      }
    } catch {}

    saveWidgetSnapshot({
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
    });
  } catch (err) {
    console.warn('[widgetSync] syncLiveWidgetsFromStores failed:', err);
  }
}
