import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { CalendarDays } from '../planner/calendar';
import { widgetAvailabilityIssue } from './widgetAvailability';

export function useWidgetSync(days: CalendarDays, loading: boolean) {
  const [error, setError] = useState<string | null>(null);
  const refreshWidgets = useCallback(async (): Promise<boolean> => {
    if (widgetAvailabilityIssue()) return false;
    try {
      const { refreshPlanWidgets } = await import('./manage');
      await refreshPlanWidgets();
      setError(null);
      return true;
    } catch {
      setError('Nie udało się odświeżyć widgetu. Zapisane plany pozostają bez zmian. Spróbuj ponownie.');
      return false;
    }
  }, []);

  useEffect(() => {
    if (loading || widgetAvailabilityIssue()) return;
    void refreshWidgets();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshWidgets();
    });
    return () => subscription.remove();
  }, [days, loading, refreshWidgets]);
  return { widgetError: error, refreshWidgets };
}
