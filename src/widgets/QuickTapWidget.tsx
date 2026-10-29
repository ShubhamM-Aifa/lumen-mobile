import React from 'react';
import type { LumenWidgetData } from './widgetSync';
import { WaterGoalWidget } from './WaterGoalWidget';

interface Props {
  data: LumenWidgetData;
}

export function QuickTapWidget({ data }: Props) {
  return <WaterGoalWidget data={data} />;
}
