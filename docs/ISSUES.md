# Issues

> **Do not read or act on this file unless explicitly instructed to by the user.** This document is for manual reference only — not for autonomous consumption by AI agents or tools.

Tracked bugs and improvements — root cause analysis and proposed fixes.

---

## 1. Opening existing reminder and clicking Cancel shows unnecessary "Discard Changes?" dialog

**Severity:** Low (UX annoyance)

**Steps to reproduce:**
1. Open an existing reminder for editing
2. Make no changes
3. Tap Cancel

**Expected:** Modal closes immediately (no changes were made).
**Actual:** "Discard Changes?" confirmation dialog appears.

**Root cause:**
In `app/(modals)/reminder.tsx:195-205`, `handleCancel` checks `isEditing || hasInput` to decide whether to show the discard dialog. The `isEditing` flag is always `true` when opening an existing reminder, so the dialog fires unconditionally — even when nothing was modified.

```ts
const hasInput = selectedIds.length > 0 || distanceInterval || timeInterval || baselineOdometer;
if (isEditing || hasInput) {          // <-- isEditing alone triggers the dialog
```

**Proposed fix:**
Track the initial form values loaded from the existing reminder (via a ref or separate state snapshot in the `useEffect` at line 70-94). Compare current form state against those initial values in `handleCancel`. Only show the discard dialog when the user has actually changed something. Something like:

```ts
const initialValues = useRef<{...} | null>(null);

// In the useEffect that loads existing data:
initialValues.current = { kind, selectedIds, distanceEnabled, distanceInterval, ... };

// In handleCancel:
const isDirty = /* deep compare current state vs initialValues.current */;
if (isDirty) { showDiscardDialog(); } else { router.back(); }
```

---

## 2. Dev-only "Reset Data" button to return to onboarding

**Severity:** N/A (developer tooling)

**Problem:**
There's no convenient way to clear all vehicle/event/reminder data and return to the onboarding screen during development. Currently requires manually deleting the SQLite database file and restarting the app.

**Proposed fix:**
Add a "Reset All Data" button to the Settings screen, guarded behind `__DEV__` so it never appears in production builds. On press:

1. Show a confirmation `Alert` (to prevent accidental taps).
2. Drop all rows from `vehicles`, `events`, `reminders`, and any related tables (or run `DELETE FROM` on each).
3. Reset all Zustand stores to their initial state (`vehicleStore`, `eventStore`, `reminderStore`, etc.).
4. Navigate to the onboarding screen via `router.replace('/onboarding')`.

```tsx
// In app/(tabs)/settings.tsx, inside the component:
{__DEV__ && (
  <Pressable onPress={handleResetData} accessibilityLabel="Reset all data">
    <Text>Reset All Data (Dev)</Text>
  </Pressable>
)}
```

---

## 3. Metric info text overflows past the right edge of the screen

**Severity:** Low (visual bug)

**Steps to reproduce:**
1. On the dashboard, tap the (i) icon next to "Avg mi/gal"

**Expected:** Explanation text is fully readable within the screen bounds.
**Actual:** The info text renders inline and runs past the right edge of the screen, getting clipped.

**Root cause:**
In `src/components/MetricInfo.tsx:39-43`, the explanation text is rendered as a `<Text>` inside a plain `<View>` with no width constraint. The parent `MetricInfo` component sits inline alongside the metric label, so the text inherits whatever remaining width is available — which on narrow metric cards isn't enough for the explanation string. There's no `flexShrink`, `maxWidth`, or wrapping container to keep it in bounds.

```tsx
{open && (
  <Text style={{ fontSize: 11, color, marginTop: 4, lineHeight: 15 }}>
    {explanation}
  </Text>
)}
```

**Proposed fix:**
Replace the inline expanding text with an `Alert.alert()` dialog. This is simpler, always fits on screen, and avoids layout disruption in the metric cards. Remove the `open` state, the auto-dismiss timer, and `LayoutAnimation` calls — the component becomes a stateless button that fires an alert on press.

```tsx
export function MetricInfo({ explanation, color }: MetricInfoProps) {
  return (
    <Pressable
      onPress={() => Alert.alert('How is this calculated?', explanation)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={explanation}
      accessibilityRole="button"
    >
      <Ionicons name="information-circle-outline" size={14} color={color} />
    </Pressable>
  );
}
```

---

## 4. Tapping "Add discount" on fuel page doesn't move focus to the discount input

**Severity:** Low (UX annoyance)

**Steps to reproduce:**
1. Open the fuel event modal
2. Focus on any other field (e.g. volume or price)
3. Tap "Add discount"

**Expected:** The discount input field appears and receives focus so the user can start typing immediately.
**Actual:** The discount row slides in but the previous field retains focus. The user must manually tap the discount input.

**Root cause:**
In `app/(modals)/fuel-event.tsx:223-231`, `handleToggleDiscount` sets `showDiscount` to `true` and triggers a `LayoutAnimation`, but never programmatically focuses the discount `TextInput`. The discount `TextInput` (line 479) has no ref, so there's nothing to call `.focus()` on.

```tsx
const handleToggleDiscount = useCallback(() => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  if (showDiscount) {
    setDiscountPerUnit('');
    setShowDiscount(false);
  } else {
    setShowDiscount(true);
    // no focus call
  }
}, [showDiscount]);
```

**Proposed fix:**
Add a `useRef<TextInput>` for the discount input field, attach it to the `TextInput` at line 479, and call `.focus()` after the discount row renders. Since the input doesn't exist in the DOM until `showDiscount` becomes `true`, use a short `setTimeout` or a `useEffect` that watches `showDiscount` to focus the ref after the next layout pass.

```tsx
const discountRef = useRef<TextInput>(null);

// Focus after the discount field mounts:
useEffect(() => {
  if (showDiscount) {
    setTimeout(() => discountRef.current?.focus(), 100);
  }
}, [showDiscount]);

// On the TextInput:
<TextInput ref={discountRef} ... />
```

---

## 5. Fuel event smart-defaults pre-filling place from last fill-up is unhelpful

**Severity:** Low (UX friction)

**Problem:**
When adding a new fuel event, the Place field is pre-populated with the station from the last fill-up via smart defaults (`app/(modals)/fuel-event.tsx:149`). Unlike odometer or price — which tend to be close to the last value — gas stations vary frequently. Pre-filling the place adds no value in most cases and forces users to clear or change it, which is more work than filling an empty field.

```tsx
if (defaults.placeId) setPlaceId(defaults.placeId);
```

The smart default is generated in `eventStore.getSmartDefaults`, which pulls the `placeId` from the most recent fuel event.

**Proposed fix:**
Remove the `placeId` from smart defaults for fuel events. Delete or skip the line at `fuel-event.tsx:149` that sets it, and optionally stop returning `placeId` from `getSmartDefaults` for fuel type. Leave odometer, price, and discount defaults as-is — those are genuinely useful predictions.

---

## 6. No confirmation feedback after exporting data

**Severity:** Medium (UX confusion)

**Steps to reproduce:**
1. Go to Settings > Export Data
2. Tap "Export CSV" (or PDF)
3. Pick a save location in the share sheet
4. Share sheet dismisses

**Expected:** Clear confirmation that the export succeeded — a toast, a checkmark, or the modal closes automatically.
**Actual:** User is returned to the Export Data screen with no feedback. The screen looks identical to before the export. No indication whether the file was saved successfully.

**Root cause:**
In `app/(modals)/export.tsx:42-86`, `handleExport` calls `Sharing.shareAsync()` and then falls through to the `finally` block which only sets `exporting` back to `false`. There's no success feedback after the share sheet completes — no toast, no alert, no navigation. The user is left staring at the same form.

```tsx
if (canShare) {
  await Sharing.shareAsync(fileUri, { ... });
}
// nothing happens after this — just setExporting(false) in finally
```

**Proposed fix:**
After `Sharing.shareAsync()` resolves, show a success toast and dismiss the modal. This gives the user clear confirmation and removes the dead-end screen state.

```tsx
await Sharing.shareAsync(fileUri, { ... });
useToastStore.getState().show('Export complete');
router.back();
```

Note: `Sharing.shareAsync()` resolves when the share sheet is dismissed regardless of whether the user actually saved or cancelled. If distinguishing between save/cancel matters, the toast message could be softer (e.g. "Export ready") — but closing the modal either way is still better than the current dead-end.
