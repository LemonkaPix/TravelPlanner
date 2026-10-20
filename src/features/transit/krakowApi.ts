import {
  isConnection, isRecord, isStop,
  type ConnectionQuery, type TransitConnection, type TransitStop,
} from './contract';

const baseUrl = process.env.EXPO_PUBLIC_TRANSIT_API_URL?.replace(/\/$/, '');
export const transitConfigured = Boolean(baseUrl);

async function request<T>(
  path: string, body: unknown, validate: (value: unknown) => value is T, signal: AbortSignal,
): Promise<T[]> {
  if (!baseUrl) throw new Error('Wyszukiwanie nie jest jeszcze dostępne. Brakuje konfiguracji usługi połączeń.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error('Zbyt wiele wyszukiwań. Odczekaj chwilę i spróbuj ponownie.');
      const payload: unknown = await response.json().catch(() => null);
      if (isRecord(payload) && typeof payload.error === 'string' && payload.error.length <= 300) throw new Error(payload.error);
      if (response.status === 503) throw new Error('Rozkłady ZTP są chwilowo niedostępne. Spróbuj ponownie za chwilę.');
      throw new Error('Nie udało się pobrać danych. Spróbuj ponownie.');
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.items) || !payload.items.every(validate)) {
      throw new Error('Usługa zwróciła nieprawidłowe dane. Spróbuj ponownie później.');
    }
    return payload.items;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) throw new Error('Wyszukiwanie trwało zbyt długo. Spróbuj ponownie.');
    if (error instanceof TypeError) throw new Error('Nie można połączyć się z usługą. Sprawdź internet i spróbuj ponownie.');
    if (error instanceof SyntaxError) throw new Error('Usługa zwróciła nieprawidłowe dane. Spróbuj ponownie później.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export async function searchStops(cityId: string, query: string, signal: AbortSignal): Promise<TransitStop[]> {
  const items = await request(`/stops?cityId=${encodeURIComponent(cityId)}&q=${encodeURIComponent(query)}`, undefined, isStop, signal);
  if (items.some((stop) => stop.cityId !== cityId)) throw new Error('Usługa zwróciła przystanki z innego miasta. Ponów wyszukiwanie.');
  return items;
}
export async function getConnections(query: ConnectionQuery, signal: AbortSignal): Promise<TransitConnection[]> {
  const items = await request('/connections', query, isConnection, signal);
  if (items.some((item) => item.fromStopId !== query.from.id || item.toStopId !== query.to.id || item.arrival > query.arriveBy ||
      Date.parse(item.arrival) < Date.parse(query.arriveBy) - 24 * 60 * 60_000)) {
    throw new Error('Usługa zwróciła połączenia niezgodne z trasą lub terminem. Ponów wyszukiwanie.');
  }
  return items;
}
