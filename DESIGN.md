# AutoMate v2 Design System

Sharp, polished, composed. Every surface is considered. Details are polished. The app looks like it costs more than it does.

---

## 1. Color

### Strategy: Restrained with warm neutrals

One accent (primary blue) for interactive elements, used sparingly. The real color story is the warm neutral surface system. Event-type colors (fuel teal, service orange, expense green) are semantic, not decorative. Status colors (destructive red, warning amber, success green) appear only when triggered by data.

No pure grays. No `#000`. No `#fff`. Every neutral is tinted warm.

### Warm Neutral Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `surface` | `#F5F4F1` | `#0E0E0C` | Screen background |
| `card` | `#FEFDFB` | `#1A1917` | Cards, elevated surfaces, form field backgrounds |
| `divider` | `#E2E0DB` | `#2A2926` | Section borders, prominent dividers |
| `divider-subtle` | `#F0EFEC` | `#2A2926` | Internal row dividers, inset separators |
| `ink` | `#1C1B18` | `#F5F4F1` | Primary text, headings |
| `ink-secondary` | `#5C5A55` | `#C5C2BC` | Secondary text, descriptions |
| `ink-muted` | `#706C67` | `#8A8680` | Labels, captions, placeholders |
| `ink-faint` | `#78756F` | `#54524D` | Disabled text, hints |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#4272C4` | Buttons, links, active tab, FAB, save actions |
| `primary-light` | `#DBE6F5` | Primary tint backgrounds (add vehicle circle) |
| `primary-dark` | `#1E3554` | Primary tint backgrounds (dark mode) |
| `primary-tint` | `#6A9FD8` | Lighter primary for dark mode active states |
| `fuel` | `#1A9A8F` | Fuel events, efficiency chart line |
| `fuel-light` | `#D0F5EE` | Fuel event icon background |
| `service` | `#E8772B` | Service events |
| `service-light` | `#FFF3E6` | Service event icon background |
| `expense` | `#2EAD76` | Expense events |
| `expense-light` | `#D5F2E3` | Expense event icon background |
| `destructive` | `#EF4444` | Delete actions, overdue reminders |
| `destructive-light` | `#FEE2E2` | Overdue badge background |
| `warning` | `#F59E0B` | Due-soon reminders |
| `warning-light` | `#FEF3C7` | Due-soon badge background, notification banner |
| `success` | `#10B981` | Upcoming reminders, confirmations |
| `success-light` | `#D1FAE5` | Upcoming badge background |

### Event Type Color Application

Every event type uses three visual differentiators (never color alone):
- **Color:** The accent color above (fuel = teal, service = orange, expense = green)
- **Icon:** Fuel pump / wrench / dollar-sign inside the colored circle
- **Label:** The type name appears as text near the icon in list views

### Application Rules

- NativeWind classes: `bg-surface dark:bg-surface-dark`, `text-ink dark:text-ink-on-dark`.
- Inline styles for chart libraries and precise color control.
- Dark mode: no shadows. Depth through surface color differentiation only.
- Event-type tint backgrounds are pastel, never saturated.
- Focused input borders: 2px `primary` (light) / `#60A5FA` (dark).

---

## 2. Typography

System font stack (San Francisco on iOS, Roboto on Android). No custom fonts.

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Hero number | 54px | 800 | Dashboard total spent (integer part) |
| Hero cents | 28px | 600 | Currency decimal portion |
| Dollar sign | 22px | 500 | Currency symbol, muted color |
| Section value | 22px | 700 | Secondary metrics (cost/mile, avg efficiency) |
| Screen title | 24px | 700 | Settings header, screen-level headings |
| App title | 48px | 800 | Onboarding "AutoMate" |
| Card title | 13px | 600 | Section headers inside cards ("Fuel Efficiency", "Spending", "Recent") |
| Body | 16px | 400 | Form values, primary body text, row labels |
| Secondary | 14px | 400 | List descriptions, metadata, filter chips |
| Subtitle | 18px | 400 | Onboarding subtitle |
| Caption | 12px | 400 | Timestamps, helper text, reminder details |
| Label | 10px | 600 | Tracked uppercase section labels |

### Currency Formatting

Split dollar amounts into three visual weights:
- Dollar sign: 22px, weight 500, `ink-muted`
- Integer: 54px, weight 800, `ink`
- Decimal: 28px, weight 600, `ink-muted`

### Numeric Display

Use `fontVariant: ['tabular-nums']` on all numeric displays: dashboard metrics, event costs, chart tooltips, spending legend amounts.

### Labels

Section labels use tracked uppercase: `fontSize: 10, fontWeight: '600', letterSpacing: 1.5-2, textTransform: 'uppercase'`, colored `ink-muted`. Used for "Total Spent", "Cost / Mile", form section dividers ("Fill Details", "Details"), bottom sheet headers ("Add Event", "Your Vehicles").

---

## 3. Surfaces & Elevation

### Cards

- Background: `card` / `card-dark`
- Border radius: 20px (`rounded-2xl` or `borderRadius: 20`)
- No borders in dashboard cards. Separation through color contrast with screen background.
- Light mode shadow: `shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: {0, 4}, elevation: 3`
- Dark mode: no shadow. Surface color difference provides depth.

### Screen Background

`bg-surface dark:bg-surface-dark` on the outermost SafeAreaView.

### Bordered Surfaces

Settings rows and form fields use 1px borders (`border-divider dark:border-divider-dark` or `border-divider-subtle`) instead of shadow. ReminderCard uses `border border-divider-subtle`.

### Dividers

- Between sections: `bg-divider dark:bg-divider-dark`, full width or with horizontal margin
- Between list rows: `bg-divider-subtle` or `border-divider-subtle`, inset from left (aligned with text start, not edge). Dashboard recent events: `marginLeft: 56` to align past the icon.

---

## 4. Spacing & Rhythm

4px base unit. Varied spacing creates visual hierarchy through space alone.

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4 | Tight gaps (icon-to-text in chips) |
| `sm` | 8 | Inner padding in compact components |
| `md` | 12 | Default gap between elements in a group |
| `lg` | 16 | Card padding, section gaps |
| `xl` | 24 | Gap between sections on a screen |
| `2xl` | 32 | Top/bottom screen padding |

### Contextual Spacing

| Relationship | Spacing |
|-------------|---------|
| Tight coupling (label to value) | 2-4px |
| Within a group (label to field) | 6px (`mb-1.5`) |
| Between form fields | 16px (`mb-4`) |
| Between items in a list | 12-16px |
| Between sections | 24-32px (`mb-6` to `mb-8`) |
| Between cards | 12px |
| Hero to secondary metrics | 16px (`mt-4`) |
| Secondary metrics to first card | 32px (`mb-8`) |

The hero metric area gets the most breathing room. Charts and cards are tighter. Period tabs sit above the hero with 20px below (`mb-5`).

### Screen-Level Padding

- Horizontal: 16px (`px-4`) standard.
- Top inset: handled by SafeAreaView `edges={['top']}`.
- Bottom scroll padding: `paddingBottom: 100` to clear FAB and tab bar.

---

## 5. Interactive Elements

### Period / Tab Selector (Dashboard)

Bare text row, no container. Six equal-width columns. Selection indicated by weight change (500 to 700) and color shift (muted to ink), plus a 4px circle dot indicator below. No pills, no highlights, no segmented control chrome.

### Chips (Filter Bar, Service Types, Categories)

Wrapping grid (`flex-row flex-wrap`) for form chips (ChipPicker). Horizontal row (`flex-row gap-2`) for filter chips. Pill shape: `rounded-full`. Selected: accent color background, white text. Unselected: surface background, muted text, subtle border. Touch target: `px-4 py-2` (form) or `px-4 py-1.5` (filter).

Event type filter chips use the event's accent color when selected (fuel = teal, service = orange, expense = green) instead of primary.

### Segmented Control

Container: `bg-surface rounded-xl border border-divider p-1`. Each segment: `flex-1 py-2 rounded-lg`. Selected: `bg-primary` with white text, border radius 10px (inset). Unselected: transparent with `ink-secondary` text. Transition: 150ms ease.

### Primary Button

`bg-primary` with white text. Border radius: 16px (`rounded-2xl`) for full-width buttons, 12px (`rounded-xl`) for compact buttons. Vertical padding: 16px (`py-4`) full-width, 12px (`py-3`) compact. Disabled: `bg-divider` with `ink-muted` text. Press feedback: `opacity: 0.85`.

### Outline/Destructive Button

`border border-destructive`, transparent background. `text-destructive font-semibold`. Border radius: 12px (`rounded-xl`). Used for delete actions in edit modals.

### Text Button

No background, no border. `text-primary font-semibold` or `text-primary font-medium`. Used for modal cancel/save, "See all", "Have a backup? Restore it".

### Form Fields

- Background: `bg-card dark:bg-card-dark`
- Border: 1px `border-divider dark:border-divider-dark`, 2px focused border on focus
- Border radius: 12px (`rounded-xl`)
- Padding: `px-3.5 py-3`
- Label above: `text-xs ink-muted font-semibold`, `mb-1.5`
- Placeholder: `#706C67`
- Suffix units (gal, mi): `text-sm text-ink-muted` right-aligned inside field
- Prefix ($): `text-sm text-ink-muted mr-1` left-aligned inside field
- Helper text: below field, `text-xs ink-muted`
- Error text: below field, `text-xs destructive`

**Read-only / Computed Field (e.g., Total Cost):**
- Background: `primary-light` (light) / `primary-dark` (dark)
- Value: weight 600, `primary` color
- No border

### Switch

Track: `false: isDark ? '#2A2926' : '#E2E0DB', true: isDark ? '#2E5A9E' : '#A7C4E4'`. Thumb: `isOn ? '#4272C4' : isDark ? '#1A1917' : '#FEFDFB'`.

### FAB

56px circle (`w-14 h-14 rounded-full`). `bg-primary`, white plus icon (30px). Position: `absolute bottom-6 right-5`. Shadow: `shadowOpacity: 0.25, shadowRadius: 4, elevation: 6`. Opens bottom sheet with haptic feedback.

---

## 6. Charts

### Line Chart (Fuel Efficiency)

- Stroke: 2.5px, teal `#1A9A8F`, smooth curve (bezier).
- Area fill: gradient from teal at 10% opacity to transparent.
- Data points: 4px radius, teal fill. Partial fills: hollow dashed circle with card-colored center.
- Active/selected data point: 10px circle with vertical dashed line to x-axis and floating tooltip.
- X-axis: date labels, `ink-muted`, 9-10px, 4-5 evenly spaced.
- Y-axis: value labels, `ink-muted`, 9-10px, left side, 3-4 evenly spaced.
- Grid lines: horizontal only, low-opacity `rulesColor`. X-axis: `divider` color.
- Height: 160px. No chart border or outer frame.
- Animation: 500ms ease-out. On period change: 200ms crossfade (no redraw).
- Pointer: 1px teal strip at 50% opacity, 6px teal pointer dot.

### Donut Chart (Spending)

- `innerRadius: 38, radius: 58`. Segments: fuel, service, expense colors.
- Gap between segments: 2px.
- Center: total in weight 800, 16px. Inner circle color matches card background.
- Selected segment: expands slightly (outer radius + 4px), legend item becomes bold.
- Tooltip: `#1C1B18` background, 8px radius, white text 12px weight 600, `tabular-nums`.

---

## 7. Component Patterns

### VehicleSwitcher

Full-width bar below safe area. Vehicle photo (32px circle, `bg-divider` placeholder with car icon) + nickname (`text-base font-bold`) + year/make/model (`text-xs text-ink-muted`) + chevron-down (18px). Background: screen surface. Bottom border: `border-divider`. Opens bottom sheet with vehicle list. In the bottom sheet vehicle list, photos are 40px and nicknames use `font-semibold`.

### EventRow

Left: 36px circle (`w-9 h-9 rounded-full`) with event-type pastel background and colored icon (18px). Center: date + place (`text-sm text-ink`), odometer (`text-xs text-ink-muted`). Right: cost (`text-sm font-semibold text-ink`). Active: `active:bg-surface`. Row height: min 64px. Row dividers inset to text column (`marginLeft: 56`). No card wrapping per row — rows sit inside a month group card.

### MonthGroupHeader (History)

Sticky header for each month section. Left: month + year (`font-semibold ink`). Right: month total (`ink-muted`). Background: screen surface (clean when sticky). Bottom border: `border-divider-subtle`. Padding: `px-4 py-2.5`.

### MetricCard (Dashboard)

Three cards in a horizontal row, equal width. Label on top (`text-xs ink-muted`), value below (large, bold). For Avg MPG: trend arrow (green ↑ or red ↓) right of value.

### EmptyState

Centered flex container. 64px icon at 40% opacity. Title: `text-lg font-bold`, 12px below icon. Description: `text-sm text-ink-secondary`, max 280px wide, 8px below title. Optional CTA: `bg-primary px-6 py-3 rounded-xl`, `mt-6`.

### ModalHeader

Height: 56px. Three-column flex row. Cancel (`text-primary`, left, `min-w-[60px]`), title (`text-base font-semibold`, centered, flex-1), Save (`text-primary font-semibold`, right, disabled: `text-ink-muted`). Background: `bg-card`. Bottom: `border-divider`.

### ReminderCard

`bg-card rounded-2xl p-4 border border-divider-subtle`. Top row: name (`text-base font-semibold`) + status badge (pill, colored background + text per status). Progress bar: 6px height, `bg-divider` track, colored fill, percentage right-aligned. Detail lines: `text-xs text-ink-muted`.

### SpendingLegend

Vertical list beside donut. Each row: 10px color square (`borderRadius: 3`) + label (`text-sm ink-secondary`) + amount (`text-sm font-semibold ink`, `tabular-nums`) + percentage (`text-xs ink-muted`, `minWidth: 28`). Row gap: 14px.

### Toast / Snackbar

- Position: bottom, 16px above tab bar, centered horizontally.
- Background: inverted (dark in light mode, light in dark mode).
- Text: inverse color, `text-sm`. Action button (e.g., "Undo"): `primary` color, `font-semibold`.
- Border radius: 12px. Padding: `px-3 py-2.5`. Shadow: `0 4px 12px rgba(0,0,0,0.15)`.
- Dismisses on undo press. No auto-dismiss timer.
- Enter: slide up 20px + fade in, 200ms. Exit: fade out, 150ms.

### Bottom Sheet

`@gorhom/bottom-sheet` with dynamic sizing. Handle: 36px wide, 4px tall, `#E2E0DB`, centered, 8px from top. Background: `#FEFDFB`. Border radius (top): 24px. Backdrop: black at 40% opacity, press-to-close. Content padding: 16px horizontal, 12px below handle. Section headers: `text-xs font-semibold text-ink-muted uppercase tracking-wider`. Bottom padding: `h-6` or `h-8`.

### AddEvent Menu

Three rows in bottom sheet. 40px event-type circles (pastel bg + colored icon 20px) + label (`text-base font-medium text-ink`). Padding: `px-4 py-4`. Active: `active:bg-surface`.

---

## 8. Tab Bar

- Background: screen surface with top border `border-divider`.
- Height: platform default (49px iOS, 56px Android) + safe area.
- Icons: 24px, `ink-muted` when inactive, `primary` when active.
- Labels: 10px weight 600, same color logic.
- Active indicator: none (color change is sufficient).
- The FAB sits above the tab bar, not overlapping it.

---

## 9. Motion

- **Reduced motion:** Check `AccessibilityInfo.isReduceMotionEnabled()`. If true, disable all non-essential animations (chart drawing, FAB scale, sheet spring). Keep only functional transitions (screen push/pop).
- Screen transitions: platform defaults via expo-router native stack.
- Chart draw: 500ms ease-out from left to right. Period change: 200ms crossfade.
- FAB: scale to 0.92, 100ms, haptic impact (light), opens bottom sheet with spring.
- Bottom sheet: gorhom default spring (damping: 0.85).
- Button press: opacity 0.85, implicit timing.
- Delete swipe: red background reveals proportionally, "Delete" fades in at 40% threshold. Overshoot disabled.
- Chip selection: background color transition, 150ms ease.
- No decorative motion. Motion conveys state changes only.

---

## 10. Icons

Ionicons (`@expo/vector-icons`) throughout. Sizing:
- Tab bar: navigator default
- Event type icons: 18-20px within circle
- Navigation (chevrons, add, close): 16-18px
- Empty state: 64px, muted color at 40% opacity
- Action items: 16-20px

---

## 11. Dark Mode

Same layout, different palette. Key differences:
- No shadows. Depth from surface layering (`surface-dark` < `card-dark` < `divider-dark`).
- Tab bar active tint: `#6A9FD8` (`primary-tint`) for contrast on dark surfaces.
- Bottom sheets use hardcoded light background (`#FEFDFB`). Known limitation.
- Event-type pastel backgrounds are designed for light mode; acceptable on dark but could be refined.

---

## 12. How to Apply

1. Use Tailwind tokens from `tailwind.config.js` via NativeWind classes for standard surfaces and text.
2. For chart colors, shadows, and values not in Tailwind, use inline `style={}` with hex values from this document.
3. Every screen: `bg-surface dark:bg-surface-dark` background.
4. Dashboard cards: borderless with shadow (light) or surface color (dark).
5. Form fields and settings rows: 1px border treatment.
6. Every numeric display: `fontVariant: ['tabular-nums']`.
7. Test both light and dark mode.
