# Known Issues

## 1. Manage Service Types does not allow adding new types
The ChipPicker "Manage" bottom sheet has an add input, but adding new service types does not work.

## 2. History cards: inconsistent subtitle layout across event types
All event types should show location ("where") in the subtitle position, matching current fuel card behavior. The "what" (service types, expense category) should move below, after mileage, visually separated (dot delimiter, bold, etc.). Currently service cards show "what" where "where" should be, and expenses also show "what" there.

## 3. Opening an existing reminder pops up the keyboard
When opening a reminder in edit mode, a text input auto-focuses and the keyboard appears immediately.

## 4. History icon and expense icon are the same
The History tab icon and the expense event icon are both the same. Find a better icon for History to differentiate them.

## 5. "Cancel" button shown on non-form screens
Several list/action screens show "Cancel" in the top left via ModalHeader, but there is nothing to cancel — tapping it just navigates back. Should say "Done" or use a back chevron instead. Affected screens:
- **Manage Vehicles** — list of vehicles, no unsaved state to cancel
- **Export Data** — action screen (pick format, export)
- **Import Data** — action screen
- **Vehicle Documents** — document list with "Add" on the right

## 6. Fuel efficiency chart overflows to the right on "All" period
The `LineChart` spacing formula on `dashboard.tsx:502` is `Math.max(44, chartWidth / count)`. The 44px minimum per data point means that when there are many fuel events (e.g. 50+ over 2 years with "All" selected), the total rendered width far exceeds the screen. The `width` prop on gifted-charts' `LineChart` does not clip content — actual width is `initialSpacing + (count - 1) * spacing + endSpacing`. Options: (a) drop the 44px floor and let points compress, (b) enable `scrollToEnd`/horizontal scrolling on the chart, (c) downsample points for longer periods (e.g. monthly averages instead of per-fill-up).

## 7. Spending donut chart drops categories with zero spending
The `donutData` memo in `dashboard.tsx:169-178` only includes categories where the amount is `> 0`. If a period has no service events, the donut renders with no orange slice — but the three `SpendingRow` legend rows (lines 581-583) are always rendered, showing the $0 category with a 0% bar alongside the donut that has no matching segment. This creates a visual mismatch: the donut "hides" the category while the legend still lists it. Either the donut should always show all three segments (with a minimal/greyed-out slice for zero) or the legend rows should match what the donut actually renders.

## 8. First-event celebration toast fires on vehicle switch
The celebration effect in `dashboard.tsx:127-134` triggers when `eventCount` transitions from 0 to >0. When switching vehicles, the event store briefly clears to 0 before loading the new vehicle's events — this 0→N transition is indistinguishable from a genuine first event, so the "First one logged! You're tracking now." banner appears on every vehicle switch. The check needs to account for vehicle changes, e.g. by resetting the ref when `activeVehicle.id` changes without showing the banner, or by gating on a per-vehicle "has seen celebration" flag.

## 9. Vehicle switcher drawer stays open while data loads
In `VehicleSwitcher.tsx:36-43`, `handleSelectVehicle` awaits the entire `switchVehicle` orchestrator (DB write + 3 parallel store loads) before calling `handleDismiss()`. This keeps the bottom sheet open for the full duration of the data load. The fix is straightforward: dismiss the sheet immediately, then fire-and-forget the data load. The dashboard already subscribes to `eventStore.isLoading` (line 66) and renders a `DashboardSkeleton` while loading (line 245-248), so the skeleton will display automatically once the stores start loading. The change is just reordering lines in `handleSelectVehicle`: call `handleDismiss()` first, then call `switchVehicle(vehicle.id)` without awaiting (or awaiting after dismiss).

## 10. Vehicle switcher spatial mismatch: top tap opens bottom sheet
The vehicle switcher header with a down-chevron sits at the top of the dashboard, but tapping it opens a `BottomSheetModal` that animates up from the bottom of the screen. The directional cue (down-chevron) and the trigger position (top of screen) both conflict with the result (sheet from bottom). Options: (a) replace the bottom sheet with a dropdown popover anchored directly below the header — best spatial coherence but requires a new component or library; (b) keep the bottom sheet but change the chevron icon to something non-directional like `swap-vertical` — quick win, reduces the misleading cue; (c) relocate the vehicle switcher near the tab bar so the bottom sheet feels natural — bigger layout change. Recommended: (a) for best UX, (b) as a low-effort interim improvement.

## 11. Cheaper-station insight uses stale all-time visit frequency
`checkCheaperStation` in `insightEngine.ts` picks the user's "regular" station by all-time visit count across all vehicles with the same fuel type. This means a station visited frequently a year ago but not recently still shows as the baseline. The subtitle references a station the user may not have been to in months, which is confusing. The cross-vehicle pooling (`crossVehicleFuelFills`) also inflates counts — visits on a different vehicle affect which station is called "regular" for the active one.
