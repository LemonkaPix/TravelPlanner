import { isRecord } from './dateTime';
import { calculatePlan, type PlanInput } from './plan';

export type AlarmPreferences = {
  preparationMinutes: string;
  seriesEnabled: boolean;
  count: string;
  intervalMinutes: string;
};
export type PlannedAlarm = { date: Date; label: string };

export function defaultAlarmPreferences(): AlarmPreferences {
  return { preparationMinutes: '60', seriesEnabled: false, count: '2', intervalMinutes: '30' };
}

function integerInRange(value: string, minimum: number, maximum: number) {
  return /^\d{1,3}$/.test(value) && Number(value) >= minimum && Number(value) <= maximum;
}

export function validateAlarmPreferences(input: AlarmPreferences) {
  const errors: Partial<Record<keyof AlarmPreferences, string>> = {};
  if (!integerInRange(input.preparationMinutes, 1, 720)) {
    errors.preparationMinutes = 'Wpisz od 1 do 720 minut.';
  }
  if (input.seriesEnabled) {
    if (!integerInRange(input.count, 2, 10)) errors.count = 'Wpisz od 2 do 10 budzików, łącznie z ostatnim.';
    if (!integerInRange(input.intervalMinutes, 1, 180)) errors.intervalMinutes = 'Wpisz od 1 do 180 minut.';
    if (!errors.count && !errors.intervalMinutes && (Number(input.count) - 1) * Number(input.intervalMinutes) >= 1440) {
      errors.intervalMinutes = 'Seria musi być krótsza niż 24 godziny. Zmniejsz odstęp lub liczbę budzików.';
    }
  }
  return errors;
}

export function isAlarmPreferences(value: unknown): value is AlarmPreferences {
  return isRecord(value) && typeof value.preparationMinutes === 'string' &&
    typeof value.seriesEnabled === 'boolean' && typeof value.count === 'string' &&
    typeof value.intervalMinutes === 'string' && Object.keys(validateAlarmPreferences(value as AlarmPreferences)).length === 0;
}

export function alarmTimes(departure: Date, preferences: AlarmPreferences): PlannedAlarm[] {
  const count = preferences.seriesEnabled ? Number(preferences.count) : 1;
  const lastAlarm = departure.getTime() - Number(preferences.preparationMinutes) * 60_000;
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(lastAlarm - (count - 1 - index) * (preferences.seriesEnabled ? Number(preferences.intervalMinutes) : 0) * 60_000),
    label: index === count - 1 ? 'Pobudka' : index === 0 ? 'Budzik wstępny' : `Budzik ${index + 1}`,
  }));
}

export function calculateDayAlarms(plan: PlanInput, preferences: AlarmPreferences) {
  if (!isAlarmPreferences(preferences)) return { ok: false as const, message: 'Popraw ustawienia budzika.' };
  const result = calculatePlan(plan);
  if (!result.ok) return { ok: false as const, message: 'Uzupełnij i zapisz połączenie, aby obliczyć budzik z godziny wyjścia.' };
  return { ok: true as const, departure: result.departure, alarms: alarmTimes(result.departure, preferences) };
}

// ACTION_SET_ALARM accepts a local hour/minute, without a date. Only hand off
// alarms whose next local occurrence is the requested instant, never a weekday
// repeat or a different day. Date arithmetic also covers overnight plans.
export function systemAlarmDateIssue(alarms: PlannedAlarm[], now: number): string | null {
  if (alarms.some(({ date }) => date.getTime() <= now)) {
    return 'Godzina co najmniej jednego budzika już minęła. Zmień ustawienia lub wybierz inny dzień.';
  }
  for (const { date } of alarms) {
    const offsets = [new Date(date.getTime() - 86_400_000), new Date(date.getTime() + 86_400_000)];
    const ambiguous = offsets.some((neighbor) => {
      const alternate = new Date(date.getTime() + (neighbor.getTimezoneOffset() - date.getTimezoneOffset()) * 60_000);
      return alternate.getTime() !== date.getTime() && alternate.getFullYear() === date.getFullYear() &&
        alternate.getMonth() === date.getMonth() && alternate.getDate() === date.getDate() &&
        alternate.getHours() === date.getHours() && alternate.getMinutes() === date.getMinutes();
    });
    if (ambiguous) return 'Godzina budzika jest niejednoznaczna przy zmianie czasu w strefie urządzenia. Wybierz inne ustawienia pobudki.';
    const next = new Date(now);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    if (next.getTime() <= now) {
      next.setDate(next.getDate() + 1);
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    }
    if (next.getTime() !== date.getTime()) {
      return 'Zegar przyjmuje godzinę bez daty. Wróć bliżej wyjazdu, gdy wszystkie godziny budzików będą ich najbliższymi wystąpieniami (zwykle w ciągu 24 godzin).';
    }
  }
  return null;
}
