import { getWidgetInfo, requestPinWidget, requestWidgetUpdateById } from 'react-native-android-widget';

import { PlanWidget } from './PlanWidget';
import { PLAN_WIDGET_NAME } from './widgetAvailability';
import { readWidgetData } from './widgetData';

let refreshQueue: Promise<void> = Promise.resolve();

export function refreshPlanWidgets(): Promise<void> {
  // Serialize foreground refreshes so a slower earlier read cannot replace a newer save.
  const next = refreshQueue.catch(() => {}).then(updateWidgets);
  refreshQueue = next;
  return next;
}

async function updateWidgets(): Promise<void> {
  const widgets = await getWidgetInfo(PLAN_WIDGET_NAME);
  if (!widgets.length) return;
  for (const widget of widgets) {
    await requestWidgetUpdateById({
      widgetName: PLAN_WIDGET_NAME, widgetId: widget.widgetId,
      renderWidget: async ({ height }) => <PlanWidget data={await readWidgetData()} height={height} />,
    });
  }
}

export async function pinPlanWidget(): Promise<boolean> {
  return requestPinWidget({ widgetName: PLAN_WIDGET_NAME });
}
