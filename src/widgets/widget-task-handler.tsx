import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayGlanceWidget } from './TodayGlanceWidget';
import { QuickTapWidget } from './QuickTapWidget';
import { getWidgetSnapshot, saveWidgetSnapshot } from './widgetSync';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction } = props;
  const snapshot = await getWidgetSnapshot();

  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction === 'LOG_WATER') {
      const nextCount = (snapshot.waterCount || 0) + 1;
      await saveWidgetSnapshot({ waterCount: nextCount });
      snapshot.waterCount = nextCount;
    }
  }

  switch (widgetInfo.widgetName) {
    case 'TodayGlanceWidget':
      props.renderWidget(<TodayGlanceWidget data={snapshot} />);
      break;
    case 'QuickTapWidget':
      props.renderWidget(<QuickTapWidget data={snapshot} />);
      break;
    default:
      break;
  }
}

