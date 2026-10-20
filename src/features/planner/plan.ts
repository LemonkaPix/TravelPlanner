import {
  KRAKOW_CITY, formatTransitDate, formatTransitTime, isCity, isConnection, isRecord, isStop,
  parseTransitDateTime, type ConnectionQuery, type TransitCity, type TransitConnection, type TransitStop,
} from '../transit/contract';

export type PlanInput = {
  origin: string;
  destination: string;
  date: string;
  time: string;
  bufferMinutes: string;
  walkToMinutes: string;
  walkFromMinutes: string;
  city: TransitCity | null;
  fromStop: TransitStop | null;
  toStop: TransitStop | null;
};
export type PlanErrors = Partial<Record<keyof PlanInput, string>>;
export const formatDate = formatTransitDate;
export const formatTime = formatTransitTime;

export function createDefaultPlan(): PlanInput {
  const now = new Date();
  let day = new Date(now);
  let arrival = parseTransitDateTime(formatDate(day), '09:00');
  if (!arrival || arrival.getTime() - 45 * 60_000 <= now.getTime()) {
    const [date, month, year] = formatDate(now).split('.').map(Number);
    day = new Date(Date.UTC(year, month - 1, date + 1, 12));
    arrival = parseTransitDateTime(formatDate(day), '09:00');
  }
  return {
    origin: 'Dom', destination: '', date: formatDate(arrival ?? day), time: '09:00',
    bufferMinutes: '10', walkToMinutes: '5', walkFromMinutes: '5',
    city: KRAKOW_CITY, fromStop: null, toStop: null,
  };
}

function validMinutes(value: string): boolean {
  return /^\d{1,3}$/.test(value) && Number(value) <= 180;
}

export function validatePlan(input: PlanInput) {
  const errors: PlanErrors = {};
  if (!input.origin.trim() || input.origin.length > 120) errors.origin = 'Wpisz miejsce wyjścia (do 120 znaków).';
  if (!input.destination.trim() || input.destination.length > 120) errors.destination = 'Wpisz miejsce docelowe (do 120 znaków).';
  const arrival = parseTransitDateTime(input.date, input.time);
  if (!/^\d{2}\.\d{2}\.20\d{2}$/.test(input.date) || !parseTransitDateTime(input.date, '12:00')) {
    errors.date = 'Podaj poprawną datę: DD.MM.RRRR (2000–2099).';
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) errors.time = 'Podaj godzinę od 00:00 do 23:59.';
  else if (!errors.date && !arrival) errors.time = 'Godzina nie istnieje lub jest niejednoznaczna przy zmianie czasu. Wybierz inną.';
  for (const key of ['bufferMinutes', 'walkToMinutes', 'walkFromMinutes'] as const) {
    if (!validMinutes(input[key])) errors[key] = 'Wpisz od 0 do 180 minut.';
  }
  if (!isCity(input.city)) errors.city = 'Obsługujemy komunikację Krakowa i okolic.';
  if (!isStop(input.fromStop) || input.fromStop.cityId !== input.city?.id) errors.fromStop = 'Wybierz przystanek początkowy z listy.';
  if (!isStop(input.toStop) || input.toStop.cityId !== input.city?.id) errors.toStop = 'Wybierz przystanek końcowy z listy.';
  else if (input.fromStop?.id === input.toStop.id) errors.toStop = 'Wybierz inny przystanek końcowy.';
  if (!arrival || Object.keys(errors).length) return { ok: false as const, errors };
  const targetArrival = new Date(arrival.getTime() - Number(input.bufferMinutes) * 60_000);
  const stopArrivalDeadline = new Date(targetArrival.getTime() - Number(input.walkFromMinutes) * 60_000);
  if (!parseTransitDateTime(formatDate(stopArrivalDeadline), formatTime(stopArrivalDeadline))) {
    errors.time = 'Termin na przystanku jest poza zakresem dat lub niejednoznaczny przy zmianie czasu. Zmień termin, zapas lub dojście.';
    return { ok: false as const, errors };
  }
  return { ok: true as const, arrival, targetArrival, stopArrivalDeadline };
}

export function connectionQuery(input: PlanInput): ConnectionQuery | null {
  const result = validatePlan(input);
  if (!result.ok || !input.city || !input.fromStop || !input.toStop) return null;
  return {
    cityId: input.city.id, from: input.fromStop, to: input.toStop,
    arriveBy: result.stopArrivalDeadline.toISOString(),
  };
}

export function calculatePlan(input: PlanInput, connection: TransitConnection | null) {
  const validation = validatePlan(input);
  if (!validation.ok) return validation;
  if (!isConnection(connection) || connection.fromStopId !== input.fromStop?.id || connection.toStopId !== input.toStop?.id) {
    return { ok: false as const, errors: {}, message: 'Wyszukaj i wybierz aktualne połączenie.' };
  }
  const stopDeparture = new Date(connection.departure);
  const stopArrival = new Date(connection.arrival);
  const destinationArrival = new Date(stopArrival.getTime() + Number(input.walkFromMinutes) * 60_000);
  if (destinationArrival > validation.targetArrival) {
    return { ok: false as const, errors: {}, message: 'To połączenie nie zapewnia dojścia na czas. Wyszukaj inne.' };
  }
  const departure = new Date(stopDeparture.getTime() - Number(input.walkToMinutes) * 60_000);
  return { ...validation, departure, stopDeparture, stopArrival, destinationArrival };
}

export function isStoredPlan(value: unknown): value is PlanInput {
  if (!isRecord(value)) return false;
  const keys = ['origin', 'destination', 'date', 'time', 'bufferMinutes', 'walkToMinutes', 'walkFromMinutes'] as const;
  return keys.every((key) => typeof value[key] === 'string') && validatePlan(value as PlanInput).ok;
}

export function migrateLegacyPlan(value: unknown): PlanInput | null {
  if (!isRecord(value)) return null;
  const keys = ['origin', 'destination', 'date', 'time', 'travelMinutes', 'bufferMinutes'] as const;
  if (!keys.every((key) => typeof value[key] === 'string')) return null;
  const legacy = value as Record<(typeof keys)[number], string>;
  if (!legacy.origin.trim() || legacy.origin.length > 120 || !legacy.destination.trim() || legacy.destination.length > 120 ||
      !/^\d{1,3}$/.test(legacy.travelMinutes) || Number(legacy.travelMinutes) < 1 || Number(legacy.travelMinutes) > 720 ||
      !validMinutes(legacy.bufferMinutes) || !parseTransitDateTime(legacy.date, legacy.time)) return null;
  return {
    origin: legacy.origin, destination: legacy.destination, date: legacy.date, time: legacy.time,
    bufferMinutes: legacy.bufferMinutes, walkToMinutes: '5', walkFromMinutes: '5',
    city: KRAKOW_CITY, fromStop: null, toStop: null,
  };
}

// Provider IDs cannot be translated safely: preserve configuration, require new
// ZTP platform selections, and keep the v2 storage entry untouched.
export function migrateJakdojadePlan(value: unknown): PlanInput | null {
  if (!isRecord(value)) return null;
  const keys = ['origin', 'destination', 'date', 'time', 'bufferMinutes', 'walkToMinutes', 'walkFromMinutes'] as const;
  if (!keys.every((key) => typeof value[key] === 'string')) return null;
  const previous = value as Record<(typeof keys)[number], string>;
  if (!previous.origin.trim() || previous.origin.length > 120 || !previous.destination.trim() || previous.destination.length > 120 ||
      !parseTransitDateTime(previous.date, previous.time) ||
      ![previous.bufferMinutes, previous.walkToMinutes, previous.walkFromMinutes].every(validMinutes)) return null;
  return {
    origin: previous.origin, destination: previous.destination, date: previous.date, time: previous.time,
    bufferMinutes: previous.bufferMinutes, walkToMinutes: previous.walkToMinutes, walkFromMinutes: previous.walkFromMinutes,
    city: KRAKOW_CITY, fromStop: null, toStop: null,
  };
}
