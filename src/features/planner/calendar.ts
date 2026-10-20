import { isRecord, isTimestamp, parseTransitDateTime } from '../transit/contract';
import { createDefaultPlan, formatDate, formatTime, isStoredPlan, validatePlan, type PlanInput } from './plan';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type Recurrence = { unit: RecurrenceUnit; interval: string };
export type CalendarDay = {
  plan: PlanInput;
  preferredDeparture: string | null;
  name: string;
  recurrence: Recurrence | null;
};
export type CalendarDays = Record<string, CalendarDay>;
export type CalendarEntry = { sourceDate: string; day: CalendarDay };

export function createCalendarDay(date: string): CalendarDay {
  return { plan: { ...createDefaultPlan(), date }, preferredDeparture: null, name: '', recurrence: null };
}

export function validRecurrence(value: unknown): value is Recurrence | null {
  return value === null || (isRecord(value) &&
    ['day', 'week', 'month', 'year'].includes(value.unit as string) &&
    typeof value.interval === 'string' && /^\d{1,2}$/.test(value.interval) && Number(value.interval) >= 1);
}

export function validDayDetails(day: CalendarDay): boolean {
  return day.name.length <= 80 && validRecurrence(day.recurrence);
}

export function isStoredCalendar(value: unknown): value is CalendarDays {
  return isRecord(value) && Object.entries(value).every(([date, day]) =>
    isRecord(day) && isStoredPlan(day.plan) && day.plan.date === date &&
    typeof day.name === 'string' && day.name.length <= 80 && validRecurrence(day.recurrence) &&
    (day.preferredDeparture === null || isTimestamp(day.preferredDeparture)));
}

export function migrateCalendar(value: unknown): CalendarDays | null {
  if (!isRecord(value)) return null;
  const days: CalendarDays = {};
  for (const [date, day] of Object.entries(value)) {
    if (!isRecord(day) || !isStoredPlan(day.plan) || day.plan.date !== date ||
        (day.preferredDeparture !== null && !isTimestamp(day.preferredDeparture))) return null;
    days[date] = { plan: day.plan, preferredDeparture: day.preferredDeparture, name: '', recurrence: null };
  }
  return days;
}

// Calendar arithmetic uses UTC noon; Polish wall-time parsing stays in plan.ts.
export function calendarDate(date: string): Date {
  const [day, month, year] = date.split('.').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function calendarDateKey(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
}

function occursOn(source: CalendarDay, date: string): boolean {
  if (!source.recurrence || !validRecurrence(source.recurrence)) return false;
  const start = calendarDate(source.plan.date);
  const target = calendarDate(date);
  const difference = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  if (difference < 0) return false;
  const { unit, interval } = source.recurrence;
  const step = Number(interval);
  if (unit === 'day' || unit === 'week') return difference % (step * (unit === 'week' ? 7 : 1)) === 0;
  if (start.getUTCDate() !== target.getUTCDate()) return false;
  const years = target.getUTCFullYear() - start.getUTCFullYear();
  if (unit === 'year') return target.getUTCMonth() === start.getUTCMonth() && years % step === 0;
  return (years * 12 + target.getUTCMonth() - start.getUTCMonth()) % step === 0;
}

export function moveCalendarDay(day: CalendarDay, date: string): CalendarDay {
  if (day.plan.date === date) return day;
  let preferredDeparture: string | null = null;
  if (day.preferredDeparture) {
    const departure = new Date(day.preferredDeparture);
    const offset = Math.round((calendarDate(formatDate(departure)).getTime() - calendarDate(day.plan.date).getTime()) / 86_400_000);
    const target = calendarDate(date);
    target.setUTCDate(target.getUTCDate() + offset);
    // An unshiftable wall time stays unmatched; the picker must ask for a new course.
    preferredDeparture = parseTransitDateTime(calendarDateKey(target), formatTime(departure))?.toISOString() ?? day.preferredDeparture;
  }
  return { ...day, plan: { ...day.plan, date }, preferredDeparture };
}

export function calendarEntry(days: CalendarDays, date: string): CalendarEntry | null {
  if (days[date]) return { sourceDate: date, day: days[date] };
  let sourceDate: string | null = null;
  for (const [key, day] of Object.entries(days)) {
    if (occursOn(day, date) && (!sourceDate || calendarDate(key) > calendarDate(sourceDate))) sourceDate = key;
  }
  return sourceDate ? { sourceDate, day: moveCalendarDay(days[sourceDate], date) } : null;
}

function nextOccurrence(day: CalendarDay, from: Date): Date | null {
  const start = calendarDate(day.plan.date);
  if (!day.recurrence) return start >= from ? start : null;
  const { unit, interval } = day.recurrence;
  const step = Number(interval);
  if (unit === 'day' || unit === 'week') {
    const period = step * (unit === 'week' ? 7 : 1) * 86_400_000;
    const date = new Date(start.getTime() + Math.max(0, Math.ceil((from.getTime() - start.getTime()) / period)) * period);
    return date.getUTCFullYear() <= 2099 ? date : null;
  }
  const months = (from.getUTCFullYear() - start.getUTCFullYear()) * 12 + from.getUTCMonth() - start.getUTCMonth();
  const period = step * (unit === 'year' ? 12 : 1);
  let occurrence = Math.max(0, Math.floor(months / period));
  while (true) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + occurrence * period, start.getUTCDate(), 12));
    if (date.getUTCFullYear() > 2099) return null;
    if (date >= from && date.getUTCDate() === start.getUTCDate()) return date;
    occurrence += 1;
  }
}

export function nextCalendarEntry(days: CalendarDays, now: number): CalendarEntry | null {
  const today = calendarDate(formatDate(new Date(now)));
  let next: CalendarEntry | null = null;
  let nextArrival = Infinity;
  for (const source of Object.values(days)) {
    let date = nextOccurrence(source, today);
    while (date) {
      if (next && date > calendarDate(next.day.plan.date)) break;
      const entry = calendarEntry(days, calendarDateKey(date));
      const result = entry && validatePlan(entry.day.plan);
      if (entry && result?.ok && result.arrival.getTime() > now) {
        if (result.arrival.getTime() < nextArrival) {
          next = entry;
          nextArrival = result.arrival.getTime();
        }
        break;
      }
      const followingDay = new Date(date);
      followingDay.setUTCDate(followingDay.getUTCDate() + 1);
      date = nextOccurrence(source, followingDay);
    }
  }
  return next;
}
