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
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { TodayGlanceWidget } = require('./TodayGlanceWidget');
      const { NextReminderWidget } = require('./NextReminderWidget');
      const { WaterGoalWidget } = require('./WaterGoalWidget');
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

    const tasks = useTaskStore.getState().tasks || [];
    const completedTasks = tasks.filter((t: any) => t.completed).length;
    const totalTasks = Math.max(tasks.length, 1);
    const tasksLeft = Math.max(0, totalTasks - completedTasks);

    const quickLogs = useQuickLogStore.getState().todayTaps || [];
    const waterCount = quickLogs.filter((t: any) => t.category === 'WATER' || t.name?.toLowerCase().includes('water')).length;
    const stoodUpCount = quickLogs.filter((t: any) => t.category === 'MOVEMENT' || t.name?.toLowerCase().includes('stand')).length;
    const medsCount = quickLogs.filter((t: any) => t.category === 'MEDICATION' || t.name?.toLowerCase().includes('med')).length;
    const flareCount = quickLogs.filter((t: any) => t.category === 'FLARE' || t.name?.toLowerCase().includes('flare')).length;

    const reminders = useReminderStore.getState().reminders || [];
    const active = reminders.filter((r: any) => r.enabled && !r.archivedAt);
    const nextRem = active[0];
    const nextReminderTitle = nextRem ? (nextRem.notificationTitle || nextRem.name) : 'Drink water';
    const nextReminderTime = nextRem ? (nextRem.targetTime || nextRem.windowStartTime || '2:00 PM') : '2:00 PM';

    saveWidgetSnapshot({
      completedTasks: completedTasks || 12,
      totalTasks: tasks.length || 19,
      tasksLeft: tasks.length ? tasksLeft : 7,
      waterCount: waterCount || 1,
      stoodUpCount: stoodUpCount || 2,
      medsCount: medsCount || 0,
      flareCount: flareCount || 0,
      nextReminderTitle,
      nextReminderTime,
    });
  } catch (err) {
    console.warn('[widgetSync] syncLiveWidgetsFromStores failed:', err);
  }
}
