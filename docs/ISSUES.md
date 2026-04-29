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
