# Accessibility Punch List

An automated grep flagged 49 of ~64 Pressable elements as potentially missing `accessibilityLabel`. The project's CLAUDE.md requires: "Every interactive UI element gets an accessibilityLabel."

A manual file-by-file audit was performed on 2026-04-28. The results are below.

---

## Audit Result: All Pressable Elements Have Labels

After reading every file and checking every `<Pressable>` element, **zero missing `accessibilityLabel` instances were found**. The automated grep produced false positives -- likely counting `Pressable` import lines, or lines where the label was on a different line than the opening tag.

Below is the per-file verification.

---

## File-by-File Verification

### app/(modals)/export.tsx -- 0 missing

All 9 Pressable elements have labels:
- Line 100: CSV format tab -- `accessibilityLabel={...CSV format...}`
- Line 117: PDF format tab -- `accessibilityLabel={...PDF format...}`
- Line 146: Vehicle picker trigger -- `accessibilityLabel={...Selected vehicle...}`
- Line 165: "All Vehicles" option -- `accessibilityLabel="All Vehicles"`
- Line 188: Vehicle list items -- `accessibilityLabel={v.nickname}`
- Line 226: Clear from date -- `accessibilityLabel="Clear from date"`
- Line 236: Set from date -- `accessibilityLabel="Set from date"`
- Line 254: Clear to date -- `accessibilityLabel="Clear to date"`
- Line 264: Set to date -- `accessibilityLabel="Set to date"`
- Line 276: Export button -- `accessibilityLabel={...Export CSV/PDF...}`

### src/components/ChipPicker.tsx -- 0 missing

All 7 Pressable elements have labels:
- Line 105: Manage button -- `accessibilityLabel={...Manage ${label}...}`
- Line 121: Chip toggle buttons -- `accessibilityLabel={...item.name, selected state...}`
- Line 178: Save edit button -- `accessibilityLabel="Save"`
- Line 181: Cancel edit button -- `accessibilityLabel="Cancel edit"`
- Line 194: Edit item button -- `accessibilityLabel={...Edit ${item.name}...}`
- Line 204: Delete item button -- `accessibilityLabel={...Delete ${item.name}...}`
- Line 229: Add new item button -- `accessibilityLabel="Add"`

### app/(modals)/manage-vehicles.tsx -- 0 missing

All 4 Pressable elements have labels:
- Line 28: Vehicle row -- `accessibilityLabel={...nickname, year make model, active state...}`
- Line 69: Move up button -- `accessibilityLabel={...Move ${item.nickname} up...}`
- Line 83: Move down button -- `accessibilityLabel={...Move ${item.nickname} down...}`
- Line 115: Add Vehicle button -- `accessibilityLabel="Add Vehicle"`

### src/components/AddEventFAB.tsx -- 0 missing

All 4 Pressable elements have labels:
- Line 55: FAB button -- `accessibilityLabel="Add event"`
- Line 85: Fill-Up/Charge menu item -- `accessibilityLabel={...Add Charge/Fill-Up event...}`
- Line 103: Service menu item -- `accessibilityLabel="Add Service event"`
- Line 115: Expense menu item -- `accessibilityLabel="Add Expense event"`

### app/(modals)/import.tsx -- 0 missing

All 5 Pressable elements have labels:
- Line 168: Select file button -- `accessibilityLabel="Select CSV file to import"`
- Line 281: Vehicle picker trigger -- `accessibilityLabel={...Selected vehicle...}`
- Line 311: Vehicle list items -- `accessibilityLabel={...nickname, selected state...}`
- Line 337: Add new vehicle -- `accessibilityLabel="Add new vehicle"`
- Line 360: Import button -- `accessibilityLabel="Import data"`

### app/(modals)/reminder.tsx -- 0 missing

All 2 direct Pressable elements have labels (others are via SegmentedControl/ChipPicker components):
- Line 310: Time unit chips -- `accessibilityLabel={...label, selected state...}`
- Line 385: Delete reminder button -- `accessibilityLabel="Delete reminder"`

### src/components/EventPhotos.tsx -- 0 missing

All 4 Pressable elements have labels:
- Line 143: Photo thumbnail -- `accessibilityLabel={...Photo ${index + 1}...}`
- Line 157: Add photo button -- `accessibilityLabel="Add photo"`
- Line 180: Close preview button -- `accessibilityLabel="Close photo preview"`
- Line 204: Delete photo button -- `accessibilityLabel="Delete photo"`

### src/components/DateField.tsx -- 0 missing

All 2 Pressable elements have labels:
- Line 56: Date picker toggle -- `accessibilityLabel={...label: formatted date...}`
- Line 79: Done button (iOS) -- `accessibilityLabel="Done selecting date"`

### src/components/PlaceAutocomplete.tsx -- 0 missing

All 5 Pressable elements have labels:
- Line 93: Place selector trigger -- `accessibilityLabel={...Select ${label}...}`
- Line 109: Clear place button -- `accessibilityLabel="Clear place"`
- Line 141: Place list items -- `accessibilityLabel={...Select ${item.name}...}`
- Line 162: Add new place button -- `accessibilityLabel="Add new place"`
- Line 213: Save place button -- `accessibilityLabel="Save place"`

### src/components/SegmentedControl.tsx -- 0 missing

All segment Pressable elements have labels:
- Line 27: Segment buttons -- `accessibilityLabel={...label, selected state...}`

### src/components/VehicleSwitcher.tsx -- 0 missing

All 4 Pressable elements have labels:
- Line 67: Switcher trigger bar -- `accessibilityLabel={...Active vehicle: name. Tap to switch...}`
- Line 118: Vehicle list items -- `accessibilityLabel={...Select ${vehicle.nickname}...}`
- Line 157: Add Vehicle button -- `accessibilityLabel="Add Vehicle"`
- Line 174: Manage Vehicles button -- `accessibilityLabel="Manage Vehicles"`

### app/(tabs)/dashboard.tsx -- 0 missing

All 2 direct Pressable elements have labels:
- Line 139: Period tabs -- `accessibilityLabel={...Period ${p}, selected state...}`
- Line 433: "See all" link -- `accessibilityLabel="See all events"`

### app/(tabs)/history.tsx -- 0 missing

All 3 direct Pressable elements have labels:
- Line 93: Delete swipe action -- `accessibilityLabel="Delete event"`
- Line 111: Long-press wrapper -- `accessibilityLabel={...event type, date, cost...}`
- Line 214: Filter chips -- `accessibilityLabel={...Filter ${label}, active state...}`

### app/(tabs)/reminders.tsx -- 0 missing

All 2 Pressable elements have labels:
- Line 56: Add Reminder button -- `accessibilityLabel="Add Reminder"`
- Line 68: Notification banner -- `accessibilityLabel="Notifications are off. Tap to enable in Settings."`

### app/(tabs)/settings.tsx -- 0 missing

All settings row Pressables have labels via the `RowItem` component which accepts and applies `accessibilityLabel`:
- Line 53: RowItem uses `accessibilityLabel={accessibilityLabel ?? label}`
- Line 322: Theme buttons -- `accessibilityLabel={...Set theme to ${label}...}`
- Line 86: PickerModal close backdrop -- `accessibilityLabel="Close picker"`
- Line 98: PickerModal done button -- `accessibilityLabel="Done"`
- Line 111: PickerModal options -- `accessibilityLabel={...item.label, selected state...}`
- All RowItem usages pass explicit accessibilityLabel props (Currency, Fuel Unit, Odometer Unit, Manage Vehicles, Backup Data, Restore Data, Import Data, Export Data, Load Test Data)

### app/onboarding.tsx -- 0 missing

All 2 Pressable elements have labels:
- Line 234: Save/continue button -- `accessibilityLabel="Save vehicle and continue"`
- Line 258: Restore backup button -- `accessibilityLabel="Restore from a backup file"`

### src/components/ErrorToast.tsx -- 0 missing

All 1 Pressable element has a label:
- Line 54: Dismiss toast -- `accessibilityLabel={...Error: ${message}. Tap to dismiss...}`

### src/components/EventRow.tsx -- 0 missing

- Line 32: Event row Pressable -- `accessibilityLabel={...event type, date, cost...}`

### src/components/ReminderCard.tsx -- 0 missing

- Line 58: Reminder card Pressable -- `accessibilityLabel={...name, status, progress...}`

### src/components/ModalHeader.tsx -- 0 missing

- Line 24: Cancel button -- `accessibilityLabel={cancelLabel}`
- Line 42: Save button -- `accessibilityLabel={saveLabel}`

### src/components/EmptyState.tsx -- 0 missing

- Line 23: Action button -- `accessibilityLabel={actionLabel}`

### src/components/UndoSnackbar.tsx -- 0 missing

- Line 46: Undo button -- `accessibilityLabel="Undo delete"`

### app/(modals)/vehicle.tsx -- 0 missing

- Line 352: Photo picker -- `accessibilityLabel={...Change/Add vehicle photo...}`
- Line 547: Delete vehicle button -- `accessibilityLabel="Delete vehicle"`

### app/(modals)/fuel-event.tsx -- 0 missing

- Line 353: Delete event button -- `accessibilityLabel="Delete event"`

### app/(modals)/service-event.tsx -- 0 missing

- Line 267: Delete event button -- `accessibilityLabel="Delete event"`

### app/(modals)/expense-event.tsx -- 0 missing

- Line 248: Delete event button -- `accessibilityLabel="Delete event"`

---

## Summary

| Category | Files Checked | Pressable Elements | Missing Labels |
|----------|:---:|:---:|:---:|
| Modals | 9 | ~30 | 0 |
| Tab Screens | 4 | ~12 | 0 |
| Components | 12 | ~28 | 0 |
| **Total** | **25** | **~70** | **0** |

The codebase is fully compliant with the CLAUDE.md accessibility rule. Every interactive `Pressable` element has an `accessibilityLabel`. Many also include `accessibilityRole`, `accessibilityState`, and `accessibilityHint` where appropriate.

## Potential Improvements (not blockers)

While no labels are missing, the following enhancements could improve the accessibility experience further:

1. **Dynamic label updates**: Some labels are static where a dynamic value would help. For example, the `PickerModal` backdrop Pressable (settings.tsx line 86) says "Close picker" but could say "Close {title} picker".

2. **accessibilityRole="tab"**: The period selector in dashboard.tsx and format toggle in export.tsx correctly use `role="tab"`, but neither wrapping View uses `role="tablist"`. The SegmentedControl component does use `role="tablist"` on its wrapper -- consider applying this pattern consistently.

3. **Swipeable gesture hints**: The SwipeableEventRow in history.tsx has a long-press label but no `accessibilityHint` about the swipe-to-delete gesture. Screen reader users may not discover the swipe action.

4. **Image alt text**: Vehicle images in VehicleSwitcher (lines 79, 130) use `accessibilityLabel=""` (empty string). Consider using the vehicle nickname as alt text instead.
