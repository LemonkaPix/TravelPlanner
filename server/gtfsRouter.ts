import { createHash } from 'node:crypto';
import {
  formatTransitDate, isConnection, parseTransitDateTime,
  type ConnectionQuery, type TransitConnection, type TransitLeg, type TransitStop,
} from '../src/features/transit/contract.ts';
import type { Feed, Footpath, Timetable, Trip } from './gtfsTypes.ts';
import { ServiceError } from './serviceError.ts';

type Instance = { trip: Trip; base: number; id: string };
type Path = { departure: number; arrival: number; legs: TransitLeg[]; trips: string[] };
const iso = (time: number) => new Date(time).toISOString();
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLocaleLowerCase('pl').trim();
const stopLabel = (stop: TransitStop) => `${stop.label}${stop.code ? ` (${stop.code})` : ''}`;

function distance(a: TransitStop, b: TransitStop): number {
  const [lat1, lon1] = a.coordinate.split(':').map(Number);
  const [lat2, lon2] = b.coordinate.split(':').map(Number);
  const radians = Math.PI / 180;
  const h = Math.sin((lat2 - lat1) * radians / 2) ** 2 +
    Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lon2 - lon1) * radians / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Incoming transfer edges: alight at `from`, walk to the next boarding `to`.
// Cross-platform walking is an estimate within the same named ZTP stop group.
export function buildTransfers(timetable: Timetable): Map<string, Footpath[]> {
  const groups = new Map<string, TransitStop[]>();
  const edges = new Map<string, Map<string, Footpath>>();
  const set = (from: string, to: string, seconds: number) => {
    const incoming = edges.get(to) ?? new Map<string, Footpath>();
    incoming.set(from, { from, to, seconds }); edges.set(to, incoming);
  };
  for (const stop of timetable.stops.values()) {
    set(stop.id, stop.id, 120);
    const code = stop.code && /^(\d+)-\d+$/.exec(stop.code);
    if (code) {
      const key = `${code[1]}:${normalizeSearch(stop.label)}`;
      const group = groups.get(key) ?? [];
      group.push(stop); groups.set(key, group);
    }
  }
  for (const group of groups.values()) for (const from of group) for (const to of group) {
    if (from.id === to.id) continue;
    const meters = distance(from, to);
    if (meters <= 400) set(from.id, to.id, Math.max(180, Math.ceil(meters / 1.2)) + 60);
  }
  // Conflicting feeds are combined conservatively: any prohibition wins.
  const prohibited = new Set<string>();
  for (const rule of timetable.rules) {
    const key = JSON.stringify([rule.from, rule.to]);
    if (rule.prohibited) prohibited.add(key);
    const existing = edges.get(rule.to)?.get(rule.from);
    const estimate = rule.from === rule.to ? 120 : Math.max(180, Math.ceil(distance(timetable.stops.get(rule.from)!, timetable.stops.get(rule.to)!) / 1.2)) + 60;
    set(rule.from, rule.to, Math.max(existing?.seconds ?? estimate, rule.minimum));
  }
  for (const [to, incoming] of edges) for (const from of incoming.keys()) {
    if (prohibited.has(JSON.stringify([from, to]))) incoming.delete(from);
  }
  return new Map([...edges].map(([to, incoming]) => [to, [...incoming.values()]]));
}

function activeServices(feed: Feed, day: string, weekday: number): Set<string> {
  const active = new Set<string>();
  for (const [id, calendar] of feed.calendars) {
    if (day >= calendar.start && day <= calendar.end && calendar.weekdays[weekday]) active.add(id);
  }
  for (const [id, added] of feed.exceptions.get(day) ?? []) {
    if (added) active.add(id); else active.delete(id);
  }
  return active;
}

function instances(timetable: Timetable, deadline: Date): Instance[] {
  const [day, month, year] = formatTransitDate(deadline).split('.').map(Number);
  const result: Instance[] = [];
  for (let offset = -2; offset <= 0; offset += 1) {
    const civilDay = new Date(Date.UTC(year, month - 1, day + offset, 12));
    const date = formatTransitDate(civilDay);
    const key = date.split('.').reverse().join('');
    // GTFS times are seconds since local noon minus 12 hours, including on DST
    // transition days. They are not parsed as potentially ambiguous wall times.
    const noon = parseTransitDateTime(date, '12:00');
    if (!noon) continue;
    const base = noon.getTime() - 12 * 60 * 60_000;
    const weekday = (civilDay.getUTCDay() + 6) % 7;
    for (const feed of timetable.feeds) {
      const active = activeServices(feed, key, weekday);
      for (const trip of feed.trips) if (active.has(trip.service)) result.push({ trip, base, id: `${trip.id}:${key}` });
    }
  }
  return result;
}

function better(candidate: Path, current: Path | undefined): boolean {
  return !current || candidate.departure > current.departure ||
    (candidate.departure === current.departure && (candidate.trips.length < current.trips.length ||
      (candidate.trips.length === current.trips.length && candidate.arrival < current.arrival)));
}

function transferPaths(paths: Map<string, Path>, transfers: Map<string, Footpath[]>, timetable: Timetable): Map<string, Path> {
  const result = new Map<string, Path>();
  for (const [board, path] of paths) for (const edge of transfers.get(board) ?? []) {
    const departure = path.departure - edge.seconds * 1000;
    const legs = edge.from === edge.to ? path.legs : [{
      label: 'Przejście między stanowiskami (czas szacowany)',
      from: stopLabel(timetable.stops.get(edge.from)!), to: stopLabel(timetable.stops.get(edge.to)!),
      departure: iso(departure), arrival: iso(path.departure - 60_000), walking: true,
    }, ...path.legs];
    const candidate = { ...path, departure, legs };
    if (better(candidate, result.get(edge.from))) result.set(edge.from, candidate);
  }
  return result;
}

function latestPath(
  query: ConnectionQuery, timetable: Timetable, trips: Instance[], transfers: Map<string, Footpath[]>, before: number,
): Path | null {
  const deadline = Date.parse(query.arriveBy);
  const earliest = deadline - 24 * 60 * 60_000;
  let tails = new Map<string, Path>([[query.to.id, { departure: deadline, arrival: deadline, legs: [], trips: [] }]]);
  let best: Path | undefined;
  // Backward rounds: exact 1, 2 or 3 vehicle rides (at most two transfers).
  // Read only the preceding round, so trip scan order cannot invent transfers.
  for (let rides = 1; rides <= 3; rides += 1) {
    const boards = new Map<string, Path>();
    for (const instance of trips) {
      const { trip, base } = instance;
      let alight: { index: number; tail: Path; arrival: number; finalArrival: number } | null = null;
      for (let index = trip.times.length - 1; index >= 0; index -= 1) {
        const event = trip.times[index];
        const arrival = base + event.arrival * 1000;
        const departure = base + event.departure * 1000;
        const tail = tails.get(event.stop);
        if (tail && event.dropoff && arrival <= tail.departure && arrival >= earliest && !tail.trips.includes(instance.id)) {
          const finalArrival = tail.legs.length ? tail.arrival : arrival;
          if (!alight || finalArrival < alight.finalArrival) alight = { index, tail, arrival, finalArrival };
        }
        if (!alight || index >= alight.index || !event.pickup || departure < earliest ||
            (event.stop === query.from.id && departure > before)) continue;
        const existing = boards.get(event.stop);
        if (existing && (departure < existing.departure || (departure === existing.departure && alight.finalArrival >= existing.arrival))) continue;
        const last = trip.times[alight.index];
        const leg: TransitLeg = {
          label: trip.label, from: stopLabel(timetable.stops.get(event.stop)!), to: stopLabel(timetable.stops.get(last.stop)!),
          departure: iso(departure), arrival: iso(alight.arrival), walking: false,
        };
        boards.set(event.stop, {
          departure, arrival: alight.finalArrival, legs: [leg, ...alight.tail.legs], trips: [instance.id, ...alight.tail.trips],
        });
      }
    }
    const candidate = boards.get(query.from.id);
    if (candidate && better(candidate, best)) best = candidate;
    tails = transferPaths(boards, transfers, timetable);
  }
  return best ?? null;
}

export function planConnections(query: ConnectionQuery, timetable: Timetable, transfers: Map<string, Footpath[]>): TransitConnection[] {
  if (!timetable.stops.has(query.from.id) || !timetable.stops.has(query.to.id)) {
    throw new ServiceError(400, 'Przystanek z zapisanego planu nie występuje w aktualnym rozkładzie. Wybierz go ponownie.');
  }
  const deadline = new Date(query.arriveBy);
  const day = formatTransitDate(deadline).split('.').reverse().join('');
  if (timetable.feeds.some((feed) => day < feed.firstDate || day > feed.lastDate)) {
    throw new ServiceError(422, 'ZTP nie udostępnia jeszcze pełnych rozkładów dla tej daty. Wybierz termin bliższy dzisiejszej dacie.');
  }
  const trips = instances(timetable, deadline);
  const results: TransitConnection[] = [];
  let before = deadline.getTime();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const path = latestPath(query, timetable, trips, transfers, before);
    if (!path) break;
    const connection: TransitConnection = {
      id: createHash('sha256').update(JSON.stringify([path.trips, path.legs])).digest('hex'),
      fromStopId: query.from.id, toStopId: query.to.id,
      departure: iso(path.departure), arrival: iso(path.arrival), legs: path.legs,
      scheduleUpdatedAt: iso(timetable.downloadedAt),
    };
    if (!isConnection(connection)) throw new ServiceError(500, 'Nie udało się obliczyć poprawnego połączenia.');
    results.push(connection);
    before = path.departure - 1;
  }
  return results;
}
