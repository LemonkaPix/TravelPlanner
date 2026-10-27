import Constants from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';

export const PLAN_WIDGET_NAME = 'UpcomingPlan';

export function widgetAvailabilityIssue(): string | null {
  if (Platform.OS !== 'android') return 'Widget jest dostępny na Androidzie.';
  if (Constants.expoVersion) return 'Widget wymaga własnej wersji TravelPlanner. Nie jest dostępny w Expo Go.';
  if (!TurboModuleRegistry.get('AndroidWidget')) return 'Zainstaluj nową wersję TravelPlanner z obsługą widgetu.';
  return null;
}
