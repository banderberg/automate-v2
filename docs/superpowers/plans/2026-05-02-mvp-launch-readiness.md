# MVP Launch Readiness Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden AutoMate v2 for first Play Store publication — 11 items across 2 tiers covering currency formatting, permissions cleanup, notification icon, About section, splash dark mode, rate prompt, Drivvo import, Play Store copy, expanded currencies, VIN onboarding, and error boundary.

**Architecture:** All changes fit within the existing architecture. One new utility file (`src/constants/currency.ts`), one new component (`src/components/AppErrorBoundary.tsx`), one new modal (`app/(modals)/licenses.tsx`), one new asset (`assets/images/notification-icon.png`), one new dependency (`expo-store-review`). No database migrations. No new stores.

**Tech Stack:** Expo SDK 52+, TypeScript strict, expo-sqlite, expo-router, Zustand, NativeWind v4, expo-store-review (new)

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/constants/currency.ts` | Currency metadata map, `formatCurrency()`, `splitCurrency()`, `getCurrencySymbol()`, `CURRENCIES` list |
| `src/components/AppErrorBoundary.tsx` | Custom error boundary with restart + report |
| `app/(modals)/licenses.tsx` | Open source licenses screen |
| `assets/images/notification-icon.png` | 96×96 white silhouette notification icon |

### Modified files
| File | Changes |
|------|---------|
| `app.json` | Remove RECORD_AUDIO, update notification icon config, add splash dark mode |
| `app/(tabs)/dashboard.tsx` | Use `formatCurrency`/`splitCurrency` from currency utility, pass `currencyCode` to child components |
| `app/(tabs)/history.tsx` | Use `formatCurrency` in accessibility labels and month headers |
| `app/(tabs)/settings.tsx` | Import CURRENCIES from currency utility, add About section rows (Rate, Feedback, Privacy, Licenses) |
| `src/components/EventRow.tsx` | Replace `currency` string prop with `currencyCode` string prop, use `formatCurrency()` |
| `src/components/ProjectedCost.tsx` | Add `currencyCode` prop, use `formatCurrency()` |
| `src/components/SpendingBarChart.tsx` | Add `currencyCode` prop, use `formatCurrency()` |
| `src/services/insightEngine.ts` | Add `currencyCode` to `InsightEngineInput`, use `formatCurrency()` in all insight strings |
| `src/services/pdfExport.ts` | Accept `currencyCode` parameter, use imported `formatCurrency()` |
| `src/services/dataImport.ts` | Add `parseDrivvoCSV()`, update `detectFormat()`, update `ParsedImportData.format` type |
| `app/(modals)/import.tsx` | Add Drivvo to format labels/colors, update unknown format help text |
| `src/types/index.ts` | Add `totalEventsLogged` and `lastReviewPromptDate` to `AppSettings` |
| `src/stores/settingsStore.ts` | Add new settings fields to DEFAULT_SETTINGS |
| `src/db/queries/settings.ts` | Handle `totalEventsLogged` (integer) and `lastReviewPromptDate` (string) |
| `src/stores/eventStore.ts` | After `addEvent`, increment `totalEventsLogged` and check review trigger |
| `app/onboarding.tsx` | Add VIN field with decode button |
| `app/_layout.tsx` | Replace `ErrorBoundary` export with custom `AppErrorBoundary` |
| `app/(modals)/_layout.tsx` | Add licenses route to modal stack |
| `docs/PLAY-STORE-LISTING.md` | Add competitor migration messaging, Drivvo import callout, updated tags |

---

## Batch 1 — Tier 1 (Parallel)

### Task 1: Currency Formatting Utility + Threading

**Files:**
- Create: `src/constants/currency.ts`
- Modify: `app/(tabs)/dashboard.tsx`
- Modify: `app/(tabs)/history.tsx`
- Modify: `src/components/EventRow.tsx`
- Modify: `src/components/ProjectedCost.tsx`
- Modify: `src/components/SpendingBarChart.tsx`
- Modify: `src/services/insightEngine.ts`
- Modify: `src/services/pdfExport.ts`
- Modify: `app/(modals)/import.tsx`

- [ ] **Step 1: Create `src/constants/currency.ts`**

```typescript
interface CurrencyConfig {
  symbol: string;
  position: 'prefix' | 'suffix';
  space: boolean;
  decimals: number;
  name: string;
}

const CURRENCY_MAP: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', position: 'prefix', space: false, decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', position: 'suffix', space: true, decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', position: 'prefix', space: false, decimals: 2, name: 'British Pound' },
  CAD: { symbol: 'C$', position: 'prefix', space: false, decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', position: 'prefix', space: false, decimals: 2, name: 'Australian Dollar' },
};

function getConfig(code: string): CurrencyConfig {
  return CURRENCY_MAP[code] ?? CURRENCY_MAP['USD'];
}

export function getCurrencySymbol(code: string): string {
  return getConfig(code).symbol;
}

export function formatCurrency(amount: number, code: string): string {
  const config = getConfig(code);
  const formatted = amount.toFixed(config.decimals);
  const withCommas = Number(formatted).toLocaleString('en-US', {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });
  if (config.position === 'suffix') {
    return config.space ? `${withCommas} ${config.symbol}` : `${withCommas}${config.symbol}`;
  }
  return config.space ? `${config.symbol} ${withCommas}` : `${config.symbol}${withCommas}`;
}

export function splitCurrency(amount: number, code: string): {
  symbol: string;
  dollars: string;
  cents: string;
  position: 'prefix' | 'suffix';
  decimals: number;
} {
  const config = getConfig(code);
  const fixed = amount.toFixed(config.decimals);
  const [whole, frac] = fixed.split('.');
  return {
    symbol: config.symbol,
    dollars: parseInt(whole).toLocaleString('en-US'),
    cents: frac ?? '',
    position: config.position,
    decimals: config.decimals,
  };
}

export const CURRENCIES: { value: string; label: string }[] = Object.entries(CURRENCY_MAP).map(
  ([code, config]) => ({ value: code, label: `${code} (${config.symbol})` })
);
```

- [ ] **Step 2: Thread currency through `dashboard.tsx`**

Replace local `splitCurrency` function with imported version. Import `useSettingsStore` for currency code. Update hero total, cost/mile, spending breakdown, donut center, SpendingRow, and all accessibility labels.

Key changes:
- Import `{ splitCurrency, formatCurrency } from '@/src/constants/currency'` and `{ useSettingsStore } from '@/src/stores/settingsStore'`
- Add `const currencyCode = useSettingsStore((s) => s.settings.currency);` in `DashboardScreen`
- Replace `splitCurrency(metrics.totalSpent)` with `splitCurrency(metrics.totalSpent, currencyCode)`
- Hero `$` literal → use `symbol` from `splitCurrency` result, respecting `position`
- Cost/mile `$${metrics.costPerMile.toFixed(2)}` → `formatCurrency(metrics.costPerMile, currencyCode)`
- Donut center `$${...}` → `formatCurrency(metrics.spendingBreakdown.total, currencyCode)`
- Spending breakdown accessibility `$${...}` → `formatCurrency(...)` 
- SpendingRow `$${amount.toFixed(0)}` → needs `currencyCode` prop passed down, use `formatCurrency(amount, currencyCode)` with 0 decimals (use `getCurrencySymbol` + manual format for integer display)
- Pass `currencyCode` to `ProjectedCost`, `SpendingBarChart`, `InsightCards` as needed
- Delete local `splitCurrency` function

- [ ] **Step 3: Thread currency through `EventRow.tsx`**

- Replace `currency?: string` prop (default `'$'`) with `currencyCode?: string` (default `'USD'`)
- Import `{ formatCurrency } from '@/src/constants/currency'`
- Replace `{currency}{event.cost.toFixed(2)}` with `{formatCurrency(event.cost, currencyCode)}`
- Replace `${currency}${event.cost.toFixed(2)}` in accessibility label with `formatCurrency(event.cost, currencyCode)`

- [ ] **Step 4: Thread currency through `ProjectedCost.tsx`**

- Add `currencyCode?: string` prop (default `'USD'`)
- Import `{ formatCurrency } from '@/src/constants/currency'`
- Replace all `$${Math.round(...).toLocaleString('en-US')}` with `formatCurrency(Math.round(...), currencyCode)`
- Update accessibility label similarly

- [ ] **Step 5: Thread currency through `SpendingBarChart.tsx`**

- Add `currencyCode?: string` prop (default `'USD'`)
- Import `{ formatCurrency, getCurrencySymbol } from '@/src/constants/currency'`
- Replace selected bar detail `$${Math.round(selected.fuel)}` etc. with `formatCurrency(Math.round(selected.fuel), currencyCode)`

- [ ] **Step 6: Thread currency through `insightEngine.ts`**

- Add `currencyCode?: string` to `InsightEngineInput.periodMetrics` (or top level)
- Import `{ formatCurrency } from '@/src/constants/currency'`
- Add `currencyCode` to `UnitLabels` and `resolveUnitLabels` (pass through from input)
- Replace all `$${...}` patterns in insight `title` and `subtitle` strings with `formatCurrency(...)`:
  - `checkSpendingSpike`: `$${Math.round(totalSpent)}` → `formatCurrency(Math.round(totalSpent), code)`
  - `checkExpensiveFillup`: `$${mostRecent.cost.toFixed(0)}` → `formatCurrency(mostRecent.cost, code)` (rounded)
  - `checkNextFillupCost`: `~$${estimate}` → `~${formatCurrency(estimate, code)}`
  - `checkCheaperStation`: `~$${savingsPerFill}/${units.fillWord}` → `~${formatCurrency(savingsPerFill, code)}/${units.fillWord}`
  - `checkCheaperStation`: `$${regularAvgPrice.toFixed(2)}` → `formatCurrency(regularAvgPrice, code)` etc.
  - `checkMonthOverMonth`: `$${Math.round(recentTotal)}` → `formatCurrency(Math.round(recentTotal), code)`

- [ ] **Step 7: Thread currency through `pdfExport.ts`**

- Accept `currencyCode: string` parameter in the export function signature
- Import `{ formatCurrency as formatCurrencyUtil } from '../constants/currency'`
- Replace local `formatCurrency` function body: `return formatCurrencyUtil(amount, currencyCode)`

- [ ] **Step 8: Update dashboard.tsx to pass currencyCode to insightEngine**

In the `loadInsightData` async function, add `currencyCode` to the `InsightEngineInput`:
```typescript
setInsightInput({
  events,
  vehicle: activeVehicle!,
  currencyCode,
  periodMetrics: { ... },
  ...
});
```

- [ ] **Step 9: Thread currency through `history.tsx`**

- Import `{ formatCurrency } from '@/src/constants/currency'` and `{ useSettingsStore } from '@/src/stores/settingsStore'`
- Add `const currencyCode = useSettingsStore((s) => s.settings.currency);` in HistoryScreen
- In `SwipeableEventRow` accessibility label: replace `$${event.cost.toFixed(2)}` with `formatCurrency(event.cost, currencyCode)`
- In month headers: replace `$` prefix on totals with `formatCurrency`
- Pass `currencyCode` to `EventRow` component

- [ ] **Step 10: Update `import.tsx` `formatCost`**

- Import `{ formatCurrency } from '@/src/constants/currency'` and `{ useSettingsStore } from '@/src/stores/settingsStore'`
- Replace local `formatCost` with `formatCurrency(cost, currencyCode)` usage

- [ ] **Step 11: Verify no remaining hardcoded `$` in display code**

Run: `grep -rn '\\$\${' app/ src/components/ src/services/insightEngine.ts src/services/pdfExport.ts | grep -v node_modules | grep -v '.test.'`

Expected: No results showing hardcoded `$` in currency display contexts.

- [ ] **Step 12: Commit**

```bash
git add src/constants/currency.ts app/(tabs)/dashboard.tsx app/(tabs)/history.tsx src/components/EventRow.tsx src/components/ProjectedCost.tsx src/components/SpendingBarChart.tsx src/services/insightEngine.ts src/services/pdfExport.ts app/(modals)/import.tsx
git commit -m "feat: add formatCurrency utility and thread through all display points

Replaces hardcoded $ with currency-aware formatting that respects
the user's selected currency (prefix/suffix, spacing, decimals)."
```

---

### Task 2: app.json Bundle (RECORD_AUDIO + Notification Icon + Splash Dark Mode)

**Files:**
- Modify: `app.json`
- Create: `assets/images/notification-icon.png`

- [ ] **Step 1: Remove RECORD_AUDIO permission**

In `app.json`, delete `"android.permission.RECORD_AUDIO"` from the `android.permissions` array (line 37).

- [ ] **Step 2: Create notification icon placeholder**

Create a 96×96 PNG: white filled circle on transparent background. This is a placeholder to be replaced with a designed asset later.

Use Node.js to generate a minimal valid PNG:
```bash
node -e "
const { createCanvas } = require('canvas');
// If canvas not available, create a minimal 96x96 transparent PNG manually
" 2>/dev/null
```

If `canvas` isn't available, create a 1x1 transparent PNG as a minimal placeholder and document that it needs replacement. The key is the `app.json` config pointing to the right path.

- [ ] **Step 3: Update expo-notifications config**

In `app.json`, update the expo-notifications plugin entry:
```json
["expo-notifications", {
  "icon": "./assets/images/notification-icon.png",
  "color": "#4272C4"
}]
```

Change `"color": "#3B82F6"` to `"color": "#4272C4"` (app's primary color) and `"icon"` path.

- [ ] **Step 4: Add splash dark mode config**

In `app.json`:
- Change `splash.backgroundColor` from `"#ffffff"` to `"#F5F4F1"`
- Add `android.splash` with dark variant:
```json
"splash": {
  "backgroundColor": "#F5F4F1",
  "dark": {
    "backgroundColor": "#0E0E0C"
  }
}
```

under the `android` key.

- [ ] **Step 5: Commit**

```bash
git add app.json assets/images/notification-icon.png
git commit -m "fix: remove RECORD_AUDIO, add notification icon config, splash dark mode

- Remove unused RECORD_AUDIO permission that triggers Play Store scrutiny
- Point notification icon to dedicated monochrome asset (placeholder)
- Add dark splash background (#0E0E0C) to prevent white flash"
```

---

### Task 3: About Section in Settings

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Create: `app/(modals)/licenses.tsx`
- Modify: `app/(modals)/_layout.tsx`

- [ ] **Step 1: Add About section rows to `settings.tsx`**

Import `Linking` from `react-native`. Add these rows in the About section after the version row:

```tsx
<RowItem
  label="Rate AutoMate"
  onPress={() => Linking.openURL('market://details?id=com.arctosbuilt.automate')}
  accessibilityLabel="Rate AutoMate on Play Store"
/>
<RowItem
  label="Send Feedback"
  onPress={() => Linking.openURL('mailto:arctos.built@gmail.com?subject=AutoMate Feedback')}
  accessibilityLabel="Send feedback email"
/>
<RowItem
  label="Privacy Policy"
  onPress={() => Linking.openURL('https://arctosbuilt.com/automate/privacy')}
  accessibilityLabel="View privacy policy"
/>
<RowItem
  label="Open Source Licenses"
  onPress={() => nav.push('/(modals)/licenses')}
  accessibilityLabel="View open source licenses"
/>
```

- [ ] **Step 2: Create `app/(modals)/licenses.tsx`**

Simple FlatList modal showing dependency names and license types. Hardcode the ~30 main dependencies from package.json.

```tsx
import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '@/src/components/ModalHeader';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';

const LICENSES = [
  { name: 'expo', license: 'MIT' },
  { name: 'expo-router', license: 'MIT' },
  { name: 'expo-sqlite', license: 'MIT' },
  { name: 'expo-notifications', license: 'MIT' },
  { name: 'expo-image-picker', license: 'MIT' },
  { name: 'expo-location', license: 'MIT' },
  { name: 'expo-file-system', license: 'MIT' },
  { name: 'expo-crypto', license: 'MIT' },
  { name: 'expo-haptics', license: 'MIT' },
  { name: 'expo-sharing', license: 'MIT' },
  { name: 'expo-print', license: 'MIT' },
  { name: 'react', license: 'MIT' },
  { name: 'react-native', license: 'MIT' },
  { name: 'zustand', license: 'MIT' },
  { name: 'nativewind', license: 'MIT' },
  { name: 'tailwindcss', license: 'MIT' },
  { name: 'react-native-gifted-charts', license: 'MIT' },
  { name: '@gorhom/bottom-sheet', license: 'MIT' },
  { name: '@shopify/flash-list', license: 'MIT' },
  { name: 'react-native-gesture-handler', license: 'MIT' },
  { name: 'react-native-reanimated', license: 'MIT' },
  { name: 'react-native-safe-area-context', license: 'MIT' },
  { name: '@expo/vector-icons', license: 'MIT' },
  { name: 'expo-map-view', license: 'MIT' },
  { name: 'react-native-maps', license: 'MIT' },
];

export default function LicensesModal() {
  const nav = useGuardedNavigate();
  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader title="Open Source Licenses" cancelLabel="Done" onCancel={() => nav.back()} hideSave />
      <FlatList
        data={LICENSES}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-divider-subtle dark:border-divider-dark">
            <Text className="text-sm text-ink dark:text-ink-on-dark flex-1">{item.name}</Text>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark">{item.license}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Add licenses route to `app/(modals)/_layout.tsx`**

Add `<Stack.Screen name="licenses" options={{ headerShown: false }} />` to the Stack.

- [ ] **Step 4: Update CURRENCIES import in settings.tsx**

Replace the local `CURRENCIES` array in `settings.tsx` with import from `src/constants/currency.ts`:
```typescript
import { CURRENCIES } from '@/src/constants/currency';
```
Delete the local `CURRENCIES` array (lines 22-28).

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/settings.tsx app/(modals)/licenses.tsx app/(modals)/_layout.tsx
git commit -m "feat: expand About section with Rate, Feedback, Privacy, Licenses

Settings About section now shows links to rate on Play Store, send
feedback email, view privacy policy, and browse open source licenses."
```

---

## Batch 2 — Tier 2 (Parallel, after Batch 1)

### Task A: Rate-This-App Prompt

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db/queries/settings.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/stores/eventStore.ts`

**Depends on:** Task 3 (About section creates "Rate AutoMate" row)

- [ ] **Step 1: Add settings fields to AppSettings type**

In `src/types/index.ts`, add to `AppSettings`:
```typescript
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  currency: string;
  defaultFuelUnit: 'gallons' | 'litres';
  defaultOdometerUnit: 'miles' | 'kilometers';
  hasCompletedOnboarding: boolean;
  totalEventsLogged: number;
  lastReviewPromptDate: string;
}
```

- [ ] **Step 2: Update settings queries**

In `src/db/queries/settings.ts`, add the two new fields to `get()`:
```typescript
totalEventsLogged: parseInt(map.get('totalEventsLogged') ?? '0', 10),
lastReviewPromptDate: map.get('lastReviewPromptDate') ?? '',
```

- [ ] **Step 3: Update DEFAULT_SETTINGS in settingsStore**

Add:
```typescript
totalEventsLogged: 0,
lastReviewPromptDate: '',
```

- [ ] **Step 4: Install expo-store-review**

```bash
npx expo install expo-store-review
```

- [ ] **Step 5: Add review trigger to eventStore.addEvent**

In `src/stores/eventStore.ts`, after the successful `addEvent` (after `set(...)` call in the try block):

```typescript
// Increment event counter and check review prompt
try {
  const settingsStore = (await import('./settingsStore')).useSettingsStore;
  const settings = settingsStore.getState().settings;
  const newCount = settings.totalEventsLogged + 1;
  await settingsStore.getState().updateSetting('totalEventsLogged', newCount);

  if (newCount >= 5) {
    const lastPrompt = settings.lastReviewPromptDate;
    const daysSinceLastPrompt = lastPrompt
      ? (Date.now() - new Date(lastPrompt).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (daysSinceLastPrompt >= 90) {
      const StoreReview = await import('expo-store-review');
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        await settingsStore.getState().updateSetting(
          'lastReviewPromptDate',
          new Date().toISOString().slice(0, 10)
        );
      }
    }
  }
} catch {
  // Review prompt is best-effort
}
```

Use dynamic imports to avoid circular dependencies (eventStore importing settingsStore) and to lazy-load expo-store-review.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/db/queries/settings.ts src/stores/settingsStore.ts src/stores/eventStore.ts package.json
git commit -m "feat: add in-app review prompt after 5th event logged

Triggers native Play Store review dialog after 5 events, max once
per 90 days. Counter persists in app_settings table."
```

---

### Task B: Drivvo CSV Import

**Files:**
- Modify: `src/services/dataImport.ts`
- Modify: `app/(modals)/import.tsx`

- [ ] **Step 1: Update ParsedImportData type**

In `src/services/dataImport.ts`, update:
```typescript
export interface ParsedImportData {
  events: ParsedEvent[];
  format: 'fuelio' | 'fuelly' | 'automate' | 'drivvo';
}
```

- [ ] **Step 2: Update detectFormat**

Add Drivvo detection before the `return 'unknown'`:
```typescript
// Drivvo: contains "Fuel Station" + "Price/Volume" or "Fill Type" in header, or "## Drivvo"
if (content.includes('## Drivvo') || 
    (content.toLowerCase().includes('fuel station') && content.toLowerCase().includes('fill type'))) {
  return 'drivvo';
}
```

Update return type: `'fuelio' | 'fuelly' | 'automate' | 'drivvo' | 'unknown'`

- [ ] **Step 3: Add parseDrivvoCSV function**

Add after `parseFuelioCSV`:
```typescript
export function parseDrivvoCSV(csvContent: string): ParsedImportData {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.length > 0);
  const events: ParsedEvent[] = [];
  let headerMap: Map<string, number> | null = null;
  let section: 'fuel' | 'service' | 'unknown' = 'unknown';

  for (const line of lines) {
    // Section markers
    if (line.startsWith('##') || line.startsWith('#')) {
      if (line.toLowerCase().includes('fuel') || line.toLowerCase().includes('refuel')) {
        section = 'fuel';
      } else if (line.toLowerCase().includes('service') || line.toLowerCase().includes('expense') || line.toLowerCase().includes('cost')) {
        section = 'service';
      }
      headerMap = null;
      continue;
    }

    const fields = parseCSVLine(line);

    // Detect header row
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('date') && (lowerLine.includes('cost') || lowerLine.includes('total') || lowerLine.includes('price'))) {
      headerMap = new Map();
      for (let i = 0; i < fields.length; i++) {
        headerMap.set(fields[i].toLowerCase().trim(), i);
      }
      continue;
    }

    if (!headerMap || fields.length < 3) continue;

    // Helper to get field by partial header name match
    const getField = (keys: string[]): string => {
      for (const key of keys) {
        for (const [header, index] of headerMap!) {
          if (header.includes(key)) return fields[index]?.trim() ?? '';
        }
      }
      return '';
    };

    const dateStr = getField(['date']);
    const date = normalizeDate(dateStr);
    if (!date) continue;

    if (section === 'fuel' || (section === 'unknown' && (lowerLine.includes('fuel') || headerMap.has('volume') || headerMap.has('fill type')))) {
      const totalCost = parseFloat(getField(['total cost', 'total', 'cost']));
      if (isNaN(totalCost)) continue;

      const volume = parseFloat(getField(['volume']));
      const pricePerUnit = parseFloat(getField(['price/volume', 'price per', 'unit price']));
      const odometer = parseFloat(getField(['odometer', 'odo']));
      const fillType = getField(['fill type', 'fill']);
      const station = getField(['fuel station', 'station', 'location']);
      const notes = getField(['notes', 'note', 'comment']);

      events.push({
        date,
        type: 'fuel',
        cost: totalCost,
        volume: isNaN(volume) ? undefined : volume,
        pricePerUnit: isNaN(pricePerUnit) ? undefined : pricePerUnit,
        odometer: isNaN(odometer) ? undefined : odometer,
        isPartialFill: fillType.toLowerCase().includes('partial'),
        placeName: station || undefined,
        notes: notes || undefined,
      });
    } else if (section === 'service') {
      const cost = parseFloat(getField(['cost', 'total', 'price']));
      if (isNaN(cost)) continue;

      const odometer = parseFloat(getField(['odometer', 'odo']));
      const description = getField(['description', 'title', 'name']);
      const typeField = getField(['type', 'category']);
      const notes = getField(['notes', 'note', 'comment']);

      const isExpense = typeField.toLowerCase().includes('expense') || typeField.toLowerCase().includes('other');

      events.push({
        date,
        type: isExpense ? 'expense' : 'service',
        cost,
        odometer: isNaN(odometer) ? undefined : odometer,
        notes: notes || undefined,
        serviceTypes: !isExpense && description ? [description] : undefined,
        category: isExpense ? (description || typeField || undefined) : undefined,
      });
    }
  }

  return { events, format: 'drivvo' };
}
```

- [ ] **Step 4: Update import.tsx**

Add `'drivvo'` to `DetectedFormat` type, `FORMAT_LABELS`, and `FORMAT_COLORS`:
```typescript
type DetectedFormat = 'fuelio' | 'fuelly' | 'automate' | 'drivvo' | 'unknown';

const FORMAT_LABELS: Record<DetectedFormat, string> = {
  ...existing,
  drivvo: 'Drivvo Export',
};

const FORMAT_COLORS: Record<DetectedFormat, { bg: string; text: string }> = {
  ...existing,
  drivvo: { bg: '#9333EA20', text: '#9333EA' },
};
```

Import `parseDrivvoCSV` and add to the switch:
```typescript
case 'drivvo':
  data = parseDrivvoCSV(content);
  break;
```

Update the unknown format help text to mention Drivvo:
```
This file does not match Fuelio, Fuelly, Drivvo, or AutoMate CSV formats.
```

- [ ] **Step 5: Commit**

```bash
git add src/services/dataImport.ts app/(modals)/import.tsx
git commit -m "feat: add Drivvo CSV import support

Flexible header-matching parser for Drivvo exports. Handles fuel
and service/expense sections with partial fill detection."
```

---

### Task C: Play Store Listing Copy Refresh

**Files:**
- Modify: `docs/PLAY-STORE-LISTING.md`

**Depends on:** Task B (mentions Drivvo import)

- [ ] **Step 1: Update Play Store listing**

Add to the features section:
```
◆ Import Your Data
Switching from Fuelio, Fuelly, or Drivvo? Import your complete history in seconds. Your data migrates with you.
```

Add a new section before the closing:
```
SWITCHING FROM ANOTHER APP?

AutoMate can import your data from Fuelio, Fuelly, and Drivvo. Go to Settings → Import Data, select your export file, and you're up and running in seconds. No data left behind.
```

Update tags to include: `Fuelio alternative`, `Drivvo alternative`, `no ads car tracker`, `no subscription fuel log`, `privacy car expense`

- [ ] **Step 2: Commit**

```bash
git add docs/PLAY-STORE-LISTING.md
git commit -m "docs: refresh Play Store listing with competitor migration messaging

Targets users searching for Fuelio/Drivvo alternatives. Highlights
import support, no-subscription model, and privacy-first approach."
```

---

### Task D: Expand Currency List

**Files:**
- Modify: `src/constants/currency.ts`
- Modify: `app/(tabs)/settings.tsx` (if CURRENCIES wasn't already imported from currency.ts)

**Depends on:** Task 1 (currency utility exists)

- [ ] **Step 1: Expand CURRENCY_MAP**

Add these currencies to `CURRENCY_MAP` in `src/constants/currency.ts`:
```typescript
INR: { symbol: '₹', position: 'prefix', space: false, decimals: 2, name: 'Indian Rupee' },
BRL: { symbol: 'R$', position: 'prefix', space: false, decimals: 2, name: 'Brazilian Real' },
MXN: { symbol: 'MX$', position: 'prefix', space: false, decimals: 2, name: 'Mexican Peso' },
JPY: { symbol: '¥', position: 'prefix', space: false, decimals: 0, name: 'Japanese Yen' },
KRW: { symbol: '₩', position: 'prefix', space: false, decimals: 0, name: 'Korean Won' },
PLN: { symbol: 'zł', position: 'suffix', space: true, decimals: 2, name: 'Polish Złoty' },
SEK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Swedish Krona' },
NOK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Norwegian Krone' },
DKK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Danish Krone' },
CHF: { symbol: 'CHF', position: 'prefix', space: true, decimals: 2, name: 'Swiss Franc' },
ZAR: { symbol: 'R', position: 'prefix', space: false, decimals: 2, name: 'South African Rand' },
TRY: { symbol: '₺', position: 'prefix', space: false, decimals: 2, name: 'Turkish Lira' },
RUB: { symbol: '₽', position: 'suffix', space: true, decimals: 2, name: 'Russian Ruble' },
PHP: { symbol: '₱', position: 'prefix', space: false, decimals: 2, name: 'Philippine Peso' },
NZD: { symbol: 'NZ$', position: 'prefix', space: false, decimals: 2, name: 'New Zealand Dollar' },
```

- [ ] **Step 2: Verify dashboard handles 0-decimal currencies**

Check that `splitCurrency` returns empty `cents` for JPY/KRW (decimals: 0). The hero total display should not show `.XX` for these currencies. If needed, conditionally hide the cents portion when `decimals === 0`.

- [ ] **Step 3: Make currency picker scrollable**

In `settings.tsx`, the `PickerModal` uses `scrollEnabled={false}` — with 20 currencies this needs `scrollEnabled={true}` and a `maxHeight`:
```tsx
<FlatList
  data={options}
  ...
  scrollEnabled={options.length > 6}
  style={options.length > 6 ? { maxHeight: 400 } : undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/constants/currency.ts app/(tabs)/settings.tsx
git commit -m "feat: expand currency picker from 5 to 20 currencies

Adds INR, BRL, MXN, JPY, KRW, PLN, SEK, NOK, DKK, CHF, ZAR, TRY,
RUB, PHP, NZD. Zero-decimal currencies (JPY, KRW) handled correctly."
```

---

### Task E: VIN Decode in Onboarding

**Files:**
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: Add VIN state and decode handler**

Add state variables:
```typescript
const [vin, setVin] = useState('');
const [vinLoading, setVinLoading] = useState(false);
const [vinError, setVinError] = useState('');
```

Add import:
```typescript
import { decodeVin } from '@/src/services/vinDecoder';
```

Add handler:
```typescript
const handleVinLookup = useCallback(async () => {
  if (vin.length !== 17 || vinLoading) return;
  setVinLoading(true);
  setVinError('');
  try {
    const result = await decodeVin(vin.trim());
    if (result) {
      if (result.year) setYear(String(result.year));
      if (result.make) setMake(result.make);
      if (result.model) setModel(result.model);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setVinError("Couldn't look up VIN — enter details manually.");
    }
  } catch {
    setVinError("Couldn't look up VIN — enter details manually.");
  } finally {
    setVinLoading(false);
  }
}, [vin, vinLoading]);
```

- [ ] **Step 2: Add VIN field to form UI**

Insert between the "Add your first vehicle" label and the Nickname field:

```tsx
{/* VIN lookup (optional) */}
<View className="mb-4">
  <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
    VIN (optional)
  </Text>
  <View className="flex-row" style={{ gap: 8 }}>
    <View className="flex-1 bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
      <TextInput
        className="text-base text-ink dark:text-ink-on-dark"
        value={vin}
        onChangeText={(t) => setVin(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 17))}
        placeholder="e.g., 1HGBH41JXMN109186"
        placeholderTextColor="#A8A49D"
        maxLength={17}
        autoCapitalize="characters"
        accessibilityLabel="Vehicle identification number"
      />
    </View>
    <Pressable
      onPress={handleVinLookup}
      disabled={vin.length !== 17 || vinLoading}
      className={`px-4 rounded-xl items-center justify-center ${
        vin.length === 17 && !vinLoading ? 'bg-primary' : 'bg-divider dark:bg-divider-dark'
      }`}
      accessibilityLabel="Look up VIN"
      accessibilityRole="button"
    >
      {vinLoading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text className={`text-sm font-semibold ${vin.length === 17 ? 'text-white' : 'text-ink-muted dark:text-ink-muted-on-dark'}`}>
          Look Up
        </Text>
      )}
    </Pressable>
  </View>
  {vinError ? (
    <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">{vinError}</Text>
  ) : (
    <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark mt-1">
      Find your VIN on the driver's door jamb or registration
    </Text>
  )}
</View>
```

Add `ActivityIndicator` to imports from `react-native`.

- [ ] **Step 3: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat: add VIN decode to onboarding flow

Optional VIN field with Look Up button auto-fills Year, Make, Model
from NHTSA API. Gracefully falls back to manual entry on failure."
```

---

### Task F: Custom Error Boundary

**Files:**
- Create: `src/components/AppErrorBoundary.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create `AppErrorBoundary.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRestart = async () => {
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {
      this.setState({ hasError: false, error: null });
    }
  };

  handleReport = () => {
    const errorMsg = this.state.error?.message ?? 'Unknown error';
    const stack = this.state.error?.stack?.slice(0, 500) ?? '';
    const body = encodeURIComponent(`Error: ${errorMsg}\n\nStack:\n${stack}`);
    Linking.openURL(`mailto:arctos.built@gmail.com?subject=AutoMate Bug Report&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#F5F4F1', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Ionicons name="warning-outline" size={36} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1C1B18', marginBottom: 8, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#706C67', textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
            The app encountered an unexpected error. Restarting usually fixes it.
          </Text>
          <Pressable
            onPress={this.handleRestart}
            style={{ backgroundColor: '#4272C4', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 16, marginBottom: 16 }}
            accessibilityLabel="Restart app"
            accessibilityRole="button"
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Restart</Text>
          </Pressable>
          <Pressable
            onPress={this.handleReport}
            style={{ paddingVertical: 8 }}
            accessibilityLabel="Report this issue via email"
            accessibilityRole="button"
          >
            <Text style={{ color: '#4272C4', fontSize: 14, fontWeight: '500' }}>Report Issue</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wire into root layout**

In `app/_layout.tsx`, replace:
```typescript
export { ErrorBoundary } from 'expo-router';
```
with:
```typescript
export { AppErrorBoundary as ErrorBoundary } from '@/src/components/AppErrorBoundary';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AppErrorBoundary.tsx app/_layout.tsx
git commit -m "feat: custom error boundary with restart and report actions

Replaces expo-router default ErrorBoundary with branded screen showing
restart button and mailto report link."
```

---

## Summary

| Batch | Tasks | Parallel? |
|-------|-------|-----------|
| 1 | #1 Currency, #2 app.json bundle, #3 About section | Yes (3 agents) |
| 2 | A Rate prompt, B Drivvo import, D Expand currencies, E VIN onboarding, F Error boundary | Yes (5 agents) |
| 2 (seq) | C Play Store copy | After B completes |

Total: 11 items, ~10 commits, 4 new files, ~20 modified files.
