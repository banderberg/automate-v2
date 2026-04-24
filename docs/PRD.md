# AutoMate v2 — Product Requirements Document

**Document version:** 1.0
**Last updated:** April 22, 2026
**Author:** Product Management
**Target platform:** Expo (React Native) with TypeScript
**Storage model:** Local-first (SQLite via expo-sqlite), optional cloud sync deferred to post-MVP

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Design Principles](#2-design-principles)
3. [User Personas](#3-user-personas)
4. [MVP vs Future Scope](#4-mvp-vs-future-scope)
5. [Information Architecture & Navigation](#5-information-architecture--navigation)
6. [Screen Specifications](#6-screen-specifications)
7. [Data Models](#7-data-models)
8. [User Flows](#8-user-flows)
9. [Business Logic & Calculations](#9-business-logic--calculations)
10. [Technical Architecture](#10-technical-architecture)
11. [Accessibility Requirements](#11-accessibility-requirements)
12. [Analytics & Instrumentation](#12-analytics--instrumentation)
13. [Future Enhancements](#13-future-enhancements)

---

## 1. Product Vision

AutoMate is a personal vehicle expense tracker that makes it effortless to log fuel purchases, maintenance, and general vehicle expenses, then surfaces actionable insights about cost of ownership.

The core promise: **know exactly what every mile costs you, with the least possible manual input.**

The app is local-first. All data lives on the device in SQLite. There is no mandatory account creation, no cloud dependency, and no data collection. Users own their data completely.

---

## 2. Design Principles

**2.1 — Fewer taps wins.** The most common action (logging a fill-up) should be completable in under 15 seconds. Every screen transition we add is a tax on the user. If a flow requires navigating to a separate screen, we need a strong reason.

**2.2 — Smart defaults over blank forms.** Pre-fill from the last entry: same station, same fuel grade, estimated odometer. The user corrects what changed rather than re-entering everything.

**2.3 — Show, don't tell.** Numbers in tables are not insights. Every metric should have a trend line. If fuel efficiency is declining, the user should see it at a glance, not calculate it mentally.

**2.4 — One vehicle at a time, all vehicles in reach.** Most interactions are scoped to the "active" vehicle, but switching should be instant (one tap, no full-screen navigation) and comparing vehicles should be possible.

**2.5 — No dead ends.** Empty states explain what the screen is for and offer a single clear action. Error states explain what went wrong and how to fix it. Loading states are skeletons, not spinners.

**2.6 — Respect the platform.** Use native patterns: bottom sheets instead of full-screen pickers, haptic feedback on destructive actions, system date pickers, swipe-to-delete with undo.

**2.7 — Accessible by default.** Every interactive element has a label. Color is never the sole differentiator. Text scales. Animations respect reduced-motion preferences.

---

## 3. User Personas

**3.1 — Daily Driver Dana**
Owns one car. Wants to track gas expenses and know her cost per mile for budgeting. Fills up once a week. Will not tolerate slow data entry. Needs the app to be faster than a note in her phone.

**3.2 — Fleet Manager Frank**
Manages 3–5 vehicles (family cars, work truck). Needs per-vehicle cost breakdowns, maintenance reminders, and exportable reports for tax purposes. Willing to invest setup time for ongoing payoff.

**3.3 — Car Enthusiast Carlos**
Owns a project car and a daily driver. Tracks every service meticulously. Wants detailed maintenance history, fuel efficiency trends, and the ability to attach photos/notes to events. Values data completeness over speed.

---

## 4. MVP vs Future Scope

### MVP (v2.0)

| Category | Features |
|----------|----------|
| Vehicles | Add/edit/delete vehicles, VIN decode, vehicle photo, multi-vehicle with instant switching, per-vehicle settings (odometer unit, fuel type, volume unit) |
| Fuel Events | Log fill-ups with date, odometer, volume, price, discount, partial fill flag, place, notes. Smart defaults from previous entry. Inline place picker. |
| Service Events | Log service visits with date, odometer, cost, service types (multi-select inline chips), place, notes. |
| Expense Events | Log general expenses with date, odometer (optional), cost, category, notes. |
| Reminders | Distance-based and/or time-based maintenance reminders with local notifications. |
| Dashboard | Cost summary by period, fuel efficiency trend chart, cost-per-mile metric, spending breakdown by category (donut chart). |
| History | Unified event timeline with filtering by type. Tap to edit. Swipe to delete with undo. |
| Places | Gas stations and service shops with name, address, GPS coordinates. Inline creation during event entry. |
| Settings | Theme (light/dark/system), currency, default units, data export (CSV). |
| Onboarding | Zero-account start. Guided first-vehicle setup. No mandatory auth. |

### Post-MVP (v2.x)

| Version | Features |
|---------|----------|
| v2.1 | Receipt OCR (camera scan to auto-populate fuel event fields), recurring expenses (insurance, registration, loan payments on a schedule) |
| v2.2 | Cloud backup and sync (optional account creation, end-to-end encrypted), multi-device access |
| v2.3 | Maintenance schedule templates (pre-loaded by make/model/year from NHTSA data), trip logging for mileage reimbursement |
| v2.4 | Multi-currency support with conversion, vehicle comparison dashboard, PDF report generation |
| v2.5 | Widgets (iOS/Android home screen quick-add), Apple Watch / Wear OS complication for odometer entry, barcode scanning for VIN |

---

## 5. Information Architecture & Navigation

### 5.1 Navigation Model

The app uses a bottom tab bar with 4 tabs. A persistent vehicle switcher is accessible from every tab via a top bar component.

```
Bottom Tabs:
  ├── Dashboard (home/default)
  ├── History
  ├── Reminders
  └── Settings

Presented Modally (bottom sheet or full-screen modal):
  ├── Add/Edit Fuel Event
  ├── Add/Edit Service Event
  ├── Add/Edit Expense Event
  ├── Add/Edit Vehicle
  ├── Add/Edit Reminder
  ├── Add/Edit Place
  └── Data Export

Inline Components (no navigation):
  ├── Vehicle Switcher (dropdown/sheet from top bar)
  ├── Place Picker (autocomplete + inline add)
  ├── Service Type Picker (chip multi-select)
  ├── Category Picker (chip single-select)
  └── Date Picker (system native)
```

### 5.2 Tab Bar Behavior

The tab bar always shows all 4 tabs. If no vehicle exists, tapping any tab other than Settings triggers the Add Vehicle flow as a full-screen modal.

Tab icons and labels:

| Tab | Icon | Label |
|-----|------|-------|
| Dashboard | `BarChart3` | Dashboard |
| History | `Clock` | History |
| Reminders | `Bell` | Reminders |
| Settings | `Settings` | Settings |

### 5.3 Vehicle Switcher

Present on every tab screen as a tappable header component showing the active vehicle name and a chevron. Tapping opens a bottom sheet listing all vehicles. Tapping a vehicle instantly switches context. A "Manage Vehicles" link at the bottom of the sheet navigates to the vehicle list/edit flow.

### 5.4 Add Event Entry Point

A floating action button (FAB) is visible on the Dashboard and History tabs. Tapping it opens a bottom sheet with three options: "Fill-Up", "Service", "Expense". Each opens the corresponding modal form. On the Dashboard tab, if the vehicle's fuel type is electric, the label reads "Charge" instead of "Fill-Up".

---

## 6. Screen Specifications

### 6.1 Dashboard

**Purpose:** At-a-glance view of the active vehicle's cost of ownership and fuel efficiency.

**Layout (top to bottom):**

1. **Vehicle header:** Active vehicle name, year/make/model, photo thumbnail, switcher chevron.
2. **Period selector:** Horizontal scrollable pill buttons: 1M, 3M, 6M, YTD, 1Y, All. Default: 3M.
3. **Key metrics row:** Three cards side by side:
   - **Total Spent** — sum of all event costs in period, formatted as currency
   - **Cost / Mile** (or km) — total cost ÷ distance driven in period
   - **Avg Fuel Efficiency** — distance per volume unit, with trend arrow (↑ better, ↓ worse vs. previous period)
4. **Fuel efficiency trend chart:** Line chart showing MPG (or km/L, or mi/kWh) over time for the selected period. Each data point is one fill-up. Partial fills are excluded from efficiency calculation but still plotted as hollow dots.
5. **Spending breakdown:** Donut chart with three segments: Fuel, Service, Expenses. Tapping a segment shows the dollar amount and percentage.
6. **Recent events:** Last 5 events as a compact list. "See all" links to the History tab.

**Empty state:** Illustration of a car with text: "Add your first event to see your dashboard. Tap + to get started."

**Acceptance criteria:**
- AC-1: Period selector filters all metrics and charts to the selected date range.
- AC-2: Cost-per-mile calculates as: (sum of all event costs) ÷ (max odometer − min odometer) within the period. If fewer than 2 events with odometer readings exist, display "—" with tooltip "Need more data."
- AC-3: Fuel efficiency excludes partial fills from the numerator/denominator but includes them in the chart as visually distinct points.
- AC-4: Trend arrow compares the selected period's average efficiency to the immediately preceding period of equal length.
- AC-5: Dashboard loads in under 500ms for up to 1,000 events.

---

### 6.2 History

**Purpose:** Chronological log of every event for the active vehicle, with the ability to filter, search, and manage events.

**Layout:**

1. **Filter bar:** Horizontal toggle chips: All, Fuel, Service, Expense. Multi-select. Default: All.
2. **Event list:** Grouped by month (e.g., "April 2026"). Each group shows the month's total spend. Events within a month are sorted by date descending (newest first).

**Event row design:** Single row per event showing:
- Left: Event type icon (colored circle: teal for fuel, orange for service, green for expense)
- Center: Primary line = date + place name (if any). Secondary line = odometer reading + unit.
- Right: Cost in currency format.

Tapping a row opens the event's edit modal. Swiping left reveals a red "Delete" action. Deleting shows an undo snackbar for 5 seconds.

**FAB:** Present, same behavior as Dashboard.

**Empty state:** "No events yet. Tap + to log your first fill-up, service, or expense."

**Acceptance criteria:**
- AC-1: Filter chips are additive (selecting Fuel + Service shows both). Deselecting all resets to All.
- AC-2: Swipe-to-delete removes the event from the list immediately and enqueues a database delete. Tapping "Undo" on the snackbar cancels the delete and restores the row.
- AC-3: List performance is smooth (60fps scroll) with up to 5,000 events via virtualized FlatList.
- AC-4: Month group headers are sticky during scroll.

---

### 6.3 Reminders

**Purpose:** Manage recurring maintenance and expense reminders for the active vehicle.

**Layout:**

1. **Reminder list:** Each card shows:
   - Reminder name (e.g., "Oil Change")
   - Next due: "{distance} miles" and/or "{date}" depending on configuration
   - Status badge: "Upcoming" (> 30 days / > 1,000 mi), "Soon" (≤ 30 days or ≤ 1,000 mi), "Overdue" (past date or exceeded distance)
   - Progress bar showing how close the user is to the trigger threshold
2. **Add button:** "+" in the top right or an "Add Reminder" card at the bottom of the list.

**Empty state:** "No reminders set. Never miss an oil change — tap + to create one."

**Acceptance criteria:**
- AC-1: Status badge updates automatically based on current odometer (derived from most recent event) and current date.
- AC-2: "Overdue" reminders sort to the top.
- AC-3: Local notification fires at 8:00 AM on the computed next-due date. Notification title: "AutoMate Reminder". Body: "{Reminder name} is due for {Vehicle name}."
- AC-4: When an event is logged that matches a reminder's service/expense type, the reminder's "last completed" baseline automatically updates and the next-due recalculates.

---

### 6.4 Settings

**Purpose:** App-level preferences and data management.

**Layout (grouped list):**

**Appearance**
- Theme: System / Light / Dark (default: System)

**Defaults**
- Currency: Picker from supported list (USD, EUR, GBP, CAD, AUD). Default: based on device locale.
- Default Fuel Unit: Gallons / Litres / kWh. Default: based on device locale.
- Default Odometer Unit: Miles / Kilometers. Default: based on device locale.

**Vehicles**
- Manage Vehicles → navigates to vehicle list (add, edit, delete, reorder)

**Data**
- Export Data → opens export modal (CSV, per-vehicle or all vehicles)
- About AutoMate → version, licenses, support link

**Acceptance criteria:**
- AC-1: Theme changes apply instantly without app restart.
- AC-2: Changing default units does not retroactively convert existing data. It only affects new entries.
- AC-3: CSV export produces one file per vehicle with columns: Date, Type, Odometer, OdometerUnit, Cost, Volume, VolumeUnit, PricePerUnit, Place, Notes, ServiceTypes. File is shared via the system share sheet.

---

### 6.5 Add/Edit Vehicle (Modal)

**Purpose:** Create or modify a vehicle profile.

**Presented as:** Full-screen modal with "Cancel" (top-left) and "Save" (top-right).

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Photo | Image picker | No | Camera or gallery. Stored locally. Circular preview. |
| Nickname | Text | Yes | Max 30 chars. e.g., "The Corolla" |
| VIN | Text | No | 17 chars. On valid VIN entry, auto-populates Year, Make, Model via NHTSA API. |
| Year | Number | Yes | 4 digits. Auto-filled from VIN if provided. |
| Make | Text | Yes | Auto-filled from VIN. |
| Model | Text | Yes | Auto-filled from VIN. |
| Trim | Text | No | e.g., "SE", "Limited" |
| Fuel Type | Segmented control | Yes | Gas / Diesel / Electric. Default: Gas. |
| Odometer Unit | Segmented control | Yes | Miles / Kilometers. Default: app-level setting. |
| Volume Unit | Derived | — | Automatically set: Gas/Diesel → app-level fuel unit default. Electric → kWh. Not user-editable here. |
| Fuel Capacity | Number | No | Tank/battery size. Units match volume unit. |

**Behavior on save:**
- If this is the first vehicle, it becomes active automatically.
- If this is a new vehicle added when others exist, prompt: "Make this the active vehicle?" (Yes/No).
- Validation: Nickname required, Year must be 1900–current+1, Make required, Model required.

**Delete:** Available only when editing. If the vehicle is active and is the only vehicle, block deletion with an explanation. If the vehicle is active and other vehicles exist, prompt the user to choose which vehicle becomes active. If the vehicle is not active, confirm and delete (cascade deletes all associated events and reminders with a warning message stating the count).

**Acceptance criteria:**
- AC-1: VIN decode populates Year, Make, Model within 3 seconds. If network unavailable, show inline warning "Couldn't look up VIN — enter details manually" and allow save.
- AC-2: Changing odometer unit on an existing vehicle converts all associated event odometer readings and reminder distance thresholds using the standard conversion factor (1 mi = 1.60934 km). A confirmation dialog warns: "This will convert {N} odometer readings from miles to kilometers. Continue?"
- AC-3: Vehicle photo is persisted to the app's document directory, not the camera roll.
- AC-4: Deleting a vehicle permanently removes all associated events and reminders. The confirmation dialog states: "Delete {name}? This will permanently remove {X} events and {Y} reminders. This cannot be undone."

---

### 6.6 Add/Edit Fuel Event (Modal)

**Purpose:** Log a fuel purchase or electric charge.

**Presented as:** Full-screen modal. Title: "Add Fill-Up" / "Edit Fill-Up" (or "Add Charge" / "Edit Charge" for electric).

**Smart defaults on open (new event only):**
- Date: today
- Odometer: estimated from last event's odometer + average daily mileage (if sufficient history), otherwise blank
- Volume Unit: vehicle's volume unit
- Price per unit: last fill-up's price per unit for this vehicle
- Place: last fill-up's place for this vehicle (if GPS is within 500m of that place's coordinates, auto-confirm; otherwise, present as suggestion)

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | Date picker | Yes | Default: today. Cannot be in the future. |
| Odometer | Number (formatted with comma separators) | Yes | Helper text shows estimated current odometer. Validates: must be ≥ nearest prior event's odometer and ≤ nearest subsequent event's odometer for the given date. |
| Volume | Decimal (1 decimal place) | Yes | Amount of fuel/energy added. |
| Price / Unit | Currency (2 decimal places) | Yes | Cost per gallon/litre/kWh. |
| Discount / Unit | Currency (2 decimal places) | No | Rewards discount per unit. Must be less than price. |
| Total Cost | Currency (read-only, computed) | — | = volume × (price − discount). Displayed prominently. |
| Partial Fill | Toggle | No | Default: off. When on, this fill-up is excluded from efficiency calculations. |
| Place | Autocomplete + inline add | No | Type-ahead search of saved gas stations. "Add new place" option at bottom creates a place inline (name required, address and GPS optional). |
| Notes | Multiline text | No | Max 500 chars. Free-form. |

**Acceptance criteria:**
- AC-1: Total cost updates in real-time as volume, price, and discount change.
- AC-2: Odometer validation runs on blur. If the entered value violates chronological ordering, show inline error: "Must be between {min} and {max} based on nearby events."
- AC-3: If the user has ≥ 3 previous fill-ups, the odometer field pre-fills with an estimate. The estimate is: last odometer + (average miles per day × days since last event).
- AC-4: Smart defaults load in under 200ms from local DB.
- AC-5: Saving triggers reminder recalculation for any reminders linked to fuel-related service types.

---

### 6.7 Add/Edit Service Event (Modal)

**Purpose:** Log a maintenance or repair visit.

**Presented as:** Full-screen modal. Title: "Add Service" / "Edit Service".

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | Date picker | Yes | Default: today. |
| Odometer | Number (formatted) | Yes | Same validation as fuel event. |
| Service Types | Multi-select chip picker | Yes (≥ 1) | Inline scrollable chip list of service types. Tapping a chip toggles selection. "Manage" link opens a bottom sheet to add/edit/delete custom service types. Pre-seeded with common types (Oil Change, Tire Rotation, Brakes, etc.). |
| Total Cost | Currency | Yes | User-entered total for the visit. |
| Place | Autocomplete + inline add | No | Filtered to service stations. |
| Notes | Multiline text | No | Max 500 chars. |

**Acceptance criteria:**
- AC-1: At least one service type must be selected. If the user tries to save with none selected, highlight the service types section with an error.
- AC-2: Adding a custom service type is a single text field in a bottom sheet — name only, no navigation away from the form.
- AC-3: Saving triggers reminder recalculation for any reminders linked to the selected service types.

---

### 6.8 Add/Edit Expense Event (Modal)

**Purpose:** Log a general vehicle expense (registration, parking, tolls, accessories, etc.).

**Presented as:** Full-screen modal. Title: "Add Expense" / "Edit Expense".

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | Date picker | Yes | Default: today. |
| Odometer | Number (formatted) | No | Optional for expenses that don't involve driving (e.g., insurance). |
| Category | Single-select chip picker | Yes | Pre-seeded: Registration, Insurance, Parking, Tolls, Accessories, Other. User can add custom categories via "Manage" link. |
| Total Cost | Currency | Yes | |
| Notes | Multiline text | No | Max 500 chars. |

**Acceptance criteria:**
- AC-1: Odometer is optional (not required) unlike fuel and service events, since expenses like insurance aren't mileage-dependent.
- AC-2: If odometer is provided, it follows the same chronological validation rules.

---

### 6.9 Add/Edit Reminder (Modal)

**Purpose:** Set a recurring maintenance or expense reminder.

**Presented as:** Full-screen modal. Title: "Add Reminder" / "Edit Reminder".

**Simplified flow:**

1. **Pick what:** A single-select list of all service types and expense categories (grouped into two sections: "Maintenance" and "Expenses"). This list is inline on the form, not a separate screen.
2. **Pick when:** Two optional sections, at least one required:
   - **By distance:** Toggle on → enter interval in miles/km (e.g., "Every 5,000 mi")
   - **By time:** Toggle on → enter interval as a number + unit picker (Days / Weeks / Months / Years) (e.g., "Every 6 months")
3. **Starting from:** Auto-populated from the most recent matching event's date/odometer. If no matching event exists, the user enters an initial date and/or odometer.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Reminder Type | Single-select from grouped list | Yes | |
| Repeat by Distance | Toggle + number input | Conditional | At least one of distance/time required. |
| Distance Interval | Number | If distance toggled on | In vehicle's odometer unit. |
| Repeat by Time | Toggle + number + unit picker | Conditional | |
| Time Interval | Number | If time toggled on | |
| Time Unit | Picker: Days, Weeks, Months, Years | If time toggled on | |
| Starting Odometer | Number | If distance on + no prior event | |
| Starting Date | Date picker | If time on + no prior event | |

**Acceptance criteria:**
- AC-1: At least one of "By distance" or "By time" must be enabled. Attempting to save with neither shows an error.
- AC-2: If a matching event exists, "Starting from" is read-only and shows "Last {type} on {date} at {odometer}."
- AC-3: The reminder card on the Reminders tab immediately reflects the new/updated reminder.
- AC-4: Local notification is scheduled (or rescheduled) on save.
- AC-5: Deleting a reminder cancels its pending notification.

---

### 6.10 Add/Edit Place (Inline or Bottom Sheet)

**Purpose:** Save a frequently visited gas station or service shop.

**Presented as:** Bottom sheet from within an event form, or as a list item in a management view accessible from the event form.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text | Yes | Max 40 chars. |
| Type | Segmented: Gas Station / Service Shop / Other | Yes | Pre-selected based on the event type that triggered creation. |
| Address | Text | No | |
| GPS Coordinates | Auto-captured or map pin | No | "Use current location" button captures device GPS. "Pick on map" opens an inline map view. Reverse geocodes to populate address. |

**Acceptance criteria:**
- AC-1: Creating a place from within a fuel event form auto-selects "Gas Station" type.
- AC-2: GPS capture requires location permission. If denied, the button is disabled with a note: "Enable location access in Settings."
- AC-3: Place is saved and immediately selectable in the parent event form without dismissing the form.

---

### 6.11 Manage Vehicles (Screen)

**Purpose:** View, reorder, and manage all vehicles.

**Accessed from:** Settings → Manage Vehicles, or the Vehicle Switcher bottom sheet → "Manage Vehicles" link.

**Layout:**
- Drag-to-reorder list of vehicle cards. Each card shows: photo (or placeholder), nickname, year/make/model, active badge if applicable.
- Tapping a card opens the Edit Vehicle modal.
- "Add Vehicle" button at the bottom.

**Acceptance criteria:**
- AC-1: Reorder persists to DB immediately on drop.
- AC-2: Sort order is reflected in the Vehicle Switcher sheet.

---

### 6.12 Data Export (Modal)

**Purpose:** Export vehicle data as CSV for tax records, insurance claims, or vehicle sale.

**Presented as:** Bottom sheet.

**Options:**
- Vehicle picker: dropdown of all vehicles + "All Vehicles"
- Date range: optional start and end date (default: all time)
- Export button → generates CSV → opens system share sheet

**CSV columns:** Date, EventType, Odometer, OdometerUnit, Cost, Volume, VolumeUnit, PricePerUnit, DiscountPerUnit, PartialFill, Place, ServiceTypes, Category, Notes

**Acceptance criteria:**
- AC-1: CSV uses UTF-8 encoding with BOM for Excel compatibility.
- AC-2: Date format is ISO 8601 (YYYY-MM-DD).
- AC-3: Export of 5,000 events completes in under 3 seconds.

---

### 6.13 Onboarding (First Launch)

**Purpose:** Get the user to a functional app state as quickly as possible.

**Flow:**
1. **Welcome screen:** App name, tagline ("Track every mile, own every dollar."), single "Get Started" button. No account creation. No permission requests yet.
2. **Add your vehicle:** The Add Vehicle modal opens. Minimum viable input: Nickname, Year, Make, Model, Fuel Type. VIN and photo can be skipped.
3. **Done:** Vehicle saves. App navigates to Dashboard with the empty state. A subtle coach mark points to the FAB: "Tap here to log your first fill-up."

**Acceptance criteria:**
- AC-1: Onboarding is completable in under 60 seconds.
- AC-2: No permissions are requested until the user takes an action that requires them (camera for photo, location for place GPS).
- AC-3: The onboarding flow does not reappear after a vehicle is created.

---

## 7. Data Models

All IDs are UUIDs (string) generated client-side to support future sync without ID conflicts.

### 7.1 Vehicle

```typescript
interface Vehicle {
  id: string;                    // UUID
  sortOrder: number;             // For list ordering
  nickname: string;              // User-given name, required
  make: string;                  // Required
  model: string;                 // Required
  year: number;                  // Required, 1900–current+1
  trim?: string;
  vin?: string;                  // 17 characters if provided
  fuelType: 'gas' | 'diesel' | 'electric';
  odometerUnit: 'miles' | 'kilometers';
  volumeUnit: 'gallons' | 'litres' | 'kWh'; // Derived from fuelType + app default
  fuelCapacity?: number;         // In volumeUnit
  imagePath?: string;            // Local file path
  isActive: boolean;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### 7.2 Event (Unified)

A single table replaces three separate event tables. The `type` discriminator determines which fields are populated.

```typescript
interface Event {
  id: string;                    // UUID
  vehicleId: string;             // FK → Vehicle
  type: 'fuel' | 'service' | 'expense';
  date: string;                  // ISO 8601 date (YYYY-MM-DD)
  odometer?: number;             // Required for fuel and service, optional for expense
  cost: number;                  // Total cost. For fuel: computed. For service/expense: user-entered.

  // Fuel-specific fields (null for other types)
  volume?: number;
  pricePerUnit?: number;
  discountPerUnit?: number;
  isPartialFill?: boolean;

  // Relationships
  placeId?: string;              // FK → Place
  categoryId?: string;           // FK → Category (expenses only)
  notes?: string;                // Max 500 chars

  createdAt: string;
  updatedAt: string;
}
```

### 7.3 Service Type

A flat, user-manageable list of maintenance items.

```typescript
interface ServiceType {
  id: string;                    // UUID
  name: string;                  // e.g., "Oil Change"
  isDefault: boolean;            // Seed data = true; user-created = false
  sortOrder: number;
  createdAt: string;
}
```

### 7.4 Event Service Type (Junction)

Many-to-many between events (type = 'service') and service types.

```typescript
interface EventServiceType {
  eventId: string;               // FK → Event
  serviceTypeId: string;         // FK → ServiceType
  // Composite PK: (eventId, serviceTypeId)
}
```

### 7.5 Category

For expense classification. Separate from service types.

```typescript
interface Category {
  id: string;                    // UUID
  name: string;                  // e.g., "Registration", "Insurance"
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}
```

### 7.6 Place

```typescript
interface Place {
  id: string;                    // UUID
  name: string;                  // Required
  type: 'gas_station' | 'service_shop' | 'other';
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}
```

### 7.7 Reminder

```typescript
interface Reminder {
  id: string;                    // UUID
  vehicleId: string;             // FK → Vehicle
  serviceTypeId?: string;        // FK → ServiceType (for maintenance reminders)
  categoryId?: string;           // FK → Category (for expense reminders)
  // Exactly one of serviceTypeId or categoryId must be set.

  distanceInterval?: number;     // e.g., 5000 (in vehicle's odometer unit)
  timeInterval?: number;         // e.g., 6
  timeUnit?: 'days' | 'weeks' | 'months' | 'years';
  // At least one of distance or time must be configured.

  baselineOdometer?: number;     // Starting point for distance calc
  baselineDate?: string;         // Starting point for time calc (ISO 8601)

  notificationId?: string;       // Expo notification identifier for cancellation

  createdAt: string;
  updatedAt: string;
}
```

### 7.8 App Settings

Stored as key-value pairs in a simple SQLite settings table.

```typescript
interface AppSettings {
  theme: 'system' | 'light' | 'dark';       // Default: 'system'
  currency: string;                           // ISO 4217 code. Default: locale-derived.
  defaultFuelUnit: 'gallons' | 'litres';     // Default: locale-derived
  defaultOdometerUnit: 'miles' | 'kilometers'; // Default: locale-derived
  hasCompletedOnboarding: boolean;
}
```

### 7.9 Seed Data

**Service Types (isDefault: true):**
Oil Change, Oil Filter, Tire Rotation, Tire Replacement, Tire Alignment, Tire Pressure, Brakes (Front), Brakes (Rear), Brake Fluid, Battery, Cabin Air Filter, Engine Air Filter, Coolant, Transmission Fluid, Power Steering Fluid, Spark Plugs, Windshield Wipers, Headlights, Brake Lights, Air Conditioning, Radiator, Windshield, Fuel Filter

**Categories (isDefault: true):**
Registration, Insurance, Parking, Tolls, Car Wash, Accessories, Other

### 7.10 Entity Relationships

```
Vehicle (1) ───< (N) Event
Vehicle (1) ───< (N) Reminder
Place (1) ───< (N) Event
Category (1) ───< (N) Event (where type = 'expense')
ServiceType (N) >──< (N) Event (where type = 'service') via EventServiceType
ServiceType (1) ───< (N) Reminder (where serviceTypeId is set)
Category (1) ───< (N) Reminder (where categoryId is set)
```

---

## 8. User Flows

### 8.1 First Launch → First Fill-Up (Critical Path)

```
Open app
  → Welcome screen → "Get Started"
  → Add Vehicle modal (nickname, year, make, model, fuel type)
  → Save → Dashboard (empty state + coach mark on FAB)
  → Tap FAB → "Fill-Up"
  → Fuel event form (date pre-filled, enter odometer + volume + price)
  → Save → Dashboard populates with first data point
```

**Target time: under 2 minutes from install to first event logged.**

### 8.2 Repeat Fill-Up (Steady State)

```
Open app (lands on Dashboard)
  → Tap FAB → "Fill-Up"
  → Form opens with smart defaults:
      Date: today
      Odometer: estimated (last + avg daily miles × days elapsed)
      Price/unit: last fill-up's price
      Place: last fill-up's place (if GPS match)
  → User adjusts odometer and volume (2 fields)
  → Save
```

**Target time: under 15 seconds.**

### 8.3 Check Maintenance Status

```
Tap Reminders tab
  → See list sorted by urgency (Overdue → Soon → Upcoming)
  → See "Oil Change: 800 mi remaining" with progress bar at 84%
  → Tap reminder → Edit Reminder modal (view details or adjust interval)
```

### 8.4 Monthly Budget Review

```
Tap Dashboard tab
  → Switch period to "1M"
  → See total spent, cost/mile, efficiency trend
  → Tap donut chart "Service" segment → see $284.00 (47%)
  → Tap "See all" → History tab filtered to current month
```

### 8.5 Export for Taxes

```
Tap Settings tab → Export Data
  → Select vehicle (or "All Vehicles")
  → Select date range (Jan 1 – Dec 31 of tax year)
  → Tap "Export CSV"
  → System share sheet opens → send to Files, email, etc.
```

---

## 9. Business Logic & Calculations

### 9.1 Fuel Efficiency

**Formula (for gas/diesel):**

For each pair of consecutive non-partial fill-ups, efficiency = distance ÷ volume of the later fill-up.

```
efficiency_segment = (odometer[i] - odometer[i-1]) / volume[i]
```

Where `fill-up[i]` and `fill-up[i-1]` are both non-partial. If a partial fill occurs between two full fills, the partial's volume is added to the later fill's volume for the calculation:

```
adjusted_volume = volume[i] + sum(partial_volumes between i-1 and i)
efficiency_segment = (odometer[i] - odometer[i-1]) / adjusted_volume
```

The **average efficiency** for a period is the distance-weighted mean of all valid segments within that period.

For electric vehicles, the same formula applies but the unit is mi/kWh or km/kWh.

### 9.2 Cost Per Mile

```
cost_per_mile = total_cost_in_period / (max_odometer - min_odometer)
```

Where `total_cost_in_period` includes fuel, service, and expense events. Only events with odometer readings contribute to the denominator. If the denominator is 0 (fewer than 2 events with odometers), display "—".

### 9.3 Odometer Estimation

When pre-filling the odometer for a new event:

```
estimated_odometer = last_event_odometer + (avg_daily_miles × days_since_last_event)
```

Where `avg_daily_miles` is calculated from the most recent 10 events:

```
avg_daily_miles = (odometer_of_most_recent - odometer_of_10th_most_recent) / days_between_them
```

If fewer than 3 events with odometer readings exist, do not estimate — leave the field blank.

### 9.4 Odometer Validation

When the user enters an odometer reading for a given date:

1. Find the nearest event with an odometer reading that occurred **before** the entered date. Call its odometer `floor`.
2. Find the nearest event with an odometer reading that occurred **after** the entered date. Call its odometer `ceiling`.
3. The entered value must satisfy: `floor ≤ entered ≤ ceiling`.
4. If no floor exists, only validate against ceiling (and vice versa).
5. If neither exists, any positive integer is valid.

### 9.5 Odometer Unit Conversion

When a vehicle's odometer unit changes:

```
new_odometer = old_odometer × conversion_factor
```

Conversion factors:
- Miles → Kilometers: × 1.60934
- Kilometers → Miles: × 0.62137

Applied to: all events for that vehicle (odometer field), all reminders for that vehicle (distanceInterval, baselineOdometer). Values are rounded to the nearest integer after conversion.

### 9.6 Reminder Scheduling

**Next due date (time-based):**

```
next_due_date = baseline_date + (time_interval × time_unit)
```

Where `baseline_date` is the date of the most recent event matching the reminder's service type or category. If no matching event exists, `baseline_date` is the user-entered starting date.

**Next due odometer (distance-based):**

```
next_due_odometer = baseline_odometer + distance_interval
```

**Distance remaining:**

```
distance_remaining = next_due_odometer - current_vehicle_odometer
```

Where `current_vehicle_odometer` is the highest odometer reading across all events for the vehicle.

**Status determination:**

| Condition | Status |
|-----------|--------|
| Due date > 30 days away AND distance remaining > 1,000 | Upcoming |
| Due date ≤ 30 days away OR distance remaining ≤ 1,000 | Soon |
| Due date is past OR distance remaining ≤ 0 | Overdue |

---

## 10. Technical Architecture

### 10.1 Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52+ (managed workflow) |
| Language | TypeScript (strict mode) |
| Navigation | Expo Router (file-based routing) |
| State Management | Zustand (lightweight, minimal boilerplate, good TypeScript support) |
| Local Database | expo-sqlite (synchronous API for reads, async for writes) |
| Notifications | expo-notifications |
| Image Picker | expo-image-picker |
| Location | expo-location |
| File System | expo-file-system |
| Charts | Victory Native or react-native-gifted-charts |
| Map | react-native-maps (for place picker) |
| Styling | NativeWind (Tailwind CSS for React Native) or StyleSheet with design tokens |

### 10.2 Project Structure

```
app/
  (tabs)/
    _layout.tsx          # Tab navigator
    dashboard.tsx
    history.tsx
    reminders.tsx
    settings.tsx
  (modals)/
    vehicle.tsx          # Add/edit vehicle
    fuel-event.tsx
    service-event.tsx
    expense-event.tsx
    reminder.tsx
    export.tsx
  _layout.tsx            # Root layout (modals + tabs)
  onboarding.tsx

src/
  db/
    schema.ts            # Table definitions
    migrations.ts        # Version-based migration runner
    queries/             # Typed query functions per entity
  stores/
    vehicleStore.ts      # Zustand store
    eventStore.ts
    reminderStore.ts
    settingsStore.ts
  services/
    vinDecoder.ts        # NHTSA API integration
    notifications.ts     # Scheduling logic
    csvExport.ts
    odometerEstimator.ts
  hooks/
    useActiveVehicle.ts
    useDashboardMetrics.ts
    useOdometerValidation.ts
    useSmartDefaults.ts
  components/
    VehicleSwitcher.tsx
    EventRow.tsx
    MetricCard.tsx
    ChipPicker.tsx
    PlaceAutocomplete.tsx
    FuelEfficiencyChart.tsx
    SpendingDonut.tsx
    ReminderCard.tsx
    EmptyState.tsx
  constants/
    seedData.ts
    units.ts
    theme.ts
```

### 10.3 Database

**Engine:** expo-sqlite with WAL mode enabled for concurrent read performance.

**Migrations:** Version-based. Each migration is a numbered SQL file. The app checks the current version on launch and runs pending migrations sequentially. Version is stored in a `_meta` table.

**Indexing strategy:**
- `event.vehicleId` + `event.date` (composite, for period queries)
- `event.vehicleId` + `event.odometer` (composite, for range validation)
- `reminder.vehicleId`
- `place.type`

**No ORM.** Use typed query functions that return typed interfaces. Raw SQL with parameterized queries exclusively — no string interpolation.

### 10.4 State Management

Zustand stores act as the read-through cache for SQLite data. On app launch:
1. Load active vehicle from DB.
2. Load events for active vehicle into eventStore.
3. Load reminders for active vehicle into reminderStore.
4. Load places and service types/categories into their respective stores.

On vehicle switch:
1. Update active vehicle in DB and vehicleStore.
2. Reload events and reminders for the new vehicle.

Store mutations always write to SQLite first, then update the in-memory store. If the DB write fails, the store is not updated and an error is surfaced to the UI.

### 10.5 Notification Strategy

- Use `expo-notifications` with `scheduleNotificationAsync`.
- Store the notification identifier on the Reminder record for cancellation.
- On every event save: query reminders whose service types overlap with the saved event's service types → recalculate → reschedule.
- Permission is requested lazily: the first time a user creates a reminder, prompt for notification permission. If denied, reminders still work visually in-app but no push notification fires. Show a banner on the Reminders tab: "Enable notifications to get reminded outside the app."

### 10.6 VIN Decode

Use the NHTSA Vehicle API (free, no key required):

```
GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
```

Extract `ModelYear`, `Make`, `Model` from the response. Wrap in a try-catch with a 5-second timeout. On failure, allow manual entry.

### 10.7 Performance Targets

| Metric | Target |
|--------|--------|
| App launch to interactive Dashboard | < 1 second (warm) |
| Add event modal open to interactive | < 300ms |
| History list scroll (5,000 events) | 60fps |
| Dashboard metric calculation (1,000 events) | < 500ms |
| CSV export (5,000 events) | < 3 seconds |
| SQLite query (event range for odometer validation) | < 50ms |

---

## 11. Accessibility Requirements

### 11.1 Screen Reader

- Every interactive element must have an `accessibilityLabel`.
- Event type icons must have labels: "Fuel event", "Service event", "Expense event".
- Chart data must have an accessible text alternative (e.g., "Fuel efficiency over the last 3 months: average 28.4 miles per gallon, trend increasing").
- Modal open/close must announce via `accessibilityLiveRegion`.

### 11.2 Visual

- Color is never the sole differentiator. Event types use both color AND icon AND label text.
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text (per WCAG 2.1 AA).
- Support dynamic type scaling. No fixed heights on content containers — use min-height and flex.
- Respect `prefers-reduced-motion`: disable chart animations and transition animations when set.

### 11.3 Motor

- All tap targets minimum 44×44 points.
- Swipe-to-delete has a non-swipe alternative (long-press context menu with "Delete" option).
- No time-limited interactions except the undo snackbar (5 seconds), which is generous.

### 11.4 Cognitive

- Empty states provide clear guidance, not just "no data" messages.
- Error messages state the problem AND the fix: "Odometer must be at least 45,231 based on your fill-up on Mar 12."
- Destructive actions require confirmation with explicit consequence description.
- Undo is available for all deletes (5-second snackbar).

---

## 12. Analytics & Instrumentation

**Privacy-first approach.** No third-party analytics SDK in MVP. All instrumentation is local:

- **Error logging:** Capture unhandled JS exceptions and SQLite errors to a local `error_log` table. Display a "Report a problem" option in Settings that generates a sanitized error log (no PII) the user can share via email.
- **Usage patterns (future):** If we add optional telemetry post-MVP, it must be opt-in with a clear toggle in Settings, anonymized, and limited to: screen view counts, feature usage frequency, and crash reports. No event data, no vehicle data, no location data ever leaves the device without explicit user consent.

---

## 13. Future Enhancements

Ordered by estimated user impact, descending.

| Priority | Enhancement | Description |
|----------|-------------|-------------|
| P1 | Receipt OCR | Camera captures gas receipt → ML model extracts total, price/gal, volume, date. User confirms/corrects. Reduces fill-up entry to 2 taps. |
| P1 | Cloud Backup | Optional account creation (email or Apple/Google sign-in). E2E encrypted backup to cloud storage. Restore on new device. |
| P2 | Recurring Expenses | Template for regular bills (insurance, loan payment, parking pass). Auto-generates expense events on a schedule. |
| P2 | Maintenance Schedules | Import manufacturer-recommended service intervals by make/model/year. Auto-creates reminders. |
| P2 | PDF Reports | Generate a formatted vehicle report: ownership summary, maintenance history, cost analysis. Useful for vehicle sale or insurance. |
| P3 | Trip Logging | Start/stop trip recording for mileage reimbursement. Logs start and end odometer, date, purpose (business/personal/medical). Exportable for IRS mileage deduction. |
| P3 | Multi-Currency | Select currency per event. Dashboard converts to a base currency using stored exchange rates. |
| P3 | Vehicle Comparison | Side-by-side dashboard for two or more vehicles: cost/mile, efficiency, total cost. |
| P4 | Home Screen Widget | iOS/Android widget showing: active vehicle's last fill-up cost, current efficiency, next reminder due. Tap to quick-add a fill-up. |
| P4 | VIN Barcode Scan | Use camera to scan the VIN barcode/QR on the driver's door jamb during vehicle setup. |
| P4 | Apple Watch / Wear OS | Complication showing next reminder. Quick odometer entry from wrist. |
