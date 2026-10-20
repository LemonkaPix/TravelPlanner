import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { open, type ZipFile, type Entry } from 'yauzl';
import {
  KRAKOW_CITY, isStop, parseTransitDateTime, stopId, TRANSIT_TIME_ZONE, type TransitStop,
} from '../src/features/transit/contract.ts';
import type { Feed, Timetable, Trip } from './gtfsTypes.ts';

const directory = fileURLToPath(new URL('./data/', import.meta.url));
const FRESH_MS = 6 * 60 * 60_000;
export const MAX_DATA_AGE_MS = 24 * 60 * 60_000;
const badFeed = () => new Error('Nieprawidłowy lub nieobsługiwany rozkład GTFS ZTP.');

function required(value: string | undefined): string {
  if (!value || value.length > 240) throw badFeed();
  return value;
}
function integer(value: string | undefined, max = 1_000_000): number {
  if (!value || !/^\d+$/.test(value) || Number(value) > max) throw badFeed();
  return Number(value);
}
function date(value: string | undefined): string {
  if (!value || !/^20\d{6}$/.test(value) || !parseTransitDateTime(`${value.slice(6)}.${value.slice(4, 6)}.${value.slice(0, 4)}`, '12:00')) throw badFeed();
  return value;
}
function seconds(value: string | undefined): number {
  if (!value || !/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(value)) throw badFeed();
  const [h, m, s] = value.split(':').map(Number);
  if (h >= 48) throw badFeed();
  return h * 3600 + m * 60 + s;
}

async function findEntry(path: string, name: string): Promise<{ zip: ZipFile; entry: Entry } | null> {
  return new Promise((resolve, reject) => {
    open(path, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(error ?? badFeed()); return; }
      zip.on('error', (failure) => { zip.close(); reject(failure); });
      zip.on('end', () => { zip.close(); resolve(null); });
      zip.on('entry', (entry: Entry) => {
        if (entry.fileName !== name) { zip.readEntry(); return; }
        if (entry.uncompressedSize > 220_000_000) { zip.close(); reject(badFeed()); return; }
        resolve({ zip, entry });
      });
      zip.readEntry();
    });
  });
}

async function* rows(path: string, name: string, columns: string[], optional = false): AsyncGenerator<Record<string, string>> {
  const found = await findEntry(path, name);
  if (!found) { if (!optional) throw badFeed(); return; }
  const { zip, entry } = found;
  let input: Readable | undefined;
  const parser = parse({
    bom: true, trim: true, skip_empty_lines: true, max_record_size: 16_384,
    columns: (headers: string[]) => {
      if (!columns.every((column) => headers.includes(column)) || new Set(headers).size !== headers.length) throw badFeed();
      return headers;
    },
  });
  let count = 0;
  try {
    input = await new Promise<Readable>((resolve, reject) => zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? badFeed()); else resolve(stream);
    }));
    const source = input;
    const fail = (error: Error) => { parser.destroy(error); };
    zip.on('error', fail);
    source.on('error', fail);
    source.pipe(parser);
    for await (const row of parser) {
      count += 1;
      if (count > 3_000_000) throw badFeed();
      yield row as Record<string, string>;
    }
  } finally {
    input?.destroy(); parser.destroy(); zip.close();
  }
}

async function archive(feed: string): Promise<{ path: string; cached: string; temporary: boolean; timestamp: number }> {
  const cached = `${directory}${feed}.zip`;
  const info = await stat(cached).catch(() => null);
  if (info && Date.now() - info.mtimeMs < FRESH_MS) return { path: cached, cached, temporary: false, timestamp: info.mtimeMs };
  const temporary = `${cached}.${randomUUID()}.download`;
  try {
    const response = await fetch(`https://gtfs.ztp.krakow.pl/GTFS_KRK_${feed}.zip`, {
      signal: AbortSignal.timeout(60_000), redirect: 'error',
    });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw badFeed(); }
    let size = 0;
    const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(size > 40_000_000 ? badFeed() : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(temporary, { flags: 'wx' }));
    return { path: temporary, cached, temporary: true, timestamp: Date.now() };
  } catch (error) {
    await rm(temporary, { force: true });
    if (info && Date.now() - info.mtimeMs < MAX_DATA_AGE_MS) return { path: cached, cached, temporary: false, timestamp: info.mtimeMs };
    throw error;
  }
}

async function importFeed(path: string, id: string, timetable: Timetable): Promise<Feed> {
  let agencies = 0;
  for await (const agency of rows(path, 'agency.txt', ['agency_timezone'])) {
    if (agency.agency_timezone !== TRANSIT_TIME_ZONE) throw badFeed();
    agencies += 1;
  }
  if (!agencies) throw badFeed();
  const stopAliases = new Map<string, string>();
  for await (const row of rows(path, 'stops.txt', ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'])) {
    if (row.location_type && row.location_type !== '0') continue;
    const coordinate = `${Number(required(row.stop_lat))}:${Number(required(row.stop_lon))}`;
    const code = row.stop_code || null;
    const stop: TransitStop = {
      id: stopId(KRAKOW_CITY.id, code, coordinate), cityId: KRAKOW_CITY.id,
      code, coordinate, label: required(row.stop_name),
    };
    if (!isStop(stop)) throw badFeed();
    const rawId = required(row.stop_id);
    if (stopAliases.has(rawId)) throw badFeed();
    stopAliases.set(rawId, stop.id);
    // ZTP platform codes identify the same stop across MPK, Mobilis and tram feeds.
    if (!timetable.stops.has(stop.id)) timetable.stops.set(stop.id, stop);
  }
  const routes = new Map<string, string>();
  for await (const row of rows(path, 'routes.txt', ['route_id', 'route_short_name'])) {
    const routeId = required(row.route_id);
    if (routes.has(routeId)) throw badFeed();
    routes.set(routeId, required(row.route_short_name || row.route_long_name));
  }
  const feed: Feed = { id, calendars: new Map(), exceptions: new Map(), trips: [], firstDate: '99999999', lastDate: '' };
  const recordDateRange = (start: string, end = start) => {
    if (end < start) throw badFeed();
    if (start < feed.firstDate) feed.firstDate = start;
    if (end > feed.lastDate) feed.lastDate = end;
  };
  for await (const row of rows(path, 'calendar.txt', ['service_id', 'start_date', 'end_date'], true)) {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((key) => {
      if (row[key] !== '0' && row[key] !== '1') throw badFeed();
      return row[key] === '1';
    });
    const start = date(row.start_date); const end = date(row.end_date);
    if (end < start) throw badFeed();
    const service = required(row.service_id);
    if (feed.calendars.has(service)) throw badFeed();
    feed.calendars.set(service, { start, end, weekdays });
    if (weekdays.some(Boolean)) recordDateRange(start, end);
  }
  for await (const row of rows(path, 'calendar_dates.txt', ['service_id', 'date', 'exception_type'], true)) {
    const day = date(row.date); const service = required(row.service_id);
    if (row.exception_type !== '1' && row.exception_type !== '2') throw badFeed();
    const exceptions = feed.exceptions.get(day) ?? new Map<string, boolean>();
    if (exceptions.has(service)) throw badFeed();
    exceptions.set(service, row.exception_type === '1');
    feed.exceptions.set(day, exceptions);
    if (row.exception_type === '1') recordDateRange(day);
  }
  const services = new Set(feed.calendars.keys());
  for (const exceptions of feed.exceptions.values()) for (const service of exceptions.keys()) services.add(service);
  const trips = new Map<string, Trip>();
  for await (const row of rows(path, 'trips.txt', ['trip_id', 'route_id', 'service_id'])) {
    const route = routes.get(row.route_id);
    if (!route || !services.has(row.service_id)) throw badFeed();
    const tripId = required(row.trip_id);
    if (trips.has(tripId)) throw badFeed();
    trips.set(tripId, {
      id: `${id}:${tripId}`, service: required(row.service_id),
      label: `${route}${row.trip_headsign ? ` → ${row.trip_headsign}` : ''}`, times: [],
    });
  }
  for await (const row of rows(path, 'stop_times.txt', ['trip_id', 'stop_id', 'stop_sequence', 'arrival_time', 'departure_time'])) {
    const trip = trips.get(row.trip_id); const stop = stopAliases.get(row.stop_id);
    if (!trip || !stop || !['', '0', '1', '2', '3'].includes(row.pickup_type ?? '') || !['', '0', '1', '2', '3'].includes(row.drop_off_type ?? '')) throw badFeed();
    trip.times.push({
      stop, sequence: integer(row.stop_sequence), arrival: seconds(row.arrival_time), departure: seconds(row.departure_time),
      pickup: !row.pickup_type || row.pickup_type === '0', dropoff: !row.drop_off_type || row.drop_off_type === '0',
    });
  }
  for (const trip of trips.values()) {
    trip.times.sort((a, b) => a.sequence - b.sequence);
    if (trip.times.length < 2 || trip.label.length > 240) throw badFeed();
    let previous: { sequence: number; departure: number } | null = null;
    for (const time of trip.times) {
      if (time.arrival > time.departure || (previous && (time.sequence <= previous.sequence || time.arrival < previous.departure))) throw badFeed();
      previous = time;
    }
    feed.trips.push(trip);
  }
  for await (const row of rows(path, 'transfers.txt', ['from_stop_id', 'to_stop_id', 'transfer_type'], true)) {
    const from = stopAliases.get(row.from_stop_id); const to = stopAliases.get(row.to_stop_id);
    // Do not silently drop trip-specific constraints if the source introduces them.
    if (!from || !to || ['from_trip_id', 'to_trip_id', 'from_route_id', 'to_route_id'].some((key) => row[key]) || !['0', '1', '2', '3'].includes(row.transfer_type)) throw badFeed();
    timetable.rules.push({ from, to, minimum: row.transfer_type === '2' ? integer(row.min_transfer_time, 86_400) : 0, prohibited: row.transfer_type === '3' });
  }
  for await (const _row of rows(path, 'frequencies.txt', ['trip_id'], true)) throw badFeed();
  if (!feed.lastDate || !feed.trips.length || !stopAliases.size) throw badFeed();
  return feed;
}

export async function importTimetable(): Promise<Timetable> {
  await mkdir(directory, { recursive: true });
  const timetable: Timetable = { stops: new Map(), feeds: [], rules: [], downloadedAt: Date.now() };
  for (const id of ['A', 'M', 'T']) {
    const file = await archive(id);
    try {
      timetable.feeds.push(await importFeed(file.path, id, timetable));
      timetable.downloadedAt = Math.min(timetable.downloadedAt, file.timestamp);
      if (file.temporary) await rename(file.path, file.cached);
    } catch (error) {
      if (!file.temporary) await rm(file.cached, { force: true });
      throw error;
    } finally {
      if (file.temporary) await rm(file.path, { force: true });
    }
  }
  return timetable;
}
