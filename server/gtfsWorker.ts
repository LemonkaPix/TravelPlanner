import { parentPort } from 'node:worker_threads';
import { KRAKOW_CITY, type ConnectionQuery } from '../src/features/transit/contract.ts';
import { importTimetable, MAX_DATA_AGE_MS } from './gtfsImport.ts';
import { buildTransfers, normalizeSearch, planConnections } from './gtfsRouter.ts';
import type { Footpath, Timetable } from './gtfsTypes.ts';
import { ServiceError } from './serviceError.ts';

if (!parentPort) throw new Error('GTFS worker requires a parent port');
const port = parentPort;
let timetable: Timetable | null = null;
let transfers = new Map<string, Footpath[]>();
let failed = false;

async function refresh() {
  let success = false;
  try {
    const next = await importTimetable();
    const nextTransfers = buildTransfers(next);
    // Swap only the fully imported three-feed snapshot and its transfer graph.
    timetable = next; transfers = nextTransfers; failed = false; success = true;
  } catch {
    failed = true;
  } finally {
    setTimeout(() => { void refresh(); }, success ? 6 * 60 * 60_000 : 60_000).unref();
  }
}

port.on('message', (message: { id: number; kind: 'stops' | 'connections'; query: string | ConnectionQuery; expires: number }) => {
  try {
    if (Date.now() >= message.expires) throw new ServiceError(504, 'Wyszukiwanie rozkładu trwało zbyt długo. Spróbuj ponownie.');
    if (!timetable || Date.now() - timetable.downloadedAt >= MAX_DATA_AGE_MS) {
      throw new ServiceError(503, failed
        ? 'Nie udało się pobrać aktualnych rozkładów ZTP. Spróbuj ponownie za minutę.'
        : 'Trwa pobieranie rozkładów ZTP. Pierwsze uruchomienie może potrwać kilka minut. Spróbuj ponownie za chwilę.');
    }
    if (message.kind === 'connections') {
      port.postMessage({ id: message.id, items: planConnections(message.query as ConnectionQuery, timetable, transfers) });
      return;
    }
    const query = normalizeSearch(message.query as string);
    const items = [...timetable.stops.values()]
      .filter((stop) => normalizeSearch(`${stop.label} ${stop.code ?? ''}`).includes(query))
      .sort((a, b) => Number(normalizeSearch(b.label).startsWith(query)) - Number(normalizeSearch(a.label).startsWith(query)) ||
        a.label.localeCompare(b.label, 'pl') || (a.code ?? '').localeCompare(b.code ?? ''))
      .slice(0, 20);
    port.postMessage({ id: message.id, items });
  } catch (error) {
    port.postMessage({ id: message.id, status: error instanceof ServiceError ? error.status : 500,
      error: error instanceof ServiceError ? error.message : `Nie udało się przeszukać rozkładów ${KRAKOW_CITY.label}.` });
  }
});
void refresh();
