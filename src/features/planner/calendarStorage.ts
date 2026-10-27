import AsyncStorage from '@react-native-async-storage/async-storage';

import { createCalendarDay, isStoredCalendar, migrateCalendar, type CalendarDays } from './calendar';
import { isStoredPlan, migratePreviousPlan } from './plan';

export const CALENDAR_STORAGE_KEY = 'travelplanner.calendar.v3';

// Shared by the app and the Android widget's headless task. Reading never writes migrations.
export async function readStoredCalendar(): Promise<{
  days: CalendarDays;
  drafts: CalendarDays;
  selectedDate?: string;
  notice: string | null;
}> {
  const raw = await AsyncStorage.getItem(CALENDAR_STORAGE_KEY);
  if (raw !== null) {
    const days: unknown = JSON.parse(raw);
    if (!isStoredCalendar(days)) throw new Error('Invalid calendar');
    return { days, drafts: {}, notice: null };
  }

  const previousCalendar = await AsyncStorage.getItem('travelplanner.calendar.v2')
    ?? await AsyncStorage.getItem('travelplanner.calendar.v1');
  if (previousCalendar !== null) {
    const days = migrateCalendar(JSON.parse(previousCalendar));
    if (!days) throw new Error('Invalid previous calendar');
    return {
      days, drafts: {},
      notice: 'Wczytano poprzedni kalendarz. Uzupełnij ręcznie linie i godziny połączeń w zapisanych planach.',
    };
  }

  for (const key of ['travelplanner.plan.v3', 'travelplanner.plan.v2', 'travelplanner.plan.v1']) {
    const previous = await AsyncStorage.getItem(key);
    if (previous === null) continue;
    const plan = migratePreviousPlan(JSON.parse(previous));
    if (!plan) throw new Error('Invalid previous plan');
    const day = { ...createCalendarDay(plan.date), plan };
    const saved = isStoredPlan(plan);
    return {
      days: saved ? { [plan.date]: day } : {},
      drafts: saved ? {} : { [plan.date]: day },
      selectedDate: plan.date,
      notice: 'Przeniesiono poprzedni plan do kalendarza. Otwórz jego dzień, sprawdź punkty i godzinę, a następnie zapisz.',
    };
  }
  return { days: {}, drafts: {}, notice: null };
}
