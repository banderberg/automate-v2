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

Each secondary metric (cost/mile, avg MPG) gets a delta line below its value:

- Cost/mile: "↓ $0.03" or "↑ $0.05" — absolute change from previous period.
- Avg MPG: "+1.2" or "−2.1" — absolute change from previous period.

Same display rules as total spent delta: omit when insufficient data, omit for "All" period.

### Calculation

Reuse the existing `getPreviousPeriodRange()` function in `useDashboardMetrics.ts`, which already computes the previous period boundaries. Extend it to also compute previous-period totals and cost-per-mile.

---

## Section 2: Projected Annual Cost

A compact progress bar widget showing the user's projected total spending for the calendar year based on their current pace.

### Layout

- Label: "PROJECTED ANNUAL" (uppercase, small)
- Value: "$4,820" (right-aligned, bold)
- Progress bar: gradient fill showing how much of the projected total has been spent so far
- Sub-labels: "$1,247 spent" (left) and "Dec 2026" (right)

### Calculation

```
daily_rate = total_spent_ytd / days_elapsed_this_year
projected_annual = daily_rate * 365
progress = total_spent_ytd / projected_annual
```

### Display Rules

- Only show when the user has at least 30 days of event history in the current year (prevents wild extrapolation from 3 days of data).
- Always uses YTD data for the projection regardless of the selected period — the projection is about the full year, not the selected window.
- Omit entirely when threshold is not met. No placeholder.

---

## Section 3: Insight Cards

### Architecture

A pure service (`src/services/insightEngine.ts`) that accepts the current events array, vehicle metadata (including fuel capacity and odometer unit), event-to-service-type mappings, places, and impression history, and returns an array of scored insight objects. No store imports, no DB access, no side effects.

```typescript
interface Insight {
  type: InsightType;
  score: number;           // 1–100, 0 means not applicable
  title: string;           // e.g., "Efficiency dropped 3.2 MPG"
  subtitle: string;        // e.g., "Last 3 fill-ups avg 23.1 vs. usual 26.3"
  icon: string;            // emoji
  iconBgColor: string;     // rgba background for icon circle
  dataHash: string;        // hash of key data points that triggered this insight
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

### Display Rules

- The dashboard calls the engine, filters out suppressed insights, sorts by score descending, and takes the top 3.
- If no insights score above 0, the section is hidden entirely.
- Each card is swipe-to-dismiss. Dismissing records the insight type + dataHash + timestamp to the `insight_impressions` table.

### Suppression Logic

An insight is suppressed when it has been shown before **and the underlying data has not changed meaningfully since the last impression.**

When an impression is recorded, it stores:
- `insight_type` — which type of insight
- `data_hash` — a hash of the key data points that triggered the insight (e.g., for "efficiency drop," a hash of the rolling average and overall average values)
- `shown_at` — timestamp

On the next evaluation, the engine computes the current `data_hash` for each insight. If the hash matches the most recent impression for that type, the insight is suppressed. If the data has changed enough to produce a different hash, the insight can resurface.

A 24-hour cooldown is applied as a safety net: even if data changes, the same insight type won't appear more than once per 24 hours.

### Insight Catalog

#### Anomaly: Efficiency Drop
- **Trigger:** Rolling 3-fill average drops >10% below overall average
- **Minimum data:** 5+ fuel events total, 3+ in recent window
- **Title:** "Efficiency dropped {delta} MPG"
- **Subtitle:** "Last 3 fill-ups avg {recent} vs. usual {overall}"
- **Data hash inputs:** rounded recent avg, rounded overall avg

#### Anomaly: Spending Spike
- **Trigger:** Current period spending >25% above previous period
- **Minimum data:** 2 complete periods of data
- **Title:** "Spending up {pct}% this period"
- **Subtitle:** "${current} vs. ${previous} prev {period_label}"
- **Data hash inputs:** current total (rounded to $10), previous total (rounded to $10)

#### Anomaly: Expensive Fill-up
- **Trigger:** Most recent fill-up cost >30% above user's average fill cost
- **Minimum data:** 3+ fuel events to establish an average
- **Title:** "Last fill-up was ${amount} — {pct}% above average"
- **Subtitle:** "Your typical fill is ${avg}"
- **Data hash inputs:** the specific event ID

#### Prediction: Next Fill-up Cost
- **Trigger:** Enough data to compute a reasonable estimate
- **Minimum data:** 3+ fills with price + volume data, fuel capacity set on vehicle
- **Calculation:** vehicle fuel capacity × most recent price per unit
- **Title:** "Next fill-up: ~${estimate}"
- **Subtitle:** "Based on tank size and recent prices{at_place}"
- **Data hash inputs:** rounded estimate

#### Prediction: Maintenance Due
- **Trigger:** Miles since last service of a given type approaches user's historical interval
- **Minimum data:** 2+ service events of the same type with odometer readings
- **Calculation:** Compute average mileage interval between services of the same type. Compare the current odometer (most recent odometer reading from any event type) against the last service of that type. If the gap exceeds 80% of the average interval, trigger.
- **Title:** "{miles} mi since last {service_type}"
- **Subtitle:** "You typically do one every ~{interval} mi"
- **Data hash inputs:** service type ID, current miles since last (rounded to 100)

#### Comparison: Cheaper Station
- **Trigger:** User has logged fills at 2+ places with a price difference >$0.10/unit
- **Minimum data:** 2+ places with 2+ fills each
- **Calculation:** Compare average price per unit across places. Multiply the per-unit savings by the user's average fill volume.
- **Title:** "You'd save ~${savings}/fill at {cheaper_place}"
- **Subtitle:** "Avg ${expensive_price}/gal at {expensive_place} vs. ${cheap_price} at {cheaper_place}"
- **Data hash inputs:** cheaper place ID, expensive place ID, rounded price difference

#### Comparison: Month-over-Month Change
- **Trigger:** Spending change >15% between the two most recent complete calendar months
- **Minimum data:** 2+ complete calendar months of data
- **Title:** "{month} cost {pct}% {more/less} than {prev_month}"
- **Subtitle:** "${current_month_total} vs. ${prev_month_total}"
- **Data hash inputs:** the two month identifiers, rounded totals

#### Milestone: Odometer Milestone
- **Trigger:** Most recent odometer reading crossed a milestone boundary (10K, 25K, 50K, 75K, 100K, 150K, 200K)
- **Minimum data:** 2+ events with odometer readings (need to confirm it was recently crossed, not just that the car is past it)
- **Title:** "You crossed {milestone} miles!"
- **Subtitle:** "Logged on {date}"
- **Data hash inputs:** the milestone value

### Priority & Scoring

Base scores by category:
- Anomalies: 70–100
- Predictions: 50–80
- Comparisons: 30–60
- Milestones: 10–40

Within each category, the magnitude of the trigger (e.g., how big the efficiency drop, how large the spending spike) scales the score within its range. Larger anomalies score higher.

### Multiple Phrasings

Each insight type has 2–3 template variants for its title/subtitle. The engine selects a variant based on a hash of the data, so the same data produces the same phrasing (no flickering between renders), but different data naturally gets different phrasing.

---

## Section 4: Spending Over Time Bar Chart

### Layout

A stacked bar chart showing monthly spending broken down by category (fuel, service, expense). Positioned below the fuel efficiency line chart.

- Header: "Spending Over Time" (left), "Monthly" (right)
- Bars: stacked with fuel (teal #1A9A8F) on bottom, service (orange #E8772B) in middle, expense (green #2EAD76) on top
- X-axis: month abbreviations (Jan, Feb, Mar, ...)
- Y-axis: dollar amounts
- Legend: horizontal row below chart with color dots + labels
- Tap interaction: tap a bar to see a tooltip with the exact breakdown — "$180 fuel + $340 service + $25 expense = $545"

### Data

Group all events in the selected period by calendar month. Sum costs per category per month. Use `react-native-gifted-charts` `BarChart` component with `stackData`.

### Display Rules

- Only show when there are events spanning at least 2 calendar months (a single month doesn't make a meaningful bar chart).
- When the selected period is "1M", show weekly bars instead of monthly.
- Maximum of 12 bars visible (for "All" period with many years of data, show the most recent 12 months).

---

## Data Model Changes

### New Table: `insight_impressions`

```sql
CREATE TABLE IF NOT EXISTS insight_impressions (
  id TEXT PRIMARY KEY,
  insight_type TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  dismissed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_insight_impressions_type ON insight_impressions(insight_type);
```

This table tracks which insights have been shown and with what data, enabling the suppression logic.

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
| `src/hooks/useDashboardMetrics.ts` | Add previous-period totals, cost-per-mile delta, spending delta percentage |
| `src/db/schema.ts` | Add `insight_impressions` table DDL |
| `src/db/migrations.ts` | Migration to create `insight_impressions` table |
| `app/(tabs)/dashboard.tsx` | Integrate new components: deltas on metrics, ProjectedCost, InsightCards, SpendingBarChart |

---

## Acceptance Criteria

- AC-1: Period-over-period deltas appear on total spent, cost/mile, and avg MPG when sufficient data exists.
- AC-2: Deltas are hidden (not "--" or placeholder text) when insufficient data exists.
- AC-3: "All" period never shows deltas.
- AC-4: Projected annual cost bar appears when the user has 30+ days of YTD event history, and is hidden otherwise.
- AC-5: Projected annual cost always uses YTD data regardless of selected period.
- AC-6: Insight cards section is hidden when no insights qualify (score 0).
- AC-7: Maximum 3 insight cards are shown at any time.
- AC-8: Dismissing an insight card records an impression and suppresses it until underlying data changes.
- AC-9: Same insight type does not reappear within 24 hours even if data changes.
- AC-10: Spending bar chart shows stacked monthly bars with tap-to-reveal breakdown.
- AC-11: Spending bar chart is hidden when events span fewer than 2 calendar months.
- AC-12: When period is "1M", spending chart shows weekly bars.
- AC-13: All new components render correctly in both light and dark themes.
- AC-14: Dashboard loads in under 500ms for up to 1,000 events (existing AC-5 maintained).
- AC-15: Insight engine is a pure service with no store imports or DB access.
