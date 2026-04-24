# AutoMate v2 — Implementation Guide

This document defines the phased build plan for AutoMate. Each phase must be completed and verified before starting the next. The full product specification is in `docs/PRD.md` — consult it for any product decisions not covered here.

Complete each phase in order. Do not skip ahead. After completing a phase, verify the app runs and the deliverables work before proceeding.

## Claude Code Settings Per Phase

Before starting each phase, set the model and effort level with `/model` and `/effort` in Claude Code.

| Phase | Model | Effort | Run before starting |
|-------|-------|--------|---------------------|
| Phase 1 — Database + Business Logic | Opus 4.6 | xhigh | `/model claude-opus-4-6` then `/effort xhigh` |
| Phase 2 — Stores + State Management | Opus 4.6 | high | `/effort high` |
| Phase 3 — Navigation Shell + UI Shell | Sonnet 4.6 | high | `/model sonnet` then `/effort high` |
| Phase 4 — Event Forms + History + Dashboard | Opus 4.6 | xhigh | `/model claude-opus-4-6` then `/effort xhigh` |
| Phase 5 — Reminders + Vehicles + Polish | Opus 4.6 | high | `/effort high` |

**Why these choices:**
- Opus 4.6 over 4.7: same coding quality for this type of work, but 4.7's new tokenizer uses up to 35% more tokens on the same text — burning through your Max plan budget faster for no meaningful gain on a structured build like this. Save 4.7 for tasks that need its vision or agentic persistence improvements.
- xhigh for Phases 1 and 4 because they have the most intricate logic (fuel efficiency algorithm, odometer validation, reminder scheduling, real-time computed forms, charts with edge cases).
- high for Phases 2 and 5 because the patterns are thoroughly specified — the model needs to execute precisely, not explore.
- Sonnet 4.6 for Phase 3 because it's UI wiring with no complex logic — save your Opus budget.
- If you hit a specific tricky bug, bump to `/effort max` for that one prompt, then set it back.

---

## PHASE 1: Project Setup + Database + Data Layer + Business Logic

Scaffold the project, create the database schema, build the typed query layer, and implement all core business logic services. Do NOT build any UI in this phase. Focus entirely on the data foundation.

## Step 1: Scaffold the Expo project

Create a new Expo project with expo-router (tabs template). Install all dependencies listed above. Configure NativeWind in the project (tailwind.config.js, babel plugin, metro config). Verify the app runs.

Project structure should follow this layout:

```
app/
  (tabs)/
    _layout.tsx
    dashboard.tsx        # placeholder
    history.tsx          # placeholder
    reminders.tsx        # placeholder
    settings.tsx         # placeholder
  (modals)/
    _layout.tsx
  _layout.tsx            # root layout
  onboarding.tsx         # placeholder

src/
  db/
    client.ts            # expo-sqlite initialization, WAL mode
    schema.ts            # table definitions as SQL strings
    migrations.ts        # migration runner
    seed.ts              # seed data insertion
    queries/
      vehicles.ts
      events.ts
      serviceTypes.ts
      categories.ts
      places.ts
      reminders.ts
      eventServiceTypes.ts
      settings.ts
  services/
    fuelEfficiency.ts
    costPerMile.ts
    odometerEstimator.ts
    odometerValidator.ts
    reminderScheduler.ts
    unitConversion.ts
    vinDecoder.ts
    csvExport.ts
  constants/
    seedData.ts
    units.ts
  types/
    index.ts             # all TypeScript interfaces
```

## Step 2: TypeScript Interfaces

Define ALL data model interfaces in `src/types/index.ts`:

### Vehicle
```typescript
interface Vehicle {
  id: string;                    // UUID
  sortOrder: number;
  nickname: string;              // required, max 30 chars
  make: string;                  // required
  model: string;                 // required
  year: number;                  // required, 1900–current year + 1
  trim?: string;
  vin?: string;                  // 17 chars if provided
  fuelType: 'gas' | 'diesel' | 'electric';
  odometerUnit: 'miles' | 'kilometers';
  volumeUnit: 'gallons' | 'litres' | 'kWh';
  fuelCapacity?: number;
  imagePath?: string;            // local file path
  isActive: boolean;
  createdAt: string;             // ISO 8601
  updatedAt: string;
}
```

### Event (unified — replaces three separate tables)
```typescript
interface Event {
  id: string;
  vehicleId: string;             // FK → Vehicle
  type: 'fuel' | 'service' | 'expense';
  date: string;                  // ISO 8601 (YYYY-MM-DD)
  odometer?: number;             // required for fuel + service, optional for expense
  cost: number;                  // total cost

  // Fuel-specific (null for other types)
  volume?: number;
  pricePerUnit?: number;
  discountPerUnit?: number;
  isPartialFill?: boolean;

  placeId?: string;              // FK → Place
  categoryId?: string;           // FK → Category (expense only)
  notes?: string;                // max 500 chars

  createdAt: string;
  updatedAt: string;
}
```

### ServiceType
```typescript
interface ServiceType {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}
```

### EventServiceType (junction)
```typescript
interface EventServiceType {
  eventId: string;
  serviceTypeId: string;
}
```

### Category
```typescript
interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}
```

### Place
```typescript
interface Place {
  id: string;
  name: string;
  type: 'gas_station' | 'service_shop' | 'other';
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Reminder
```typescript
interface Reminder {
  id: string;
  vehicleId: string;
  serviceTypeId?: string;        // FK → ServiceType
  categoryId?: string;           // FK → Category
  // Exactly one of serviceTypeId or categoryId must be set

  distanceInterval?: number;
  timeInterval?: number;
  timeUnit?: 'days' | 'weeks' | 'months' | 'years';
  // At least one of distance or time must be configured

  baselineOdometer?: number;
  baselineDate?: string;

  notificationId?: string;       // expo-notifications identifier

  createdAt: string;
  updatedAt: string;
}
```

### AppSettings
```typescript
interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  currency: string;              // ISO 4217
  defaultFuelUnit: 'gallons' | 'litres';
  defaultOdometerUnit: 'miles' | 'kilometers';
  hasCompletedOnboarding: boolean;
}
```

## Step 3: Database Schema + Migrations

Create the SQLite schema in `src/db/schema.ts`. All tables should use TEXT for UUIDs, TEXT for ISO dates, REAL for decimals, INTEGER for booleans (0/1).

Tables:
- `_meta` (key TEXT PK, value TEXT) — stores schema version
- `vehicle` — all Vehicle fields, PK on id
- `event` — all Event fields, PK on id, FK to vehicle (CASCADE DELETE), FK to place, FK to category
- `service_type` — PK on id
- `event_service_type` — composite PK (eventId, serviceTypeId), FKs to event (CASCADE DELETE) and service_type
- `category` — PK on id
- `place` — PK on id
- `reminder` — PK on id, FK to vehicle (CASCADE DELETE), FK to service_type, FK to category
- `app_settings` — key TEXT PK, value TEXT

Indexes:
- `idx_event_vehicle_date` on event(vehicleId, date)
- `idx_event_vehicle_odometer` on event(vehicleId, odometer)
- `idx_reminder_vehicle` on reminder(vehicleId)
- `idx_place_type` on place(type)

In `src/db/migrations.ts`, build a migration runner that:
1. Checks `_meta` for current version
2. Runs pending migrations in order
3. Updates version after each successful migration
4. Migration 1 = create all tables + indexes + seed data

In `src/db/seed.ts`, define seed data:

Service Types (23 items, isDefault: true):
Oil Change, Oil Filter, Tire Rotation, Tire Replacement, Tire Alignment, Tire Pressure, Brakes (Front), Brakes (Rear), Brake Fluid, Battery, Cabin Air Filter, Engine Air Filter, Coolant, Transmission Fluid, Power Steering Fluid, Spark Plugs, Windshield Wipers, Headlights, Brake Lights, Air Conditioning, Radiator, Windshield, Fuel Filter

Categories (7 items, isDefault: true):
Registration, Insurance, Parking, Tolls, Car Wash, Accessories, Other

Default settings:
- theme: 'system'
- currency: 'USD'
- defaultFuelUnit: 'gallons'
- defaultOdometerUnit: 'miles'
- hasCompletedOnboarding: 'false'

## Step 4: Typed Query Functions

Every query function must use PARAMETERIZED QUERIES (placeholders with ?). No string interpolation in SQL. Every function returns typed interfaces.

Build these in `src/db/queries/`:

### vehicles.ts
- `getAll(): Promise<Vehicle[]>` — sorted by sortOrder
- `getActive(): Promise<Vehicle | null>`
- `getById(id: string): Promise<Vehicle | null>`
- `insert(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle>` — generates UUID
- `update(id: string, fields: Partial<Vehicle>): Promise<void>` — sets updatedAt
- `remove(id: string): Promise<void>`
- `setActive(id: string): Promise<void>` — deactivates all others, activates this one
- `updateSortOrder(updates: Array<{id: string, sortOrder: number}>): Promise<void>`

### events.ts
- `getByVehicle(vehicleId: string, filters?: { type?: Event['type'][], startDate?: string, endDate?: string }): Promise<Event[]>` — sorted by date DESC
- `getById(id: string): Promise<Event | null>`
- `insert(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>` — generates UUID
- `update(id: string, fields: Partial<Event>): Promise<void>`
- `remove(id: string): Promise<void>`
- `getLatestByVehicle(vehicleId: string): Promise<Event | null>` — most recent by date
- `getMaxOdometer(vehicleId: string): Promise<number | null>`
- `getOdometerBounds(vehicleId: string, date: string): Promise<{ floor: number | null, ceiling: number | null }>`
- `getRecentFuelEvents(vehicleId: string, limit: number): Promise<Event[]>` — type=fuel, sorted by date DESC
- `getEventsWithOdometer(vehicleId: string, limit: number): Promise<Event[]>` — where odometer IS NOT NULL, sorted by date DESC

### serviceTypes.ts
- `getAll(): Promise<ServiceType[]>` — sorted by sortOrder
- `insert(name: string): Promise<ServiceType>` — isDefault: false
- `update(id: string, name: string): Promise<void>`
- `remove(id: string): Promise<void>`

### eventServiceTypes.ts
- `getByEvent(eventId: string): Promise<ServiceType[]>` — JOIN to get full ServiceType objects
- `setForEvent(eventId: string, serviceTypeIds: string[]): Promise<void>` — delete existing, insert new (transactional)

### categories.ts
- `getAll(): Promise<Category[]>` — sorted by sortOrder
- `insert(name: string): Promise<Category>`
- `update(id: string, name: string): Promise<void>`
- `remove(id: string): Promise<void>`

### places.ts
- `getAll(): Promise<Place[]>` — sorted by name
- `getByType(type: Place['type']): Promise<Place[]>`
- `getById(id: string): Promise<Place | null>`
- `insert(place: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>): Promise<Place>`
- `update(id: string, fields: Partial<Place>): Promise<void>`
- `remove(id: string): Promise<void>`

### reminders.ts
- `getByVehicle(vehicleId: string): Promise<Reminder[]>`
- `getById(id: string): Promise<Reminder | null>`
- `getByServiceType(vehicleId: string, serviceTypeId: string): Promise<Reminder[]>`
- `getByCategory(vehicleId: string, categoryId: string): Promise<Reminder[]>`
- `insert(reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reminder>`
- `update(id: string, fields: Partial<Reminder>): Promise<void>`
- `remove(id: string): Promise<void>`

### settings.ts
- `get(): Promise<AppSettings>`
- `set(key: keyof AppSettings, value: string): Promise<void>`

## Step 5: Business Logic Services

### fuelEfficiency.ts

```typescript
export function computeFuelEfficiency(
  fuelEvents: Event[] // sorted by odometer ASC, type=fuel only
): { segments: Array<{ date: string; efficiency: number; isPartial: boolean }>; average: number | null }
```

Algorithm:
- Walk through events in odometer order
- For each pair of consecutive NON-partial fills, compute: (odometer[i] - odometer[i-1]) / volume[i]
- If partial fills exist between two full fills, add the partial volumes to the later fill's volume:
  adjusted_volume = volume[i] + sum(partial volumes between i-1 and i)
  efficiency = (odometer[i] - odometer[i-1]) / adjusted_volume
- Average = distance-weighted mean of all valid segments
- Return both the individual segments (for charting) and the average

### costPerMile.ts

```typescript
export function computeCostPerMile(
  events: Event[], // all types for one vehicle in a period
): number | null
```

Formula: sum(all event costs) / (max odometer - min odometer)
Return null if fewer than 2 events have odometer readings.

### odometerEstimator.ts

```typescript
export function estimateOdometer(
  recentEvents: Event[], // events with odometer, sorted by date DESC, limit 10
  targetDate: string     // ISO date to estimate for
): number | null
```

Algorithm:
- If fewer than 3 events, return null
- avg_daily_miles = (most recent odometer - oldest odometer) / days between them
- estimate = most recent odometer + (avg_daily_miles × days since most recent event to targetDate)
- Return rounded to nearest integer

### odometerValidator.ts

```typescript
export function validateOdometer(
  value: number,
  bounds: { floor: number | null; ceiling: number | null }
): { valid: boolean; message?: string }
```

Rules:
- If floor exists and value < floor: invalid, message: "Must be at least {floor}"
- If ceiling exists and value > ceiling: invalid, message: "Must be at most {ceiling}"
- If value <= 0: invalid
- Otherwise: valid

### unitConversion.ts

```typescript
export const MILES_TO_KM = 1.60934;
export const KM_TO_MILES = 0.62137;

export function convertOdometer(value: number, from: 'miles' | 'kilometers', to: 'miles' | 'kilometers'): number
// Returns Math.round(value * factor)

export async function convertVehicleOdometers(vehicleId: string, to: 'miles' | 'kilometers'): Promise<number>
// Converts all event odometers and reminder distances for a vehicle
// Returns count of records converted
// Must be transactional
```

### reminderScheduler.ts

```typescript
export function computeNextDue(
  reminder: Reminder,
  currentOdometer: number | null,
  today: string // ISO date
): {
  nextDate: string | null;
  nextOdometer: number | null;
  distanceRemaining: number | null;
  daysRemaining: number | null;
  status: 'upcoming' | 'soon' | 'overdue';
}
```

Logic:
- If time-based: nextDate = baselineDate + (timeInterval * timeUnit). daysRemaining = nextDate - today.
- If distance-based: nextOdometer = baselineOdometer + distanceInterval. distanceRemaining = nextOdometer - currentOdometer.
- Status: overdue if daysRemaining < 0 OR distanceRemaining ≤ 0. Soon if daysRemaining ≤ 30 OR distanceRemaining ≤ 1000. Upcoming otherwise.

```typescript
export async function recalculateRemindersForServiceTypes(
  vehicleId: string,
  serviceTypeIds: string[],
  latestEvent: { date: string; odometer?: number }
): Promise<void>
```

This function: finds all reminders for the vehicle matching any of the given serviceTypeIds, updates their baselineDate and baselineOdometer from the latestEvent, and (placeholder for Phase 4) reschedules notifications.

### vinDecoder.ts

```typescript
export async function decodeVin(vin: string): Promise<{
  year?: number;
  make?: string;
  model?: string;
} | null>
```

Calls NHTSA API: GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
5-second timeout. Returns null on failure. Extracts ModelYear, Make, Model from response.

### csvExport.ts

```typescript
export async function exportVehicleData(
  vehicleId: string | null, // null = all vehicles
  startDate?: string,
  endDate?: string
): Promise<string> // returns file path of generated CSV
```

CSV columns: Date, EventType, Odometer, OdometerUnit, Cost, Volume, VolumeUnit, PricePerUnit, DiscountPerUnit, PartialFill, Place, ServiceTypes, Category, Notes
UTF-8 with BOM. ISO 8601 dates.

## Step 6: Initialization

In `src/db/client.ts`, create an `initializeDatabase()` function that:
1. Opens the database with WAL mode
2. Enables foreign keys (PRAGMA foreign_keys = ON)
3. Runs pending migrations
4. Returns the database instance

This function should be called once at app startup (in the root _layout.tsx).

## CRITICAL RULES FOR THIS PHASE

- **No stubs, no TODOs, no placeholder implementations.** Every query function must contain real SQL. Every business logic service must implement the actual algorithm. If you write `// TODO: implement` anywhere, you have failed this phase. Phases 2-5 depend on this code being real and working.
- **Every SQL query must use parameterized placeholders (?).** No string interpolation, no template literals in SQL strings. This is non-negotiable.
- **Test the data round-trip mentally for every query function.** insert() should produce a row that getById() can retrieve and that maps to the correct TypeScript interface. If a field is nullable in the interface, it must be nullable in the schema.
- **The fuel efficiency algorithm is tricky — get it right.** Walk through it step by step with a mental test case: 3 full fills and 1 partial fill in between. The partial's volume must roll into the next full fill's denominator. If you aren't sure, write out the test case as comments in the code.
- **Do not skip csvExport or vinDecoder.** These are real services, not future work. vinDecoder makes an HTTP call to the NHTSA API. csvExport writes a file using expo-file-system. Both must be fully implemented.

## Step 7: Unit Tests for Business Logic Services

Install Jest and ts-jest (Expo's default test runner). Create tests in `src/services/__tests__/`. These tests run against pure functions — no database, no React, no mocking needed for most of them.

Test file structure:
```
src/services/__tests__/
  fuelEfficiency.test.ts
  costPerMile.test.ts
  odometerEstimator.test.ts
  odometerValidator.test.ts
  unitConversion.test.ts
  reminderScheduler.test.ts
```

### fuelEfficiency.test.ts

Test cases (minimum — add more edge cases if you see them):

1. **Two consecutive full fills** — basic MPG calculation. Events: [odometer 1000, volume 10] → [odometer 1300, volume 12]. Expected: 300/12 = 25 MPG.
2. **Partial fill between two full fills** — partial volume rolls into next full fill. Events: [full, odo 1000, vol 10] → [partial, odo 1150, vol 5] → [full, odo 1300, vol 8]. Expected: (1300-1000) / (8+5) = 23.08 MPG.
3. **Multiple partial fills in a row** — all partials roll into the next full fill.
4. **Only one event** — returns empty segments and null average.
5. **All partial fills** — no valid segments, null average.
6. **Empty input** — returns empty segments and null average.
7. **Events not sorted by odometer** — function should still work correctly (sort internally or document that input must be sorted, and test accordingly).

### costPerMile.test.ts

1. **Normal case** — 3 events with odometers 10000, 10500, 11000 and costs $50, $200, $30. Expected: 280 / (11000-10000) = $0.28/mi.
2. **Fewer than 2 events with odometers** — returns null.
3. **Mixed events where some lack odometer** (expense events) — cost is included in numerator but those events don't affect the denominator range.
4. **Single event** — returns null.
5. **Zero distance** (same odometer on all events, which shouldn't happen but defensively) — returns null, not Infinity.

### odometerEstimator.test.ts

1. **Happy path** — 10 events over 100 days, estimate for 5 days from now. Should extrapolate linearly.
2. **Fewer than 3 events** — returns null.
3. **Events with same date** — doesn't divide by zero.
4. **Target date is in the past** (editing an old event) — should still estimate based on average daily rate applied to the target date gap.

### odometerValidator.test.ts

1. **Value within bounds** — valid.
2. **Value below floor** — invalid with message.
3. **Value above ceiling** — invalid with message.
4. **Value ≤ 0** — invalid.
5. **No floor (first event for vehicle)** — only ceiling checked.
6. **No ceiling (most recent event for vehicle)** — only floor checked.
7. **No bounds at all** — any positive value is valid.

### unitConversion.test.ts

1. **Miles to km** — 1000 mi → 1609 km (rounded).
2. **Km to miles** — 1609 km → 1000 mi (rounded).
3. **Same unit** — no change.
4. **Zero** — returns 0.
5. **Conversion is symmetric** — converting 1000 mi→km→mi returns 1000 (within rounding tolerance of ±1).

### reminderScheduler.test.ts

1. **Time-based, monthly** — baseline Jan 15, interval 6 months → next due Jul 15. Days remaining calculated from today.
2. **Distance-based** — baseline 50000 mi, interval 5000 → next due 55000. If current odometer is 54200, remaining = 800.
3. **Both time and distance** — status is the worst of the two (if distance says "overdue" but time says "upcoming", status is "overdue").
4. **Overdue by date** — next due date is in the past → status "overdue".
5. **Overdue by distance** — distance remaining ≤ 0 → status "overdue".
6. **Soon by date** — ≤ 30 days remaining → "soon".
7. **Soon by distance** — ≤ 1000 remaining → "soon".
8. **Upcoming** — both > 30 days and > 1000 → "upcoming".
9. **No current odometer** (no events yet) — distance remaining is null, status based on time only.
10. **No baseline date** (time-based but no previous event and no user-entered start) — throws or returns null for time fields.

### What NOT to test

- Do not test query functions (they need a database). Those are verified by running the app.
- Do not test vinDecoder (it makes HTTP calls). That's verified manually.
- Do not test csvExport (it writes files). That's verified in Phase 5 end-to-end.

### Running tests

All tests should pass with `npx jest` or `npm test`. Configure the test script in package.json.

## What to deliver

1. A complete, runnable Expo project with all files listed above
2. Every query function implemented with parameterized SQL
3. Every business logic service implemented with the exact algorithms specified
4. Unit tests for all 6 business logic services, all passing
5. The database initializes and seeds on first run
6. Placeholder screens in the app/ directory that just show the screen name as text
7. The app should start without errors and `npm test` should pass

Do NOT build any real UI, stores, or navigation beyond the placeholder tabs. That's Phase 2.

---

## PHASE 2: Zustand Stores + State Management

Phase 1 is complete. The project has the full SQLite schema with migrations and seed data, typed query functions for all tables, business logic services, and type interfaces for all data models.

Build Zustand stores that act as the read-through cache for the SQLite layer. The stores are the single source of truth for the UI — components will never call query functions directly.

## Store Architecture

Stores write to SQLite FIRST, then update in-memory state. If the DB write fails, the store does not update and the error is surfaced to the caller.

Create these stores in `src/stores/`:

### vehicleStore.ts

```typescript
interface VehicleStore {
  // State
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize(): Promise<void>;
  // Loads all vehicles from DB, sets activeVehicle from the one with isActive=true

  setActiveVehicle(id: string): Promise<void>;
  // Writes to DB (deactivate all, activate this one), reloads events + reminders for new vehicle

  addVehicle(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'isActive'>): Promise<Vehicle>;
  // Inserts to DB, adds to state, optionally sets as active (if first vehicle or user chose to)

  updateVehicle(id: string, fields: Partial<Vehicle>): Promise<void>;
  // Writes to DB, updates state. If odometerUnit changed, calls convertVehicleOdometers and reloads events.

  deleteVehicle(id: string): Promise<void>;
  // Validates not the sole active vehicle, removes from DB (cascades), removes from state, sets new active if needed.

  reorderVehicles(orderedIds: string[]): Promise<void>;
  // Updates sortOrder in DB and state
}
```

### eventStore.ts

```typescript
interface EventStore {
  // State
  events: Event[];               // All events for active vehicle
  isLoading: boolean;
  error: string | null;

  // Computed (derived from events, memoized)
  fuelEvents: Event[];
  serviceEvents: Event[];
  expenseEvents: Event[];

  // Actions
  loadForVehicle(vehicleId: string): Promise<void>;
  // Fetches all events for vehicle from DB, replaces state

  addEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>, serviceTypeIds?: string[]): Promise<Event>;
  // Inserts event to DB. If type=service, sets serviceTypeIds via junction table.
  // Triggers reminderStore.recalculateForEvent(event, serviceTypeIds).
  // Adds to state.

  updateEvent(id: string, fields: Partial<Event>, serviceTypeIds?: string[]): Promise<void>;
  // Updates DB. If service, replaces junction entries. Triggers reminder recalc. Updates state.

  deleteEvent(id: string): Promise<void>;
  // SOFT delete: removes from state immediately, enqueues DB delete.
  // Returns an undo function that re-inserts if called within 5 seconds.

  undoDelete(): Promise<void>;
  // Re-inserts the last deleted event from a pending queue.

  // Smart defaults
  getSmartDefaults(type: Event['type']): Promise<Partial<Event>>;
  // For fuel: last fuel event's pricePerUnit, placeId, today's date, estimated odometer.
  // For service: today's date, estimated odometer.
  // For expense: today's date.
}
```

### reminderStore.ts

```typescript
interface ReminderStore {
  // State
  reminders: ReminderWithStatus[];  // Reminders with computed next-due info
  isLoading: boolean;
  error: string | null;

  // Actions
  loadForVehicle(vehicleId: string): Promise<void>;
  // Fetches reminders, computes status for each, sorts by urgency (overdue first)

  addReminder(data: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>): Promise<Reminder>;
  // Inserts to DB, computes status, schedules notification (placeholder for now), adds to state

  updateReminder(id: string, fields: Partial<Reminder>): Promise<void>;
  // Updates DB, recomputes status, reschedules notification, updates state

  deleteReminder(id: string): Promise<void>;
  // Removes from DB, cancels notification (placeholder), removes from state

  recalculateForEvent(event: Event, serviceTypeIds?: string[]): Promise<void>;
  // Called by eventStore after an event is saved.
  // Finds reminders matching the event's serviceTypeIds (for service events)
  // or categoryId (for expense events).
  // Updates their baseline date/odometer and recomputes status.
}

// Extended type for UI consumption
interface ReminderWithStatus extends Reminder {
  nextDate: string | null;
  nextOdometer: number | null;
  distanceRemaining: number | null;
  daysRemaining: number | null;
  status: 'upcoming' | 'soon' | 'overdue';
  linkedName: string;            // The service type or category name
}
```

### settingsStore.ts

```typescript
interface SettingsStore {
  settings: AppSettings;
  isLoading: boolean;

  initialize(): Promise<void>;
  // Loads all settings from DB

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  // Writes to DB, updates state
}
```

### referenceDataStore.ts

```typescript
interface ReferenceDataStore {
  serviceTypes: ServiceType[];
  categories: Category[];
  places: Place[];
  isLoading: boolean;

  initialize(): Promise<void>;
  // Loads serviceTypes, categories, places from DB

  addServiceType(name: string): Promise<ServiceType>;
  updateServiceType(id: string, name: string): Promise<void>;
  deleteServiceType(id: string): Promise<void>;

  addCategory(name: string): Promise<Category>;
  updateCategory(id: string, name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  addPlace(data: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>): Promise<Place>;
  updatePlace(id: string, fields: Partial<Place>): Promise<void>;
  deletePlace(id: string): Promise<void>;
}
```

## Initialization Sequence

In the root `app/_layout.tsx`, create an initialization flow:

1. Show a loading/splash state
2. Call `initializeDatabase()`
3. Call `settingsStore.initialize()`
4. Call `vehicleStore.initialize()`
5. Call `referenceDataStore.initialize()`
6. If an active vehicle exists:
   a. Call `eventStore.loadForVehicle(activeVehicle.id)`
   b. Call `reminderStore.loadForVehicle(activeVehicle.id)`
7. Check `settings.hasCompletedOnboarding` — if false, redirect to onboarding
8. Render the tab navigator

## Vehicle Switching

When `vehicleStore.setActiveVehicle(id)` is called:
1. Write the change to DB (deactivate all, activate selected)
2. Update vehicleStore state
3. Call `eventStore.loadForVehicle(newId)`
4. Call `reminderStore.loadForVehicle(newId)`

This must feel instant. The DB queries should complete in under 100ms for reasonable data sizes.

## Undo Delete Pattern

The eventStore delete flow:
1. Remove the event from the in-memory array immediately (optimistic UI)
2. Store the removed event in a `pendingDelete` variable
3. Start a 5-second timer
4. If `undoDelete()` is called before the timer: re-insert the event into the array, clear pendingDelete
5. If the timer expires: execute the DB delete, clear pendingDelete
6. If a NEW delete happens while one is pending: finalize the pending delete immediately, then start the new one

## Custom Hook: useActiveVehicle

Create `src/hooks/useActiveVehicle.ts`:

```typescript
export function useActiveVehicle() {
  const activeVehicle = useVehicleStore(s => s.activeVehicle);
  const events = useEventStore(s => s.events);
  const reminders = useReminderStore(s => s.reminders);

  // Derived values
  const currentOdometer = useMemo(() => /* max odometer from events */, [events]);
  const fuelEvents = useMemo(() => events.filter(e => e.type === 'fuel'), [events]);
  // etc.

  return { activeVehicle, events, reminders, currentOdometer, fuelEvents, ... };
}
```

## Custom Hook: useDashboardMetrics

Create `src/hooks/useDashboardMetrics.ts`:

```typescript
export function useDashboardMetrics(period: { startDate: string; endDate: string }) {
  const events = useEventStore(s => s.events);

  // Filter events to period
  // Compute: totalSpent, costPerMile, fuelEfficiency (segments + average), spendingBreakdown
  // Compare efficiency to previous period for trend arrow
  // Memoize all computations

  return { totalSpent, costPerMile, efficiency, efficiencyTrend, spendingBreakdown, chartData };
}
```

## CRITICAL RULES FOR THIS PHASE

- **Write to DB first, update state second.** Every store mutation must follow this pattern: try the DB write, and only if it succeeds, update the in-memory state. If you update state first and the DB write fails, the UI is now lying to the user.
- **Errors must be surfaceable.** Every catch block must set the store's `error` state to a human-readable message. Do not silently swallow errors with empty catch blocks. The UI will read this error state in Phase 4.
- **The undo delete pattern must actually work.** The event must be removed from the in-memory array immediately (optimistic), the DB delete must be deferred for 5 seconds, and calling undoDelete() must re-insert the event into the array at the correct position. Think through the edge case: what if the user deletes event A, then deletes event B within 5 seconds? Event A's delete must finalize immediately before event B's undo window starts.
- **Vehicle switching must reload dependents.** When setActiveVehicle is called, eventStore and reminderStore must both reload for the new vehicle. Don't rely on components to do this — the vehicleStore action itself must trigger the reloads.
- **Memoize derived data in hooks.** useDashboardMetrics runs expensive calculations (fuel efficiency across potentially hundreds of events). Use useMemo with proper dependency arrays. Do not recompute on every render.

## What to deliver
2. The initialization sequence in root _layout.tsx
3. useActiveVehicle and useDashboardMetrics hooks
4. Vehicle switching works end-to-end
5. Undo delete pattern works on eventStore
6. All store actions handle errors (try/catch, set error state, surface to caller)
7. The app still runs — placeholder screens can now show basic data like "Active vehicle: {name}" to prove the data flows

Do NOT build real screen UI yet. Keep the placeholder screens but have them render basic data from the stores to verify the data pipeline works (e.g., Dashboard placeholder shows activeVehicle.nickname and event count).

---

## PHASE 3: Navigation Shell + Vehicle Switcher + Event Entry Points

Phases 1-2 are complete. Build the navigation shell, vehicle switcher, FAB with action sheet, and the onboarding flow. After this phase, the app should FEEL like a real app even though the detail screens are still stubs.

## Design System Setup

Before building components, establish design tokens in NativeWind's tailwind.config.js:

- Colors: Define a palette that works in both light and dark mode. Event type colors: fuel = teal-500, service = orange-500, expense = emerald-500. Use semantic names (primary, surface, muted, destructive, etc.).
- The app should respect system theme by default (via settingsStore.settings.theme).
- All text should use the system font (no custom fonts needed for MVP).
- Border radius: use rounded-xl (12px) as the default for cards, rounded-full for chips/pills.

## Components to Build

### 1. VehicleSwitcher (src/components/VehicleSwitcher.tsx)

A tappable header bar present on Dashboard, History, and Reminders tabs.

Layout:
- Left: Vehicle photo (32x32 circle, or a car icon placeholder)
- Center: Vehicle nickname (bold) + year make model (smaller, muted)
- Right: Chevron-down icon

On tap: opens a bottom sheet (use @gorhom/bottom-sheet) listing all vehicles. Each row shows: photo, nickname, year/make/model. Active vehicle has a checkmark. Tapping a vehicle calls vehicleStore.setActiveVehicle(id) and closes the sheet.

At the bottom of the sheet: a "Manage Vehicles" link that navigates to the manage vehicles screen (stub for now — just a placeholder screen at app/(modals)/manage-vehicles.tsx).

If only one vehicle exists, still show the header but tapping shows the sheet with just that one vehicle + "Add Vehicle" + "Manage Vehicles."

### 2. AddEventFAB (src/components/AddEventFAB.tsx)

A floating action button (bottom-right, above tab bar) showing a "+" icon.

On tap: opens a bottom sheet with three options:
- 🔵 "Fill-Up" (or "Charge" if activeVehicle.fuelType === 'electric') — icon: fuel pump or lightning bolt
- 🟠 "Service" — icon: wrench
- 🟢 "Expense" — icon: dollar sign

Each option is a tappable row. Tapping one closes the sheet and navigates to the corresponding modal:
- router.push('/(modals)/fuel-event')
- router.push('/(modals)/service-event')
- router.push('/(modals)/expense-event')

These modal screens should be stubs for now that just show "Add Fuel Event" / "Add Service Event" / "Add Expense Event" text with a "Close" button that calls router.back().

### 3. Tab Layout (app/(tabs)/_layout.tsx)

4 tabs with these icons (use @expo/vector-icons Ionicons or a similar icon set already bundled with Expo):
- Dashboard: bar-chart (or stats-chart)
- History: time
- Reminders: notifications
- Settings: settings

Active tab should use the primary color. Inactive tabs use muted color.

If no vehicle exists (vehicleStore.vehicles.length === 0), every tab except Settings should show a full-screen prompt: "Add a vehicle to get started" with an "Add Vehicle" button that opens the vehicle modal.

### 4. Modal Layout (app/(modals)/_layout.tsx)

Configure as a modal stack (presentation: 'modal' in expo-router). All modals slide up from bottom and can be dismissed by swiping down.

Create stub modal files:
- app/(modals)/fuel-event.tsx
- app/(modals)/service-event.tsx
- app/(modals)/expense-event.tsx
- app/(modals)/vehicle.tsx
- app/(modals)/reminder.tsx
- app/(modals)/manage-vehicles.tsx
- app/(modals)/export.tsx

Each stub should have a header bar with "Cancel" (left, calls router.back()) and "Save" (right, disabled for now) and body text identifying the screen.

### 5. Onboarding Flow (app/onboarding.tsx)

Simple two-step flow:

Step 1 — Welcome screen:
- App name "AutoMate" in large text
- Tagline: "Track every mile, own every dollar."
- "Get Started" button

Step 2 — tapping "Get Started" navigates to app/(modals)/vehicle.tsx (the add vehicle modal). Since that's still a stub, for now just have the onboarding set hasCompletedOnboarding = true and redirect to the tabs.

The root _layout.tsx should check: if !hasCompletedOnboarding && vehicles.length === 0, show onboarding. Otherwise show tabs.

### 6. EmptyState (src/components/EmptyState.tsx)

Reusable component with props:
- icon: React.ReactNode (an icon component)
- title: string
- description: string
- actionLabel?: string
- onAction?: () => void

Renders centered layout: icon (48px, muted), title (18px, bold), description (14px, muted), optional button.

Use this in each tab's empty state.

## Tab Screen Updates

Replace the placeholders with proper layouts that use the components above:

### Dashboard (app/(tabs)/dashboard.tsx)
- VehicleSwitcher at top
- If no events: EmptyState with "Add your first event to see your dashboard" + "Add Event" button (opens FAB sheet)
- If events exist: show temporary text: "Dashboard — {eventCount} events loaded" (real charts come in Phase 4)
- AddEventFAB

### History (app/(tabs)/history.tsx)
- VehicleSwitcher at top
- If no events: EmptyState with "No events yet. Tap + to log your first fill-up."
- If events exist: show temporary FlatList of events with basic info (date, type, cost) — this will be replaced with the real HistoryEventRow in Phase 4
- AddEventFAB

### Reminders (app/(tabs)/reminders.tsx)
- VehicleSwitcher at top
- If no reminders: EmptyState with "No reminders set. Never miss an oil change."
- If reminders exist: temporary list showing reminder name + status
- "+" button in header to open reminder modal

### Settings (app/(tabs)/settings.tsx)
- Grouped list:
  - Appearance → Theme picker (System/Light/Dark) — wire to settingsStore
  - Defaults → show current currency, fuel unit, odometer unit (tappable but implementation deferred)
  - Vehicles → "Manage Vehicles" row → navigates to manage-vehicles modal
  - Data → "Export Data" row → navigates to export modal
  - About → "AutoMate v2.0"
- Theme switching should work end-to-end in this phase

## CRITICAL RULES FOR THIS PHASE

- **Bottom sheets must be real, not simulated.** Use @gorhom/bottom-sheet (install it). Do not simulate bottom sheets with absolute-positioned views or Modal components. The sheets must support swipe-to-dismiss, snap points, and backdrop dimming.
- **The vehicle switcher must feel instant.** When tapping a different vehicle, the sheet should close, the header should update, and the tab content should refresh. If there's a perceptible delay while events reload, show a subtle skeleton/shimmer on the tab content — do not show a blocking spinner.
- **Empty states are not optional.** Every tab must have a proper EmptyState component when there's no data. Do not leave any screen showing a blank white/dark area. The empty states are specified in the screen descriptions above — use the exact copy.
- **Modals must be dismissible by swipe-down.** Configure expo-router's modal presentation correctly. Test that swiping down on a modal dismisses it and returns to the previous screen.
- **The onboarding → first vehicle → dashboard flow must work end-to-end.** On a fresh install: the user should see the welcome screen, tap "Get Started," arrive at the tabs (vehicle modal is stub for now so just set onboarding complete), and see the Dashboard empty state. This flow must not break.

## What to deliver
2. VehicleSwitcher works: shows active vehicle, bottom sheet lists all vehicles, tapping switches and reloads data
3. AddEventFAB appears on Dashboard and History, opens action sheet, routes to stub modals
4. All modals are routable and dismissible
5. Onboarding flow redirects correctly on first launch
6. Empty states render on all tabs when no data exists
7. Theme switching works (system/light/dark)
8. The app feels like a real app — navigation is smooth, sheets animate, tabs switch instantly

---

## PHASE 4: Core Screens — Event Forms + History + Dashboard

Phases 1-3 are complete. Build the real UI for the three event forms, the History screen, and the Dashboard. This is the core of the app.

## Shared Components to Build First

### ChipPicker (src/components/ChipPicker.tsx)

Props:
- items: Array<{ id: string; name: string }>
- selectedIds: string[]
- onSelectionChange: (ids: string[]) => void
- multiSelect: boolean (default true)
- label?: string
- error?: string
- onManage?: () => void  // if provided, shows "Manage" link that opens a bottom sheet for add/edit/delete

Layout: horizontal scrollable row of pill-shaped chips. Selected chips have filled primary background. Unselected chips have outlined/muted style. In multi-select mode, tapping toggles. In single-select, tapping selects one and deselects others.

"Manage" link at the end opens a bottom sheet with:
- List of items with edit (pencil icon) and delete (trash icon) on each
- "Add new" text field at bottom with "Add" button
- Adding/editing/deleting calls the appropriate referenceDataStore action

### PlaceAutocomplete (src/components/PlaceAutocomplete.tsx)

Props:
- value: string | null (placeId)
- onChange: (placeId: string | null) => void
- placeType: 'gas_station' | 'service_shop' | 'other'

Layout: Text input that filters places from referenceDataStore as user types. Dropdown shows matching places. Last item is always "＋ Add new place" which opens an inline bottom sheet with:
- Name (text input, required)
- Type (pre-selected from prop)
- "Use current location" button (requests expo-location permission, gets GPS, reverse geocodes for address)
- Address (text input, auto-filled from GPS but editable)
- "Save" button

On save: calls referenceDataStore.addPlace(), sets the new place as selected, closes sheet.

### ModalHeader (src/components/ModalHeader.tsx)

Props:
- title: string
- onCancel: () => void
- onSave: () => void
- saveDisabled?: boolean
- saveLabel?: string (default "Save")

Layout: Row with Cancel (left), title (center), Save (right). Standard for all modal forms.

### OdometerField (src/components/OdometerField.tsx)

Props:
- value: string (controlled)
- onChange: (text: string) => void
- onBlur: () => void
- unit: 'miles' | 'kilometers'
- estimatedOdometer?: number | null
- error?: string
- required?: boolean

Layout: Numeric text input with comma formatting. Helper text below shows "Estimated: {estimatedOdometer} {unit}" if provided. Error text in red below helper if error is set.

## Event Forms

### Add/Edit Fuel Event (app/(modals)/fuel-event.tsx)

Route params: { eventId?: string } — if eventId present, load existing event for editing.

On mount (new event):
1. Call eventStore.getSmartDefaults('fuel')
2. Pre-fill: date = today, odometer = estimated, pricePerUnit = last price, placeId = last place
3. Call odometerValidator to get bounds for today's date

On mount (edit):
1. Load event by ID from eventStore
2. Load associated place name if placeId exists

Form layout (scrollable):
- ModalHeader: "Add Fill-Up" / "Edit Fill-Up" (or Charge for electric)
- Date field: tappable, opens system date picker. Cannot be future.
- OdometerField: required. Validates on blur using odometerValidator.
- Volume field: decimal, 1 decimal place. Label: "Fuel Added" (or "Energy Added" for electric). Suffix: gal/L/kWh.
- Price/Unit field: currency input. Suffix: $/gal etc.
- Discount/Unit field: currency input. Optional. Validates < price.
- Total Cost: read-only computed field. Bold, larger text. Updates in real-time.
- Partial Fill toggle: "This is a partial fill" with info tooltip "Partial fills are excluded from fuel efficiency calculations."
- PlaceAutocomplete: placeType='gas_station'
- Notes: multiline, 500 char max with character counter

On Save:
1. Validate all required fields
2. Compute cost = volume * (pricePerUnit - (discountPerUnit || 0))
3. Call eventStore.addEvent() or eventStore.updateEvent()
4. router.back()
5. Show success toast (use a simple toast component or react-native-toast-message)

On Delete (edit mode only):
- Show "Delete" button at bottom of form (red, outlined)
- On tap: router.back() immediately, eventStore.deleteEvent() triggers undo snackbar on the previous screen

### Add/Edit Service Event (app/(modals)/service-event.tsx)

Route params: { eventId?: string }

Form layout:
- ModalHeader: "Add Service" / "Edit Service"
- Date field
- OdometerField: required
- ChipPicker: serviceTypes from referenceDataStore, multiSelect=true, required (≥ 1 selected), with Manage link. If editing, pre-select from eventServiceTypes junction.
- Total Cost: currency input, required
- PlaceAutocomplete: placeType='service_shop'
- Notes

On Save:
1. Validate (date, odometer, ≥1 service type, cost)
2. Call eventStore.addEvent(data, serviceTypeIds) or eventStore.updateEvent(id, data, serviceTypeIds)
3. router.back()

### Add/Edit Expense Event (app/(modals)/expense-event.tsx)

Route params: { eventId?: string }

Form layout:
- ModalHeader: "Add Expense" / "Edit Expense"
- Date field
- OdometerField: optional (note: no "required" indicator)
- ChipPicker: categories from referenceDataStore, multiSelect=false, required, with Manage link
- Total Cost: currency input, required
- Notes

On Save:
1. Validate (date, category, cost)
2. Call eventStore.addEvent(data) or eventStore.updateEvent(id, data)
3. router.back()

## History Screen (app/(tabs)/history.tsx)

Replace the temporary list with the real implementation:

### Filter Bar
Horizontal row of chips at top: All | Fuel | Service | Expense
- "All" is a special chip that, when selected, deselects the others
- Selecting Fuel/Service/Expense is additive (multi-select)
- Deselecting all auto-selects "All"
- Filter is applied to the event list

### Event List
SectionList grouped by month (section header = "April 2026 — $342.50" showing month total).

Each row (EventRow component):
- Left: colored circle (teal/orange/green) with icon (fuel pump / wrench / dollar)
- Center column: top line = formatted date + place name (or empty). Bottom line = odometer + unit (or "—" if no odometer).
- Right: cost formatted as currency

Rows are tappable → router.push(`/(modals)/${event.type}-event?eventId=${event.id}`)

Swipe-to-delete:
- Swipe left reveals red "Delete" area
- On swipe complete: call eventStore.deleteEvent(id)
- Show undo snackbar at bottom: "Event deleted" with "Undo" button
- Undo button calls eventStore.undoDelete()
- Snackbar auto-dismisses after 5 seconds

Long-press alternative: show context menu with "Edit" and "Delete" options (for accessibility / non-swipe users).

Section headers are sticky.

### Performance
Use FlashList (from @shopify/flash-list) instead of FlatList for better performance with large lists. Estimated item size: 72.

## Dashboard Screen (app/(tabs)/dashboard.tsx)

Replace the temporary content with the real dashboard:

### Period Selector
Horizontal scrollable pills: 1M, 3M, 6M, YTD, 1Y, All
Default: 3M. Tapping a pill updates the period and all metrics below.

Use the useDashboardMetrics hook from Phase 2.

### Metric Cards Row
Three cards in a horizontal row (each takes 1/3 width):

1. **Total Spent**: Large currency value. Small label above.
2. **Cost/Mile** (or km): Large value (e.g., "$0.42/mi"). Show "—" if insufficient data. Small label above.
3. **Avg MPG** (or km/L, mi/kWh): Large value. Trend arrow: ↑ green if better than previous period, ↓ red if worse. Show "—" if insufficient data.

### Fuel Efficiency Chart
Line chart (react-native-gifted-charts) showing efficiency over time.
- X axis: date
- Y axis: efficiency value
- Data points from useDashboardMetrics.chartData
- Partial fill points rendered as hollow/dashed circles
- Chart should be ~200px tall
- Accessible text alternative below chart (hidden visually, visible to screen readers)

If fewer than 2 data points: show placeholder text "Log more fill-ups to see efficiency trends" instead of chart.

### Spending Breakdown
Donut/pie chart showing three segments: Fuel (teal), Service (orange), Expense (green).
- Center of donut: total amount
- Legend below with segment name, amount, percentage
- Tapping a segment... for now, just highlights it (future: could filter history)

If no events: show nothing (the empty state handles the whole screen).

### Recent Events
"Recent Activity" header with "See all →" link (navigates to History tab).
Last 5 events as compact EventRow components (reuse the same component from History).

## CRITICAL RULES FOR THIS PHASE

- **Smart defaults must actually work.** When opening a new fuel event, the form must call eventStore.getSmartDefaults('fuel') and pre-fill the fields. If you skip this and leave every form blank on open, you've missed the most important UX improvement in the entire rebuild.
- **Odometer validation must be async-safe.** The OdometerField calls the DB to get bounds. The form must not allow save while the bounds query is in flight. Show the field in a loading state until bounds resolve. Do not let a user save an out-of-order odometer reading because validation hadn't loaded yet.
- **Total cost on the fuel form must update in real-time.** As the user types volume, price, or discount, the computed total must recalculate and display on every keystroke (debounced is fine, but no longer than 100ms). This field is read-only — the user cannot edit it directly.
- **Swipe-to-delete must pair with the undo snackbar.** The History screen swipe action must call eventStore.deleteEvent(), which removes from state optimistically. The UndoSnackbar component must appear at the bottom, persist for 5 seconds, and call eventStore.undoDelete() on tap. If the user scrolls, switches filters, or does anything else, the snackbar stays visible for the full 5 seconds.
- **Charts must handle edge cases gracefully.** Fewer than 2 fuel events = no efficiency chart (show placeholder text). Zero events = no donut chart. One event = metrics show "—" for cost-per-mile. Do not render empty or broken charts.
- **Use FlashList from @shopify/flash-list for the History list.** Not FlatList, not SectionList. FlashList with estimated item size for performance. Section headers can be implemented with FlashList's stickyHeaders or by rendering section header items in the data array.

## What to deliver
2. History screen with filtering, sections, swipe-to-delete with undo, and long-press menu
3. Dashboard with period selector, metric cards, fuel efficiency line chart, spending donut, and recent events
4. All data persists to SQLite and survives app restart
5. ChipPicker, PlaceAutocomplete, OdometerField, ModalHeader components are reusable
6. The complete add-event flow works end-to-end: FAB → sheet → modal → fill form → save → see it in History and Dashboard

---

## PHASE 5: Reminders + Vehicle Management + Settings + Polish

Phases 1-4 are complete. Build the remaining screens, wire up notifications, and do a polish pass.

## 1. Add/Edit Reminder (app/(modals)/reminder.tsx)

Route params: { reminderId?: string }

Form layout:
- ModalHeader: "Add Reminder" / "Edit Reminder"

- **Pick what** section:
  Two-segment control: "Maintenance" | "Expense"
  Below the segment: ChipPicker showing either serviceTypes or categories depending on selection. Single-select mode. Required.

  When editing: the segment and chip are pre-selected and the segment is disabled (can't change type of existing reminder).

- **Repeat every** section:
  "By Distance" row: toggle switch + number input (label: "miles" or "km" based on vehicle) — enabled/disabled by toggle
  "By Time" row: toggle switch + number input + picker (Days/Weeks/Months/Years) — enabled/disabled by toggle
  At least one must be toggled on. If user tries to save with both off: error message "Choose at least one repeat interval."

- **Starting from** section (only shows if needed):
  If the selected service type or category has a previous matching event for this vehicle:
    Read-only info row: "Last {name} on {date} at {odometer} {unit}"
  If no matching event:
    Editable date picker: "Start tracking from" (required if time toggle is on)
    Editable odometer field: "Starting odometer" (required if distance toggle is on)

- Delete button (edit mode only): red outlined button at bottom

On Save:
1. Validate
2. If new: call reminderStore.addReminder()
3. If editing: call reminderStore.updateReminder()
4. Schedule notification (see below)
5. router.back()

## 2. Reminders Screen (app/(tabs)/reminders.tsx)

Replace the temporary list with real ReminderCard components.

### ReminderCard (src/components/ReminderCard.tsx)

Props: reminder: ReminderWithStatus

Layout:
- Top row: reminder name (linked service type or category name), status badge (pill: green "Upcoming", yellow "Soon", red "Overdue")
- Middle: progress bar. For distance-based: fill = (distanceInterval - distanceRemaining) / distanceInterval. For time-based: similar with days. Use the one that's closer to due.
- Bottom row: "Next: {nextOdometer} mi" and/or "Next: {nextDate formatted}" depending on what's configured. If both: show both on separate lines.
- Tap: opens router.push('/(modals)/reminder?reminderId=${id}')

List is sorted: overdue first, then soon, then upcoming. Within each group, sort by urgency (closest to due first).

"+" button in the screen header opens the reminder modal.

## 3. Notifications

Wire up expo-notifications:

### Permission Flow
On the first call to reminderStore.addReminder():
1. Check notification permission status
2. If not determined: request permission
3. If denied: save the reminder but show a persistent banner on the Reminders tab: "Notifications are off. You'll only see reminders in the app. [Enable in Settings]" (links to Linking.openSettings)
4. If granted: schedule the notification

### Scheduling
When a reminder is saved or recalculated:
1. If it has a notificationId, cancel the existing notification
2. Compute nextDate from reminderScheduler.computeNextDue()
3. If nextDate is in the future: schedule a notification
   - trigger: { date: nextDate at 8:00 AM local time }
   - content: { title: "AutoMate Reminder", body: "{name} is due for {vehicleName}" }
4. Store the returned notification identifier on the reminder record

### Recalculation trigger
The reminderStore.recalculateForEvent() function (already built in Phase 2) should now also reschedule notifications after updating baselines.

## 4. Add/Edit Vehicle (app/(modals)/vehicle.tsx)

Route params: { vehicleId?: string }

This was a stub — build the real form:

Form layout (scrollable):
- ModalHeader: "Add Vehicle" / "Edit Vehicle"
- **Photo**: Circular image (120px). Tap to show action sheet: "Take Photo" / "Choose from Library" / "Remove" (if exists). Use expo-image-picker. Save to expo-file-system documentDirectory.
- **VIN**: Text input, 17 chars max, uppercased. On blur with exactly 17 chars: call vinDecoder.decodeVin(). If successful, auto-fill Year, Make, Model with a brief "Auto-filled from VIN ✓" toast. If failed: show "Couldn't look up VIN" inline warning but allow manual entry.
- **Nickname**: Text input, required, max 30 chars. Placeholder: "e.g., The Corolla"
- **Year**: Number input, 4 digits, required
- **Make**: Text input, required
- **Model**: Text input, required
- **Trim**: Text input, optional
- **Fuel Type**: Segmented control: Gas / Diesel / Electric. Default: Gas. Changing this updates volumeUnit automatically.
- **Odometer Unit**: Segmented control: Miles / Kilometers. Default from settingsStore.
  - If EDITING and the value changes: show confirmation dialog "This will convert {N} odometer readings from {old} to {new}. Continue?" If confirmed, the save action will trigger unit conversion.
- **Fuel Capacity**: Number input, optional. Suffix: gal/L/kWh based on volumeUnit.

On Save (new):
1. Validate required fields
2. Call vehicleStore.addVehicle(data)
3. If this is the first vehicle, it auto-activates. If not: show bottom sheet "Make this the active vehicle?" Yes/No.
4. If settings.hasCompletedOnboarding is false: set it to true
5. router.back()

On Save (edit):
1. Validate
2. If odometerUnit changed: call unitConversion.convertVehicleOdometers(), then reload events
3. Call vehicleStore.updateVehicle(id, data)
4. router.back()

On Delete (edit, bottom of form):
1. If this is the only vehicle: show info dialog "Add another vehicle before deleting this one."
2. If this is the active vehicle and others exist: show picker "Choose the vehicle to activate after deleting {name}" with a list of other vehicles. On selection: set that one active, then delete.
3. If this is not active: show confirmation "Delete {name}? This will permanently remove {X} events and {Y} reminders." On confirm: call vehicleStore.deleteVehicle(id), router.back().

## 5. Manage Vehicles (app/(modals)/manage-vehicles.tsx)

Layout:
- ModalHeader: "Manage Vehicles" (Cancel only, no Save)
- Drag-to-reorder list of vehicle cards
  - Each card: photo (40px circle), nickname (bold), year make model, active badge (green dot)
  - Drag handle on the right
  - Tap opens vehicle edit modal
- "Add Vehicle" button at bottom

On reorder: call vehicleStore.reorderVehicles(orderedIds)

## 6. Data Export (app/(modals)/export.tsx)

Layout:
- ModalHeader: "Export Data" (Cancel, no Save)
- Vehicle picker: dropdown/bottom-sheet with all vehicles + "All Vehicles" option
- Date range: "From" date picker + "To" date picker (both optional, default = all time)
- "Export CSV" button (primary, full-width)

On export:
1. Call csvExport.exportVehicleData(vehicleId, startDate, endDate)
2. Use expo-sharing to open the system share sheet with the generated file
3. Show success toast or error

## 7. Settings Polish (app/(tabs)/settings.tsx)

Wire up the remaining settings items that were deferred:

- **Currency**: Tappable row showing current currency. Opens bottom sheet with list: USD ($), EUR (€), GBP (£), CAD (C$), AUD (A$). Selecting updates settingsStore. Currency symbol is used in all formatted values throughout the app.
- **Default Fuel Unit**: Tappable row → bottom sheet: Gallons, Litres. This only affects NEW vehicles.
- **Default Odometer Unit**: Tappable row → bottom sheet: Miles, Kilometers. This only affects NEW vehicles.

## 8. Polish Pass

### Error Handling
- Every store action that can fail should set an error state
- Create a global error toast/banner component that reads error from stores and auto-displays
- Errors auto-clear after 5 seconds or on next successful action
- Network errors (VIN decode): show inline message, don't block the form

### Loading States
- Use skeleton loaders (gray animated rectangles) for Dashboard metrics and charts while data loads
- Event list should show skeletons for 3 rows during initial load
- All bottom sheets should show a loading state if they fetch data

### Haptics
- Use expo-haptics: light impact on FAB tap, medium impact on delete swipe completion, success notification on event save

### Accessibility Audit
Go through every interactive element and ensure:
- accessibilityLabel is set on all icon-only buttons (FAB, edit, delete, etc.)
- Event type icons have labels ("Fuel event", "Service event", "Expense event")
- Charts have accessibilityLabel with text summary of the data
- All form fields have proper accessibilityLabel and accessibilityHint
- Status badges have labels ("Overdue reminder", "Upcoming reminder")
- Color-blind safety: event rows use icon + color (not color alone). Reminder status uses text + color.
- Dynamic type: test with iOS large text and Android font scale 1.5. No text should clip. Use minHeight not fixed height on rows.
- Reduced motion: check Appearance.getColorScheme() isn't the right one — use AccessibilityInfo.isReduceMotionEnabled() to disable chart animations and transition animations.

### Undo Snackbar Component (src/components/UndoSnackbar.tsx)
- Sits at the bottom of the screen, above the tab bar
- Shows when eventStore has a pending delete
- Text: "Event deleted" + "Undo" button
- Auto-dismisses after 5 seconds
- Appears on History tab (and persists if user switches tabs within the 5 seconds? No — dismisses on tab switch to keep it simple.)

## CRITICAL RULES FOR THIS PHASE

- **The vehicle delete flow has three branches — implement all three.** (1) Only vehicle: block with info dialog. (2) Active vehicle with others: picker to choose new active. (3) Non-active vehicle: confirm with count of cascading deletions. Do not simplify this to a single confirmation dialog. Each branch has different UX because the consequences are different.
- **Notifications must actually schedule.** Use expo-notifications scheduleNotificationAsync with a date trigger. After saving a reminder, you should be able to see the scheduled notification by calling getAllScheduledNotificationsAsync(). Store the returned identifier on the reminder record so it can be cancelled later. If you can't verify scheduling works in the simulator, at minimum write the code correctly and add a comment explaining how to test on a real device.
- **The accessibility audit is not a suggestion — it is a deliverable.** Go through every component you've built across all phases and add accessibilityLabel to every icon button, every status badge, every chart. Add accessibilityRole to buttons and links. Add accessible text alternatives to both charts. This is real work, not a checkmark.
- **Odometer unit conversion must be transactional.** When a vehicle switches from miles to km, every event and reminder for that vehicle must be updated in a single SQLite transaction. If any update fails, all must roll back. Do not convert records one at a time with individual UPDATE statements.
- **Error states must be visible.** If a VIN decode fails, the user must see an inline warning. If a CSV export fails, the user must see an error toast. If a notification permission is denied, the reminders tab must show a persistent banner. Do not fail silently anywhere.
- **Data round-trip is the final acceptance test.** Before you declare this phase done, mentally walk through: add vehicle → add 3 fuel events → add 1 service event with 2 service types → add 1 expense → set a reminder → kill the app → reopen → verify all data is present, dashboard metrics are correct, reminder status is accurate. If any of that would break, fix it.

## What to deliver
2. Vehicle add/edit/delete fully working with VIN decode, photo, unit conversion
3. Manage vehicles screen with drag-to-reorder
4. CSV export working end-to-end with share sheet
5. Settings fully wired (theme, currency, units)
6. Error handling, loading states, haptics, and accessibility in place
7. Complete end-to-end flows: first launch → onboarding → add vehicle → add events → see dashboard → set reminders → get notifications → export data
8. The app should be shippable as an MVP
