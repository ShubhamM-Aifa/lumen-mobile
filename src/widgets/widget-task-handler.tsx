import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayGlanceWidget } from './TodayGlanceWidget';
import { NextReminderWidget } from './NextReminderWidget';
import { WaterGoalWidget } from './WaterGoalWidget';
import { QuickTapWidget } from './QuickTapWidget';
import { getWidgetSnapshot, saveWidgetSnapshot } from './widgetSync';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction } = props;
  const snapshot = await getWidgetSnapshot();

  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction === 'LOG_WATER') {
      const nextCount = (snapshot.waterCount || 0) + 1;
      snapshot.waterCount = nextCount;
      snapshot.completedTasks = (snapshot.completedTasks || 0) + 1;
      if (snapshot.tasksLeft > 0) snapshot.tasksLeft -= 1;
      await saveWidgetSnapshot(snapshot);
    } else if (clickAction === 'LOG_STAND') {
      const nextCount = (snapshot.stoodUpCount || 0) + 1;
      snapshot.stoodUpCount = nextCount;
      snapshot.completedTasks = (snapshot.completedTasks || 0) + 1;
      if (snapshot.tasksLeft > 0) snapshot.tasksLeft -= 1;
      await saveWidgetSnapshot(snapshot);
    } else if (clickAction === 'LOG_MEDS') {
      const nextCount = (snapshot.medsCount || 0) + 1;
      snapshot.medsCount = nextCount;
      snapshot.completedTasks = (snapshot.completedTasks || 0) + 1;
      if (snapshot.tasksLeft > 0) snapshot.tasksLeft -= 1;
      await saveWidgetSnapshot(snapshot);
    } else if (clickAction === 'LOG_FLARE') {
      const nextCount = (snapshot.flareCount || 0) + 1;
      snapshot.flareCount = nextCount;
      await saveWidgetSnapshot(snapshot);
    }
  }

  switch (widgetInfo.widgetName) {
    case 'TodayGlanceWidget':
      props.renderWidget(<TodayGlanceWidget data={snapshot} />);
      break;
    case 'NextReminderWidget':
      props.renderWidget(<NextReminderWidget data={snapshot} />);
      break;
    case 'WaterGoalWidget':
      props.renderWidget(<WaterGoalWidget data={snapshot} />);
      break;
    case 'QuickTapWidget':
      props.renderWidget(<QuickTapWidget data={snapshot} />);
      break;
    default:
      break;
  }
}
