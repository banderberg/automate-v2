# AutoMate v2 — Post-MVP Implementation Plan

**Date:** April 26, 2026
**Last updated:** April 28, 2026
**Context:** The MVP (Phases 1–5) is complete. Phases 6–10 are also complete. This document preserves the specs for reference and lists the post-launch roadmap (Phases 11+).

**Reference:** See `docs/COMPETITIVE-ANALYSIS.md` for the competitive research behind these priorities.

---

## Completed Phases

All post-MVP phases (6–10) have been implemented. The specs below are retained for reference.

---

## Phase 6: Local Backup & Restore ✓

**Status: Complete**
**Priority:** Critical — launch blocker
**Estimated scope:** Small (single session)

### Goal
Users can export the entire database to a backup file and restore from it. This is manual (not cloud sync) — the user taps "Backup" and gets a file they can save to Google Drive, Files, email, etc. via the system share sheet. They can later restore from that file.

### Context
- The app uses expo-sqlite with a single database file
- expo-file-system and expo-sharing are already in the stack and used by CSV export (`src/services/csvExport.ts`)
- Settings screen (`app/(tabs)/settings.tsx`) has a "Data" section where backup/restore should live
- The export modal (`app/(modals)/export.tsx`) handles CSV export — backup is a separate flow from Settings directly

### Deliverables

1. **Backup service** (`src/services/backup.ts`)
   - `createBackup(): Promise<string>` — copies the SQLite database file to a timestamped backup file in the app's cache directory (e.g., `automate-backup-2026-04-26.db`). Returns the file path.
   - `restoreBackup(fileUri: string): Promise<void>` — validates the file is a valid SQLite database with the expected schema, closes the current DB connection, replaces the database file, re-initializes the database, and reloads all stores.
   - `getBackupInfo(fileUri: string): Promise<{ vehicleCount: number; eventCount: number; createdAt: string }>` — reads metadata from a backup file so the user can confirm before restoring.

2. **Settings UI additions** (`app/(tabs)/settings.tsx`)
   - "Backup Data" row in the Data section — taps calls `createBackup()` then opens the system share sheet via expo-sharing
   - "Restore Data" row — taps opens the system document picker (expo-document-picker) to select a `.db` file, shows a confirmation dialog with backup metadata ("This backup contains 2 vehicles and 47 events. Restoring will replace all current data. Continue?"), then calls `restoreBackup()`

3. **Install expo-document-picker** if not already present

### Acceptance Criteria
- AC-1: Tapping "Backup Data" produces a `.db` file and opens the share sheet
- AC-2: The backup file can be saved to Files/Google Drive and re-imported
- AC-3: Restoring a backup replaces all data and the app shows the restored data immediately
- AC-4: Restoring an invalid file (not a database, wrong schema) shows an error message and does not corrupt the current data
- AC-5: A confirmation dialog with vehicle/event counts shows before restore executes

### Files to Create/Modify
- Create: `src/services/backup.ts`
- Modify: `app/(tabs)/settings.tsx` (add backup/restore rows)
- Modify: `package.json` (add expo-document-picker if needed)

---

## Phase 7: Receipt Photo Attachment on Events ✓

**Status: Complete**
**Priority:** High — first post-launch update
**Estimated scope:** Medium (single session)

### Goal
Users can attach one or more photos (receipts, invoices) to any event type (fuel, service, expense). Photos are viewable when editing an event and persist across app restarts.

### Context
- expo-image-picker is already installed and used for vehicle photos in `app/(modals)/vehicle.tsx`
- Vehicle photo storage pattern exists — photos are saved to documentDirectory via expo-file-system
- The Event data model (`src/types/index.ts`) does not currently have an image field
- Events are stored in the `event` table in SQLite

### Deliverables

1. **Schema migration** (`src/db/migrations.ts`)
   - Add migration 2: create `event_photo` table (id TEXT PK, eventId TEXT FK → event CASCADE DELETE, filePath TEXT, sortOrder INTEGER, createdAt TEXT)
   - This is a separate table rather than a column on event, because events can have multiple photos

2. **TypeScript interface** (`src/types/index.ts`)
   - Add `EventPhoto` interface: `{ id: string; eventId: string; filePath: string; sortOrder: number; createdAt: string }`

3. **Query functions** (`src/db/queries/eventPhotos.ts`)
   - `getByEvent(eventId: string): Promise<EventPhoto[]>`
   - `insert(eventId: string, filePath: string): Promise<EventPhoto>`
   - `remove(id: string): Promise<void>` (also deletes the file from disk)
   - `removeAllForEvent(eventId: string): Promise<void>`

4. **Photo picker component** (`src/components/EventPhotos.tsx`)
   - Props: `eventId: string | null` (null for new events not yet saved), `photos: EventPhoto[]`, `onPhotosChange: (photos: EventPhoto[]) => void`
   - Displays a horizontal scrollable row of thumbnail images (80x80, rounded-xl)
   - Last item is an "Add Photo" button (dashed border, camera icon)
   - Tapping "Add Photo" shows action sheet: "Take Photo" / "Choose from Library"
   - Tapping an existing photo opens a full-screen preview with a "Delete" button
   - For new events (no eventId yet): photos are stored in a temp array and saved after the event is created
   - Photos are saved to `${documentDirectory}/event-photos/${eventId}/` using expo-file-system

5. **Event form integration**
   - Add the EventPhotos component to all three event modals (fuel-event.tsx, service-event.tsx, expense-event.tsx)
   - Position below the Notes field
   - On save (new event): save event first to get ID, then save photos
   - On save (edit): sync photos (delete removed, add new)
   - On delete event: photos cascade-delete via FK, but also delete files from disk

6. **Event store updates** (`src/stores/eventStore.ts`)
   - `addEvent()` and `updateEvent()` accept an optional `photos` parameter
   - `deleteEvent()` cleanup deletes photo files from disk (or let cascade handle DB, cleanup files separately)

### Acceptance Criteria
- AC-1: User can attach photos from camera or gallery to any event type
- AC-2: Photos persist and are visible when reopening an event for editing
- AC-3: Deleting a photo removes it from the DB and from disk
- AC-4: Deleting an event removes all associated photos from DB and disk
- AC-5: New events (not yet saved) can queue photos that save after the event is created
- AC-6: Photos display as a horizontal scrollable thumbnail row on the event form

### Files to Create/Modify
- Create: `src/db/queries/eventPhotos.ts`
- Create: `src/components/EventPhotos.tsx`
- Modify: `src/types/index.ts` (add EventPhoto)
- Modify: `src/db/migrations.ts` (add migration 2)
- Modify: `app/(modals)/fuel-event.tsx`
- Modify: `app/(modals)/service-event.tsx`
- Modify: `app/(modals)/expense-event.tsx`
- Modify: `src/stores/eventStore.ts`

---

## Phase 8: Data Import from Competitors ✓

**Status: Complete**
**Priority:** High — enables user acquisition from competitor apps
**Estimated scope:** Medium (single session)

### Goal
Users can import their data from Fuelio and Fuelly CSV exports. This lowers the switching barrier from the two most popular competitors with exportable data.

### Context
- Fuelio exports CSV with columns: Date, Fuel station, Fuel type, Payment type, Full/Partial, Price per unit, Volume, Total price, Odometer, Consumption, Notes, Latitude, Longitude
- Fuelly exports CSV with columns: Date, MPG, Miles, Gallons, Price/Gallon, Total Cost, Partial, Notes, Octane, Location
- The app already has CSV export (`src/services/csvExport.ts`) which can serve as a reference for file handling
- expo-document-picker (installed in Phase 6) can be reused for file selection

### Deliverables

1. **Import service** (`src/services/dataImport.ts`)
   - `detectFormat(csvContent: string): 'fuelio' | 'fuelly' | 'automate' | 'unknown'` — sniffs the header row to determine the source format
   - `parseFuelioCSV(csvContent: string): ParsedImportData` — parses Fuelio's CSV into a normalized structure
   - `parseFuellyCSV(csvContent: string): ParsedImportData` — parses Fuelly's CSV into a normalized structure
   - `parseAutomateCSV(csvContent: string): ParsedImportData` — re-import from AutoMate's own export
   - `importData(data: ParsedImportData, vehicleId: string): Promise<ImportResult>` — writes parsed data into the DB for a specified vehicle. Returns count of imported events.
   - `ParsedImportData` type: array of normalized event objects with date, odometer, cost, volume, pricePerUnit, isPartialFill, notes, placeName
   - `ImportResult` type: `{ eventsImported: number; placesCreated: number; errors: string[] }`

2. **Import UI** (`app/(modals)/import.tsx`)
   - New modal accessible from Settings → "Import Data"
   - Step 1: "Select File" button — opens document picker for `.csv` files
   - Step 2: Shows detected format ("Detected: Fuelio export") and preview (first 5 rows in a summary)
   - Step 3: Vehicle picker — "Import into which vehicle?" dropdown of existing vehicles + "Create new vehicle"
   - Step 4: "Import" button — runs import, shows result ("Imported 127 fuel events and created 8 places")
   - Error handling: show per-row errors ("Row 45: invalid date format — skipped")

3. **Route registration**
   - Add `app/(modals)/import.tsx` to the modal stack
   - Add "Import Data" row to Settings under the Data section

### Acceptance Criteria
- AC-1: Fuelio CSV export imports correctly (fuel events with dates, odometers, volumes, costs, places)
- AC-2: Fuelly CSV export imports correctly
- AC-3: AutoMate's own CSV export can be re-imported
- AC-4: Unknown formats show a clear error ("Unrecognized file format. AutoMate can import from Fuelio, Fuelly, or AutoMate exports.")
- AC-5: Import creates Place records for station/location names that don't already exist
- AC-6: Duplicate detection: events with the same date + odometer + cost for the same vehicle are skipped with a warning
- AC-7: Import does not corrupt existing data — all writes are transactional

### Files to Create/Modify
- Create: `src/services/dataImport.ts`
- Create: `app/(modals)/import.tsx`
- Modify: `app/(modals)/_layout.tsx` (register new route)
- Modify: `app/(tabs)/settings.tsx` (add Import Data row)

---

## Phase 9: PDF Service History Export ✓

**Status: Complete**
**Priority:** Medium — differentiator for vehicle resale
**Estimated scope:** Small (single session)

### Goal
Users can generate a formatted PDF document of a vehicle's complete service history. Useful when selling a vehicle or filing insurance claims.

### Context
- CSV export already exists in `src/services/csvExport.ts`
- The export modal (`app/(modals)/export.tsx`) has vehicle picker and date range — extend it with a format toggle
- expo-print can generate PDFs from HTML strings and save them
- expo-sharing is already used for CSV sharing

### Deliverables

1. **Install expo-print** if not already present

2. **PDF generation service** (`src/services/pdfExport.ts`)
   - `generateServiceHistoryPDF(vehicleId: string, startDate?: string, endDate?: string): Promise<string>` — returns file path
   - The PDF should include:
     - Header: Vehicle nickname, year/make/model, VIN (if present)
     - Summary: total events, total spent, date range, current odometer
     - Event table: date, type, description (service types or category), odometer, cost, place, notes
     - Grouped by year, sorted by date descending
     - Footer: "Generated by AutoMate on {date}"
   - Use expo-print's `printToFileAsync({ html })` — generate the PDF from an HTML string with inline CSS
   - Style the HTML to match the app's warm neutral aesthetic (use DESIGN.md color tokens)

3. **Export modal update** (`app/(modals)/export.tsx`)
   - Add format toggle: "CSV" | "PDF" (segmented control or chips)
   - When PDF is selected: vehicle picker is single-vehicle only (no "All Vehicles"), date range still available
   - Export button generates the selected format and opens the share sheet

### Acceptance Criteria
- AC-1: PDF generates with correct vehicle info header, event table, and summary
- AC-2: PDF is shareable via the system share sheet
- AC-3: PDF renders correctly when opened in a PDF viewer
- AC-4: Events are grouped by year and sorted by date
- AC-5: PDF with 500 events generates in under 5 seconds

### Files to Create/Modify
- Create: `src/services/pdfExport.ts`
- Modify: `app/(modals)/export.tsx` (add format toggle)
- Modify: `package.json` (add expo-print if needed)

---

## Phase 10: Play Store Preparation ✓

**Status: Complete**
**Priority:** Critical — required for launch
**Estimated scope:** Small (single session)

### Goal
Prepare all assets and configuration needed to submit to Google Play Store.

### Context
- The app is an Expo managed workflow project
- EAS Build (Expo Application Services) is the standard path to generate AAB files for Play Store
- app.json / app.config.js contains the app metadata

### Deliverables

1. **App configuration** (`app.json` or `app.config.js`)
   - Set `expo.name`: "AutoMate"
   - Set `expo.slug`: "automate"
   - Set `expo.version`: "1.0.0"
   - Set `expo.android.package`: "com.automate.app" (or owner's preferred package name)
   - Set `expo.android.versionCode`: 1
   - Set `expo.android.adaptiveIcon`: configure with provided icon assets
   - Set `expo.android.permissions`: only the permissions actually used (CAMERA, ACCESS_FINE_LOCATION, POST_NOTIFICATIONS — all requested lazily at runtime)
   - Set `expo.android.splash`: configure splash screen with app branding
   - Review and remove any dev-only config

2. **EAS configuration** (`eas.json`)
   - Configure build profiles:
     - `preview`: internal distribution for testing
     - `production`: Play Store submission (generates AAB)
   - Configure submit profile for Google Play

3. **Privacy policy** (required by Google Play)
   - Create a simple privacy policy page/document stating:
     - All data is stored locally on the device
     - No data is collected, transmitted, or shared
     - No analytics or tracking
     - No account required
     - Camera and location permissions are used only when explicitly triggered by user action
   - This needs to be hosted at a URL (suggest GitHub Pages or a simple static page)

4. **Play Store listing content** (text file for reference)
   - App title (30 chars max): "AutoMate - Car Expense Tracker"
   - Short description (80 chars): "Track fuel, maintenance & expenses. Know what every mile costs. No ads, no cloud."
   - Full description (4000 chars): feature list, privacy pitch, differentiators
   - Feature graphic specifications (1024x500)
   - Screenshot specifications (min 2, recommended 8, 16:9 or 9:16)
   - Category: Auto & Vehicles
   - Content rating: Everyone
   - Tags: car expenses, fuel tracker, maintenance log, MPG, vehicle management

5. **Icon assets**
   - Adaptive icon: foreground (432x432) + background
   - Standard icon (512x512) for Play Store listing
   - Note: the agent should document what icons are needed; actual graphic design may require a human or design tool

### Acceptance Criteria
- AC-1: `eas build --platform android --profile production` produces a signed AAB
- AC-2: app.json has all required Android fields populated
- AC-3: eas.json has preview and production profiles
- AC-4: Privacy policy text is drafted
- AC-5: Play Store listing copy is drafted and within character limits

### Files to Create/Modify
- Modify: `app.json` or `app.config.js`
- Create: `eas.json`
- Create: `docs/PLAY-STORE-LISTING.md` (listing copy for reference)
- Create: `docs/PRIVACY-POLICY.md` (privacy policy text)

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 6 | Local Backup & Restore | ✓ Complete |
| 7 | Receipt Photo Attachment | ✓ Complete |
| 8 | Data Import from Competitors | ✓ Complete |
| 9 | PDF Service History Export | ✓ Complete |
| 10 | Play Store Preparation | ✓ Complete |

---

## Future Phases (Post-Launch Roadmap)

These are not yet implemented. Each would get its own detailed plan document when the time comes.

| Phase | Feature | Notes |
|-------|---------|-------|
| 11 | Vehicle Document Storage | Store insurance, registration, and other vehicle documents as photos/PDFs with expiration alerts. See `docs/PHASE-11-VEHICLE-DOCUMENTS.md`. |
| 12 | Full-Fidelity Backup (Zip) | Upgrade backup format from single `.db` file to `.zip` containing database + all on-disk files (event photos, vehicle documents). Solves the current limitation where backup metadata survives restore but files don't. Benefits both event photos (Phase 7) and vehicle documents (Phase 11). |
| 13 | Cloud Sync (Google Drive) | Real-time or scheduled automatic backup. Much more complex than Phase 6. |
| 14 | Home Screen Widgets | Quick-add fill-up from home screen. Expo has widget support via expo-widgets. |
| 15 | Receipt OCR | Camera scan → auto-populate fuel event fields. Requires ML integration. |
| 16 | VIN Scanning | Scan a VIN barcode with the camera to auto-populate vehicle details via NHTSA API. Eliminates manual entry of year/make/model during vehicle creation. Uses expo-camera or expo-barcode-scanner. |
| 17 | Trip Logging | GPS-based trip recording for mileage reimbursement. |
| 18 | Recurring Expenses | Auto-generate expense events on a schedule (insurance, loan payments). |
| 19 | Maintenance Schedule Templates | Import manufacturer service intervals by make/model/year. |
