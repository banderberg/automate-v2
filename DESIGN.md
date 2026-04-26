# AutoMate v2 Design System

Warm precision. Sharp layouts and clean type balanced by subtle warmth. Never sterile, never generic.

The app should feel like a well-designed physical notebook that also happens to be smart.

---

## 1. Color

### Strategy: Restrained with warm neutrals

One accent (primary blue) used sparingly for interactive elements. The real color story is the warm neutral surface system. Event-type colors (fuel teal, service orange, expense green) are semantic, not decorative.

### Warm Neutral Palette

Every neutral is tinted warm. No pure grays, no pure black, no pure white.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `surface` | `#F5F4F1` | `#0E0E0C` | Screen background |
| `card` | `#FEFDFB` | `#1A1917` | Card/elevated surfaces |
| `divider` | `#E2E0DB` | `#2A2926` | Borders, dividers |
| `divider-subtle` | `#F0EFEC` | `#2A2926` | Internal row dividers |
| `ink` | `#1C1B18` | `#F5F4F1` | Primary text, headings |
| `ink-secondary` | `#5C5A55` | `#C5C2BC` | Secondary text, descriptions |
| `ink-muted` | `#A8A49D` | `#78756F` | Labels, captions, placeholders |
| `ink-faint` | `#78756F` | `#54524D` | Disabled text, hints |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#3B82F6` | Buttons, links, active tab, FAB |
| `fuel` | `#0D9488` | Fuel events, efficiency chart |
| `service` | `#F97316` | Service events |
| `expense` | `#10B981` | Expense events |
| `destructive` | `#EF4444` | Delete, overdue, errors |
| `warning` | `#F59E0B` | Due-soon reminders |
| `success` | `#10B981` | Upcoming reminders, confirmations |

### Application Rules

- NativeWind classes: `bg-surface dark:bg-surface-dark`, `text-ink dark:text-ink-on-dark`, etc.
- Inline styles when needed for chart libraries or precise control.
- Dark mode: no shadows. Depth through surface color differentiation only.

---

## 2. Typography

System font stack (San Francisco / Roboto). No custom fonts.

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Hero number | 54px | 800 | Dashboard total spent |
| Hero cents | 28px | 600 | Currency decimal portion |
| Section value | 22px | 700 | Secondary metrics, stat values |
| Card title | 13px | 600 | Section headers inside cards |
| Body | 16px (text-base) | 400 | Form values, primary body text |
| Secondary | 14px (text-sm) | 400 | List descriptions, metadata |
| Caption | 12px (text-xs) | 400 | Timestamps, helper text |
| Label | 10px | 600 | Tracked uppercase section labels |

### Currency Formatting

Split dollar amounts into three visual weights:
- Dollar sign: 22px, weight 500, muted color
- Integer: 54px, weight 800, primary color
- Decimal: 28px, weight 600, muted color

Use `fontVariant: ['tabular-nums']` on all numeric displays.

### Labels

Section labels use tracked uppercase: `fontSize: 10, fontWeight: '600', letterSpacing: 1.5-2, textTransform: 'uppercase'`, colored `ink-muted`.

---

## 3. Surfaces & Elevation

### Cards

- Background: `card` / `card-dark`
- Border radius: 20px (`rounded-2xl` or `borderRadius: 20`)
- No borders. Separation through color contrast with screen background.
- Light mode shadow: `shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: {0, 4}, elevation: 3`
- Dark mode: no shadow. Surface color difference provides depth.

### Screen Background

`bg-surface dark:bg-surface-dark` on the outermost SafeAreaView.

### Dividers

- Between sections: `bg-divider dark:bg-divider-dark`, full width or with horizontal margin
- Between list rows: `bg-divider-subtle`, inset from left (aligned with text, not edge)

---

## 4. Spacing & Rhythm

4px base unit. Vary spacing for rhythm; same padding everywhere is monotony.

| Relationship | Spacing |
|-------------|---------|
| Tight coupling (label to value) | 2-4px |
| Within a group | 8-12px |
| Between items in a list | 14-16px |
| Between sections | 24-32px (`mb-6` to `mb-8`) |
| Hero breathing room | 32-40px below |

The hero metric area gets the most breathing room. Charts and cards are tighter. Varied rhythm creates visual hierarchy through space alone.

---

## 5. Interactive Elements

### Period / Tab Selector

Bare text, no container. Selection indicated by weight change (500 to 700) and a small dot indicator (4px circle) below the selected item. No pills, no highlights, no segmented control chrome.

### Chips (Service Types, Categories)

Wrapping grid (`flex-row flex-wrap`), not horizontal scroll. Selected: accent color background, white text. Unselected: surface background, muted text, subtle border.

### Buttons

Primary: `bg-primary` with white text, 12px border radius, 16px vertical padding.
Disabled: reduced opacity or `bg-divider` with muted text.

### Form Fields

- Background: `card` / `card-dark`
- Border: 1px `divider`, focused: 2px `primary`
- Border radius: 12px
- Label above field: 10px tracked uppercase, `ink-muted`

---

## 6. Charts

- Area beneath the background: screen background or card, never bordered
- Line chart: 2.5px stroke, teal (`#0D9488`), curved, with a subtle area fill (10% opacity gradient)
- Donut: inner radius ~38, outer ~58. Center shows total in weight 800.
- Tooltip: dark background (`#1C1B18`), 12px rounded, `tabular-nums`
- Axis text: `ink-muted`, 9-10px
- Grid lines: `divider-subtle` at low opacity

---

## 7. Component Patterns

### VehicleSwitcher

Full-width bar below safe area. Vehicle photo (32px circle) + nickname (bold) + year/make/model (muted) + chevron. Background matches screen surface. Subtle bottom divider.

### EventRow

Left: 36px circle with event-type tint background and colored icon. Center: date + place (primary text), odometer (muted). Right: cost in semibold. Dividers inset to text column.

### EmptyState

Centered. 64px icon in `ink-muted`. Title in weight 600. Description in `ink-secondary`. Optional action button.

### ModalHeader

56px height. Cancel (primary color, left), title (weight 600, centered), Save (primary color, right, disabled: muted). Subtle bottom divider.

### Spending Legend

Vertical list beside donut chart. Each row: 10px rounded-square color indicator + label + right-aligned amount + percentage.

---

## 8. Motion

- Screen transitions: platform defaults (expo-router native)
- Chart draw: 500ms ease-out
- FAB press: scale 0.92, 100ms, haptic
- Bottom sheet: spring (gorhom defaults)
- No decorative motion. Motion conveys state changes only.

---

## 9. How to Apply

1. Use the Tailwind tokens from `tailwind.config.js` via NativeWind classes.
2. For values not in Tailwind (chart colors, precise shadows), use inline `style={}` with the hex values from this document.
3. Every screen uses `bg-surface dark:bg-surface-dark` as its background.
4. Every card uses borderless treatment with shadow (light) or surface color (dark).
5. Every numeric display uses `fontVariant: ['tabular-nums']`.
6. Test both light and dark mode. Dark mode uses no shadows; depth comes from surface layering.
