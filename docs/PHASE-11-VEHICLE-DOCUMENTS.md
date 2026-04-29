# Phase 11: Vehicle Document Storage

**Date:** April 29, 2026
**Priority:** High — competitive gap, pre-launch
**Estimated scope:** Medium (single session)

---

## Goal

Users can store important vehicle documents (insurance cards, registration, title, emissions certificates, etc.) as photos or PDFs per vehicle. Documents can have an optional expiration date that triggers a reminder notification. This closes a competitive gap — MyAutoLog, Vehicle Maintenance Tracker, and AUTOsist all offer document storage with expiration alerts.

---

## Context & Existing Patterns

The codebase has well-established patterns that this feature should follow exactly:

- **File storage:** `src/components/EventPhotos.tsx` shows the pattern — photos stored to `${Paths.document}/<subdir>/` using `expo-file-system`'s `File`, `Paths`, `Directory` classes. Copy from picker to permanent location with `Crypto.randomUUID()` filenames.
- **Image picking:** `expo-image-picker` is used in `EventPhotos.tsx` (camera + library) and `app/(modals)/vehicle.tsx` (vehicle photo). Same action sheet pattern on both.
- **Database migrations:** `src/db/migrations.ts` — sequential version numbers, current version is 2 (event_photo table). This feature adds migration version 3.
- **Query layer:** One file per entity in `src/db/queries/`, each with a `Row` interface, a `mapRow` function, and CRUD functions using parameterized SQL. See `src/db/queries/eventPhotos.ts` and `src/db/queries/reminders.ts` as templates.
- **Type definitions:** All interfaces in `src/types/index.ts`.
- **Stores:** Zustand stores in `src/stores/`. Write to DB first, update state second. Errors surfaced via `error` state field.
- **Modals:** Files in `app/(modals)/`, using `ModalHeader` component, `useGuardedNavigate` or `useRouter`, `SafeAreaView`, `KeyboardAvoidingView`.
- **Reminders/Notifications:** `src/stores/reminderStore.ts` handles scheduling via `expo-notifications`. Document expiration reminders should use the same notification scheduling pattern.

---

## Design Decisions

These decisions were resolved during design review and are final:

1. **Type union:** `'insurance' | 'registration' | 'title' | 'emissions' | 'inspection' | 'other'` — "license" dropped (driver documents don't belong to a vehicle). "Other" is sufficient as a catch-all since users will have 3-10 documents per vehicle.
2. **Notifications:** Single notification scheduled 30 days before expiration. One `notificationId` per document, consistent with the reminder pattern.
3. **No `fileType` column:** Derive image vs PDF from the file extension on `filePath` (e.g. `filePath.endsWith('.pdf')`). Use a utility function `isDocumentPdf(filePath: string): boolean`.
4. **PDF preview:** Show a PDF icon + filename in both the list thumbnail and the modal preview area. No in-app PDF viewer, no "View" button.
5. **Flat file storage:** All document files stored in `${Paths.document}/vehicle-documents/{UUID}.{ext}` — no per-vehicle subdirectories. Matches the event photos pattern.
6. **Name pre-fill:** When user selects a type, pre-fill the name field only if it is currently empty. Track a `nameWasTouched` flag; skip pre-fill if true.
7. **Documents row visibility:** Only shown in vehicle edit mode (existing vehicle). No extra discovery mechanisms.
8. **DateField for future dates:** Add `minDate` prop to `DateField` component (maps to `minimumDate` on native picker). Document modal passes `minDate={new Date()}` and `maxDate={new Date(2100, 0, 1)}`. Existing DateField callers unaffected since both props remain optional.
9. **Vehicle deletion cleanup order:** When deleting a vehicle: (1) query all documents for the vehicle, (2) cancel all their notifications, (3) delete files from disk, (4) delete DB rows / let CASCADE handle it.
10. **Flat list, no sections:** Document list uses `FlatList` sorted by type then name. Each row shows the type label — no `SectionList` or section headers.
11. **File replacement on edit:** The preview area remains tappable in edit mode. On save, if the file changed, delete the old file from disk and persist the new path.
12. **No `getExpiring()` query:** Notifications are scheduled at creation time. No batch query needed for the initial implementation.
13. **Backup limitation:** Document files on disk are NOT included in database backups (same as event photos). The restore confirmation message includes a note: "Document and photo files are not included in backups." Ghost rows (metadata without files) show a "File unavailable — tap to re-attach" placeholder. Full-fidelity zip backup is tracked as Phase 12.

---

## Deliverables

### 1. TypeScript Interface

**File:** `src/types/index.ts`

Add:

```typescript
export interface VehicleDocument {
  id: string;
  vehicleId: string;             // FK → Vehicle
  name: string;                  // e.g. "Insurance Card", "Registration"
  type: 'insurance' | 'registration' | 'title' | 'emissions' | 'inspection' | 'other';
  filePath: string;              // local file path (photo or PDF)
  expirationDate?: string;       // ISO 8601 (YYYY-MM-DD), optional
  notificationId?: string;       // expo-notifications identifier for expiration alert
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

The `type` field uses a fixed union for display purposes (icon, sorting) but `name` is freeform so users can label documents however they want. Determine whether a file is an image or PDF by checking `filePath.endsWith('.pdf')`.

### 2. Database Migration

**File:** `src/db/migrations.ts`

Add migration version 3:

```sql
CREATE TABLE IF NOT EXISTS vehicle_document (
  id TEXT PRIMARY KEY,
  vehicleId TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  filePath TEXT NOT NULL,
  expirationDate TEXT,
  notificationId TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_document_vehicle ON vehicle_document(vehicleId);
```

### 3. Query Layer

**File to create:** `src/db/queries/vehicleDocuments.ts`

Follow the pattern in `src/db/queries/eventPhotos.ts` and `src/db/queries/reminders.ts`:

- `VehicleDocumentRow` interface (all fields as `string | null`)
- `mapRow(row): VehicleDocument` function
- `getByVehicle(vehicleId: string): Promise<VehicleDocument[]>` — sorted by type then name
- `getById(id: string): Promise<VehicleDocument | null>`
- `insert(doc: Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleDocument>` — generate UUID via `Crypto.randomUUID()`
- `update(id: string, fields: Partial<...>): Promise<void>` — dynamic SET clause pattern from `src/db/queries/reminders.ts` lines 109-148
- `remove(id: string): Promise<void>` — cancel notification if `notificationId` exists, delete the file from disk, then delete DB row (pattern from `eventPhotos.ts` lines 57-75)
- `removeAllForVehicle(vehicleId: string): Promise<void>` — query all docs for vehicle, cancel all notifications, delete files from disk, then delete DB rows

### 4. Document Store

**File to create:** `src/stores/documentStore.ts`

Zustand store following the pattern of `eventStore.ts`:

```typescript
interface DocumentStore {
  documents: VehicleDocument[];
  isLoading: boolean;
  error: string | null;

  loadForVehicle(vehicleId: string): Promise<void>;
  addDocument(
    data: Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>,
    scheduleNotification?: boolean
  ): Promise<VehicleDocument>;
  updateDocument(
    id: string,
    fields: Partial<VehicleDocument>,
    newFilePath?: string
  ): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  clearDocuments(): void;
}
```

**Notification scheduling:** When a document has an `expirationDate` and `scheduleNotification` is true (default), schedule a single local notification 30 days before expiration. Store the `notificationId` on the document row. Cancel old notification when updating or deleting. Use the same `expo-notifications` scheduling as `reminderStore.ts`.

**File replacement on update:** When `newFilePath` is provided, delete the old file from disk (best effort) and update `filePath` in the DB.

**Integration with vehicle lifecycle:** When `vehicleStore.deleteVehicle()` is called, the CASCADE DELETE handles DB cleanup, but document files on disk and scheduled notifications need cleanup. Call `vehicleDocumentQueries.removeAllForVehicle()` in the delete flow — this cancels notifications, deletes files, then deletes DB rows (in that order).

### 5. DateField Enhancement

**File:** `src/components/DateField.tsx`

Add an optional `minDate` prop:

```typescript
interface DateFieldProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  maxDate?: Date;
  minDate?: Date;              // new — maps to minimumDate on native picker
  required?: boolean;
}
```

Pass `minDate` through to `DateTimePicker` as `minimumDate`. Existing callers are unaffected since the prop is optional.

### 6. Document Modal

**File to create:** `app/(modals)/document.tsx`

A modal for adding/editing a single document. Route: `/(modals)/document?vehicleId=xxx` (new) or `/(modals)/document?documentId=xxx` (edit).

**Layout** — follow the pattern in `app/(modals)/vehicle.tsx` and `app/(modals)/reminder.tsx`:
- `ModalHeader` with title "Add Document" / "Edit Document" and Save button
- `SafeAreaView` → `KeyboardAvoidingView` → `ScrollView`
- All interactive elements get `accessibilityLabel`

**Fields:**
1. **Document image/file preview** — large preview area at top (like vehicle photo in `vehicle.tsx`). Tap to pick from camera/library/files. Tappable in both create and edit mode (allows replacing the file).
   - For images: use `expo-image-picker` (camera + library) — same action sheet pattern as `EventPhotos.tsx`
   - For PDFs: use `expo-document-picker` (already installed) — filter to `application/pdf`
   - Show 3 options in action sheet: "Take Photo", "Choose from Library", "Choose PDF File"
   - Display image thumbnail for images, or PDF icon + filename for PDFs (derive from file extension)
   - When file is missing on disk (restore scenario): show "File unavailable — tap to re-attach" placeholder
2. **Name** — TextInput, required, max 50 chars. Pre-fill based on selected type only when name field is empty (track `nameWasTouched` flag). Type-to-name mapping: Insurance → "Insurance Card", Registration → "Registration", Title → "Title", Emissions → "Emissions Certificate", Inspection → "Inspection Report", Other → (no pre-fill).
3. **Type** — chip row with options: Insurance, Registration, Title, Emissions, Inspection, Other. Use the `ChipPicker` component (`src/components/ChipPicker.tsx`) in single-select mode without `onAdd`/`onUpdate`/`onDelete` (fixed set, no custom types).
4. **Expiration Date** — optional `DateField` (`src/components/DateField.tsx`). Show a "No expiration" / "Set expiration" toggle, then the date picker if enabled. Pass `minDate={new Date()}` and `maxDate={new Date(2100, 0, 1)}` and `required={false}`.
5. **Notes** — optional TextInput, multiline, max 500 chars.
6. **Delete button** — only in edit mode, at the bottom, destructive style with confirmation dialog.

**File storage:** Copy picked files to `${Paths.document}/vehicle-documents/{UUID}.{ext}` — flat directory, no per-vehicle subdirectories.

**On save (new):** Call `documentStore.addDocument()`, schedule notification if expiration date is set, then `router.back()`.
**On save (edit):** Call `documentStore.updateDocument()` with `newFilePath` if file changed (old file deleted automatically). Reschedule notification if expiration changed. Then `router.back()`.
**On delete:** Confirmation dialog → `documentStore.deleteDocument()` → `router.back()`.

### 7. Vehicle Documents List Screen

**File to create:** `app/(modals)/vehicle-documents.tsx`

A list screen showing all documents for a vehicle. Route: `/(modals)/vehicle-documents?vehicleId=xxx`.

**Layout:**
- `ModalHeader` with title "Documents" and an "Add" button (Ionicons `add` icon)
- If no documents: `EmptyState` component (`src/components/EmptyState.tsx`) with icon `document-text-outline`, title "No Documents", subtitle "Store insurance, registration, and other vehicle documents here."
- If documents exist: `FlatList` sorted by type then name (flat list, no section headers)

**Each row shows:**
- Thumbnail (small image preview or PDF icon) — 48x48, rounded. For missing files: gray placeholder icon.
- Document name (bold)
- Document type label (muted)
- Expiration date if set — with color coding: green (>30 days), amber (≤30 days), red (expired)
- Chevron for navigation

**Tap a row:** Navigate to `/(modals)/document?documentId=xxx` for editing.
**Tap "Add":** Navigate to `/(modals)/document?vehicleId=xxx` for creating.

### 8. Navigation Integration

**File:** `app/(modals)/_layout.tsx`

No changes needed — the modal layout uses a bare `<Stack>` with no explicit screen definitions. New modal files are auto-registered by expo-router.

**File:** `app/(modals)/vehicle.tsx`

Add a "Documents" row at the bottom of the edit form (only visible when editing an existing vehicle, not when creating). This row shows the document count and navigates to the vehicle-documents list:

```tsx
{isEditing && (
  <Pressable
    onPress={() => nav.push(`/(modals)/vehicle-documents?vehicleId=${vehicleId}`)}
    className="flex-row items-center justify-between px-4 py-4 bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark"
    accessibilityLabel={`Documents, ${documentCount} stored`}
    accessibilityRole="button"
  >
    <View className="flex-row items-center gap-3">
      <Ionicons name="document-text-outline" size={20} color="#A8A49D" />
      <Text className="text-base text-ink dark:text-ink-on-dark">Documents</Text>
    </View>
    <View className="flex-row items-center gap-2">
      <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark">{documentCount}</Text>
      <Ionicons name="chevron-forward" size={16} color="#A8A49D" />
    </View>
  </Pressable>
)}
```

To get `documentCount`, import `useDocumentStore` and read `documents.length`. Load documents in a `useEffect` when `vehicleId` is available.

### 9. Backup Integration

**File:** `src/services/backup.ts`

The backup service copies the entire SQLite database file, so the `vehicle_document` table is automatically included in backups — no changes needed to the backup/restore logic.

Document **files** on disk (photos, PDFs in `vehicle-documents/` directory) are NOT included in the database backup. This is the same limitation as event photos. Full-fidelity zip backup (including all on-disk files) is tracked as Phase 12.

Update `getBackupInfo()` to include a document count in the info returned:
```typescript
const docCount = await tempDb.getFirstAsync<{ count: number }>(
  'SELECT COUNT(*) as count FROM vehicle_document'
);
```

**File:** `app/(tabs)/settings.tsx`

Update the restore confirmation message to:
- Show document count alongside vehicle and event counts
- Include a note: "Document and photo files are not included in backups and must be re-added after restore."

### 10. Reset Data Integration

**File:** `app/(tabs)/settings.tsx`

In the `handleResetAllData` callback, add a DELETE for the new table (before deleting vehicles, since CASCADE would handle it, but being explicit is consistent with the existing pattern):

```sql
await db.execAsync('DELETE FROM vehicle_document;');
```

Also clean up document files from disk:
```typescript
const docDir = new Directory(Paths.document, 'vehicle-documents');
if (docDir.exists) docDir.delete();
```

---

## Implementation Order

Execute these steps sequentially. Each step depends on the previous one.

1. **Types** — Add `VehicleDocument` interface to `src/types/index.ts`
2. **Migration** — Add migration version 3 to `src/db/migrations.ts`
3. **Queries** — Create `src/db/queries/vehicleDocuments.ts`
4. **Store** — Create `src/stores/documentStore.ts`
5. **DateField** — Add `minDate` prop to `src/components/DateField.tsx`
6. **Document modal** — Create `app/(modals)/document.tsx`
7. **Documents list** — Create `app/(modals)/vehicle-documents.tsx`
8. **Vehicle modal integration** — Add "Documents" row to `app/(modals)/vehicle.tsx`
9. **Backup info** — Update `src/services/backup.ts` and restore confirmation in `settings.tsx`
10. **Reset integration** — Update `app/(tabs)/settings.tsx` to clean up documents on reset

---

## Acceptance Criteria

- AC-1: User can add a document (photo from camera, photo from library, or PDF file) to any vehicle
- AC-2: Documents persist across app restarts and are visible when navigating to the vehicle's documents
- AC-3: Deleting a document cancels its notification, removes it from the DB, and deletes the file from disk
- AC-4: Deleting a vehicle cancels all document notifications, removes document files from disk, and DB rows via CASCADE
- AC-5: Documents with an expiration date show color-coded status (green >30 days, amber ≤30 days, red expired)
- AC-6: A single local notification fires 30 days before document expiration
- AC-7: The vehicle edit screen shows a "Documents" row with a count of stored documents
- AC-8: The empty state shows when no documents exist for a vehicle
- AC-9: Backup info includes document count; restore confirmation displays it with a note about file limitations
- AC-10: Resetting all data removes document files from disk
- AC-11: Editing a document allows replacing the attached file (old file deleted from disk)
- AC-12: After restoring a backup, documents with missing files show "File unavailable — tap to re-attach"

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/db/queries/vehicleDocuments.ts` | Query layer for vehicle_document table |
| `src/stores/documentStore.ts` | Zustand store for document state |
| `app/(modals)/document.tsx` | Add/edit document modal |
| `app/(modals)/vehicle-documents.tsx` | Document list per vehicle |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `VehicleDocument` interface |
| `src/db/migrations.ts` | Add migration version 3 (vehicle_document table + index) |
| `src/components/DateField.tsx` | Add optional `minDate` prop |
| `app/(modals)/vehicle.tsx` | Add "Documents" row in edit mode |
| `src/services/backup.ts` | Add document count to `getBackupInfo()` |
| `app/(tabs)/settings.tsx` | Add document cleanup to reset flow; update restore confirmation message |
