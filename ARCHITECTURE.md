# TravelPlanner — architecture

React Native 0.88 / React 19.3 / Expo SDK 58 / Expo Router / TypeScript.
Local trip planner with manually entered connections. All user-facing copy is
Polish. There is no backend, provider API, timetable download or network search.

## Feature index and entry points

| Feature | Entry point | Responsibility |
| --- | --- | --- |
| Bootstrap/navigation | `package.json` → `expo-router/entry` → `src/app/_layout.tsx` | Plan (`index`), Edytor (`editor`), Ustawienia (`settings`); shared settings and calendar providers, dark theme |
| Planner | `src/app/index.tsx` → `src/features/planner/PlannerScreen.tsx` | Compact date header, upcoming trip, weekly/monthly calendar, single selected-day edit/add card, destination shortcuts for empty days, modal day editor, foreground clock refresh |
| Upcoming trip | `src/features/planner/UpcomingPlanPanel.tsx` → `calendar.ts:nextCalendarEntry` | Nearest saved arrival deadline, prominent leave time, destination and first ride; expandable full route with walking legs, arrival, buffer and edit action; incomplete migrated plans prompt completion |
| Day editor | `src/app/editor.tsx` & planner modal → `src/features/planner/PlanDayEditor.tsx` | Start/end saved-point selection supplies place names, stops and walking times; settings supply buffer; deadline, name, recurrence, manual connection, timeline, explicit save/delete |
| Manual connection | `src/features/planner/ManualConnectionFields.tsx` → `journey.ts` | Add/edit/remove up to 20 ordered legs: line/description, stops, departure/arrival dates and times; intermediate legs may be walking transfers |
| Plan calculation | `src/features/planner/plan.ts` | PlanInput, required fields, minutes validation, departure/destination calculations, persisted-plan guard, previous-plan conversion |
| Local journey model | `src/features/planner/journey.ts` | Label-only Stop, ManualLeg input, resolved ManualConnection/JourneyLeg, chronological and stop continuity validation, legacy stop-label conversion |
| Date/time | `src/features/planner/dateTime.ts` | Europe/Warsaw formatting/parsing; rejects nonexistent or ambiguous DST wall times; shared record/label guards |
| Calendar/recurrence | `src/features/planner/PlanCalendar.tsx`, `calendar.ts`, `RecurrenceFields.tsx` | Monday-first weekly strip with date/time and plan markers, expandable month with marker legend, today shortcut; selected-day summary lives below the calendar; lazy recurrence and next occurrence, calendar guards and migration |
| Plan storage | `src/features/planner/useStoredPlan.ts` | Shared calendar context, AsyncStorage v3, isolated per-date drafts, serialized explicit writes, cycle editing/deletion, additive import |
| Settings | `src/app/settings.tsx` → `src/features/planner/SettingsScreen.tsx` | Local start/end point CRUD in modals with typed stop names, common buffer, alarm preferences, file transfer and local-data information |
| Settings model/storage | `src/features/planner/settings.ts`, `StoredSettingsProvider.tsx` | Stable local point IDs, validation, AsyncStorage v3, hydration, serialized writes, read-only v2/v1 migration, missing-point restoration for imports |
| System alarms | `src/features/planner/AlarmSettingsSection.tsx`, `DayAlarmPanel.tsx` → `alarms.ts`, `systemAlarms.ts` | Preparation time and optional series; saved selected-day/editor preview plus separate handoff at the exact leave time; Android Clock intents with date safety guards; Expo Go creation guard; manual times on iOS/web |
| Saved point selection | `src/features/planner/SavedPointPicker.tsx` | Collapsed start/end dropdowns with settings shortcut; applied snapshots stay usable after catalog changes |
| Plan transfer | `src/features/planner/PlanTransferPanel.tsx` → `planTransfer.ts`, `planFiles.ts` / `planFiles.web.ts` | Versioned JSON export/import, preview, date-conflict skipping, missing-point restoration; native share sheet / browser download and system document picker |
| Forms/theme | `src/components/FormField.tsx`, `src/constants/theme.ts` | Accessible labelled fields, existing Nocturne Transit dark surfaces, typography, color and elevation tokens |
| Safe areas | `src/components/SafeAreaView.tsx` / `SafeAreaView.web.tsx`, `src/app/_layout.tsx` | Native safe-area-context; web CSS safe-area environment values; tab bar bottom/side insets and full-screen modal padding |
| Configuration | `app.json`, `package.json`, `tsconfig.json` | SDK-compatible dependencies, native Expo configuration, client-only web rendering (`web.output: single`); no API environment variables |
| App identity | `app.json` → `assets/icon.png`, `assets/favicon.png` | Nocturne Transit clock/route mark; shared iOS/Android launcher icon, Android adaptive masking and web favicon; design notes and generation prompt in `assets/README.md` |

## Data flow

`settings AsyncStorage → StoredSettingsProvider → start/end dropdowns → place/stop/walking snapshots + common buffer`.
`calendar AsyncStorage → selected occurrence / independent draft → selected-point snapshots + deadline/name/recurrence fields + manual legs`.
`manual legs → resolveConnection → calculatePlan → editor timeline / upcoming summary`.
`explicit save → validated anchored day/cycle → serialized AsyncStorage write`.
`persisted anchors + recurrence → lazy calendar occurrences (no expanded copies or network)`.
`persisted anchors → versioned JSON → native share sheet / browser download`.
`document picker → size/format/version/plan guards → import preview → missing settings points → additive calendar write`.
`saved selected occurrence + alarm preferences → preparation alarm series and exact leave-time alarm → preview → separate Android system Clock handoffs`.

The removed `server/` source, server package/lockfile, transit HTTP client/search
hooks, provider DTOs, stop search, automatic connection picker and `.env.example`
are no longer part of the application. Any pre-existing ignored `server/data/`
cache and `server/node_modules/` are unused local generated artifacts.
No runtime behavior depends on Kraków IDs, coordinates, platform codes or ZTP.
Read-only migration may retain an old platform code as part of a plain stop label.

## Manual plans and calculations

PlanInput has origin/destination, date (`DD.MM.YYYY`), arrival deadline (`HH:mm`),
bufferMinutes/walkToMinutes/walkFromMinutes integer strings (0–180), nullable
label-only fromStop/toStop, and a ManualLeg array. A leg stores label, from/to,
departureDate/departureTime, arrivalDate/arrivalTime, walking. Dates are explicit,
so overnight journeys can begin on the previous date. Each wall time must resolve
uniquely in Europe/Warsaw within 2000–2099.

The first and last legs must be rides. Their endpoint labels follow the plan's
stops; selecting a different saved point updates the endpoint leg labels. Intermediate stops
are editable; editing a shared stop also updates its adjacent leg. Every arrival is strictly after its departure; the next departure
cannot precede the previous arrival. Adjacent stop names must match after trimming;
a walk between different stops must be represented as an intermediate walking leg.
The resolved connection uses canonical UTC ISO strings for the existing timeline.
Nothing fetches, estimates or refreshes timetable times.

Target destination arrival = deadline − buffer.
Stop deadline = target destination arrival − walkFromMinutes.
Leave time = first departure − walkToMinutes.
Destination arrival = last arrival + walkFromMinutes and must meet the target.
The common settings buffer initializes a fresh day and is also applied when a
saved point is selected. Existing plan snapshots remain independent of settings.
Saving requires a complete feasible manual connection and valid name/recurrence.
Migrated plans may have an empty leg array until the user completes them; they
remain visible in the calendar and show completion guidance in the summary.

## Calendar, lifecycle and persistence

CalendarDays maps anchored dates to CalendarDay { plan, name, recurrence }.
Names are optional up to 80 characters. Recurrence is null or an interval string
1–99 with unit day/week/month/year. There is one plan per date. Explicit anchors
win collisions; otherwise the latest matching source anchor wins. Monthly/yearly
missing dates are skipped. Calendar arithmetic uses UTC noon; form/calculation
times use Warsaw. Navigation is bounded to 2000–2099.

Occurrences shift the plan date and every manual leg date by the calendar-day
difference while preserving wall times, including overnight day offsets. DST
validation is rerun for each occurrence. Editing/saving a recurring occurrence
changes the whole source cycle and validates its original anchor before writing.
Deleting removes the whole cycle; disabling recurrence replaces it with one plan
on the edited date. Draft recurrence never expands into other days.

`useStoredPlan` reads `travelplanner.calendar.v3`. If absent, it converts calendar
v2 then v1, or falls back to plan v3/v2/v1. Old names, terms, point labels, walks,
buffer and cycles are retained. Old departure-only preferences cannot reconstruct
full connections, so migrated leg arrays start empty. Incomplete old standalone
plans stay drafts. Present invalid new storage does not fall back to older data.
Older keys are never deleted or automatically rewritten.

Persisted anchors and in-memory per-date drafts are separate. Closing an editor
keeps its draft until relaunch. Saving/deleting one day does not write unrelated
drafts. Writes are explicit and serialized; only successful writes replace the
persisted snapshot and clear that day's draft. Failure retains both the draft and
prior snapshot. Hydration and writes block dependent editing. The planner opens
the shared day editor in a full-screen Modal, with keyboard/safe-area/back support;
successful save/delete closes it. The Edytor tab uses the same component.

The upcoming summary resolves the nearest saved future arrival deadline, including
cycles, and calculates directly from its manual connection. It is independent of
the selected day and of later point catalog changes. It never writes storage.
Clock updates every 15 seconds and on foreground resume; elapsed leave times are
labelled. A plan disappears from the upcoming slot after its arrival deadline.
The planner prioritizes the leave time, arrival deadline, destination and first
boarding. Route details are collapsed by default; expanding them reveals all
ride/walking legs, endpoint walks, destination arrival, spare time and editing.
Without an upcoming plan, the panel directs users to the calendar; adding a plan
uses the selected-day card, without a duplicate action in the empty summary.
The calendar has no duplicate selected-day banner; its single summary card opens
the shared editor. Destination shortcuts appear only when the selected day has
no saved plan or draft. These display choices do not change stored plans.

PlannerSettings has startPoints/endPoints, common bufferMinutes and alarm preferences. Each SavedPoint
has a stable ID, name (nonblank, up to 120 chars), Stop { label } (nonblank, up to
240 chars), and walkMinutes (0–180). IDs are unique across both lists.
`StoredSettingsProvider` reads `travelplanner.settings.v3`, falling back read-only
to v2 then v1, converting old stops to labels and adding default alarm preferences.
Invalid present v3 data never falls back to old data. Add/edit/delete/buffer/alarm actions serialize
explicit writes; failure retains editable input and the prior catalog. Catalog
changes never mutate saved plan snapshots. Point forms use typed names and have
no search lifecycle or server availability state.

## System alarms

`AlarmSettingsSection` saves preparationMinutes (1–720), seriesEnabled, count
(2–10 including the last alarm) and intervalMinutes (1–180). Series-only numbers
are validated when enabled; the series span must be shorter than 24 hours.
Defaults are 60 minutes, series off, 2 alarms and a
30-minute interval. The last alarm is leave time minus preparation; earlier alarms
precede it by equal intervals, so the full preparation time remains available.
The settings example uses an 08:00 departure. Existing v2/v1 settings retain their
points and buffer and receive these defaults without writing until an explicit save.

`DayAlarmPanel` appears below the saved selected-day card and in a saved day editor.
Drafts require saving first. Each occurrence is handled independently even for a
recurring plan: alarms do not repeat. The preview uses Europe/Warsaw and includes
dates when alarms fall before the plan day. Clock extras use device-local hours.

On Android, `systemAlarms` dynamically imports expo-intent-launcher and sends
`android.intent.action.SET_ALARM` sequentially with integer HOUR/MINUTES, a dated
label, vibration and SKIP_UI; no DAYS extra is sent. If Clock stays open, returning
continues the series. `SHOW_ALARMS` opens Clock for checking and managing alarms.
`app.json` declares `com.android.alarm.permission.SET_ALARM`. The native binary
must be rebuilt to include the dependency and permission; generated native files
are not edited. No notification permission, scheduler or custom ringing service
is used. Expo's integer-extra conversion is required: RN Linking.sendIntent sends
numbers as Doubles, which are incompatible with the Clock hour/minute extras.

`systemAlarmCreationIssue` separates alarm creation from opening Clock. Expo Go
is detected with `Constants.expoVersion` from the existing expo-constants
dependency; SDK 58's `ExecutionEnvironment.StoreClient` also includes development
builds, so it must not be used to exclude them. In Expo Go, the create button is
disabled with an explanation that project permissions cannot be added to the
installed host. Preview and `SHOW_ALARMS` remain available for manual entry.
Native permission denials, missing IntentLauncher and missing Clock handlers
receive distinct messages, rather than suggesting that every error means Clock
is absent. No automatic retries can duplicate a partially handed-off series.
`README.md` documents a local `npx expo run:android --device` build, its Android
toolchain prerequisites and plan transfer from Expo Go's separate local storage.

The standard Clock intent has no date parameter. Every requested alarm must be
in the future and equal the next occurrence of its hour/minute in the device's
timezone (usually within 24 hours). The whole series is checked before dispatch,
and each alarm again immediately before its intent. Ambiguous wall times during
a device-timezone DST overlap are rejected. Later dates and elapsed
alarms remain previews with an explanation; they are never silently scheduled
for an earlier day. No pending future handoff is stored. On iOS/web, creating
alarms in the system Clock is unavailable through this integration; the preview
and explicit manual-setting guidance remain visible.

Clock provides no reliable creation confirmation or alarm IDs. Completion reports
handoffs, failures report how many were handed off, and concurrent handoffs are
blocked. The app does not claim to know whether an alarm remains enabled. Editing
or deleting plans/preferences does not change alarms already handed off: users
manage them in Clock. Alarm preferences are local settings, excluded from plan
import/export; alarms themselves are owned by Clock, not persisted by this app.

## Import/export

Exports contain `format: travelplanner-plans`, `version: 2`, `days: CalendarDays`,
including complete manual legs, names and recurrences; drafts and unrelated
settings are excluded. Version 1 imports convert old plans to empty manual legs,
and the preview explains that connections need completing. Unknown versions fail.

Import rejects files over 8 MB before reading and JSON over 2 million UTF-16 code
units; every entry is guarded before any write. Confirmation adds only anchors
absent from both saved days and drafts; repeats/conflicts are skipped. Existing
anchor/cycle collision rules apply without expanding recurrences. Missing points
are restored to settings using exact name/walk/stop matches and unique IDs.
Settings are written before the calendar; if calendar persistence fails, added
points may remain and retry reuses them. A settings failure prevents calendar save.

Native export reuses one cached JSON for share recipients; web uses timestamped
filenames and revokes object URLs. Import uses the system document picker, removes
native picker copies after reading and revokes web picker object URLs. Transfer
operations and hydration prevent duplicate/dependent actions.

## Dependencies and verification

Native configuration belongs in `app.json`; generated ios/android files are not
edited. New Expo/React Native dependencies must use `npx expo install` and SDK 58
documentation. File transfer retains expo-document-picker, expo-file-system and
expo-sharing. The sharing plugin disables incoming-sharing features. System Clock
handoff adds expo-intent-launcher (~58.0.3) via `npx expo install`, using SDK 58
documentation. Backend-only packages were removed with the separate server
package/lockfile.

The launcher icon is an opaque 1024×1024 PNG with square corners and a central
clock/route mark in pale blue and mint on navy. Android adaptive icons reuse the
same opaque artwork as the foreground, with navy behind it and generous margins
for system masks; there is no separate transparent or monochrome layer. Web uses
a 64×64 PNG favicon derived from the launcher icon. Launcher changes require a
new native build/install; no generated native files are maintained here.

Do not run tests, linters, builds, typechecks or automated verification without an
explicit user request. This change uses static source review with code-reviewer;
no automated or interactive app verification was run.
