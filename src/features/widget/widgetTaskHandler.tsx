import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { PlanWidget } from './PlanWidget';
import { PLAN_WIDGET_NAME } from './widgetAvailability';
import { readWidgetData } from './widgetData';

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== PLAN_WIDGET_NAME || widgetAction === 'WIDGET_DELETED') return;
  const data = await readWidgetData();
  renderWidget(<PlanWidget data={data} height={widgetInfo.height} />);
}
