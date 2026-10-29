import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface LumenWidgetData {
  waterCount: number;
  waterGoal: number;
  distanceKm: string;
  stepsToday: number;
  activeMinutes: number;
  activeGoal: number;
  lastUpdated: string;
}

export const WIDGET_DATA_KEY = 'lumen:widget_snapshot_v1';

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
      const { QuickTapWidget } = require('./QuickTapWidget');

      await requestWidgetUpdate({
        widgetName: 'TodayGlanceWidget',
        renderWidget: () => TodayGlanceWidget({ data: merged }),
      });

      await requestWidgetUpdate({
        widgetName: 'QuickTapWidget',
        renderWidget: () => QuickTapWidget({ data: merged }),
      });
    } catch (renderErr) {
      // Widget might not be placed on home screen yet
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
  return {
    waterCount: 0,
    waterGoal: 8,
    distanceKm: '0.0',
    stepsToday: 0,
    activeMinutes: 0,
    activeGoal: 30,
    lastUpdated: 'Today',
  };
}

