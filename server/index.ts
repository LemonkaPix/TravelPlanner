import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isConnectionQuery, isLabel } from '../src/features/transit/contract.ts';
import { cities, connections, startTimetable, stops } from './krakowTransit.ts';
import { ServiceError } from './serviceError.ts';

const origins = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081').split(',').map((origin) => origin.trim()));
const requests = new Map<string, { count: number; expires: number }>();
let inFlight = 0;

function send(response: ServerResponse, status: number, data: unknown) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
function rateLimit(request: IncomingMessage) {
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.expires <= now) requests.delete(key);
  // The reverse proxy must impose its own persistent per-client limits; forwarded
  // headers are deliberately not trusted by this local service.
  const ip = request.socket.remoteAddress ?? 'unknown';
  const entry = requests.get(ip) ?? { count: 0, expires: now + 60_000 };
  if (entry.count >= 40 || inFlight >= 8 || requests.size >= 10_000) throw new ServiceError(429, 'Zbyt wiele zapytań. Spróbuj za chwilę.');
  entry.count += 1;
  requests.set(ip, entry);
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ServiceError(415, 'Wymagany JSON.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_192) throw new ServiceError(413, 'Zbyt duże zapytanie.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ServiceError(400, 'Nieprawidłowy JSON.'); }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !origins.has(origin)) { send(response, 403, { error: 'Niedozwolone źródło zapytania.' }); return; }
  if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  let admitted = false;
  try {
    rateLimit(request);
    inFlight += 1;
    admitted = true;
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/cities') send(response, 200, { items: await cities() });
    else if (request.method === 'GET' && url.pathname === '/stops') {
      const cityId = url.searchParams.get('cityId');
      const query = url.searchParams.get('q')?.trim();
      if (!isLabel(cityId) || !query || query.length < 2 || query.length > 120) throw new ServiceError(400, 'Podaj miasto i nazwę przystanku.');
      send(response, 200, { items: await stops(cityId, query) });
    } else if (request.method === 'POST' && url.pathname === '/connections') {
      const query = await readBody(request);
      if (!isConnectionQuery(query)) throw new ServiceError(400, 'Nieprawidłowa trasa lub termin.');
      send(response, 200, { items: await connections(query) });
    } else send(response, 404, { error: 'Nie znaleziono zasobu.' });
  } catch (error) {
    const known = error instanceof ServiceError;
    send(response, known ? error.status : 500, { error: known ? error.message : 'Usługa połączeń jest niedostępna.' });
  } finally {
    if (admitted) inFlight -= 1;
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');

startTimetable();
