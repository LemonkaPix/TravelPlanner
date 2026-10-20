// JSON contract shared by the mobile app and the Kraków ZTP timetable API.
export type TransitCity = { id: string; label: string };
export const KRAKOW_CITY: TransitCity = { id: 'KRAKOW', label: 'Kraków i okolice' };
export type TransitStop = {
  id: string;
  label: string;
  cityId: string;
  code: string | null;
  coordinate: string;
};
export type TransitLeg = {
  label: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  walking: boolean;
};
export type TransitConnection = {
  id: string;
  fromStopId: string;
  toStopId: string;
  departure: string;
  arrival: string;
  legs: TransitLeg[];
  scheduleUpdatedAt: string;
};
export type ConnectionQuery = {
  cityId: string;
  from: TransitStop;
  to: TransitStop;
  arriveBy: string;
};

export const TRANSIT_TIME_ZONE = 'Europe/Warsaw';
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TRANSIT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TRANSIT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatTransitDate(date: Date): string {
  return dateFormatter.format(date).replace(/\//g, '.');
}
export function formatTransitTime(date: Date): string {
  return timeFormatter.format(date);
}

// Form input is a Polish wall time. Reject missing/ambiguous DST times rather
// than silently choosing an occurrence. GTFS service-day arithmetic is separate.
export function parseTransitDateTime(date: string, time: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(20\d{2})$/.exec(date);
  if (!match || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [, day, month, year] = match.map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const matches: Date[] = [];
  // All Polish civil offsets in the supported 2000–2099 date range.
  for (const offset of [60, 120]) {
    const candidate = new Date(wall - offset * 60_000);
    if (formatTransitDate(candidate) === date && formatTransitTime(candidate) === time) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
}
export function isCity(value: unknown): value is TransitCity {
  return isRecord(value) && value.id === KRAKOW_CITY.id && isLabel(value.label);
}
export function isCoordinate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^-?\d{1,3}(\.\d+)?:-?\d{1,3}(\.\d+)?$/.test(value)) return false;
  const [lat, lon] = value.split(':').map(Number);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
export function stopId(cityId: string, code: string | null, coordinate: string): string {
  // Namespace prevents a saved Jakdojade code from being reused as a GTFS stop.
  return `${cityId}:ZTP:${code ?? `@${coordinate}`}`;
}
export function isStop(value: unknown): value is TransitStop {
  return isRecord(value) && isCity({ id: value.cityId, label: value.cityId }) &&
    isLabel(value.label) && (value.code === null || isLabel(value.code)) && isCoordinate(value.coordinate) &&
    value.id === stopId(value.cityId as string, value.code, value.coordinate);
}
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function isConnection(value: unknown): value is TransitConnection {
  if (!isRecord(value) || !isLabel(value.id) || !isLabel(value.fromStopId) || !isLabel(value.toStopId) ||
      !isTimestamp(value.scheduleUpdatedAt) || !isTimestamp(value.departure) || !isTimestamp(value.arrival) || value.arrival < value.departure ||
      !Array.isArray(value.legs) || value.legs.length < 1 || value.legs.length > 40) return false;
  let previous = value.departure;
  for (const leg of value.legs) {
    if (!isRecord(leg) || !isLabel(leg.label) || !isLabel(leg.from) || !isLabel(leg.to) ||
        typeof leg.walking !== 'boolean' || !isTimestamp(leg.departure) || !isTimestamp(leg.arrival) ||
        leg.departure < previous || leg.arrival < leg.departure || leg.arrival > value.arrival) return false;
    previous = leg.arrival;
  }
  return value.legs[0].departure === value.departure &&
    value.legs[value.legs.length - 1].arrival === value.arrival &&
    !value.legs[0].walking && !value.legs[value.legs.length - 1].walking;
}
export function isConnectionQuery(value: unknown): value is ConnectionQuery {
  if (!isRecord(value) || !isStop(value.from) || !isStop(value.to) ||
      value.cityId !== value.from.cityId || value.cityId !== value.to.cityId ||
      value.from.id === value.to.id || !isTimestamp(value.arriveBy)) return false;
  const deadline = new Date(value.arriveBy);
  return parseTransitDateTime(formatTransitDate(deadline), formatTransitTime(deadline))?.toISOString() === value.arriveBy;
}
