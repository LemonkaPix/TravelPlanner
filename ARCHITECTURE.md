# TravelPlanner — architecture

React Native / Expo SDK 57 / Expo Router / TypeScript. Plans one trip in Kraków
and its KMK surroundings, using free official ZTP GTFS schedule data. No provider
account, API key, private secret or paid journey-planning service is needed.

## Feature index and entry points

| Feature | Entry point | Responsibility |
| --- | --- | --- |
| Bootstrap | `package.json` → `expo-router/entry` → `src/app/_layout.tsx` | Router, status bar, background |
| Planner | `src/app/index.tsx` → `src/features/planner/PlannerScreen.tsx` | Polish form, fixed Kraków area, timeline, explicit save |
| Plan logic | `src/features/planner/plan.ts` | Required fields, walking/buffer validation, Warsaw times, calculations, v1/v2 migration |
| Proposals | `src/features/planner/ConnectionPicker.tsx` | Explicit search/refresh, selection, schedule age, transit and estimated transfer legs |
| Stop search | `src/features/transit/TransitFields.tsx` | Debounced platform search, code/name selections, errors/retry |
| Mobile HTTP client | `src/features/transit/krakowApi.ts` | Cancellable proxy JSON requests, timeout, runtime guards, Polish errors |
| Async lifecycle | `src/features/transit/useTransitSearch.ts` | Query tags, cancellation, debounce, retry, suppression of obsolete results |
| Shared contract/time | `src/features/transit/contract.ts` | DTOs/guards, KRAKOW_CITY, namespaced platform IDs, Warsaw display/form parsing |
| Storage | `src/features/planner/useStoredPlan.ts` | AsyncStorage v3; explicit snapshots; read-only migration from v2/v1 |
| HTTP server | `server/index.ts` | Node 24 HTTP entry, validation, CORS allowlist, request/concurrency limits |
| Worker client | `server/krakowTransit.ts` | GTFS worker lifecycle, request correlation, 10 s timeout, restart after worker exit |
| Timetable worker | `server/gtfsWorker.ts` | Background refresh, atomic snapshot swap, local stop search and routing |
| GTFS import | `server/gtfsImport.ts` | Official HTTPS ZIP downloads/cache, bounded streaming ZIP/CSV parsing, calendar/trip/stop normalization |
| GTFS types | `server/gtfsTypes.ts` | Internal timetable, service calendars, exceptions, stop events and transfer rules |
| Journey search | `server/gtfsRouter.ts` | Backward rounds, active service days, up to two transfers, three departure alternatives |
| Server errors | `server/serviceError.ts` | Known status/Polish error messages without leaking raw importer failures |
| Shared form/tokens | `src/components/FormField.tsx`, `src/constants/theme.ts` | Accessible labelled fields and visual styles |
| Configuration | `.env.example`, `server/.env.example`, `server/package.json`, `server/tsconfig.json`, `tsconfig.json`, `app.json` | Public backend URL, optional HTTP settings, isolated Node types, native Expo configuration |

## Source data and responsibility boundary

Official free, unauthenticated source: https://gtfs.ztp.krakow.pl/:
- `GTFS_KRK_A.zip`: MPK buses.
- `GTFS_KRK_M.zip`: Mobilis buses.
- `GTFS_KRK_T.zip`: trams.

These are GTFS schedule archives, **not** a hosted REST journey planner. Our Node
backend imports them and provides a small JSON API to the mobile/web client.
Jakdojade XML, Basic Auth, credential variables and fast-xml-parser were removed.
There is no dependency on Transitous or another public routing service.

Documentation: https://gtfs.org/documentation/schedule/reference/;
https://ztp.krakow.pl/dane-otwarte. The source ZIP headers/sample rows were inspected
during implementation. The three agency.txt files explicitly use Europe/Warsaw.
The inspected feeds have calendar_dates exceptions, individual stop codes, full
stop times and no transfers.txt/frequencies.txt; stop IDs differ across feeds.

## Data flow and API

`AsyncStorage → form → validatePlan → connectionQuery → krakowApi → HTTP server`.
`official GTFS ZIPs → background worker import/cache → complete timetable snapshot`.
`worker stop search / backward routing → guarded JSON → explicit selection → calculatePlan → timeline`.

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /cities` | none | `{ items: [KRAKOW_CITY] }`, compatibility endpoint; no city selector in UI |
| `GET /stops` | cityId=KRAKOW, q (2–120 chars) | Up to 20 named platforms matching normalized name/code |
| `POST /connections` | ConnectionQuery { cityId, from/to stop objects, arriveBy UTC ISO } | Up to 3 TransitConnection objects |

Successful envelopes are `{ items: [...] }`; errors are `{ error: string }`.
503 indicates cold import, unavailable/expired data, or a worker restart; 422
indicates a date outside any required feed's published service-date range; 400
includes removed/unknown platform IDs; 429 is a request limit; 504 is worker timeout.
The client shows these known Polish backend messages and offers retry.

TransitStop: id, label, cityId, optional code (nullable), coordinate (`lat:lon`).
IDs are `KRAKOW:ZTP:<stop_code>`; without a code use `KRAKOW:ZTP:@<coordinate>`.
Source stop_id values are mapped within each feed; shared ZTP platform codes
merge a physical stop across operators. Requests resolve IDs against the current
canonical timetable; caller-supplied names/coordinates do not control routing.

TransitConnection: id, fromStopId, toStopId, departure, arrival, legs,
scheduleUpdatedAt. Timestamps are canonical UTC ISO strings. Each leg has label,
from/to labels (including platform codes), full times and a walking flag. The
snapshot timestamp is the oldest archive's successful download/cache timestamp,
not a claim about real-time data or the provider's last schedule edit.

Only typed stop queries, selected stops and a stop arrival deadline go to our
backend. Home/university descriptions stay on the device. ZTP receives only
periodic archive downloads; no user queries or personal labels are forwarded.

## Import/cache lifecycle

The HTTP server starts the GTFS worker without waiting for import. A cold search
gets a retryable 503 rather than blocking for archive downloads. The worker parses
CSV records from selected ZIP entries using csv-parse and yauzl; shapes are skipped
and ZIP entries are never extracted to filesystem paths. Downloads have a 60 s
limit and 40 MB compressed cap per archive; selected entries are capped at 220 MB,
CSV records at 16 KiB and rows at 3 million/file. URLs are fixed official HTTPS
endpoints; no credentials or arbitrary upstream URLs are accepted.

`server/data/` is an ignored generated ZIP cache. Validated downloads replace
cached archives; a malformed cached file is discarded for the next import retry.
Cache downloads are reused for 6 h; failed network downloads may use a cached
archive younger than 24 h. A complete import and transfer graph replace the old
in-memory snapshot together. Partial imports never become queryable. Refresh is
scheduled after 6 h on success, or after 1 minute on failure. Previously imported
data remains queryable only while the oldest download is younger than 24 h.

Use one process per cache directory. Keep the server running for refreshes. The
initial download/import may take minutes, and schedules need substantial memory
(the inspected archives contain approximately 150 MB of stop_times CSV in total).
No import, app/server launch or routing checks were run as part of implementation.

## Routing and time semantics

The form's date/time denotes arrival at the labelled destination. All display/form
parsing uses Europe/Warsaw, independently of the device timezone.
Stop deadline = planned arrival − buffer − walkFromMinutes.
Leave home = selected platform departure − walkToMinutes.
Destination arrival = selected platform arrival + walkFromMinutes; it must not
exceed planned arrival − buffer. Walking/buffer fields accept 0–180 minutes.
Reaching the initial platform coincides with departure; the safety buffer is at
the final destination. Past plans remain labelled and are not rolled forward.

Calendar weekly flags and calendar_dates additions/removals determine active
services. GTFS event seconds use agency-local noon minus 12 hours as the service
day anchor, including DST transitions. Times 24:00–47:59:59 remain on their
originating service day. Candidate instances include the deadline day and two
preceding service days. Form wall times that are missing/ambiguous at DST changes
are rejected; GTFS event times already have an unambiguous service-day anchor.

Search runs backward for 1, 2 and 3 vehicle rides (at most 2 transfers), maximizing
departure time while meeting the deadline. Rounds read only the preceding round;
trip iteration order cannot create extra transfers. Boarding/alighting require
normal pickup/drop-off (conditional/reservation-only events are excluded). Three
runs with successively earlier origin departure cutoffs produce up to three
alternatives with distinct departure times. The search horizon is 24 h. These are
bounded local proposals, not a complete Pareto set or a street-network router.

Same-platform transfers reserve at least 2 min. Between differently coded
platforms in the same named ZTP code group, within 400 m straight-line distance,
walking is estimated at 1.2 m/s with at least 3 min walking plus 1 min before
boarding. These walking legs are visibly labelled as estimates; street crossings,
accessibility and actual pedestrian routes are not mapped. If transfers.txt is
supplied, explicit minimums/prohibitions are applied conservatively (any
prohibition wins). Trip/route-specific or in-seat transfer rules and frequency
services are rejected on import rather than silently ignored. Missing event times,
non-monotonic trips, unknown references and unsupported timezones fail import.

## Persistence and UI lifecycle

PlanInput contains origin/destination labels, date/time strings, fixed city,
fromStop/toStop, walkToMinutes/walkFromMinutes/bufferMinutes strings. Explicit save
writes a valid snapshot to `travelplanner.plan.v3`. Selected timetable connections
are session-only and must be searched again after reopening. Saving configuration
does not require a chosen connection. No automatic writes happen during migration.

Load v3 first; if absent, read v2 (Jakdojade) then v1 (manual travel duration).
v2 preserves labels/date/time/walking/buffer but clears both provider-specific
stops and sets Kraków. v1 also defaults each walk to 5 min and discards manual
travelMinutes. Both require new platform selection and explicit save. Older
entries are never removed; read/parse errors leave them intact. Hydration blocks
editing and a saved snapshot cannot overwrite edits made during a save.

Stop search waits 350 ms after at least 2 characters. Connection search is explicit.
Query tags hide obsolete results immediately; effect cleanup and AbortController
cancel old searches. A changed route/deadline clears selection and remounts the
proposal picker. Network failure, loading, empty results and retry are in Polish.

## Deployment, dependencies and verification

The backend requires Node 24 and its own npm install; app dependencies are unchanged.
Server-only packages: csv-parse, yauzl, @types/node, @types/yauzl with separate lockfile.
HTTP configuration is optional: HOST (default loopback), PORT (3001), ALLOWED_ORIGINS
(default http://localhost:8081). Root TypeScript excludes server/node_modules/native
projects; the Node config uses ES2023 libs and native erasable TypeScript syntax.

The app requires only EXPO_PUBLIC_TRANSIT_API_URL pointing to your hosted backend;
free data does not provide free hosting. Use HTTPS for phone/web deployment and
appropriate edge limits. Built-in limits are 40 requests/min/socket IP and 8
concurrent HTTP requests. CORS is a web-origin restriction, not authentication.
Forwarded IP headers are not trusted. Worker requests time out after 10 s; mobile
HTTP requests after 15 s. No location permissions, notifications or live delay
predictions are used. Public GTFS-RT files are intentionally outside this scope.

Do not run tests, linters, builds, typechecks or other automated verification unless
explicitly requested. Changes were reviewed statically; calculation/calendar,
midnight/DST, transfers, migration and importer/API tests remain deferred. Read
and update this map before future module/configuration/contract/data-flow changes.
