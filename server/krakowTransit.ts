import { Worker } from 'node:worker_threads';
import { KRAKOW_CITY, type ConnectionQuery, type TransitConnection, type TransitStop } from '../src/features/transit/contract.ts';
import { ServiceError } from './serviceError.ts';

type Pending = { resolve: (items: unknown[]) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> };
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const current = new Worker(new URL('./gtfsWorker.ts', import.meta.url));
  worker = current;
  current.on('message', (message: { id: number; items?: unknown[]; status?: number; error?: string }) => {
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); pending.delete(message.id);
    if (message.items) request.resolve(message.items);
    else request.reject(new ServiceError(message.status ?? 503, message.error ?? 'Nie można odczytać rozkładów ZTP.'));
  });
  const unavailable = () => {
    if (worker !== current) return;
    worker = null;
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new ServiceError(503, 'Usługa rozkładów uruchamia się ponownie. Spróbuj za chwilę.'));
    }
    pending.clear();
  };
  current.on('error', unavailable); current.on('exit', unavailable);
  return current;
}

function request<T>(kind: 'stops' | 'connections', query: string | ConnectionQuery): Promise<T[]> {
  const current = getWorker();
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      pending.delete(id); reject(new ServiceError(504, 'Wyszukiwanie rozkładu trwało zbyt długo. Spróbuj ponownie.'));
    }, 10_000);
    pending.set(id, { resolve: (items) => resolve(items as T[]), reject, timeout });
    current.postMessage({ id, kind, query, expires: Date.now() + 10_000 });
  });
}
export function startTimetable() { getWorker(); }
export function cities() { return [KRAKOW_CITY]; }
export function stops(cityId: string, query: string): Promise<TransitStop[]> {
  if (cityId !== KRAKOW_CITY.id) throw new ServiceError(400, 'Obsługujemy komunikację Krakowa i okolic.');
  return request('stops', query);
}
export function connections(query: ConnectionQuery): Promise<TransitConnection[]> {
  return request('connections', query);
}
