import { widgetAvailabilityIssue } from './widgetAvailability';

if (!widgetAvailabilityIssue()) {
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { widgetTaskHandler } = require('./widgetTaskHandler') as typeof import('./widgetTaskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
