# Smart Dashboard Design

## Overview

Upgrade the dashboard from a passive summary screen to an intelligent, insight-driven view that surfaces actionable observations, period-over-period comparisons, and forward-looking projections — all computed from the user's own local data with no external APIs.

### Design Principles

- **Clear and concise** — every element earns its screen space. No information overload.
- **Progressive richness** — the dashboard grows smarter as the user logs more data. New users see a clean, simple view. Power users see insights and trends.
- **Insights must be earned** — an insight only appears when the underlying data justifies it. No filler, no repetition for its own sake.
- **Fully offline** — all computation uses the existing SQLite data. No network dependency.

## Changes Summary

| Element | Status | What Changes |
|---|---|---|
| Vehicle switcher | Unchanged | — |
| Period selector | Unchanged | — |
| Hero total spent | Enhanced | Add period-over-period delta |
| Secondary metrics (cost/mi, avg MPG) | Enhanced | Add period-over-period deltas with absolute values |
| Projected annual cost | **New** | Compact progress bar below metrics |
| Insight cards | **New** | 0–3 contextual cards between metrics and charts |
| Fuel efficiency chart | Unchanged | — |
| Spending over time chart | **New** | Stacked bar chart by month |
| Spending donut | Unchanged | — |
| Recent events | Unchanged | — |

## Scroll Order

1. Vehicle switcher
2. Period selector (1M / 3M / 6M / YTD / 1Y / All)
3. Hero total spent + delta
4. Secondary metrics (cost/mi, avg MPG) + deltas
5. Projected annual cost bar
6. Insight cards (0–3)
7. Fuel efficiency line chart (existing)
8. Spending over time stacked bar chart (new)
9. Spending donut (existing)
10. Recent events (existing)

---

## Section 1: Enriched Hero Metrics

### Total Spent Delta

Below the hero dollar amount, show a comparison to the equivalent previous period:

- "↑ 18% vs prev 3 months" (red for increase)
- "↓ 12% vs prev 3 months" (green for decrease)

**Display rules:**
- Only show when the previous period has event data to compare against.
- Only show when the change exceeds 5% (suppress noise).
- For "All" period, no delta is shown (no previous period exists).
- For "YTD", compare against Jan 1 – today of the prior year.
- When insufficient data exists, omit the delta line entirely — no placeholder, no "not enough data" text.

### Secondary Metric Deltas

Each secondary metric (cost/mile, avg efficiency) gets a delta line below its value:

- Cost/mile: "↓ $0.03" or "↑ $0.05" — absolute change from previous period.
- Avg efficiency: "+1.2" or "−2.1" — absolute change from previous period. Uses the vehicle's efficiency unit label (MPG, km/L, mi/kWh).

Same display rules as total spent delta: omit when insufficient data, omit for "All" period. The 5% suppression threshold applies uniformly to all three metrics (calculated as percentage change).

### Calculation

Reuse the existing `getPreviousPeriodRange()` function in `useDashboardMetrics.ts`, which already computes the previous period boundaries. Extend it to also compute previous-period totals and cost-per-mile.

---

## Section 2: Projected Annual Cost

A compact progress bar widget showing the user's projected total spending for the calendar year based on their current pace.

### Layout

- Label: "PROJECTED ANNUAL" (uppercase, small)
- Value: "$4,820" (right-aligned, bold)
- Progress bar: solid teal (`#1A9A8F`) fill with 20% opacity track — neutral tone, not signaling good or bad
- Sub-labels: "$1,247 spent" (left) and "Dec 2026" (right)

### Calculation

```
daily_rate = total_spent_ytd / days_elapsed_this_year
projected_annual = daily_rate * (isLeapYear ? 366 : 365)
progress = total_spent_ytd / projected_annual
```

### Display Rules

- Only show when at least 30 calendar days have elapsed since the first YTD event (prevents wild extrapolation from very short time spans). No minimum event count — a user with 2 events over 60 days has a valid daily rate.
- Always uses YTD data for the projection regardless of the selected period — the projection is about the full year, not the selected window.
- Omit entirely when threshold is not met. No placeholder.

---

## Section 3: Insight Cards

### Architecture

A pure scoring service (`src/services/insightEngine.ts`) with a single entry point:

```typescript
function generateInsights(input: InsightEngineInput): Insight[]
```

The engine returns **all** qualifying insights (score > 0) regardless of impression history. The `useInsights` hook applies suppression logic and the cooldowns, then takes the top 3. This keeps the engine easy to test (no impression fixtures needed) and treats suppression as a display policy, not a scoring concern.

No store imports, no DB access, no side effects.

```typescript
interface InsightEngineInput {
  events: VehicleEvent[];                    // all events for the active vehicle (full history)
  vehicle: Vehicle;                          // active vehicle metadata (fuel capacity, odometer unit, volume unit, fuel type)
  periodMetrics: {                           // pre-computed from useDashboardMetrics
    totalSpent: number;
    previousPeriodTotal: number | null;
    costPerMile: number | null;
    previousCostPerMile: number | null;
    periodLabel: string;                     // "3 months", "6 months", etc.
  };
  serviceEventsByType: Map<string, Array<{   // for maintenance due insight
    eventId: string;
    date: string;
    odometer: number;
    serviceTypeName: string;
  }>>;
  places: Place[];                           // for station comparison
  crossVehicleFuelFills: VehicleEvent[];     // fuel events from all vehicles of same fuel type
  efficiencyData: {                          // from computeFuelEfficiency
    average: number | null;
    recentRollingAverage: number | null;      // rolling 3-fill avg
  };
}

interface Insight {
  type: InsightType;
  score: number;           // 1–100, 0 means not applicable
  title: string;           // e.g., "Efficiency dropped 3.2 mi/gal"
  subtitle: string;        // e.g., "Last 3 fill-ups avg 23.1 vs. usual 26.3"
  icon: string;            // emoji
  iconBgColor: string;     // rgba background for icon circle
  dataKey: string;         // plain string concatenation of key inputs (e.g., "23.1|26.3")
}

type InsightType =
  | 'efficiency_drop'
  | 'spending_spike'
  | 'expensive_fillup'
  | 'next_fillup_cost'
  | 'maintenance_due'
  | 'cheaper_station'
  | 'month_over_month'
  | 'odometer_milestone';
```

### Unit-Aware Templates

All insight title/subtitle templates use tokens that resolve based on the vehicle's configuration:
- `{efficiencyUnit}` — resolves to mi/gal, km/L, mi/kWh, etc. (never hardcoded "MPG")
- `{fillWord}` — resolves to "fill-up" for gas/diesel, "charge" for electric
- `{odometerUnit}` — resolves to "mi" or "km"
- `{volumeUnit}` — resolves to "gal", "L", or "kWh"

### Display Rules

- The `useInsights` hook calls the engine, applies suppression, sorts by score descending, and takes the top 3.
- If no insights survive suppression, the section is hidden entirely.
- Each card is swipe-to-dismiss using `Swipeable` from `react-native-gesture-handler` (already installed as a dependency of `@gorhom/bottom-sheet`).
- Insight cards load asynchronously, independent of core dashboard content. Hero metrics, projected cost, and charts render immediately; insight cards fade in when their additional queries (cross-vehicle fills, service events, impressions) complete. This preserves the <500ms load time requirement for the core dashboard.

### Impression Recording

An impression is recorded **when the card is shown**, not when it is dismissed:

- When an insight card renders on the dashboard, a row is inserted into `insight_impressions` with `vehicle_id`, `insight_type`, `data_hash`, and `shown_at`. `dismissed_at` is null.
- If the user swipes to dismiss, `dismissed_at` is updated on the existing row.

This ensures that even insights the user ignores (never swipes) are tracked and won't reappear until the data changes.

### Suppression Logic

An insight is suppressed when it has been shown before **and the underlying data has not changed meaningfully since the last impression.**

Suppression is vehicle-scoped — each vehicle has independent impression history. On each evaluation, the hook computes the current `dataKey` for each insight and checks the most recent impression for that type + vehicle:

1. **Data hash matches** → insight is suppressed regardless of time elapsed.
2. **Data hash differs (data changed), insight was only shown (not dismissed)** → insight can resurface after a 24-hour cooldown.
3. **Data hash differs (data changed), insight was explicitly dismissed** → insight can resurface after a 7-day cooldown, since the user actively indicated they'd seen enough.

This creates two tiers: passive viewing gets a light cooldown, active dismissal gets a heavier one.

### Insight Catalog

#### Anomaly: Efficiency Drop
- **Trigger:** Rolling 3-fill average drops >10% below overall average. "Rolling 3-fill average" means the 3 most recent fills with a valid efficiency calculation (full fills with a preceding reference point). Partial fills are excluded, consistent with `computeFuelEfficiency`.
- **Minimum data:** 5+ fuel events total, 3+ in recent window
- **Title:** "Efficiency dropped {delta} {efficiencyUnit}"
- **Subtitle:** "Last 3 {fillWord}s avg {recent} vs. usual {overall}"
- **Data key:** `"{recentAvgRounded}|{overallAvgRounded}"`

#### Anomaly: Spending Spike
- **Trigger:** Current period spending >25% above previous period. Uses the dashboard's selected period, matching the hero delta's `getPreviousPeriodRange()` logic. For "All" period, no previous period exists, so this insight can't fire.
- **Minimum data:** 2 complete periods of data
- **Title:** "Spending up {pct}% this period"
- **Subtitle:** "${current} vs. ${previous} prev {period_label}"
- **Data key:** `"{currentRoundedTo10}|{previousRoundedTo10}"`
- **Note:** May appear alongside the hero total spent delta. The hero delta is a persistent compact indicator (5% threshold); this insight is a one-time attention-grabber with dollar amounts (25% threshold). Complementary, not redundant.

#### Anomaly: Expensive Fill-up
- **Trigger:** Most recent fill-up cost >30% above user's average fill cost
- **Minimum data:** 3+ fuel events to establish an average
- **Title:** "Last {fillWord} was ${amount} — {pct}% above average"
- **Subtitle:** "Your typical {fillWord} is ${avg}"
- **Data key:** `"{eventId}"` — fires at most once per fill-up; the next fill naturally resets the evaluation

#### Prediction: Next Fill-up Cost
- **Trigger:** Enough data to compute a reasonable estimate
- **Minimum data:** 3+ fills with price + volume data, fuel capacity set on vehicle
- **Calculation:** vehicle fuel capacity × most recent price per unit
- **Title:** "Next {fillWord}: ~${estimate}"
- **Subtitle:** "Based on tank size and recent prices{at_place}"
- **Data key:** `"{estimateRounded}"`

#### Prediction: Maintenance Due
- **Trigger:** Miles since last service of a given type approaches user's historical interval
- **Minimum data:** 2+ service events of the same type with odometer readings
- **Calculation:** Compute average mileage interval between services of the same type. Compare the current odometer (most recent odometer reading from any event type) against the last service of that type. If the gap exceeds 80% of the average interval, trigger.
- **Title:** "{miles} {odometerUnit} since last {service_type}"
- **Subtitle:** "You typically do one every ~{interval} {odometerUnit}"
- **Scoring:** Scales by interval count — 1 interval (2 events) scores near the floor of the Predictions range (50–55); 2+ intervals score higher.
- **Data key:** `"{serviceTypeId}|{milesSinceLastRoundedTo100}"`

#### Comparison: Cheaper Station
- **Trigger:** User has logged fills at 2+ places with a price difference >$0.10/unit
- **Minimum data:** 2+ places with 2+ fills each
- **Data source:** Uses fuel fills from *all vehicles of the same fuel type*, not just the active vehicle. Gas station prices are a property of the place, not the vehicle. A `crossVehicleFuelFills` parameter provides this data.
- **Comparison logic:** Compare the user's most frequently used station (by fill count) against the cheapest alternative. Tiebreaker when fill counts are equal: highest average price is treated as the "regular" station. This produces the most actionable insight — savings vs. the user's actual habit.
- **Title:** "You'd save ~${savings}/{fillWord} at {cheaper_place}"
- **Subtitle:** "Avg ${expensive_price}/{volumeUnit} at {expensive_place} vs. ${cheap_price} at {cheaper_place}"
- **Data key:** `"{cheaperPlaceId}|{expensivePlaceId}|{priceDiffRounded}"`

#### Comparison: Month-over-Month Change
- **Trigger:** Spending change >15% between the two most recent complete calendar months *within the selected period*. If "1M" is selected, this insight can't fire (only one month). If "All" is selected, it picks the two most recent complete months. Consistent with the dashboard's period-filtered mental model.
- **Minimum data:** 2+ complete calendar months within the selected period
- **Title:** "{month} cost {pct}% {more/less} than {prev_month}"
- **Subtitle:** "${current_month_total} vs. ${prev_month_total}"
- **Data key:** `"{month1}|{month2}|{total1Rounded}|{total2Rounded}"`

#### Milestone: Odometer Milestone
- **Trigger:** Most recent odometer reading crossed a milestone boundary. Milestones differ by unit:
  - **Miles:** 10K, 25K, 50K, 75K, 100K, 150K, 200K
  - **Kilometers:** 10K, 25K, 50K, 100K, 150K, 200K, 250K, 300K
- **Minimum data:** 2+ events with odometer readings (need to confirm it was recently crossed, not just that the car is past it)
- **Title:** "You crossed {milestone} {odometerUnit}!"
- **Subtitle:** "Logged on {date}"
- **Data key:** `"{milestoneValue}"`

### Priority & Scoring

Base scores by category:
- Anomalies: 70–100
- Predictions: 50–80
- Comparisons: 30–60
- Milestones: 10–40

Within each category, the magnitude of the trigger (e.g., how big the efficiency drop, how large the spending spike) scales the score within its range. Larger anomalies score higher.

### Template Variants

v1 ships with a single title/subtitle template per insight type. Dynamic value interpolation (amounts, percentages, place names, unit labels) already prevents repetitive phrasing — no two data-different insights read identically. Hash-based variant selection (2–3 templates per type) is deferred to a polish pass. This is purely additive — no architectural impact.

---

## Section 4: Spending Over Time Bar Chart

### Layout

A stacked bar chart showing monthly spending broken down by category (fuel, service, expense). Positioned below the fuel efficiency line chart.

- Header: "Spending Over Time" (left), "Monthly" (right)
- Bars: stacked with fuel (teal #1A9A8F) on bottom, service (orange #E8772B) in middle, expense (green #2EAD76) on top
- X-axis: month abbreviations (Jan, Feb, Mar, ...)
- Y-axis: dollar amounts
- Legend: horizontal row below chart with color dots + labels
- Tap interaction: tapping a bar highlights it and shows a fixed detail row below the legend — "Apr: $180 fuel + $340 service + $25 expense = $545." Detail row is hidden when nothing is tapped. Avoids tooltip clipping issues on small screens.

### Data

Group all events in the selected period by calendar month. Sum costs per category per month. Use `react-native-gifted-charts` `BarChart` component with `stackData`.

### Display Rules

- Only show when there are events spanning at least 2 calendar months (a single month doesn't make a meaningful bar chart).
- When the selected period is "1M", show weekly bars instead of monthly. Weeks use ISO calendar weeks (starting Monday), labeled with the week's start date (e.g., "Apr 7", "Apr 14"). Partial first/last weeks are acceptable.
- Horizontally scrollable when more than 12 months of data, capped at 36 bars (3 years). Default scroll position: rightmost (most recent months). For most period selections (1M, 3M, 6M, YTD, 1Y) there aren't enough bars to scroll.

---

## Data Model Changes

### New Table: `insight_impressions`

```sql
CREATE TABLE IF NOT EXISTS insight_impressions (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  dismissed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_insight_impressions_vehicle_type ON insight_impressions(vehicle_id, insight_type);
```

This table tracks which insights have been shown per vehicle, enabling vehicle-scoped suppression logic. The `data_hash` column stores a plain string concatenation of key inputs (e.g., `"23.1|26.3"`), not a cryptographic hash — readable, debuggable, zero dependencies. The implementation uses the name `dataKey` internally; the column name remains `data_hash`.

Created in migration **v4**.

---

## New Files

| File | Purpose |
|---|---|
| `src/services/insightEngine.ts` | Pure insight scoring engine — all 8 insight types |
| `src/services/__tests__/insightEngine.test.ts` | Unit tests for each insight type's trigger logic |
| `src/hooks/useInsights.ts` | Hook that calls the engine and manages impression recording |
| `src/components/InsightCard.tsx` | Single insight card component with swipe-to-dismiss |
| `src/components/InsightCards.tsx` | Container that renders 0–3 InsightCard components |
| `src/components/ProjectedCost.tsx` | Projected annual cost progress bar widget |
| `src/components/SpendingBarChart.tsx` | Stacked bar chart component |
| `src/db/queries/insightImpressions.ts` | CRUD for the insight_impressions table |

## Modified Files

| File | Changes |
|---|---|
| `src/hooks/useDashboardMetrics.ts` | Add previous-period totals, cost-per-mile delta, spending delta percentage, period label |
| `src/db/schema.ts` | Add `insight_impressions` table DDL |
| `src/db/migrations.ts` | Migration v4 to create `insight_impressions` table |
| `src/db/queries/events.ts` | Add `getFuelEventsByFuelType(fuelType)` — cross-vehicle fuel fills for cheaper station insight |
| `src/db/queries/eventServiceTypes.ts` | Add `getServiceEventsByType(vehicleId)` — events grouped by service type with odometer readings for maintenance due insight |
| `app/(tabs)/dashboard.tsx` | Integrate new components: deltas on metrics, ProjectedCost, InsightCards, SpendingBarChart |

---

## Acceptance Criteria

- AC-1: Period-over-period deltas appear on total spent, cost/mile, and avg efficiency when sufficient data exists. 5% threshold applied uniformly to all three.
- AC-2: Deltas are hidden (not "--" or placeholder text) when insufficient data exists.
- AC-3: "All" period never shows deltas.
- AC-4: Projected annual cost bar appears when 30+ calendar days have elapsed since the first YTD event, and is hidden otherwise.
- AC-5: Projected annual cost always uses YTD data regardless of selected period. Uses leap-year-aware day count.
- AC-6: Insight cards section is hidden when no insights survive suppression.
- AC-7: Maximum 3 insight cards are shown at any time.
- AC-8: An impression (with `vehicle_id`) is recorded when an insight card is shown (not on dismiss). Swiping to dismiss updates `dismissed_at` on the existing impression.
- AC-9: A shown-but-not-dismissed insight with unchanged data key does not reappear. If data changes, it can resurface after 24 hours.
- AC-9a: An explicitly dismissed insight with unchanged data key does not reappear. If data changes, it can resurface after 7 days.
- AC-10: Spending bar chart shows stacked monthly bars with tap-to-reveal detail row below the legend.
- AC-11: Spending bar chart is hidden when events span fewer than 2 calendar months.
- AC-12: When period is "1M", spending chart shows weekly bars (ISO weeks, labeled with start date).
- AC-12a: For "All" period, bar chart is horizontally scrollable up to 36 bars, defaulting to rightmost position.
- AC-13: All new components render correctly in both light and dark themes.
- AC-14: Core dashboard (metrics, projected cost, charts) loads in under 500ms. Insight cards load asynchronously and fade in when ready.
- AC-15: Insight engine is a pure scorer with no store imports or DB access. Returns all qualifying insights; `useInsights` hook handles suppression and top-3 selection.
- AC-16: All insight templates use unit-aware tokens ({efficiencyUnit}, {fillWord}, {odometerUnit}, {volumeUnit}) — no hardcoded "MPG", "miles", or "fill-up".
- AC-17: Insight impressions are vehicle-scoped. Switching vehicles shows independent insight state.
- AC-18: Cheaper Station insight uses cross-vehicle fuel fills (same fuel type) for price comparison.
