import { nextCalendarEntry } from '../planner/calendar';
import { readStoredCalendar } from '../planner/calendarStorage';
import { calculatePlan, formatDate, formatTime } from '../planner/plan';

export type PlanWidgetData = {
  title: string;
  departure: string | null;
  departureDate: string;
  deadline: string;
  boarding: string;
  stop: string;
  message: string;
  updated: string;
};

export async function readWidgetData(): Promise<PlanWidgetData> {
  const now = new Date();
  const base: PlanWidgetData = {
    title: 'Brak nadchodzących planów', departure: null, departureDate: '',
    deadline: '', boarding: '', stop: '', message: 'Otwórz aplikację i zapisz kolejny dojazd.',
    updated: `${formatDate(now)} · ${formatTime(now)}`,
  };
  try {
    const { days } = await readStoredCalendar();
    const entry = nextCalendarEntry(days, now.getTime());
    if (!entry) return base;
    const { plan, name } = entry.day;
    const result = calculatePlan(plan);
    const title = name ? `${name} · ${plan.destination}` : plan.destination;
    const deadline = `Dotarcie do ${plan.time} · ${plan.date}`;
    if (!result.ok) {
      return { ...base, title, deadline, message: 'Uzupełnij połączenie w aplikacji, aby obliczyć godzinę wyjścia.' };
    }
    const firstRide = result.connection.legs[0];
    return {
      ...base, title, deadline, departure: formatTime(result.departure),
      departureDate: formatDate(result.departure),
      boarding: `${firstRide.label} · ${formatTime(new Date(firstRide.departure))} · ${formatDate(new Date(firstRide.departure))}`,
      stop: firstRide.from, message: '',
    };
  } catch {
    return { ...base, title: 'Nie można wczytać planów', message: 'Otwórz aplikację i sprawdź zapisane dane. Następnie odśwież widget.' };
  }
}
