# AutoMate v2 — Implementation Guide

This document defines the phased build plan for AutoMate. Each phase must be completed and verified before starting the next. The full product specification is in `docs/PRD.md` — consult it for any product decisions not covered here.

Complete each phase in order. Do not skip ahead. After completing a phase, verify the app runs and the deliverables work before proceeding.

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

## What to deliver

1. A complete, runnable Expo project with all files listed above
2. Every query function implemented with parameterized SQL
3. Every business logic service implemented with the exact algorithms specified
4. The database initializes and seeds on first run
5. Placeholder screens in the app/ directory that just show the screen name as text
6. The app should start without errors

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
  - Vehicles �