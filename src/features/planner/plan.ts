import { formatDate, formatTime, isRecord, parseDateTime } from './dateTime';
import { isStop, localStop, resolveConnection, type ManualLeg, type Stop } from './journey';
export { formatDate, formatTime } from './dateTime';

export type PlanInput = {
  origin: string;
  destination: string;
  date: string;
  time: string;
  bufferMinutes: string;
  walkToMinutes: string;
  walkFromMinutes: string;
  fromStop: Stop | null;
  toStop: Stop | null;
  legs: ManualLeg[];
};
export type PlanErrors = Partial<Record<keyof PlanInput, string>>;

export function createDefaultPlan(): PlanInput {
  const now = new Date();
  let day = new Date(now);
  let arrival = parseDateTime(formatDate(day), '09:00');
  if (!arrival || arrival.getTime() - 45 * 60_000 <= now.getTime()) {
    const [date, month, year] = formatDate(now).split('.').map(Number);
    day = new Date(Date.UTC(year, month - 1, date + 1, 12));
    arrival = parseDateTime(formatDate(day), '09:00');
  }
  return {
    origin: 'Dom', destination: '', date: formatDate(arrival ?? day), time: '09:00',
    bufferMinutes: '10', walkToMinutes: '5', walkFromMinutes: '5',
    fromStop: null, toStop: null, legs: [],
  };
}

export function validMinutes(value: string): boolean {
  return /^\d{1,3}$/.test(value) && Number(value) <= 180;
}

export function validatePlan(input: PlanInput) {
  const errors: PlanErrors = {};
  if (!input.origin.trim() || input.origin.length > 120) errors.origin = 'Wpisz miejsce wyjścia (do 120 znaków).';
  if (!input.destination.trim() || input.destination.length > 120) errors.destination = 'Wpisz miejsce docelowe (do 120 znaków).';
  const arrival = parseDateTime(input.date, input.time);
  if (!/^\d{2}\.\d{2}\.20\d{2}$/.test(input.date) || !parseDateTime(input.date, '12:00')) {
    errors.date = 'Podaj poprawną datę: DD.MM.RRRR (2000–2099).';
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.time = 'Podaj godzinę od 00:00 do 23:59.';
  else if (!errors.date && !arrival) errors.time = 'Godzina nie istnieje lub jest niejednoznaczna przy zmianie czasu. Wybierz inną.';
  for (const key of ['bufferMinutes', 'walkToMinutes', 'walkFromMinutes'] as const) {
    if (!validMinutes(input[key])) errors[key] = 'Wpisz od 0 do 180 minut.';
  }
  if (!isStop(input.fromStop)) errors.fromStop = 'Wpisz przystanek początkowy.';
  if (!isStop(input.toStop)) errors.toStop = 'Wpisz przystanek końcowy.';
  if (!arrival || Object.keys(errors).length) return { ok: false as const, errors };
  const targetArrival = new Date(arrival.getTime() - Number(input.bufferMinutes) * 60_000);
  const stopArrivalDeadline = new Date(targetArrival.getTime() - Number(input.walkFromMinutes) * 60_000);
  if (!parseDateTime(formatDate(stopArrivalDeadline), formatTime(stopArrivalDeadline))) {
    errors.time = 'Termin na przystanku jest poza zakresem dat lub niejednoznaczny przy zmianie czasu. Zmień termin, zapas lub dojście.';
    return { ok: false as const, errors };
  }
  return { ok: true as const, arrival, targetArrival, stopArrivalDeadline };
}

export function calculatePlan(input: PlanInput) {
  const validation = validatePlan(input);
  if (!validation.ok) return validation;
  const { connection, error } = resolveConnection(input.legs);
  if (!connection) return { ok: false as const, errors: {}, message: error };
  if (connection.legs[0].from.trim() !== input.fromStop?.label.trim() ||
      connection.legs[connection.legs.length - 1].to.trim() !== input.toStop?.label.trim()) {
    return { ok: false as const, errors: {}, message: 'Pierwszy i ostatni przystanek połączenia muszą odpowiadać punktom trasy.' };
  }
  const stopDeparture = new Date(connection.departure);
  const stopArrival = new Date(connection.arrival);
  const destinationArrival = new Date(stopArrival.getTime() + Number(input.walkFromMinutes) * 60_000);
  if (destinationArrival > validation.targetArrival) {
    return { ok: false as const, errors: {}, message: 'Połączenie nie zapewnia dojścia na czas z wymaganym zapasem. Zmień godziny lub termin.' };
  }
  const departure = new Date(stopDeparture.getTime() - Number(input.walkToMinutes) * 60_000);
  if (!parseDateTime(formatDate(departure), formatTime(departure))) {
    return { ok: false as const, errors: {}, message: 'Godzina wyjścia jest poza zakresem dat lub niejednoznaczna przy zmianie czasu.' };
  }
  return { ...validation, connection, departure, stopDeparture, stopArrival, destinationArrival };
}

export function isStoredPlan(value: unknown): value is PlanInput {
  if (!isRecord(value)) return false;
  const keys = ['origin', 'destination', 'date', 'time', 'bufferMinutes', 'walkToMinutes', 'walkFromMinutes'] as const;
  return keys.every((key) => typeof value[key] === 'string') && validatePlan(value as PlanInput).ok &&
    Array.isArray(value.legs) && (value.legs.length === 0 || calculatePlan(value as PlanInput).ok);
}

// Preserve local labels and times; old plans never stored a complete connection.
export function migratePreviousPlan(value: unknown): PlanInput | null {
  if (!isRecord(value)) return null;
  const keys = ['origin', 'destination', 'date', 'time', 'bufferMinutes'] as const;
  if (!keys.every((key) => typeof value[key] === 'string')) return null;
  if (['walkToMinutes', 'walkFromMinutes'].some((key) => value[key] !== undefined && typeof value[key] !== 'string')) return null;
  const plan: PlanInput = {
    origin: value.origin as string, destination: value.destination as string,
    date: value.date as string, time: value.time as string, bufferMinutes: value.bufferMinutes as string,
    walkToMinutes: typeof value.walkToMinutes === 'string' ? value.walkToMinutes : '5',
    walkFromMinutes: typeof value.walkFromMinutes === 'string' ? value.walkFromMinutes : '5',
    fromStop: localStop(value.fromStop), toStop: localStop(value.toStop), legs: [],
  };
  const result = validatePlan(plan);
  if (!result.ok && Object.keys(result.errors).some((key) => key !== 'fromStop' && key !== 'toStop')) return null;
  return plan;
}
