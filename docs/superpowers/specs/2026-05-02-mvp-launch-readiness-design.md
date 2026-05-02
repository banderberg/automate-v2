# MVP Launch Readiness Sprint — Design Spec

**Date:** 2026-05-02
**Context:** AutoMate v2 is feature-complete (Phases 1–10). This sprint hardens the app for first Play Store publication based on a competitive analysis of Fuelio, Drivvo, Simply Auto, CARFAX, Fuelly, My Cars, and MyAutoLog.

**Scope:** 11 items in 2 tiers. No new database tables or migrations. One new modal route (`licenses.tsx`). One new dependency (`expo-store-review`). Two new component files (`currency.ts`, `AppErrorBoundary.tsx`). One new asset (`notification-icon.png`).

---

## Tier 1 — Must-Fix

### 1. Currency Formatting

**Problem:** The app supports 5 currencies in Settings (USD, EUR, GBP, CAD, AUD) but every display uses a hardcoded `$`. A user who selects EUR still sees `$` everywhere.

**Solution:** Create a `formatCurrency()` utility and thread it through all display points.

**New file:** `src/constants/currency.ts`

```typescript
const CURRENCY_MAP: Record<string, { symbol: string; position: 'prefix' | 'suffix'; space: boolean }> = {
  USD: { symbol: '$', position: 'prefix', space: false },
  EUR: { symbol: '€', position: 'suffix', space: true },
  GBP: { symbol: '£', position: 'prefix', space: false },
  CAD: { symbol: 'C$', position: 'prefix', space: false },
  AUD: { symbol: 'A$', position: 'prefix', space: false },
  // Tier 2 (item D) will expand this list to ~20 currencies
};

export function getCurrencySymbol(code: string): string;
export function formatCurrency(amount: number, code: string): string;
export function splitCurrency(amount: number, code: string): { symbol: string; dollars: string; cents: string; position: 'prefix' | 'suffix' };
```

`formatCurrency(123.45, 'EUR')` → `"123,45 €"`
`formatCurrency(123.45, 'USD')` → `"$123.45"`
`splitCurrency(1234.56, 'USD')` → `{ symbol: '$', dollars: '1,234', cents: '56', position: 'prefix' }`

**Files to modify (currency threading):**

| File | What changes |
|------|-------------|
| `app/(tabs)/dashboard.tsx` | Hero total (splitCurrency), cost/mile, spending breakdown amounts, donut center, accessibility labels. Replace local `splitCurrency` with imported version. Read currency from settings store. |
| `app/(tabs)/history.tsx` | Month total display, accessibility labels on event rows |
| `src/components/EventRow.tsx` | Remove `currency = '$'` default. Accept `currencyCode: string` prop. Use `formatCurrency()`. |
| `src/components/ProjectedCost.tsx` | Projected annual, YTD spent displays and accessibility label. Accept `currencyCode` prop. |
| `src/components/SpendingBarChart.tsx` | Selected bar detail text (`$123 fuel + $45 service...`). Accept `currencyCode` prop. |
| `src/components/InsightCards.tsx` | Pass currency to InsightCard if needed |
| `src/services/insightEngine.ts` | All insight `title` and `subtitle` strings containing `$`. Accept currency code in `InsightEngineInput` or `UnitLabels`. |
| `src/services/pdfExport.ts` | `formatCurrency()` function (line 38). Accept currency parameter from vehicle/settings. |
| `src/services/csvExport.ts` | Verify CSV cost column is raw number (no symbol) — should be fine already. |

The currency code flows from `useSettingsStore` → components via prop or hook. The insight engine receives it via `InsightEngineInput`.

### 2. Remove RECORD_AUDIO Permission

**Problem:** `android.permission.RECORD_AUDIO` is declared in `app.json` line 37. The app has no audio features. This triggers Play Store Data Safety scrutiny and user distrust.

**File to modify:** `app.json`
**Change:** Delete the `"android.permission.RECORD_AUDIO"` line from the permissions array.

### 3. Android Notification Icon

**Problem:** `expo-notifications` config uses `./assets/images/icon.png` (full-color app icon). Android renders notification icons as monochrome silhouettes — a full-color icon becomes a solid colored blob.

**New file:** `assets/images/notification-icon.png`
- 96×96 px
- White silhouette on transparent background
- Simplified version of the app icon — just the core shape, no background fill
- PNG with alpha channel

**File to modify:** `app.json` — update the expo-notifications plugin config:
```json
["expo-notifications", {
  "icon": "./assets/images/notification-icon.png",
  "color": "#4272C4"
}]
```

**Note:** The actual icon asset requires graphic design. The implementation should create a placeholder (white circle or simple car silhouette) that can be replaced with a designed asset later. Alternatively, generate a silhouette programmatically from the existing icon.

### 4. Expand About Section in Settings

**Problem:** The Settings "About" section shows only the version number. No way for users to get help, leave a review, view the privacy policy, or see licenses.

**File to modify:** `app/(tabs)/settings.tsx`

**Add these rows to the About section:**

| Row | Action |
|-----|--------|
| `AutoMate v{version}` | Existing — no change |
| `Rate AutoMate` | Opens Play Store listing via `Linking.openURL('market://details?id=com.arctosbuilt.automate')` |
| `Send Feedback` | Opens email compose via `Linking.openURL('mailto:arctos.built@gmail.com?subject=AutoMate Feedback')` |
| `Privacy Policy` | Opens the hosted privacy policy URL via `Linking.openURL()`. URL to be provided by the developer. |
| `Open Source Licenses` | Opens a new modal screen listing each dependency name and its license type (MIT, Apache-2.0, etc.). Generate the list at build time from `package.json` dependencies or hardcode the ~40 entries. Use a simple `FlatList` in a modal registered at `app/(modals)/licenses.tsx`. |

Each row uses the existing `RowItem` component. `Rate AutoMate` and `Send Feedback` get a small external-link icon instead of the chevron.

### 5. Splash Screen Dark Mode

**Problem:** `app.json` sets `splash.backgroundColor: "#ffffff"`. Dark-mode users get a bright white flash on app launch.

**File to modify:** `app.json`

**Changes:**
- Update `splash.backgroundColor` from `"#ffffff"` to `"#F5F4F1"` (the light-mode surface color from DESIGN.md)
- Add dark splash config under `android.splash` (if supported by current Expo SDK):
```json
"android": {
  "splash": {
    "backgroundColor": "#F5F4F1",
    "dark": {
      "backgroundColor": "#0E0E0C"
    }
  }
}
```
- If the SDK doesn't support `android.splash.dark` at the top level, use the `expo-splash-screen` plugin config instead.

---

## Tier 2 — High-Value Additions

### A. Rate-This-App Prompt

**Problem:** New apps need early positive reviews to build credibility. Without a prompt, only frustrated users review.

**New dependency:** `expo-store-review`

**Implementation:**
1. Add a `totalEventsLogged` counter to the settings store (or a new `_meta` key in the settings table). Incremented each time any event is saved in the event store.
2. After saving an event, check: if `totalEventsLogged >= 5` AND more than 90 days since last prompt (or never prompted), call `StoreReview.requestReview()`.
3. Store `lastReviewPromptDate` in settings to enforce the 90-day cooldown.
4. The native review dialog (Android In-App Review API) handles its own rate-limiting on top of ours.

**Files to modify:**
- `src/stores/settingsStore.ts` — add `totalEventsLogged` and `lastReviewPromptDate` to settings schema
- `src/db/queries/settings.ts` — handle new keys
- `src/stores/eventStore.ts` — increment counter after successful event save, check review trigger
- `app/(tabs)/settings.tsx` — the "Rate AutoMate" row is created in item #4. This item adds the programmatic trigger (after 5th event), not a duplicate row.

**Settings DB keys added:**
- `totalEventsLogged` (integer, default 0)
- `lastReviewPromptDate` (ISO date string or empty)

### B. Drivvo CSV Import

**Problem:** Drivvo has 5.1M downloads and is hemorrhaging users due to a 400% price increase. AutoMate's import supports Fuelio and Fuelly but not Drivvo.

**Drivvo CSV format (from export):**

Drivvo exports multiple CSV sections. The fuel section has columns similar to:
```
Date,Fuel Station,Fuel Type,Fuel Subtype,Fill Type,Volume,Price/Volume,Total Cost,Odometer,Consumption,Payment Method,Notes
```

The service/expense section:
```
Date,Description,Type,Cost,Odometer,Notes
```

**Note:** These column names are based on competitive research, not a verified export file. The implementation should use flexible header matching (case-insensitive, partial match on key columns like "Fuel Station", "Price/Volume", "Fill Type") rather than exact header string comparison. If a real Drivvo export differs, the parser should adapt to the actual headers found.

**File to modify:** `src/services/dataImport.ts`

**Changes:**
1. Update `ParsedImportData.format` type to include `'drivvo'`
2. Update `detectFormat()` — Drivvo CSVs contain `"Fuel Station"` or `"Price/Volume"` in the header, or a `"## Drivvo"` comment
3. Add `parseDrivvoCSV(csvContent: string): ParsedImportData`:
   - Parse fuel section: map Date, Volume, Price/Volume, Total Cost, Odometer, Fuel Station (→ placeName), Fill Type (Full/Partial → isPartialFill), Notes
   - Parse service/expense section: map Date, Description (→ serviceTypes or category), Cost, Odometer, Notes. Use Type field to distinguish service vs expense.
   - Handle Drivvo's date format (likely DD/MM/YYYY — `normalizeDate()` already handles this)
4. Update `app/(modals)/import.tsx` — update detected format display to show "Drivvo" and update the help text listing supported formats

### C. Play Store Listing Copy Refresh

**Problem:** The listing doesn't mention migration from competitors. Users searching "Drivvo alternative" or "switch from Fuelio" won't find AutoMate.

**File to modify:** `docs/PLAY-STORE-LISTING.md`

**Changes:**
1. Add a section to the full description:
```
SWITCHING FROM ANOTHER APP?

AutoMate can import your data from Fuelio, Fuelly, and Drivvo. 
Go to Settings → Import Data, select your export file, and 
you're up and running in seconds. No data left behind.
```

2. Update tags/keywords to include:
   - `Fuelio alternative`
   - `Drivvo alternative`
   - `no ads car tracker`
   - `no subscription fuel log`
   - `privacy car expense`

3. Mention import support in the Features section:
```
◆ Import Your Data
Switching from Fuelio, Fuelly, or Drivvo? Import your complete 
history in seconds. Your data migrates with you.
```

### D. Expand Currency List

**Problem:** Only 5 currencies (USD, EUR, GBP, CAD, AUD) supported. Excludes most of the world.

**Files to modify:**
- `src/constants/currency.ts` (created in item #1) — expand `CURRENCY_MAP` to ~20 currencies
- `app/(tabs)/settings.tsx` — expand `CURRENCIES` array

**Currencies to add (in addition to existing 5):**

| Code | Symbol | Name | Market |
|------|--------|------|--------|
| INR | ₹ | Indian Rupee | India |
| BRL | R$ | Brazilian Real | Brazil |
| MXN | MX$ | Mexican Peso | Mexico |
| JPY | ¥ | Japanese Yen | Japan (no decimals) |
| KRW | ₩ | Korean Won | South Korea (no decimals) |
| PLN | zł | Polish Złoty | Poland |
| SEK | kr | Swedish Krona | Sweden (suffix) |
| NOK | kr | Norwegian Krone | Norway (suffix) |
| DKK | kr | Danish Krone | Denmark (suffix) |
| CHF | CHF | Swiss Franc | Switzerland |
| ZAR | R | South African Rand | South Africa |
| TRY | ₺ | Turkish Lira | Turkey |
| RUB | ₽ | Russian Ruble | Russia |
| PHP | ₱ | Philippine Peso | Philippines |
| NZD | NZ$ | New Zealand Dollar | NZ |

**Special handling:**
- JPY and KRW: no decimal places (amount is always integer)
- SEK, NOK, DKK: symbol is suffix with space (`123 kr`)
- EUR: symbol is suffix with space in most locales (`123,45 €`)

The `formatCurrency()` utility from item #1 must handle `decimals: 0 | 2` and `position: 'prefix' | 'suffix'` per currency.

### E. VIN Decode in Onboarding

**Problem:** The VIN decoder exists (`src/services/vinDecoder.ts`) and works in the full vehicle modal, but onboarding requires manual entry of Year, Make, and Model.

**File to modify:** `app/onboarding.tsx`

**Changes:**
1. Add a VIN text field above the Year field, with a "Look Up" button
2. On valid 17-character VIN entry + tap "Look Up":
   - Call `decodeVin(vin)` from `src/services/vinDecoder.ts`
   - On success: auto-populate Year, Make, Model fields. Show brief success feedback.
   - On failure (network error, invalid VIN): show inline warning "Couldn't look up VIN — enter details manually." Allow save to proceed.
3. VIN field is optional — the existing manual flow is unchanged
4. Add a subtle helper text: "Find your VIN on the driver's door jamb or registration"

**UI placement:** Between the "Add your first vehicle" label and the Nickname field. Collapsible or secondary — it shouldn't overwhelm the simple path.

Suggested layout:
```
[Add your first vehicle]

VIN (optional)
[________________] [Look Up]
Find your VIN on the driver's door jamb or registration

Nickname
[________________]
...rest of fields...
```

### F. Custom Error Boundary

**Problem:** The app uses expo-router's default `ErrorBoundary` export. An unhandled crash in production shows a generic unstyled screen with no branding, no recovery path, and no way to report the issue.

**New file:** `src/components/AppErrorBoundary.tsx`

**Implementation:**
- React class component (error boundaries require class components)
- Catches unhandled JS errors in the component tree
- Displays:
  - App icon (small, centered)
  - "Something went wrong" title
  - Error message in a subtle, non-scary way (e.g., "The app encountered an unexpected error")
  - "Restart" button — calls `Updates.reloadAsync()` (or `DevSettings.reload()` in dev)
  - "Report Issue" text button — opens `mailto:arctos.built@gmail.com?subject=AutoMate Bug Report&body={error message + stack trace summary}`
- Styled to match the app's design system (surface background, ink text, primary button)
- Does NOT try to recover state — a full restart is the safest path

**File to modify:** `app/_layout.tsx`
- Export the custom component as `ErrorBoundary` (replacing the `export { ErrorBoundary } from 'expo-router'` line). Expo Router automatically uses the exported `ErrorBoundary` from each layout file as the error boundary for that segment.

---

## Execution Plan

### Batch 1 (Tier 1 — all parallel, no dependencies)

| Item | Agent | Key files |
|------|-------|-----------|
| #1 Currency formatting | Agent A | `src/constants/currency.ts` (new), dashboard, history, EventRow, ProjectedCost, SpendingBarChart, insightEngine, pdfExport |
| #2 RECORD_AUDIO | Agent B | `app.json` |
| #3 Notification icon | Agent B | `assets/images/notification-icon.png` (new), `app.json` |
| #4 About section | Agent C | `app/(tabs)/settings.tsx` |
| #5 Splash dark mode | Agent B | `app.json` |

Items 2, 3, and 5 are all `app.json` changes — bundle into one agent to avoid merge conflicts.

### Batch 2 (Tier 2 — mostly parallel, noted dependencies)

| Item | Agent | Depends on | Key files |
|------|-------|-----------|-----------|
| A Rate prompt | Agent D | #4 (About row exists) | `settingsStore.ts`, `settings.ts` queries, `eventStore.ts` |
| B Drivvo import | Agent E | None | `src/services/dataImport.ts`, `app/(modals)/import.tsx` |
| C Play Store copy | Agent F | B (mentions Drivvo) | `docs/PLAY-STORE-LISTING.md` |
| D Expand currencies | Agent G | #1 (currency utility exists) | `src/constants/currency.ts`, `app/(tabs)/settings.tsx` |
| E VIN onboarding | Agent H | None | `app/onboarding.tsx` |
| F Error boundary | Agent I | None | `src/components/AppErrorBoundary.tsx` (new), `app/_layout.tsx` |

### Dependency graph

```
Batch 1 (parallel):
  #1 Currency fix ──────────────┐
  #2+#3+#5 app.json bundle      │
  #4 About section ────────┐    │
                           │    │
Batch 2 (parallel):        │    │
  A Rate prompt ◄──────────┘    │
  B Drivvo import ──────┐      │
  C Play Store copy ◄───┘      │
  D Expand currencies ◄────────┘
  E VIN onboarding (independent)
  F Error boundary (independent)
```

---

## What's NOT in Scope

- Cloud sync / backup upgrades
- Receipt OCR
- Gas station finder
- GPS trip tracking
- Home screen widgets
- AI features
- Recurring expenses
- Full-fidelity zip backup
- New database migrations
- Monetization / premium tier (separate brainstorming session)

---

## Acceptance Criteria

1. A user who sets currency to EUR sees `€` (not `$`) on every screen: dashboard, history, event rows, charts, insights, PDF export
2. The Play Store Data Safety form does not require a microphone disclosure
3. Reminder notifications display a recognizable icon in the Android notification shade
4. Settings → About shows version, rate link, feedback email, privacy policy, and licenses
5. Dark-mode app launch does not flash white
6. After logging 5 events, the native review dialog appears (once per 90 days)
7. A Drivvo CSV export can be imported with correct fuel events, costs, and places
8. The Play Store description mentions data import from Fuelio, Fuelly, and Drivvo
9. The currency picker offers ~20 currencies including INR, BRL, MXN, JPY
10. Onboarding offers an optional VIN lookup that auto-fills Year/Make/Model
11. An unhandled JS crash shows a branded error screen with Restart and Report Issue actions
