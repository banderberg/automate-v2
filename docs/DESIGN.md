# AutoMate v2 — Design System Specification

**Purpose:** This document defines the visual design language for AutoMate. It is a standalone spec — read it alongside `docs/PRD.md` and `docs/PHASES.md` but it does not modify them. Apply these rules when building or restyling any UI component.

**Design direction:** Clean, light-first finance app aesthetic. Think premium banking app, not utilitarian utility. The references are a flight tracker (Flighty-style dark cards), a padel booking app (warm accent, pill chips), a focus timer (soft card surfaces, progress indicators), and a credit card manager (large currency typography, line charts with callouts, transaction lists).

---

## 1. Color Palette

### Light Mode (default)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#FFFFFF` | Screen background |
| `surface` | `#F5F5F7` | Card backgrounds, input fields, bottom sheets |
| `surfaceElevated` | `#FFFFFF` | Elevated cards (with shadow) on surface backgrounds |
| `textPrimary` | `#1A1A1A` | Headings, primary content |
| `textSecondary` | `#6B7280` | Labels, captions, helper text |
| `textTertiary` | `#9CA3AF` | Placeholders, disabled text |
| `border` | `#E5E7EB` | Card borders, dividers, input outlines |
| `borderFocused` | `#3B82F6` | Focused input outlines |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0A0A0A` | Screen background |
| `surface` | `#1C1C1E` | Card backgrounds |
| `surfaceElevated` | `#2C2C2E` | Elevated cards |
| `textPrimary` | `#F5F5F7` | |
| `textSecondary` | `#9CA3AF` | |
| `textTertiary` | `#6B7280` | |
| `border` | `#2C2C2E` | |
| `borderFocused` | `#60A5FA` | |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#3B82F6` | Primary buttons, active tab, links, FAB |
| `primaryLight` | `#DBEAFE` | Primary tint backgrounds (light mode) |
| `primaryDark` | `#1E3A5F` | Primary tint backgrounds (dark mode) |
| `fuel` | `#0D9488` | Fuel event icon, chart line, chip |
| `fuelLight` | `#CCFBF1` | Fuel tint background |
| `service` | `#F97316` | Service event icon, chart segment |
| `serviceLight` | `#FFF7ED` | Service tint background |
| `expense` | `#10B981` | Expense event icon, chart segment |
| `expenseLight` | `#D1FAE5` | Expense tint background |
| `destructive` | `#EF4444` | Delete buttons, overdue badges, error text |
| `destructiveLight` | `#FEE2E2` | Delete swipe background |
| `warning` | `#F59E0B` | "Soon" reminder badge |
| `warningLight` | `#FEF3C7` | Warning tint background |
| `success` | `#10B981` | "Upcoming" badge, success toasts, confirmed states |
| `successLight` | `#D1FAE5` | Success tint background |

### Event Type Color Application

Every event type uses three visual differentiators (never color alone):
- **Color:** The accent color above (fuel = teal, service = orange, expense = green)
- **Icon:** Fuel pump / wrench / dollar-sign inside the colored circle
- **Label:** The type name appears as text near the icon in list views

---

## 2. Typography

Use the system font stack (San Francisco on iOS, Roboto on Android). No custom fonts. This keeps the app feeling native and avoids bundle size.

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `displayLarge` | 34 | Bold (700) | 41 | Hero currency values on Dashboard (Total Spent) |
| `displaySmall` | 28 | Bold (700) | 34 | Section hero numbers (Cost/Mile, Avg MPG) |
| `titleLarge` | 22 | SemiBold (600) | 28 | Screen titles in headers |
| `titleMedium` | 18 | SemiBold (600) | 24 | Card titles, section headers, modal titles |
| `titleSmall` | 16 | SemiBold (600) | 22 | Subsection headers |
| `bodyLarge` | 16 | Regular (400) | 24 | Primary body text, form field values |
| `bodyMedium` | 14 | Regular (400) | 20 | Secondary body text, list item descriptions |
| `bodySmall` | 12 | Regular (400) | 16 | Captions, helper text, timestamps |
| `labelLarge` | 14 | SemiBold (600) | 20 | Button labels, chip text, tab labels |
| `labelSmall` | 11 | SemiBold (600) | 16 | Badges, tiny labels |

### Currency Formatting

Large currency values (Dashboard hero): Use `displayLarge` with the dollar sign in `textSecondary` at `titleLarge` size, aligned to the baseline. This creates the visual hierarchy seen in the finance app reference where "$" is smaller than the number.

```
 $248,967.83
 ↑ smaller    ↑ displayLarge
```

---

## 3. Spacing & Layout

### Spacing Scale

Use a 4px base unit. Standard spacing tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4 | Tight gaps (icon-to-text in chips) |
| `sm` | 8 | Inner padding in compact components |
| `md` | 12 | Default gap between elements in a group |
| `lg` | 16 | Card padding, section gaps |
| `xl` | 24 | Gap between sections on a screen |
| `2xl` | 32 | Top/bottom screen padding |

### Screen Layout

- Horizontal padding: 16px on both sides (all screens)
- Content starts directly below the safe area / header — no decorative hero images
- Scrollable screens use `contentContainerStyle` with `paddingBottom: 100` to clear the tab bar and FAB

### Card Layout

Cards are the primary content container. All data lives in cards — never floating directly on the background.

- Padding: 16px
- Border radius: 16px
- Background: `surface` in light mode, `surfaceElevated` in dark mode
- Border: 1px `border` color
- Shadow (light mode only): `0 1px 3px rgba(0,0,0,0.08)`
- No shadow in dark mode — use border differentiation only
- Gap between cards: 12px

---

## 4. Components

### 4.1 Metric Card (Dashboard)

Three cards in a horizontal row, equal width. Inspired by the finance app's "On Progress / Overdue / Total" row.

```
┌─────────────────┐
│  Total Spent     │  ← bodySmall, textSecondary
│  $1,247.30       │  ← displaySmall, textPrimary
└─────────────────┘
```

- Background: `surface`
- Border radius: 16px
- Padding: 16px vertical, 12px horizontal
- Label on top (small, muted), value below (large, bold)
- For Avg MPG: add a trend arrow (↑ green or ↓ red) to the right of the value, `labelSmall` size

### 4.2 Event Row (History list)

Inspired by the finance app's transaction list. Each row is a card-like element with clear left-center-right zones.

```
┌──────────────────────────────────────────────┐
│  🟢  Apr 18 · Shell on Main St    $42.50     │
│  ⛽   45,231 mi                               │
└──────────────────────────────────────────────┘
```

- Left: 36px circle with event type color and icon (white icon on colored background)
- Center: Two lines. Top = date + place (or just date if no place). Bottom = odometer + unit.
- Right: Cost, right-aligned, `titleSmall` weight
- Row height: min 64px, flexible for dynamic type
- Divider: 1px `border` between rows, inset to align with text (not full-width)
- No card wrapping per row — rows sit inside a month group card

### 4.3 Month Group Header (History)

Sticky header for each month section.

```
April 2026                              $342.50
```

- Left: Month + year, `titleSmall`, `textPrimary`
- Right: Month total, `titleSmall`, `textSecondary`
- Background: `background` (so it looks clean when sticky)
- Bottom border: 1px `border`
- Padding: 16px horizontal, 12px vertical

### 4.4 Chip / Pill Selector

Used for: period selector on Dashboard, filter bar on History, service type picker, category picker. Inspired by the padel app's time slot pills and the finance app's "4 Installment / 6 Installment" tabs.

**Unselected:**
- Background: `surface`
- Border: 1px `border`
- Text: `textSecondary`, `labelLarge`
- Border radius: 20px (fully rounded pill)
- Padding: 8px vertical, 16px horizontal

**Selected:**
- Background: `primary`
- Border: none
- Text: `#FFFFFF`, `labelLarge`
- Border radius: 20px

**Event type filter chips (History)** use the event's accent color instead of `primary` when selected:
- Fuel selected: background `fuel`, text white
- Service selected: background `service`, text white
- Expense selected: background `expense`, text white

### 4.5 Floating Action Button

- Size: 56px circle
- Background: `primary`
- Icon: "+" in white, 24px
- Shadow: `0 4px 12px rgba(59,130,246,0.35)`
- Position: bottom-right, 16px from edges, above tab bar
- On press: scale down to 0.92 with haptic feedback

### 4.6 Bottom Sheet

Using @gorhom/bottom-sheet. Consistent styling across all sheets.

- Background: `background` (light) or `surface` (dark)
- Handle bar: 36px wide, 4px tall, `border` color, centered, 8px from top
- Border radius (top): 24px
- Backdrop: black at 40% opacity
- Content padding: 16px horizontal, 12px below handle

### 4.7 Form Fields

Clean, minimal inputs inspired by the padel app's detail cards.

**Text Input:**
- Background: `surface`
- Border: 1px `border`, 2px `borderFocused` on focus
- Border radius: 12px
- Padding: 14px horizontal, 12px vertical
- Label: above the field, `bodySmall`, `textSecondary`
- Value: `bodyLarge`, `textPrimary`
- Helper text: below the field, `bodySmall`, `textTertiary`
- Error text: below the field, `bodySmall`, `destructive`

**Read-only / Computed Field (e.g., Total Cost):**
- Same layout but background: `primaryLight` (light mode) or `primaryDark` (dark mode)
- Value: `titleMedium`, `primary`
- No border

**Segmented Control (Fuel Type, Odometer Unit):**
- Pill-shaped container with `surface` background and 1px `border`
- Border radius: 12px
- Segments are equal-width
- Selected segment: `primary` background, white text, border radius 10px (inset)
- Unselected: transparent background, `textSecondary`
- Transition: 150ms ease

### 4.8 Reminder Card

```
┌──────────────────────────────────────────────┐
│  Oil Change                      ● Upcoming  │
│  ████████████░░░░  84%                       │
│  Next: 55,000 mi · Jul 15, 2026             │
└──────────────────────────────────────────────┘
```

- Card style: standard card (surface background, border, radius)
- Top row: name (titleSmall) + status badge (pill, right-aligned)
- Status badge colors:
  - Upcoming: `success` background at 15% opacity, `success` text
  - Soon: `warning` background at 15% opacity, `warning` text (dark text, not white)
  - Overdue: `destructive` background at 15% opacity, `destructive` text
- Progress bar: 6px height, rounded-full, track = `border`, fill = matches status color
- Bottom row: next due info, `bodyMedium`, `textSecondary`

### 4.9 Vehicle Switcher (Header)

Sits below the safe area, above screen content. Not a navigation header — it's part of the screen content.

```
┌──────────────────────────────────────────────┐
│  [photo]  The Corolla                    ▾   │
│           2020 Toyota Corolla SE             │
└──────────────────────────────────────────────┘
```

- Left: 40px circular photo (or car icon placeholder on `surface` background)
- Center: nickname (titleMedium, textPrimary) + year/make/model (bodySmall, textSecondary)
- Right: chevron-down icon, `textTertiary`
- Tappable: entire row
- No border, no card — sits directly on the background with subtle bottom divider

### 4.10 Modal Header

```
Cancel          Add Fill-Up              Save
```

- Height: 56px
- Cancel: `bodyLarge`, `primary` color, left-aligned
- Title: `titleMedium`, `textPrimary`, centered
- Save: `bodyLarge`, `primary` color, right-aligned. Disabled state: `textTertiary`
- Bottom border: 1px `border`

### 4.11 Empty State

Centered vertically in the available space.

- Icon: 48px, `textTertiary` color
- Title: `titleMedium`, `textPrimary`, centered, 12px below icon
- Description: `bodyMedium`, `textSecondary`, centered, max 280px wide, 8px below title
- Button (if present): primary filled button, 16px below description

### 4.12 Toast / Snackbar

- Position: bottom, 16px above tab bar, centered horizontally
- Background: `textPrimary` (inverted — dark in light mode, light in dark mode)
- Text: inverse of textPrimary, `bodyMedium`
- Action button (e.g., "Undo"): `primary` color on the inverted background, `labelLarge`
- Border radius: 12px
- Padding: 12px horizontal, 10px vertical
- Shadow: `0 4px 12px rgba(0,0,0,0.15)`
- Auto-dismiss: 5 seconds with a subtle shrinking progress bar at the bottom edge

---

## 5. Charts

### 5.1 Line Chart (Fuel Efficiency Trend)

Inspired by the finance app's "Total Spending" analytics chart.

- Background: transparent (sits on the card background)
- Line: 2px stroke, `fuel` color, smooth curve (bezier interpolation)
- Area fill: gradient from `fuel` at 15% opacity to transparent
- Data points: 6px circles, `fuel` color fill, white border. Partial fills: hollow circle (white fill, `fuel` border, dashed)
- Active/selected data point: 10px circle with a vertical dashed line to the x-axis and a floating tooltip showing the value + date
- X-axis: date labels, `bodySmall`, `textTertiary`, 4-5 evenly spaced
- Y-axis: value labels, `bodySmall`, `textTertiary`, left side, 3-4 evenly spaced
- Grid lines: horizontal only, 1px, `border` at 50% opacity
- Height: 200px
- No chart border or outer frame

### 5.2 Donut Chart (Spending Breakdown)

- Outer radius: 80px, inner radius: 55px (thick ring)
- Segments: `fuel`, `service`, `expense` colors
- Gap between segments: 2px (slight spacing)
- Center text: total amount, `titleMedium`, `textPrimary`
- Legend: below the chart, horizontal row, each item shows: colored dot (8px) + label + amount. `bodySmall`, `textSecondary`.
- Selected segment: expands slightly (outer radius + 4px) and the legend item becomes `textPrimary` bold

---

## 6. Tab Bar

- Background: `background` with a top border of 1px `border`
- Height: platform default (49px iOS, 56px Android) + safe area
- Icons: 24px, `textTertiary` when inactive, `primary` when active
- Labels: `labelSmall`, same color logic
- Active indicator: none (the color change is sufficient — no pill or underline)
- The FAB sits above the tab bar, not overlapping it

---

## 7. Animations & Motion

- **Reduced motion:** Check `AccessibilityInfo.isReduceMotionEnabled()`. If true, disable all non-essential animations (chart drawing, FAB scale, sheet spring). Keep only functional transitions (screen push/pop).
- **Screen transitions:** Use expo-router defaults (native platform transitions). Do not customize.
- **Bottom sheet:** Spring animation (damping: 0.85). Not customizable beyond what @gorhom/bottom-sheet provides.
- **Chart line draw:** 600ms ease-out from left to right on first render. No redraw on period change — just fade the new data in (200ms crossfade).
- **FAB press:** Scale to 0.92, 100ms, with `expo-haptics` `ImpactFeedbackStyle.Light`.
- **Delete swipe:** The red background reveals proportionally. The "Delete" text/icon fades in at 40% swipe threshold.
- **Toast enter:** Slide up 20px + fade in, 200ms. Exit: fade out, 150ms.
- **Chip selection:** Background color transition, 150ms ease.

---

## 8. How to Apply This Spec

This file does not replace or modify `CLAUDE.md`, `docs/PRD.md`, or `docs/PHASES.md`. It supplements them.

When building or restyling UI components:
1. Use the NativeWind classes that map to these tokens. Define the color tokens in `tailwind.config.js` under `theme.extend.colors` using the exact hex values above.
2. Reference this document for sizing, spacing, typography, and component-specific styling.
3. If a component isn't specified here, follow the general principles: cards with 16px padding and 16px radius, system fonts, the spacing scale, and the color tokens.
4. Dark mode: use NativeWind's `dark:` variant prefix. Every color that changes between modes must have both variants defined.
