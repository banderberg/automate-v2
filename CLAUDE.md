# AutoMate v2

A car expenses tracking app built with Expo (React Native) and TypeScript.

## Project Documentation

- `docs/PRD.md` — Full Product Requirements Document. This is the single source of truth for product decisions: screens, fields, data models, business logic, acceptance criteria.
- `docs/PHASES.md` — Phased implementation plan with detailed prompts for each build phase.
- `DESIGN.md` — Live design system (warm neutral palette, typography, component patterns). Color tokens here match `tailwind.config.js`.

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
    vehicle-documents.tsx
    document.tsx
    export.tsx
    import.tsx
  _layout.tsx            # Root layout
  +not-found.tsx
  onboarding.tsx

src/
  db/
    client.ts            # expo-sqlite init, WAL mode, foreign keys
    schema.ts            # Table DDL
    migrations.ts        # Versioned migration runner
    seed.ts              # Seed data
    testData.ts          # Development test data
    queries/
      categories.ts
      events.ts
      eventPhotos.ts
      eventServiceTypes.ts
      places.ts
      reminders.ts
      serviceTypes.ts
      settings.ts
      vehicleDocuments.ts
      vehicles.ts
  stores/
    documentStore.ts
    eventStore.ts
    referenceDataStore.ts
    reminderStore.ts
    settingsStore.ts
    toastStore.ts
    vehicleStore.ts
  services/
    backup.ts
    costPerMile.ts
    csvExport.ts
    dataImport.ts
    fuelEfficiency.ts
    notifications.ts
    odometerEstimator.ts
    odometerValidator.ts
    pdfExport.ts
    reminderScheduler.ts
    unitConversion.ts
    vinDecoder.ts
    __tests__/           # Unit tests for services
  hooks/
    useActiveVehicle.ts
    useDashboardMetrics.ts
    useDialog.ts
    useGuardedNavigate.ts
  components/
    AddEventFAB.tsx
    ChipPicker.tsx
    ConfirmDialog.tsx
    DateField.tsx
    EmptyState.tsx
    ErrorToast.tsx
    EventPhotos.tsx
    EventRow.tsx
    MetricInfo.tsx
    ModalHeader.tsx
    OdometerField.tsx
    PlaceAutocomplete.tsx
    ReminderCard.tsx
    SegmentedControl.tsx
    Skeleton.tsx
    UndoSnackbar.tsx
    VehicleSwitcher.tsx
  constants/
    seedData.ts
    units.ts
  types/
    index.ts             # All TypeScript interfaces

docs/
  PRD.md                 # Product Requirements Document (source of truth)
  PHASES.md              # Phased implementation plan
  ISSUES.md              # Known issues tracker
  A11Y-PUNCH-LIST.md    # Accessibility audit items
  COMPETITIVE-ANALYSIS.md
  POST-MVP-PLAN.md       # Post-MVP feature roadmap
  PHASE-11-VEHICLE-DOCUMENTS.md
  PLAY-STORE-GUIDE.md
  PLAY-STORE-LISTING.md
  PRIVACY-POLICY.md
```
