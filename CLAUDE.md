# AutoMate v2

A car expenses tracking app built with Expo (React Native) and TypeScript.

## Project Documentation

- `docs/PRD.md` — Full Product Requirements Document. This is the single source of truth for product decisions: screens, fields, data models, business logic, acceptance criteria.
- `docs/PHASES.md` — Phased implementation plan with detailed prompts for each build phase.

## Build Phases

The app is built in 5 sequential phases. Complete each phase fully before starting the next.

1. **Phase 1:** Project setup, database schema, typed query layer, business logic services. No UI.
2. **Phase 2:** Zustand stores, state management, initialization sequence, custom hooks.
3. **Phase 3:** Navigation shell, tab bar, vehicle switcher, FAB, onboarding, empty states, theme switching.
4. **Phase 4:** Event forms (fuel, service, expense), History screen, Dashboard with charts.
5. **Phase 5:** Reminders with notifications, vehicle management, settings, data export, accessibility, polish.

To start a phase, read the corresponding section in `docs/PHASES.md`.

## Tech Stack (pinned — do not substitute)

- Expo SDK 52+ (managed workflow)
- TypeScript in strict mode
- expo-sqlite (local database, WAL mode)
- expo-router (file-based navigation)
- Zustand (state management)
- NativeWind v4 (Tailwind CSS for React Native)
- react-native-gifted-charts (line charts, donut charts)
- @gorhom/bottom-sheet (bottom sheets)
- @shopify/flash-list (performant lists)
- expo-notifications (local notifications)
- expo-image-picker (camera and gallery)
- expo-location (GPS for places)
- expo-file-system (file storage)
- expo-crypto (UUID generation)
- expo-haptics (tactile feedback)
- expo-sharing (share sheet for CSV export)
- expo-map-view (map for place picker)

## Code Standards

- **No `any` types.** No `// @ts-ignore`.
- **No `// TODO` or stub implementations.** Every function must be complete and functional.
- **Parameterized SQL only.** Every query uses `?` placeholders. No string interpolation in SQL.
- **Every interactive UI element** gets an `accessibilityLabel`.
- **Write to DB first, update state second.** Store mutations always persist to SQLite before updating in-memory state. If the DB write fails, state is not updated.
- **Errors are never swallowed.** Every catch block surfaces a human-readable message via the store's error state.

## Project Structure

```
app/
  (tabs)/
    _layout.tsx          # Tab navigator
    dashboard.tsx
    history.tsx
    reminders.tsx
    settings.tsx
  (modals)/
    _layout.tsx          # Modal stack
    vehicle.tsx
    fuel-event.tsx
    service-event.tsx
    expense-event.tsx
    reminder.tsx
    manage-vehicles.tsx
    export.tsx
  _layout.tsx            # Root layout
  onboarding.tsx

src/
  db/
    client.ts            # expo-sqlite init, WAL mode, foreign keys
    schema.ts            # Table DDL
    migrations.ts        # Versioned migration runner
    seed.ts              # Seed data
    queries/
      namedEntities.ts   # Generic CRUD factory for service_type + category tables
      odometerConversion.ts # Bulk odometer unit conversion (DB mutations)
      events.ts
      eventPhotos.ts
      eventServiceTypes.ts
      places.ts
      reminders.ts
      settings.ts
      vehicleDocuments.ts
      vehicles.ts
  stores/                # Zustand stores (no store imports another store)
    orchestrator.ts      # Cross-store workflows — the only module importing multiple stores
  services/              # Pure business logic — no store imports, no DB mutations
  hooks/                 # Custom React hooks
  components/            # Reusable UI components
  constants/             # Seed data lists, unit definitions, theme tokens
  types/
    index.ts             # All TypeScript interfaces

docs/
  PRD.md
  PHASES.md
```
