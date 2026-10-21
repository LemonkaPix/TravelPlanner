# TravelPlanner — architecture

React Native / Expo SDK 57 / Expo Router / TypeScript. Plans daily trips in Kraków
and its KMK surroundings, using free official ZTP GTFS schedule data. No provider
account, API key, private secret or paid journey-planning service is needed.

## Feature index and entry points

| Feature | Entry point | Responsibility |
| --- | --- | --- |
| Bootstrap/navigation | `package.json` → `expo-router/entry` → `src/app/_layout.tsx` | Expo Router bottom tabs: Plan (`index`, default) / Ustawienia (`settings`), shared settings provider, status bar, background |
| Planner | `src/app/index.tsx` → `src/features/planner/PlannerScreen.tsx` | Upcoming-trip summary above the calendar; day tap opens the full-screen native modal editor; clock and foreground refresh |
| Upcoming trip | `src/features/planner/UpcomingPlanPanel.tsx` → `calendar.ts:nextCalendarEntry` | Nearest saved day/cycle occurrence; fresh route lookup, preferred departure, leave time, lines/boarding times, destination/deadline and editor shortcut |
| Day editor | `src/features/planner/PlanDayEditor.tsx` | Optional day name, saved points, arrival time, course choice, departure timeline; explicit save/delete and return to calendar |
| Recurrence | `src/features/planner/RecurrenceFields.tsx` → `src/features/planner/calendar.ts` | None or every 1–99 days/weeks/months/years; shared cycle editing/deletion and lazy occurrence resolution |
| Calendar | `src/features/planner/PlanCalendar.tsx`, `src/features/planner/calendar.ts` | Monday-first Polish month grid, selected/today states, day names, arrival-time, recurrence and saved/draft markers; day model/guard and timezone-independent calendar arithmetic |
| Settings | `src/app/settings.tsx` → `src/features/planner/SettingsScreen.tsx` | Compact start/end lists with right-aligned edit/delete icons; add/edit opens a modal form with ZTP StopPicker; separately saved common buffer |
| Settings model | `src/features/planner/settings.ts` | Local stable point IDs, names, stops, walking minutes, common buffer; runtime validation and defaults |
| Settings storage | `src/features/planner/StoredSettingsProvider.tsx` | Shared context/hook, separate AsyncStorage v1, hydration, serialized explicit writes, missing-point restoration for imported plans, errors |
| Saved point selection | `src/features/planner/SavedPointPicker.tsx` | Collapsed dropdowns with selected point details, scrollable options and empty-list guidance in planner |
| Plan logic | `src/features/planner/plan.ts` | Required fields, walking/buffer validation, Warsaw times, calculations, v1/v2 migration |
| Proposals | `src/features/planner/ConnectionPicker.tsx` | Automatic search for the selected day; up to three selectable courses, restored departure preference, schedule age/transit/estimated transfer legs |
| Stop search | `src/features/transit/TransitFields.tsx` | Debounced platform search, code/name selections, errors/retry |
| Mobile HTTP client | `src/features/transit/krakowApi.ts` | Cancellable proxy JSON requests, timeout, runtime guards, Polish errors |
| Async lifecycle | `src/features/transit/useTransitSearch.ts` | Query tags, cancellation, debounce, retry, suppression of obsolete results |
| Shared contract/time | `src/features/transit/contract.ts` | DTOs/guards, KRAKOW_CITY, namespaced platform IDs, Warsaw display/form parsing |
| Storage | `src/features/planner/useStoredPlan.ts` | Calendar AsyncStorage v2, independent editor drafts, day/cycle save/delete, departure preference; read-only migration from calendar v1 and plan v3/v2/v1 |
| Plan export/import | `src/features/planner/PlanTransferPanel.tsx` → `planTransfer.ts`, `planFiles.ts` / `planFiles.web.ts` | JSON export of saved anchors/cycles, validated additive import with preview, date-conflict skipping and missing saved-point restoration |
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

`calendar AsyncStorage → selected-day draft → validatePlan → connectionQuery → krakowApi → HTTP server`.
`settings AsyncStorage → StoredSettingsProvider → settings editor / saved point picker`.
`calendar day tap → modal editor → resolved occurrence / draft → PlanInput + preferred departure → validation/search`.
`persisted anchors + recurrence rules → calendarEntry → visible calendar occurrences (no network requests)`.
`persisted anchors → versioned JSON → native share sheet / browser download`.
`system file picker → size/format/version/calendar guards → import preview → missing points in settings → merged calendar persistence`.
`persisted anchors → nextCalendarEntry → saved occurrence + current saved-point match → cancellable connections lookup → calculatePlan → compact summary`.
`explicit point selection → selected day’s PlanInput fields + common buffer → existing plan validation/search`.
`official GTFS ZIPs → background worker import/cache → complete timetable snapshot`.
`worker stop search / backward routing → guarded JSON → restored departure / manual proposal selection → calculatePlan → timeline`.

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

The selected calendar day and its arrival time denote arrival at the labelled destination. All display/form
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
fromStop/toStop, walkToMinutes/walkFromMinutes/bufferMinutes strings. A `CalendarDay`
adds a name (optional, at most 80 characters), nullable `preferredDeparture`
(canonical UTC ISO) and nullable `recurrence` (`unit`: day/week/month/year;
`interval`: an integer string from 1 to 99). `CalendarDays` stores anchored entries
keyed by DD.MM.YYYY. Runtime guards validate every field, the complete PlanInput,
key/date agreement, recurrence and departure timestamp.

`useStoredPlan` hydrates `travelplanner.calendar.v2`. Persisted anchors and in-memory
per-date drafts are separate. Closing an editor keeps its draft until relaunch;
saving another day never implicitly writes unrelated drafts. Writes are explicit
and serialized. A successful write updates the persisted snapshot and clears only
the saved draft; a failed write retains both draft and prior snapshot. Input and
editor closing are disabled while saving. No automatic migration writes occur.

The Plan tab initially shows a compact upcoming-trip panel above the monthly
calendar and any storage/migration notice. The panel resolves the nearest valid
saved arrival deadline still in the future, including repeating occurrences.
Unsaved drafts and the calendar's selected date do not affect its choice.
`nextCalendarEntry` jumps arithmetically to the next candidate per recurrence,
respects the same collision rules as the grid and skips expired/invalid wall times
without expanding an entire cycle. Monthly/yearly missing dates are skipped.
Once a planned arrival passes, the next clock update selects the following plan.

The panel automatically fetches current proposals for that one occurrence when
its saved points still match the settings catalog. It restores the preferred
departure or uses the latest feasible proposal when none was stored. An unavailable
saved course produces an explicit message, never a silently substituted departure.
Leave time uses the existing walking/buffer calculations. The panel shows the
plan name/date, leave time, each vehicle leg's boarding time/line/direction and
platform, final named destination, planned deadline and calculated destination
arrival. Cross-midnight departures include their dates. It labels elapsed leave
times and schedule-only data; loading, empty/error/retry and changed-point states
have Polish guidance. Missing upcoming plans show guidance to add one.

The clock updates every 15 seconds. Returning to the foreground refreshes both
the clock and the panel's query tag. The panel reuses the cancellable/timeout-aware
HTTP search hook; late responses cannot overwrite a changed route or foreground
refresh. Opening an editor unmounts the panel and cancels its search, avoiding
competing searches; closing the editor mounts a fresh summary. The summary never
writes plans, departure preferences or storage. Its shortcut opens the same day
editor as a calendar tap. No day form or full timeline is mounted on the landing
screen.
A day tap opens `PlanDayEditor` in a full-screen React Native Modal, with keyboard
avoidance, safe-area insets, Android back handling and a return-to-calendar button.
Successful save/delete closes the editor; failures leave it open for retry.
The calendar displays Polish months, Monday-first weeks, today's outline, the
selected day, optional names, arrival times, cycle marks and saved/draft dots.
The today button changes the visible month without opening an editor. Navigation
is bounded to 2000–2099. Empty days start at 09:00 with no route or recurrence.
Calendar arithmetic uses UTC noon; arrival validation/search uses Warsaw time.

Occurrences are resolved lazily by `calendarEntry`; no expanded copies of an
unbounded cycle are stored or searched. Daily and weekly rules count calendar
days; monthly rules preserve the day of month, yearly rules preserve month/day.
Missing dates are skipped (31st in short months, February 29 in non-leap years).
Rules start on the anchor and have no end before the supported 2099 boundary.
Explicitly anchored days win collisions; otherwise the latest matching anchor wins.
The calendar resolves persisted cycles and overlays drafts only on their edited
dates; an unsaved recurrence does not populate future dates.

Opening any occurrence resolves its own date and Warsaw arrival/departure times.
Preferred departure dates retain their day offset relative to destination arrival,
including departures before midnight; wall times are shifted using Warsaw parsing,
not a fixed UTC offset. An unshiftable DST departure stays unmatched so the picker
requires a new course. Editing/saving a recurring occurrence changes its whole
source cycle, retaining the original anchor date; deleting removes the whole cycle.
The editor explicitly labels this scope and the source date. Disabling recurrence
replaces the cycle with one plan on the selected date, explained in the form.
Anchor validation runs before persistence; DST-invalid anchor edits cannot be saved.

A chosen connection is required by the save UI. Only its departure preference is
persisted, not a cached timetable or connection object. Opening the editor searches
fresh proposals and restores the matching departure. Without a preference the
latest feasible departure is selected. If a saved departure is absent, the UI
requires choosing another course instead of silently replacing it. Up to three
alternatives are visible/selectable. This calendar/editor flow uses the existing
backend/API contracts; native generated projects and navigation routes are unchanged.

Settings are independent of the saved plan: `PlannerSettings` holds `startPoints`,
`endPoints` and a `bufferMinutes` string. Each `SavedPoint` has a stable local `id`,
`name` (nonblank, at most 120 characters), a `TransitStop` and a `walkMinutes` string.
Walking and buffer minutes share the plan's integer-string validation (0–180).
Reads and writes validate the complete settings snapshot, unique nonempty IDs and
the existing `isStop` guard (including the supported Kraków city and ZTP namespace).
No complete plan is needed to save settings. No backend/API contracts changed.

`StoredSettingsProvider`, mounted above both bottom tabs, hydrates once from
`travelplanner.settings.v1`; defaults are empty lists and 10 minutes of buffer.
Hydration blocks editing/point application. Invalid JSON, invalid settings and
storage read failures show a Polish notice without deleting or rewriting the entry.
An explicit later settings save can replace it, as explained in the notice.
Each point add/edit/delete and buffer save writes a snapshot explicitly; concurrent
writes are blocked and context updates only after successful persistence. Write
failure retains both the previous catalog and the editable draft for retry.
Settings changes never write `travelplanner.calendar.v2` or change day/cycle snapshots.

The Plan tab includes an export/import panel below the calendar. JSON files have
`format: "travelplanner-plans"`, `version: 1` and `days: CalendarDays`; they contain
only saved anchors, including names, complete plan snapshots, recurrence and
preferred departures. Drafts and unrelated settings are excluded. Export uses
the native share sheet on iOS/Android and a JSON download in browsers. Native
export reuses one cached `travelplanner-plany.json`, retained for receiving apps
that read it after the share sheet closes. Browser exports use timestamped names
and revoke temporary object URLs after download initiation.

Import uses the system document picker, rejects files over 8 MB before reading,
limits JSON text to 2 million UTF-16 code units, checks the format/version and
validates every calendar entry before offering a preview. Invalid files cause no
writes; unknown versions are rejected. Confirmation adds only anchors whose dates
are absent from both saved anchors and drafts. Conflicting dates are counted and
skipped, including repeated imports; existing snapshots and drafts are retained.
Overlapping recurrences use the existing explicit-anchor/latest-cycle rules,
explained in the preview. No recurrence is expanded during transfer.

Before writing imported calendar entries, `StoredSettingsProvider.addPlanPoints`
uses `settingsWithPlanPoints` to add missing origin/destination points from those
entries. Exact name, walking minutes and serialized stop matches are reused;
new IDs are unique across both lists. Existing points and common buffer remain
unchanged. The settings write precedes the calendar write so imported routes can
resolve immediately on a new device. These are separate storage entries: if the
calendar write fails, added points may remain; the error explicitly explains this
and retry reuses them. Settings failure prevents the calendar write. Import uses
the same synchronous calendar write lock as day saves/deletes. Transfer operations
block planner editing and duplicate transfer actions; hydration/settings writes
disable transfer actions. Canceled file selection performs no writes. Native
picker copies are deleted after reading; browser picker object URLs are revoked.

Settings initially show compact point rows with edit/delete icon buttons on the
right and an add button below each list. Add/edit opens a full-screen React Native
modal containing the form; cancel closes it, successful persistence closes it and
shows a confirmation on the list, and failed writes leave the form/draft open.
Closing is disabled while saving. Stop search is mounted only while editing.

The day editor exposes saved start/end point dropdowns and an arrival time. Dropdowns
initially show the point matching that day's name, platform and walking minutes,
so reopened days do not require selecting points again. Opening a dropdown reveals
a bounded scrollable list; selecting an option closes it. Empty catalogs disable
the dropdown and direct users to settings. Options copy `name` to
`origin`/`destination`, `stop` to `fromStop`/`toStop`, and `walkMinutes` to
`walkToMinutes`/`walkFromMinutes`, set the supported city and apply the common buffer.
Changes clear that day's departure preference. Once both current catalog points
match and the deadline is valid, search starts automatically. Query changes hide
obsolete connections and remount the proposal picker; day switches also clear the
visible connection before loading that day's fresh results.
Applying a point again uses its latest saved data; catalog edits/removal do not
mutate previously applied snapshots. If a matching point changes or is removed,
its dropdown selection and connection query become inactive until a current point
is selected again, preventing disagreement between point details and route data.
Both routes remain in `src/app/`; feature code stays in `src/features/planner/`.
Expo Router's installed JavaScript tabs require no new dependencies. The tab bar
handles the bottom safe area; screens handle top/side insets and keyboard avoidance.

Load calendar v2 first. If absent, migrate calendar v1 with blank names and no
recurrence, preserving every saved day. If neither calendar exists, read plan v3,
v2 (Jakdojade), then v1 (manual travel duration), wrapping it as one calendar entry.
Valid v3 plans join the in-memory persisted snapshot; incomplete provider migrations
remain drafts. The legacy plan date is selected in the calendar without opening
its editor. Old entries are never rewritten/removed. Invalid present calendars do
not fall back to stale older keys. The first explicit write persists the v2 snapshot.
v2 preserves labels/date/time/walking/buffer but clears both provider-specific
stops and sets Kraków. v1 also defaults each walk to 5 min and discards manual
travelMinutes. Both require new platform selection and explicit save. Older
entries are never removed; read/parse errors leave them intact. Hydration blocks
editing and a saved snapshot cannot overwrite edits made during a save.

Stop search waits 350 ms after at least 2 characters. Connection search starts
inside the opened editor or the upcoming-trip panel when both current saved
points and a valid deadline are available. Query tags hide
obsolete results immediately; effect cleanup and AbortController cancel old
searches. A changed route/deadline hides selection and remounts the proposal
picker. Network failure, loading, empty results and retry are in Polish.

## Deployment, dependencies and verification

The backend requires Node 24 and its own npm install. Plan transfer adds SDK 57
compatible `expo-document-picker`, `expo-file-system` and `expo-sharing`, installed
with `npx expo install`. The sharing config plugin is registered in `app.json`
with its default incoming-sharing features disabled; no native generated files
are edited. Implementation follows the SDK 57 DocumentPicker, FileSystem and
Sharing documentation at `https://docs.expo.dev/versions/v57.0.0/sdk/`.
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
Settings CRUD, relaunch persistence, tab navigation and point application were
reviewed in source only; app launch, interactive checks and automated verification
were not run for the settings implementation.

Upcoming-trip summary, calendar/modal editing, names, recurrence, day/cycle persistence,
course selection, migration and deletion were reviewed statically with the
code-reviewer skill. Tests, lint, typechecks, builds and
interactive verification were not run, per project instructions.

Plan export/import and saved-point restoration were reviewed statically with the
code-reviewer skill. Tests, lint, typechecks, builds and interactive verification
were not run, per project instructions.
