# Smart Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the dashboard from a passive summary screen to an intelligent, insight-driven view with period-over-period deltas, projected annual cost, contextual insight cards, and a spending bar chart.

**Architecture:** Four independent feature layers built bottom-up: (1) data layer additions (migration + queries), (2) enriched metrics hook + projected cost, (3) insight engine service + suppression hook, (4) UI components + dashboard integration. Each layer is testable in isolation.

**Tech Stack:** TypeScript, expo-sqlite, Zustand, react-native-gifted-charts (BarChart), react-native-gesture-handler (Swipeable), Jest

**Spec:** `docs/superpowers/specs/2026-04-30-smart-dashboard-design.md`
**Decisions:** `docs/plans/06-smart-dashboard-decisions.md`

---

### Task 1: Migration v4 — `insight_impressions` table

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations.ts`

- [ ] **Step 1: Add the DDL constant to schema.ts**

Add after the `CREATE_SETTINGS_TABLE` constant:

```typescript
export const CREATE_INSIGHT_IMPRESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS insight_impressions (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    shown_at TEXT NOT NULL,
    dismissed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export const CREATE_INSIGHT_IMPRESSIONS_INDEX =
  'CREATE INDEX IF NOT EXISTS idx_insight_impressions_vehicle_type ON insight_impressions(vehicle_id, insight_type);';
```

- [ ] **Step 2: Add migration v4 to migrations.ts**

Add to the `migrations` array after the v3 entry:

```typescript
{
  version: 4,
  up: async (db: SQLiteDatabase) => {
    await db.execAsync(CREATE_INSIGHT_IMPRESSIONS_TABLE);
    await db.execAsync(CREATE_INSIGHT_IMPRESSIONS_INDEX);
  },
},
```

Add import at the top of `migrations.ts`:

```typescript
import { ALL_CREATE_TABLES, CREATE_INDEXES, CREATE_INSIGHT_IMPRESSIONS_TABLE, CREATE_INSIGHT_IMPRESSIONS_INDEX } from './schema';
```

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/migrations.ts
git commit -m "feat: add insight_impressions table (migration v4)"
```

---

### Task 2: Insight impressions query layer

**Files:**
- Create: `src/db/queries/insightImpressions.ts`

- [ ] **Step 1: Create the CRUD module**

```typescript
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';

export interface InsightImpressionRow {
  id: string;
  vehicleId: string;
  insightType: string;
  dataHash: string;
  shownAt: string;
  dismissedAt: string | null;
  createdAt: string;
}

interface RawRow {
  id: string;
  vehicle_id: string;
  insight_type: string;
  data_hash: string;
  shown_at: string;
  dismissed_at: string | null;
  created_at: string;
}

function mapRow(row: RawRow): InsightImpressionRow {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    insightType: row.insight_type,
    dataHash: row.data_hash,
    shownAt: row.shown_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
  };
}

export async function getLatestByVehicle(vehicleId: string): Promise<InsightImpressionRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT i1.*
     FROM insight_impressions i1
     INNER JOIN (
       SELECT insight_type, MAX(shown_at) AS max_shown
       FROM insight_impressions
       WHERE vehicle_id = ?
       GROUP BY insight_type
     ) i2 ON i1.insight_type = i2.insight_type AND i1.shown_at = i2.max_shown
     WHERE i1.vehicle_id = ?`,
    [vehicleId, vehicleId]
  );
  return rows.map(mapRow);
}

export async function recordImpression(
  vehicleId: string,
  insightType: string,
  dataHash: string,
): Promise<string> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO insight_impressions (id, vehicle_id, insight_type, data_hash, shown_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, insightType, dataHash, now, now]
  );
  return id;
}

export async function markDismissed(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE insight_impressions SET dismissed_at = ? WHERE id = ?',
    [now, id]
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/insightImpressions.ts
git commit -m "feat: add insight impressions query layer"
```

---

### Task 3: New data queries — cross-vehicle fuel fills and service events by type

**Files:**
- Modify: `src/db/queries/events.ts`
- Modify: `src/db/queries/eventServiceTypes.ts`

- [ ] **Step 1: Add `getFuelEventsByFuelType` to events.ts**

Add at the bottom of `src/db/queries/events.ts`:

```typescript
export async function getFuelEventsByFuelType(
  fuelType: string
): Promise<VehicleEvent[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT e.* FROM event e
     JOIN vehicle v ON v.id = e.vehicleId
     WHERE e.type = 'fuel' AND v.fuelType = ?
     ORDER BY e.date DESC`,
    [fuelType]
  );
  return rows.map(mapRow);
}
```

- [ ] **Step 2: Add `getServiceEventsByType` to eventServiceTypes.ts**

Add at the bottom of `src/db/queries/eventServiceTypes.ts`:

```typescript
export interface ServiceEventWithType {
  eventId: string;
  date: string;
  odometer: number;
  serviceTypeName: string;
  serviceTypeId: string;
}

export async function getServiceEventsByType(
  vehicleId: string
): Promise<Map<string, ServiceEventWithType[]>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{
    eventId: string;
    date: string;
    odometer: number | null;
    serviceTypeName: string;
    serviceTypeId: string;
  }>(
    `SELECT e.id AS eventId, e.date, e.odometer, st.name AS serviceTypeName, st.id AS serviceTypeId
     FROM event e
     JOIN event_service_type est ON est.eventId = e.id
     JOIN service_type st ON st.id = est.serviceTypeId
     WHERE e.vehicleId = ? AND e.odometer IS NOT NULL
     ORDER BY e.odometer ASC`,
    [vehicleId]
  );

  const map = new Map<string, ServiceEventWithType[]>();
  for (const row of rows) {
    if (row.odometer == null) continue;
    const entry: ServiceEventWithType = {
      eventId: row.eventId,
      date: row.date,
      odometer: row.odometer,
      serviceTypeName: row.serviceTypeName,
      serviceTypeId: row.serviceTypeId,
    };
    const existing = map.get(row.serviceTypeId) ?? [];
    existing.push(entry);
    map.set(row.serviceTypeId, existing);
  }
  return map;
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/events.ts src/db/queries/eventServiceTypes.ts
git commit -m "feat: add cross-vehicle fuel query and service events by type query"
```

---

### Task 4: Enrich `useDashboardMetrics` — period deltas and spending chart data

**Files:**
- Modify: `src/hooks/useDashboardMetrics.ts`

- [ ] **Step 1: Extend the `DashboardMetrics` interface**

Replace the existing `DashboardMetrics` interface with:

```typescript
interface PeriodDelta {
  value: number;
  percentage: number;
  direction: 'up' | 'down';
}

interface MonthlySpending {
  label: string;
  fuel: number;
  service: number;
  expense: number;
  total: number;
}

interface DashboardMetrics {
  totalSpent: number;
  costPerMile: number | null;
  efficiency: {
    average: number | null;
    segments: EfficiencyChartPoint[];
  };
  efficiencyTrend: 'up' | 'down' | 'flat' | null;
  spendingBreakdown: SpendingBreakdown;
  chartData: EfficiencyChartPoint[];
  recentEvents: VehicleEvent[];
  // New fields for smart dashboard
  totalSpentDelta: PeriodDelta | null;
  costPerMileDelta: PeriodDelta | null;
  efficiencyDelta: PeriodDelta | null;
  previousPeriodTotal: number | null;
  previousCostPerMile: number | null;
  periodLabel: string;
  monthlySpending: MonthlySpending[];
  projectedAnnualCost: number | null;
  ytdSpent: number | null;
}
```

- [ ] **Step 2: Add helper functions**

Add above `useDashboardMetrics`:

```typescript
function computeDelta(current: number, previous: number, threshold: number = 0.05): PeriodDelta | null {
  if (previous === 0) return null;
  const percentage = (current - previous) / Math.abs(previous);
  if (Math.abs(percentage) < threshold) return null;
  return {
    value: current - previous,
    percentage,
    direction: percentage > 0 ? 'up' : 'down',
  };
}

function getPeriodLabel(period: string): string {
  switch (period) {
    case '1M': return '1 month';
    case '3M': return '3 months';
    case '6M': return '6 months';
    case 'YTD': return 'year';
    case '1Y': return '1 year';
    case 'All': return 'all time';
    default: return '3 months';
  }
}

function computeMonthlySpending(events: VehicleEvent[]): MonthlySpending[] {
  const byMonth = new Map<string, { fuel: number; service: number; expense: number }>();

  for (const e of events) {
    const month = e.date.slice(0, 7); // "YYYY-MM"
    const entry = byMonth.get(month) ?? { fuel: 0, service: 0, expense: 0 };
    entry[e.type] += e.cost;
    byMonth.set(month, entry);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      label: new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
      fuel: data.fuel,
      service: data.service,
      expense: data.expense,
      total: data.fuel + data.service + data.expense,
    }));
}

function computeWeeklySpending(events: VehicleEvent[]): MonthlySpending[] {
  const byWeek = new Map<string, { fuel: number; service: number; expense: number; weekStart: Date }>();

  for (const e of events) {
    const d = new Date(e.date + 'T00:00:00');
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const key = monday.toISOString().split('T')[0];
    const entry = byWeek.get(key) ?? { fuel: 0, service: 0, expense: 0, weekStart: monday };
    entry[e.type] += e.cost;
    byWeek.set(key, entry);
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      label: data.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fuel: data.fuel,
      service: data.service,
      expense: data.expense,
      total: data.fuel + data.service + data.expense,
    }));
}

function computeProjectedAnnualCost(allEvents: VehicleEvent[]): { projected: number; ytdSpent: number } | null {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const ytdEvents = allEvents.filter((e) => e.date >= yearStart.toISOString().split('T')[0]);
  if (ytdEvents.length === 0) return null;

  const firstEventDate = new Date(
    ytdEvents.reduce((min, e) => (e.date < min ? e.date : min), ytdEvents[0].date) + 'T00:00:00'
  );
  const daysElapsed = Math.floor((now.getTime() - firstEventDate.getTime()) / 86400000);
  if (daysElapsed < 30) return null;

  const ytdSpent = ytdEvents.reduce((sum, e) => sum + e.cost, 0);
  const daysInYear = now.getFullYear() % 4 === 0 && (now.getFullYear() % 100 !== 0 || now.getFullYear() % 400 === 0) ? 366 : 365;
  const dailyRate = ytdSpent / daysElapsed;

  return { projected: dailyRate * daysInYear, ytdSpent };
}
```

- [ ] **Step 3: Update the `useDashboardMetrics` return value**

Inside the `useMemo` callback, after the existing `spendingBreakdown` calculation, add the new computations. Replace the return statement with:

```typescript
    // --- New: Period deltas ---
    let totalSpentDelta: PeriodDelta | null = null;
    let costPerMileDelta: PeriodDelta | null = null;
    let efficiencyDelta: PeriodDelta | null = null;
    let previousPeriodTotalValue: number | null = null;
    let previousCostPerMileValue: number | null = null;

    if (period !== 'All') {
      const prev = getPreviousPeriodRange(period);
      const prevEvents = events.filter(
        (e) => e.date >= prev.startDate && e.date <= prev.endDate
      );

      if (prevEvents.length > 0) {
        const prevTotal = prevEvents.reduce((sum, e) => sum + e.cost, 0);
        previousPeriodTotalValue = prevTotal;
        totalSpentDelta = computeDelta(totalSpent, prevTotal);

        const prevCpm = computeCostPerMile(prevEvents);
        previousCostPerMileValue = prevCpm;
        if (costPerMile != null && prevCpm != null) {
          costPerMileDelta = computeDelta(costPerMile, prevCpm);
        }

        if (efficiency.average != null) {
          const prevFuelEvents = prevEvents
            .filter((e) => e.type === 'fuel' && e.odometer != null)
            .sort((a, b) => a.odometer! - b.odometer!);
          const prevEfficiency = computeFuelEfficiency(prevFuelEvents);
          if (prevEfficiency.average != null) {
            efficiencyDelta = computeDelta(efficiency.average, prevEfficiency.average);
          }
        }
      }
    }

    // --- New: Monthly/weekly spending for bar chart ---
    const monthlySpending = period === '1M'
      ? computeWeeklySpending(periodEvents)
      : computeMonthlySpending(periodEvents);

    // --- New: Projected annual cost (always YTD-based) ---
    const projectionResult = computeProjectedAnnualCost(events);

    return {
      totalSpent,
      costPerMile,
      efficiency,
      efficiencyTrend,
      spendingBreakdown,
      chartData,
      recentEvents,
      totalSpentDelta,
      costPerMileDelta,
      efficiencyDelta,
      previousPeriodTotal: previousPeriodTotalValue,
      previousCostPerMile: previousCostPerMileValue,
      periodLabel: getPeriodLabel(period),
      monthlySpending,
      projectedAnnualCost: projectionResult?.projected ?? null,
      ytdSpent: projectionResult?.ytdSpent ?? null,
    };
```

- [ ] **Step 4: Export `getPreviousPeriodRange` and `getDateRange`**

Change the function declarations from `function` to `export function`:

```typescript
export function getDateRange(period: string): { startDate: string; endDate: string } {
```

```typescript
export function getPreviousPeriodRange(period: string): { startDate: string; endDate: string } {
```

Also export the new types by adding `export` before `interface PeriodDelta` and `interface MonthlySpending`.

- [ ] **Step 5: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDashboardMetrics.ts
git commit -m "feat: add period deltas, monthly spending, and projected cost to dashboard metrics"
```

---

### Task 5: Insight engine — types and unit helpers

**Files:**
- Create: `src/services/insightEngine.ts`

- [ ] **Step 1: Write the failing test — unit helper resolves tokens correctly**

Create `src/services/__tests__/insightEngine.test.ts`:

```typescript
import { generateInsights } from '../insightEngine';
import type { Vehicle, VehicleEvent, Place } from '../../types';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    sortOrder: 0,
    nickname: 'Test Car',
    make: 'Honda',
    model: 'Civic',
    year: 2022,
    fuelType: 'gas',
    odometerUnit: 'miles',
    volumeUnit: 'gallons',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFuelEvent(
  id: string,
  date: string,
  cost: number,
  odometer: number,
  volume: number,
  opts: { isPartialFill?: boolean; placeId?: string; pricePerUnit?: number } = {},
): VehicleEvent {
  return {
    id,
    vehicleId: 'v1',
    type: 'fuel',
    date,
    cost,
    odometer,
    volume,
    pricePerUnit: opts.pricePerUnit ?? cost / volume,
    isPartialFill: opts.isPartialFill,
    placeId: opts.placeId,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  };
}

function makeServiceEvent(id: string, date: string, cost: number, odometer: number): VehicleEvent {
  return {
    id,
    vehicleId: 'v1',
    type: 'service',
    date,
    cost,
    odometer,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  };
}

function makeExpenseEvent(id: string, date: string, cost: number): VehicleEvent {
  return {
    id,
    vehicleId: 'v1',
    type: 'expense',
    date,
    cost,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  };
}

function emptyInput() {
  return {
    events: [] as VehicleEvent[],
    vehicle: makeVehicle(),
    periodMetrics: {
      totalSpent: 0,
      previousPeriodTotal: null as number | null,
      costPerMile: null as number | null,
      previousCostPerMile: null as number | null,
      periodLabel: '3 months',
    },
    serviceEventsByType: new Map<string, Array<{ eventId: string; date: string; odometer: number; serviceTypeName: string }>>(),
    places: [] as Place[],
    crossVehicleFuelFills: [] as VehicleEvent[],
    efficiencyData: {
      average: null as number | null,
      recentRollingAverage: null as number | null,
    },
  };
}

describe('generateInsights', () => {
  it('returns empty array when no data', () => {
    const result = generateInsights(emptyInput());
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: FAIL with "Cannot find module '../insightEngine'"

- [ ] **Step 3: Create the insight engine with types and the empty `generateInsights` function**

Create `src/services/insightEngine.ts`:

```typescript
import type { Vehicle, VehicleEvent, Place } from '../types';
import { getOdometerLabel, getVolumeLabel, getEfficiencyLabel } from '../constants/units';

export type InsightType =
  | 'efficiency_drop'
  | 'spending_spike'
  | 'expensive_fillup'
  | 'next_fillup_cost'
  | 'maintenance_due'
  | 'cheaper_station'
  | 'month_over_month'
  | 'odometer_milestone';

export interface Insight {
  type: InsightType;
  score: number;
  title: string;
  subtitle: string;
  icon: string;
  iconBgColor: string;
  dataKey: string;
}

export interface InsightEngineInput {
  events: VehicleEvent[];
  vehicle: Vehicle;
  periodMetrics: {
    totalSpent: number;
    previousPeriodTotal: number | null;
    costPerMile: number | null;
    previousCostPerMile: number | null;
    periodLabel: string;
  };
  serviceEventsByType: Map<string, Array<{
    eventId: string;
    date: string;
    odometer: number;
    serviceTypeName: string;
  }>>;
  places: Place[];
  crossVehicleFuelFills: VehicleEvent[];
  efficiencyData: {
    average: number | null;
    recentRollingAverage: number | null;
  };
}

interface UnitLabels {
  efficiencyUnit: string;
  fillWord: string;
  odometerUnit: string;
  volumeUnit: string;
}

function resolveUnitLabels(vehicle: Vehicle): UnitLabels {
  return {
    efficiencyUnit: getEfficiencyLabel(vehicle.odometerUnit, vehicle.volumeUnit),
    fillWord: vehicle.fuelType === 'electric' ? 'charge' : 'fill-up',
    odometerUnit: getOdometerLabel(vehicle.odometerUnit),
    volumeUnit: getVolumeLabel(vehicle.volumeUnit),
  };
}

export function generateInsights(input: InsightEngineInput): Insight[] {
  const insights: Insight[] = [];
  const units = resolveUnitLabels(input.vehicle);

  checkEfficiencyDrop(input, units, insights);
  checkSpendingSpike(input, units, insights);
  checkExpensiveFillup(input, units, insights);
  checkNextFillupCost(input, units, insights);
  checkMaintenanceDue(input, units, insights);
  checkCheaperStation(input, units, insights);
  checkMonthOverMonth(input, units, insights);
  checkOdometerMilestone(input, units, insights);

  return insights;
}

function checkEfficiencyDrop(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkSpendingSpike(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkExpensiveFillup(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkNextFillupCost(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkMaintenanceDue(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkCheaperStation(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkMonthOverMonth(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkOdometerMilestone(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS — "returns empty array when no data"

- [ ] **Step 5: Commit**

```bash
git add src/services/insightEngine.ts src/services/__tests__/insightEngine.test.ts
git commit -m "feat: add insight engine scaffold with types and unit helpers"
```

---

### Task 6: Insight engine — implement all 8 insight checkers

**Files:**
- Modify: `src/services/insightEngine.ts`
- Modify: `src/services/__tests__/insightEngine.test.ts`

This task implements each checker with its test. Work through them one at a time — write the test, then implement.

- [ ] **Step 1: Write failing test for efficiency drop**

Add to `insightEngine.test.ts`:

```typescript
describe('efficiency_drop', () => {
  it('fires when rolling 3-fill avg drops >10% below overall', () => {
    const input = emptyInput();
    // 5 fuel events: first 3 at ~30 MPG, last 3 at ~24 MPG (>10% drop)
    // Need full fills sorted by odometer ASC
    input.efficiencyData = {
      average: 30,
      recentRollingAverage: 24,
    };
    // Need 5+ fuel events
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 35, 1000, 10),
      makeFuelEvent('f2', '2026-01-15', 35, 1300, 10),
      makeFuelEvent('f3', '2026-02-01', 35, 1600, 10),
      makeFuelEvent('f4', '2026-02-15', 42, 1900, 12.5),
      makeFuelEvent('f5', '2026-03-01', 42, 2200, 12.5),
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'efficiency_drop');
    expect(insight).toBeDefined();
    expect(insight!.score).toBeGreaterThanOrEqual(70);
    expect(insight!.score).toBeLessThanOrEqual(100);
    expect(insight!.title).toContain('6.0');
    expect(insight!.title).toContain('mi/gal');
    expect(insight!.dataKey).toBe('24.0|30.0');
  });

  it('does not fire when drop is <10%', () => {
    const input = emptyInput();
    input.efficiencyData = { average: 30, recentRollingAverage: 28 };
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 35, 1000, 10),
      makeFuelEvent('f2', '2026-01-15', 35, 1300, 10),
      makeFuelEvent('f3', '2026-02-01', 35, 1600, 10),
      makeFuelEvent('f4', '2026-02-15', 35, 1900, 10),
      makeFuelEvent('f5', '2026-03-01', 35, 2200, 10),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'efficiency_drop')).toBeUndefined();
  });

  it('does not fire with fewer than 5 fuel events', () => {
    const input = emptyInput();
    input.efficiencyData = { average: 30, recentRollingAverage: 20 };
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 35, 1000, 10),
      makeFuelEvent('f2', '2026-01-15', 35, 1300, 10),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'efficiency_drop')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement `checkEfficiencyDrop`**

Replace the stub in `insightEngine.ts`:

```typescript
function checkEfficiencyDrop(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const { average, recentRollingAverage } = input.efficiencyData;
  if (average == null || recentRollingAverage == null) return;

  const fuelEventCount = input.events.filter(e => e.type === 'fuel').length;
  if (fuelEventCount < 5) return;

  const dropPct = (average - recentRollingAverage) / average;
  if (dropPct <= 0.10) return;

  const delta = Math.round((average - recentRollingAverage) * 10) / 10;
  const score = Math.min(100, Math.round(70 + dropPct * 100));

  insights.push({
    type: 'efficiency_drop',
    score,
    title: `Efficiency dropped ${delta.toFixed(1)} ${units.efficiencyUnit}`,
    subtitle: `Last 3 ${units.fillWord}s avg ${recentRollingAverage.toFixed(1)} vs. usual ${average.toFixed(1)}`,
    icon: '📉',
    iconBgColor: 'rgba(239, 68, 68, 0.12)',
    dataKey: `${recentRollingAverage.toFixed(1)}|${average.toFixed(1)}`,
  });
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS — all efficiency_drop tests

- [ ] **Step 4: Write failing test for spending spike**

Add to `insightEngine.test.ts`:

```typescript
describe('spending_spike', () => {
  it('fires when current period >25% above previous', () => {
    const input = emptyInput();
    input.periodMetrics = {
      totalSpent: 1500,
      previousPeriodTotal: 1000,
      costPerMile: null,
      previousCostPerMile: null,
      periodLabel: '3 months',
    };
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'spending_spike');
    expect(insight).toBeDefined();
    expect(insight!.score).toBeGreaterThanOrEqual(70);
    expect(insight!.title).toContain('50%');
    expect(insight!.dataKey).toBe('1500|1000');
  });

  it('does not fire when increase is <25%', () => {
    const input = emptyInput();
    input.periodMetrics = {
      totalSpent: 1100,
      previousPeriodTotal: 1000,
      costPerMile: null,
      previousCostPerMile: null,
      periodLabel: '3 months',
    };
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'spending_spike')).toBeUndefined();
  });

  it('does not fire when no previous period data', () => {
    const input = emptyInput();
    input.periodMetrics = {
      totalSpent: 1500,
      previousPeriodTotal: null,
      costPerMile: null,
      previousCostPerMile: null,
      periodLabel: '3 months',
    };
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'spending_spike')).toBeUndefined();
  });
});
```

- [ ] **Step 5: Implement `checkSpendingSpike`**

```typescript
function checkSpendingSpike(input: InsightEngineInput, _units: UnitLabels, insights: Insight[]): void {
  const { totalSpent, previousPeriodTotal, periodLabel } = input.periodMetrics;
  if (previousPeriodTotal == null || previousPeriodTotal === 0) return;

  const pct = (totalSpent - previousPeriodTotal) / previousPeriodTotal;
  if (pct <= 0.25) return;

  const pctRound = Math.round(pct * 100);
  const score = Math.min(100, Math.round(70 + pct * 30));
  const currentRounded = Math.round(totalSpent / 10) * 10;
  const previousRounded = Math.round(previousPeriodTotal / 10) * 10;

  insights.push({
    type: 'spending_spike',
    score,
    title: `Spending up ${pctRound}% this period`,
    subtitle: `$${Math.round(totalSpent)} vs. $${Math.round(previousPeriodTotal)} prev ${periodLabel}`,
    icon: '💸',
    iconBgColor: 'rgba(239, 68, 68, 0.12)',
    dataKey: `${currentRounded}|${previousRounded}`,
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS — all spending_spike tests

- [ ] **Step 7: Write failing test for expensive fill-up**

```typescript
describe('expensive_fillup', () => {
  it('fires when most recent fill is >30% above average', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 40, 1000, 10),
      makeFuelEvent('f2', '2026-01-15', 42, 1300, 10),
      makeFuelEvent('f3', '2026-02-01', 38, 1600, 10),
      makeFuelEvent('f4', '2026-03-01', 70, 1900, 15), // most recent, 75% above avg of ~40
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'expensive_fillup');
    expect(insight).toBeDefined();
    expect(insight!.dataKey).toBe('f4');
    expect(insight!.title).toContain('$70');
  });

  it('does not fire with fewer than 3 fuel events', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 40, 1000, 10),
      makeFuelEvent('f2', '2026-03-01', 70, 1300, 15),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'expensive_fillup')).toBeUndefined();
  });
});
```

- [ ] **Step 8: Implement `checkExpensiveFillup`**

```typescript
function checkExpensiveFillup(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const fuelEvents = input.events
    .filter(e => e.type === 'fuel')
    .sort((a, b) => b.date.localeCompare(a.date));
  if (fuelEvents.length < 3) return;

  const mostRecent = fuelEvents[0];
  const avgCost = fuelEvents.reduce((s, e) => s + e.cost, 0) / fuelEvents.length;
  if (avgCost === 0) return;

  const pct = (mostRecent.cost - avgCost) / avgCost;
  if (pct <= 0.30) return;

  const pctRound = Math.round(pct * 100);
  const score = Math.min(100, Math.round(70 + pct * 30));

  insights.push({
    type: 'expensive_fillup',
    score,
    title: `Last ${units.fillWord} was $${mostRecent.cost.toFixed(0)} — ${pctRound}% above average`,
    subtitle: `Your typical ${units.fillWord} is $${avgCost.toFixed(0)}`,
    icon: '⚠️',
    iconBgColor: 'rgba(239, 68, 68, 0.12)',
    dataKey: mostRecent.id,
  });
}
```

- [ ] **Step 9: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS

- [ ] **Step 10: Write failing test for next fill-up cost**

```typescript
describe('next_fillup_cost', () => {
  it('fires when vehicle has fuel capacity and 3+ fills with price data', () => {
    const input = emptyInput();
    input.vehicle = makeVehicle({ fuelCapacity: 14 });
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 45, 1000, 12, { pricePerUnit: 3.75 }),
      makeFuelEvent('f2', '2026-01-15', 48, 1300, 12, { pricePerUnit: 4.00 }),
      makeFuelEvent('f3', '2026-02-01', 44, 1600, 11, { pricePerUnit: 4.00 }),
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'next_fillup_cost');
    expect(insight).toBeDefined();
    // 14 gal * $4.00 = $56
    expect(insight!.title).toContain('$56');
  });

  it('does not fire without fuel capacity', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-01-01', 45, 1000, 12, { pricePerUnit: 3.75 }),
      makeFuelEvent('f2', '2026-01-15', 48, 1300, 12, { pricePerUnit: 4.00 }),
      makeFuelEvent('f3', '2026-02-01', 44, 1600, 11, { pricePerUnit: 4.00 }),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'next_fillup_cost')).toBeUndefined();
  });
});
```

- [ ] **Step 11: Implement `checkNextFillupCost`**

```typescript
function checkNextFillupCost(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const { vehicle } = input;
  if (!vehicle.fuelCapacity) return;

  const fuelWithPrice = input.events
    .filter(e => e.type === 'fuel' && e.pricePerUnit != null && e.volume != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (fuelWithPrice.length < 3) return;

  const recentPrice = fuelWithPrice[0].pricePerUnit!;
  const estimate = Math.round(vehicle.fuelCapacity * recentPrice);

  const place = fuelWithPrice[0].placeId
    ? input.places.find(p => p.id === fuelWithPrice[0].placeId)
    : null;
  const atPlace = place ? ` at ${place.name}` : '';

  insights.push({
    type: 'next_fillup_cost',
    score: 60,
    title: `Next ${units.fillWord}: ~$${estimate}`,
    subtitle: `Based on tank size and recent prices${atPlace}`,
    icon: '🔮',
    iconBgColor: 'rgba(26, 154, 143, 0.12)',
    dataKey: `${estimate}`,
  });
}
```

- [ ] **Step 12: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS

- [ ] **Step 13: Write failing test for maintenance due**

```typescript
describe('maintenance_due', () => {
  it('fires when current mileage exceeds 80% of historical interval', () => {
    const input = emptyInput();
    // Two oil changes 5000 mi apart, current odometer is 4200 mi past last one
    input.serviceEventsByType = new Map([
      ['st1', [
        { eventId: 's1', date: '2025-06-01', odometer: 30000, serviceTypeName: 'Oil Change' },
        { eventId: 's2', date: '2025-12-01', odometer: 35000, serviceTypeName: 'Oil Change' },
      ]],
    ]);
    // Current odometer = 39200 (4200 mi since last, 84% of 5000 interval)
    input.events = [
      makeFuelEvent('f1', '2026-03-01', 40, 39200, 10),
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'maintenance_due');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('4,200');
    expect(insight!.title).toContain('Oil Change');
  });

  it('does not fire when only 1 service event exists for a type', () => {
    const input = emptyInput();
    input.serviceEventsByType = new Map([
      ['st1', [
        { eventId: 's1', date: '2025-06-01', odometer: 30000, serviceTypeName: 'Oil Change' },
      ]],
    ]);
    input.events = [makeFuelEvent('f1', '2026-03-01', 40, 39200, 10)];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'maintenance_due')).toBeUndefined();
  });
});
```

- [ ] **Step 14: Implement `checkMaintenanceDue`**

```typescript
function checkMaintenanceDue(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const currentOdometer = input.events
    .filter(e => e.odometer != null)
    .reduce((max, e) => Math.max(max, e.odometer!), 0);
  if (currentOdometer === 0) return;

  for (const [serviceTypeId, serviceEvents] of input.serviceEventsByType) {
    if (serviceEvents.length < 2) continue;

    const sorted = [...serviceEvents].sort((a, b) => a.odometer - b.odometer);
    let totalInterval = 0;
    const intervalCount = sorted.length - 1;

    for (let i = 1; i < sorted.length; i++) {
      totalInterval += sorted[i].odometer - sorted[i - 1].odometer;
    }
    const avgInterval = totalInterval / intervalCount;
    if (avgInterval <= 0) continue;

    const lastService = sorted[sorted.length - 1];
    const milesSinceLast = currentOdometer - lastService.odometer;
    const ratio = milesSinceLast / avgInterval;

    if (ratio < 0.80) continue;

    const baseScore = intervalCount === 1 ? 52 : Math.min(80, 55 + intervalCount * 5);
    const score = Math.min(80, Math.round(baseScore + ratio * 5));
    const milesSinceFormatted = milesSinceLast.toLocaleString('en-US');
    const intervalFormatted = Math.round(avgInterval).toLocaleString('en-US');
    const roundedMiles = Math.round(milesSinceLast / 100) * 100;

    insights.push({
      type: 'maintenance_due',
      score,
      title: `${milesSinceFormatted} ${units.odometerUnit} since last ${lastService.serviceTypeName}`,
      subtitle: `You typically do one every ~${intervalFormatted} ${units.odometerUnit}`,
      icon: '🔧',
      iconBgColor: 'rgba(46, 173, 118, 0.12)',
      dataKey: `${serviceTypeId}|${roundedMiles}`,
    });
  }
}
```

- [ ] **Step 15: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS

- [ ] **Step 16: Write failing test for cheaper station**

```typescript
describe('cheaper_station', () => {
  it('fires when 2+ stations have >$0.10 price difference', () => {
    const input = emptyInput();
    input.places = [
      { id: 'p1', name: 'Shell Main St', type: 'gas_station', createdAt: '', updatedAt: '' },
      { id: 'p2', name: 'Costco Gas', type: 'gas_station', createdAt: '', updatedAt: '' },
    ];
    input.crossVehicleFuelFills = [
      makeFuelEvent('f1', '2026-01-01', 50, 1000, 12, { placeId: 'p1', pricePerUnit: 4.00 }),
      makeFuelEvent('f2', '2026-01-15', 48, 1300, 12, { placeId: 'p1', pricePerUnit: 3.90 }),
      makeFuelEvent('f3', '2026-02-01', 42, 1600, 12, { placeId: 'p1', pricePerUnit: 3.80 }),
      makeFuelEvent('f4', '2026-02-15', 38, 1900, 12, { placeId: 'p2', pricePerUnit: 3.40 }),
      makeFuelEvent('f5', '2026-03-01', 39, 2200, 12, { placeId: 'p2', pricePerUnit: 3.50 }),
    ];
    input.vehicle = makeVehicle();
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'cheaper_station');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('Costco Gas');
    expect(insight!.subtitle).toContain('Shell Main St');
  });

  it('does not fire with only one station', () => {
    const input = emptyInput();
    input.places = [
      { id: 'p1', name: 'Shell', type: 'gas_station', createdAt: '', updatedAt: '' },
    ];
    input.crossVehicleFuelFills = [
      makeFuelEvent('f1', '2026-01-01', 50, 1000, 12, { placeId: 'p1', pricePerUnit: 4.00 }),
      makeFuelEvent('f2', '2026-01-15', 48, 1300, 12, { placeId: 'p1', pricePerUnit: 3.90 }),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'cheaper_station')).toBeUndefined();
  });
});
```

- [ ] **Step 17: Implement `checkCheaperStation`**

```typescript
function checkCheaperStation(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const fills = input.crossVehicleFuelFills.filter(e => e.placeId && e.pricePerUnit != null);

  const stationData = new Map<string, { totalPrice: number; count: number; totalVolume: number }>();
  for (const fill of fills) {
    const data = stationData.get(fill.placeId!) ?? { totalPrice: 0, count: 0, totalVolume: 0 };
    data.totalPrice += fill.pricePerUnit!;
    data.count += 1;
    data.totalVolume += fill.volume ?? 0;
    stationData.set(fill.placeId!, data);
  }

  const qualified = Array.from(stationData.entries())
    .filter(([, d]) => d.count >= 2)
    .map(([placeId, d]) => ({
      placeId,
      avgPrice: d.totalPrice / d.count,
      count: d.count,
      avgVolume: d.totalVolume / d.count,
    }));

  if (qualified.length < 2) return;

  // Find most frequent station (tiebreaker: highest avg price)
  qualified.sort((a, b) => b.count - a.count || b.avgPrice - a.avgPrice);
  const regular = qualified[0];

  // Find cheapest alternative
  const cheapest = qualified
    .filter(s => s.placeId !== regular.placeId)
    .sort((a, b) => a.avgPrice - b.avgPrice)[0];

  if (!cheapest) return;

  const priceDiff = regular.avgPrice - cheapest.avgPrice;
  if (priceDiff < 0.10) return;

  const savingsPerFill = Math.round(priceDiff * regular.avgVolume);
  const regularPlace = input.places.find(p => p.id === regular.placeId);
  const cheapPlace = input.places.find(p => p.id === cheapest.placeId);
  if (!regularPlace || !cheapPlace) return;

  const priceDiffRounded = Math.round(priceDiff * 100) / 100;

  insights.push({
    type: 'cheaper_station',
    score: Math.min(60, Math.round(30 + priceDiff * 100)),
    title: `You'd save ~$${savingsPerFill}/${units.fillWord} at ${cheapPlace.name}`,
    subtitle: `Avg $${regular.avgPrice.toFixed(2)}/${units.volumeUnit} at ${regularPlace.name} vs. $${cheapest.avgPrice.toFixed(2)} at ${cheapPlace.name}`,
    icon: '⛽',
    iconBgColor: 'rgba(232, 119, 43, 0.12)',
    dataKey: `${cheapest.placeId}|${regular.placeId}|${priceDiffRounded}`,
  });
}
```

- [ ] **Step 18: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS

- [ ] **Step 19: Write failing test for month-over-month**

```typescript
describe('month_over_month', () => {
  it('fires when spending changes >15% between two most recent complete months', () => {
    const input = emptyInput();
    // Feb: $400 total, Mar: $600 total (50% increase)
    input.events = [
      makeFuelEvent('f1', '2026-02-05', 200, 1000, 10),
      makeExpenseEvent('e1', '2026-02-15', 200),
      makeFuelEvent('f2', '2026-03-05', 300, 1300, 10),
      makeServiceEvent('s1', '2026-03-15', 300, 1500),
    ];
    // Simulate period that contains both months (use periodMetrics.periodLabel)
    input.periodMetrics.periodLabel = '3 months';
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'month_over_month');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('50%');
    expect(insight!.title).toContain('Mar');
  });

  it('does not fire with only one month of data', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-03-05', 200, 1000, 10),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'month_over_month')).toBeUndefined();
  });
});
```

- [ ] **Step 20: Implement `checkMonthOverMonth`**

```typescript
function checkMonthOverMonth(input: InsightEngineInput, _units: UnitLabels, insights: Insight[]): void {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthTotals = new Map<string, number>();
  for (const e of input.events) {
    const month = e.date.slice(0, 7);
    if (month === currentMonth) continue; // skip incomplete current month
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + e.cost);
  }

  const months = Array.from(monthTotals.entries()).sort(([a], [b]) => b.localeCompare(a));
  if (months.length < 2) return;

  const [recentMonth, recentTotal] = months[0];
  const [prevMonth, prevTotal] = months[1];

  if (prevTotal === 0) return;
  const pct = (recentTotal - prevTotal) / prevTotal;
  if (Math.abs(pct) <= 0.15) return;

  const pctRound = Math.round(Math.abs(pct) * 100);
  const direction = pct > 0 ? 'more' : 'less';
  const recentLabel = new Date(recentMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });
  const prevLabel = new Date(prevMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });
  const recentRounded = Math.round(recentTotal / 10) * 10;
  const prevRounded = Math.round(prevTotal / 10) * 10;

  insights.push({
    type: 'month_over_month',
    score: Math.min(60, Math.round(30 + Math.abs(pct) * 60)),
    title: `${recentLabel} cost ${pctRound}% ${direction} than ${prevLabel}`,
    subtitle: `$${Math.round(recentTotal)} vs. $${Math.round(prevTotal)}`,
    icon: '📊',
    iconBgColor: 'rgba(232, 119, 43, 0.12)',
    dataKey: `${recentMonth}|${prevMonth}|${recentRounded}|${prevRounded}`,
  });
}
```

- [ ] **Step 21: Run tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS

- [ ] **Step 22: Write failing test for odometer milestone**

```typescript
describe('odometer_milestone', () => {
  it('fires when most recent reading crosses a milestone boundary', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-02-01', 40, 49800, 10),
      makeFuelEvent('f2', '2026-03-01', 40, 50200, 10), // crossed 50K
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'odometer_milestone');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('50,000');
    expect(insight!.title).toContain('mi');
    expect(insight!.dataKey).toBe('50000');
  });

  it('uses km milestones for kilometer vehicles', () => {
    const input = emptyInput();
    input.vehicle = makeVehicle({ odometerUnit: 'kilometers', volumeUnit: 'litres' });
    input.events = [
      makeFuelEvent('f1', '2026-02-01', 40, 99000, 10),
      makeFuelEvent('f2', '2026-03-01', 40, 101000, 10), // crossed 100K km
    ];
    const result = generateInsights(input);
    const insight = result.find(i => i.type === 'odometer_milestone');
    expect(insight).toBeDefined();
    expect(insight!.title).toContain('100,000');
    expect(insight!.title).toContain('km');
  });

  it('does not fire when no milestone was crossed', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-02-01', 40, 42000, 10),
      makeFuelEvent('f2', '2026-03-01', 40, 43000, 10),
    ];
    const result = generateInsights(input);
    expect(result.find(i => i.type === 'odometer_milestone')).toBeUndefined();
  });
});
```

- [ ] **Step 23: Implement `checkOdometerMilestone`**

```typescript
const MILE_MILESTONES = [10000, 25000, 50000, 75000, 100000, 150000, 200000];
const KM_MILESTONES = [10000, 25000, 50000, 100000, 150000, 200000, 250000, 300000];

function checkOdometerMilestone(input: InsightEngineInput, units: UnitLabels, insights: Insight[]): void {
  const eventsWithOdo = input.events
    .filter(e => e.odometer != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (eventsWithOdo.length < 2) return;

  const current = eventsWithOdo[0].odometer!;
  const previous = eventsWithOdo[1].odometer!;

  const milestones = input.vehicle.odometerUnit === 'kilometers' ? KM_MILESTONES : MILE_MILESTONES;

  for (const milestone of milestones) {
    if (previous < milestone && current >= milestone) {
      insights.push({
        type: 'odometer_milestone',
        score: 30,
        title: `You crossed ${milestone.toLocaleString('en-US')} ${units.odometerUnit}!`,
        subtitle: `Logged on ${new Date(eventsWithOdo[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        icon: '🎉',
        iconBgColor: 'rgba(46, 173, 118, 0.12)',
        dataKey: `${milestone}`,
      });
      break; // only one milestone per evaluation
    }
  }
}
```

- [ ] **Step 24: Run all tests**

Run: `npx jest src/services/__tests__/insightEngine.test.ts -v`
Expected: PASS — all tests pass

- [ ] **Step 25: Commit**

```bash
git add src/services/insightEngine.ts src/services/__tests__/insightEngine.test.ts
git commit -m "feat: implement all 8 insight engine checkers with tests"
```

---

### Task 7: `useInsights` hook — suppression and impression management

**Files:**
- Create: `src/hooks/useInsights.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Insight, InsightEngineInput } from '../services/insightEngine';
import { generateInsights } from '../services/insightEngine';
import * as insightImpressions from '../db/queries/insightImpressions';
import type { InsightImpressionRow } from '../db/queries/insightImpressions';

const SHOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DISMISSED_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INSIGHTS = 3;

export interface DisplayedInsight extends Insight {
  impressionId: string | null;
}

export function useInsights(
  input: InsightEngineInput | null,
  vehicleId: string | null,
) {
  const [insights, setInsights] = useState<DisplayedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const recordedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!input || !vehicleId) {
      setInsights([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function evaluate() {
      setLoading(true);
      const allInsights = generateInsights(input!);
      const impressions = await insightImpressions.getLatestByVehicle(vehicleId!);

      const impressionMap = new Map<string, InsightImpressionRow>();
      for (const imp of impressions) {
        impressionMap.set(imp.insightType, imp);
      }

      const now = Date.now();
      const filtered = allInsights.filter((insight) => {
        const lastImpression = impressionMap.get(insight.type);
        if (!lastImpression) return true;

        if (lastImpression.dataHash === insight.dataKey) return false;

        const shownAt = new Date(lastImpression.shownAt).getTime();
        const cooldown = lastImpression.dismissedAt ? DISMISSED_COOLDOWN_MS : SHOWN_COOLDOWN_MS;
        return now - shownAt >= cooldown;
      });

      filtered.sort((a, b) => b.score - a.score);
      const top = filtered.slice(0, MAX_INSIGHTS);

      if (cancelled) return;
      setInsights(top.map((i) => ({ ...i, impressionId: null })));
      setLoading(false);

      // Record impressions for displayed insights
      for (const insight of top) {
        const key = `${vehicleId}:${insight.type}:${insight.dataKey}`;
        if (recordedRef.current.has(key)) continue;
        recordedRef.current.add(key);
        const id = await insightImpressions.recordImpression(vehicleId!, insight.type, insight.dataKey);
        if (!cancelled) {
          setInsights((prev) =>
            prev.map((i) => (i.type === insight.type && i.dataKey === insight.dataKey ? { ...i, impressionId: id } : i))
          );
        }
      }
    }

    evaluate();

    return () => {
      cancelled = true;
    };
  }, [input, vehicleId]);

  const dismiss = useCallback(async (impressionId: string, insightType: string) => {
    await insightImpressions.markDismissed(impressionId);
    setInsights((prev) => prev.filter((i) => i.type !== insightType));
  }, []);

  return { insights, loading, dismiss };
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useInsights.ts
git commit -m "feat: add useInsights hook with suppression and impression recording"
```

---

### Task 8: `ProjectedCost` component

**Files:**
- Create: `src/components/ProjectedCost.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { View, Text } from 'react-native';

interface ProjectedCostProps {
  projectedAnnual: number;
  ytdSpent: number;
  isDark: boolean;
}

export function ProjectedCost({ projectedAnnual, ytdSpent, isDark }: ProjectedCostProps) {
  const progress = projectedAnnual > 0 ? ytdSpent / projectedAnnual : 0;
  const year = new Date().getFullYear();

  return (
    <View
      style={{
        backgroundColor: isDark ? '#2A2926' : '#F0EFEC',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
      accessibilityLabel={`Projected annual cost: $${Math.round(projectedAnnual).toLocaleString('en-US')}. $${Math.round(ytdSpent).toLocaleString('en-US')} spent so far.`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: isDark ? '#8A8680' : '#706C67',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Projected Annual
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#F5F4F1' : '#1C1B18',
            fontVariant: ['tabular-nums'],
          }}
        >
          ${Math.round(projectedAnnual).toLocaleString('en-US')}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: isDark ? 'rgba(26, 154, 143, 0.2)' : 'rgba(26, 154, 143, 0.15)',
          borderRadius: 3,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: '#1A9A8F',
            height: '100%',
            width: `${Math.min(100, Math.round(progress * 100))}%`,
            borderRadius: 3,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: isDark ? '#706C67' : '#8A8680', fontVariant: ['tabular-nums'] }}>
          ${Math.round(ytdSpent).toLocaleString('en-US')} spent
        </Text>
        <Text style={{ fontSize: 10, color: isDark ? '#706C67' : '#8A8680' }}>
          Dec {year}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ProjectedCost.tsx
git commit -m "feat: add ProjectedCost progress bar component"
```

---

### Task 9: `InsightCard` and `InsightCards` components

**Files:**
- Create: `src/components/InsightCard.tsx`
- Create: `src/components/InsightCards.tsx`

- [ ] **Step 1: Create the InsightCard component**

```typescript
import { View, Text, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRef } from 'react';

interface InsightCardProps {
  title: string;
  subtitle: string;
  icon: string;
  iconBgColor: string;
  isDark: boolean;
  onDismiss: () => void;
}

export function InsightCard({ title, subtitle, icon, iconBgColor, isDark, onDismiss }: InsightCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  function renderRightActions(_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) {
    const opacity = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          opacity,
        }}
      >
        <Text style={{ color: isDark ? '#8A8680' : '#706C67', fontSize: 12 }}>Dismiss</Text>
      </Animated.View>
    );
  }

  function handleSwipeOpen() {
    swipeableRef.current?.close();
    onDismiss();
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
    >
      <View
        style={{
          backgroundColor: isDark ? '#2A2926' : '#F0EFEC',
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: iconBgColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isDark ? '#F5F4F1' : '#1C1B18',
              lineHeight: 18,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? '#8A8680' : '#706C67',
              lineHeight: 16,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}
```

- [ ] **Step 2: Create the InsightCards container**

```typescript
import { View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { InsightCard } from './InsightCard';
import type { DisplayedInsight } from '../hooks/useInsights';

interface InsightCardsProps {
  insights: DisplayedInsight[];
  isDark: boolean;
  onDismiss: (impressionId: string, insightType: string) => void;
}

export function InsightCards({ insights, isDark, onDismiss }: InsightCardsProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (insights.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [insights.length > 0]);

  if (insights.length === 0) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
      {insights.map((insight) => (
        <InsightCard
          key={insight.type}
          title={insight.title}
          subtitle={insight.subtitle}
          icon={insight.icon}
          iconBgColor={insight.iconBgColor}
          isDark={isDark}
          onDismiss={() => {
            if (insight.impressionId) {
              onDismiss(insight.impressionId, insight.type);
            }
          }}
        />
      ))}
    </Animated.View>
  );
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/InsightCard.tsx src/components/InsightCards.tsx
git commit -m "feat: add InsightCard and InsightCards components with swipe-to-dismiss"
```

---

### Task 10: `SpendingBarChart` component

**Files:**
- Create: `src/components/SpendingBarChart.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface MonthlySpending {
  label: string;
  fuel: number;
  service: number;
  expense: number;
  total: number;
}

interface SpendingBarChartProps {
  data: MonthlySpending[];
  isDark: boolean;
  chartWidth: number;
  period: string;
}

export function SpendingBarChart({ data, isDark, chartWidth, period }: SpendingBarChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const displayData = useMemo(() => {
    const capped = data.slice(-36);
    return capped;
  }, [data]);

  const stackData = useMemo(() => {
    return displayData.map((d, index) => ({
      stacks: [
        { value: d.fuel, color: '#1A9A8F', onPress: () => setSelectedIndex(index) },
        { value: d.service, color: '#E8772B', onPress: () => setSelectedIndex(index) },
        { value: d.expense, color: '#2EAD76', onPress: () => setSelectedIndex(index) },
      ],
      label: d.label,
    }));
  }, [displayData]);

  const selected = selectedIndex != null ? displayData[selectedIndex] : null;
  const needsScroll = displayData.length > 12;
  const barSpacing = Math.max(20, Math.min(44, (chartWidth - 40) / displayData.length - 24));
  const headerLabel = period === '1M' ? 'Weekly' : 'Monthly';

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18' }}>
          Spending Over Time
        </Text>
        <Text style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67' }}>{headerLabel}</Text>
      </View>
      <View accessibilityLabel={`Spending bar chart, ${displayData.length} bars`}>
        <BarChart
          stackData={stackData}
          width={needsScroll ? displayData.length * (24 + barSpacing) : chartWidth}
          height={160}
          barWidth={24}
          spacing={barSpacing}
          initialSpacing={16}
          endSpacing={16}
          noOfSections={3}
          yAxisColor="transparent"
          xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
          yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
          xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
          hideRules={false}
          rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
          rulesType="solid"
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
          isAnimated
          animationDuration={400}
          scrollRef={needsScroll ? scrollRef : undefined}
          scrollToEnd={needsScroll}
        />
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', paddingVertical: 8 }}>
        <LegendDot color="#1A9A8F" label="Fuel" isDark={isDark} />
        <LegendDot color="#E8772B" label="Service" isDark={isDark} />
        <LegendDot color="#2EAD76" label="Expense" isDark={isDark} />
      </View>
      {/* Detail row */}
      {selected && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text
            style={{
              fontSize: 11,
              color: isDark ? '#C5C2BC' : '#5C5A55',
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {selected.label}: ${Math.round(selected.fuel)} fuel + ${Math.round(selected.service)} service + ${Math.round(selected.expense)} expense = ${Math.round(selected.total)}
          </Text>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label, isDark }: { color: string; label: string; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67' }}>{label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SpendingBarChart.tsx
git commit -m "feat: add SpendingBarChart stacked bar chart component"
```

---

### Task 11: Dashboard integration — wire everything together

**Files:**
- Modify: `app/(tabs)/dashboard.tsx`

This is the final integration task. It modifies the dashboard to use the new components and enriched metrics.

- [ ] **Step 1: Add new imports**

Add to the top of `dashboard.tsx`:

```typescript
import { ProjectedCost } from '@/src/components/ProjectedCost';
import { InsightCards } from '@/src/components/InsightCards';
import { SpendingBarChart } from '@/src/components/SpendingBarChart';
import { useInsights } from '@/src/hooks/useInsights';
import { getServiceEventsByType } from '@/src/db/queries/eventServiceTypes';
import { getFuelEventsByFuelType } from '@/src/db/queries/events';
import { getLatestByVehicle as getImpressions } from '@/src/db/queries/insightImpressions';
import type { InsightEngineInput } from '@/src/services/insightEngine';
import { computeFuelEfficiency } from '@/src/services/fuelEfficiency';
```

- [ ] **Step 2: Add delta display below the hero total spent**

After the existing hero total spent `<View className="flex-row items-baseline">` block (around line 284), add:

```typescript
{metrics.totalSpentDelta && (
  <Text
    style={{
      fontSize: 12,
      fontWeight: '500',
      color: metrics.totalSpentDelta.direction === 'up' ? '#EF4444' : '#10B981',
      marginTop: 4,
    }}
  >
    {metrics.totalSpentDelta.direction === 'up' ? '↑' : '↓'} {Math.round(Math.abs(metrics.totalSpentDelta.percentage) * 100)}% vs prev {metrics.periodLabel}
  </Text>
)}
```

- [ ] **Step 3: Add delta displays below secondary metrics**

After each secondary metric value `<Text>` (cost/mile and avg MPG), add the delta text. After the cost/mile value:

```typescript
{metrics.costPerMileDelta && (
  <Text style={{ fontSize: 11, color: metrics.costPerMileDelta.direction === 'up' ? '#EF4444' : '#10B981', marginTop: 2 }}>
    {metrics.costPerMileDelta.direction === 'up' ? '↑' : '↓'} ${Math.abs(metrics.costPerMileDelta.value).toFixed(2)}
  </Text>
)}
```

After the avg MPG value and trend icon:

```typescript
{metrics.efficiencyDelta && (
  <Text style={{ fontSize: 11, color: metrics.efficiencyDelta.direction === 'up' ? '#10B981' : '#EF4444', marginTop: 2 }}>
    {metrics.efficiencyDelta.value > 0 ? '+' : ''}{metrics.efficiencyDelta.value.toFixed(1)}
  </Text>
)}
```

- [ ] **Step 4: Add ProjectedCost below secondary metrics**

After the `</View>` that closes the secondary metrics row (the `flex-row px-4 mt-4 mb-8` view), add:

```typescript
{metrics.projectedAnnualCost != null && metrics.ytdSpent != null && (
  <View className="px-4 mb-6">
    <ProjectedCost
      projectedAnnual={metrics.projectedAnnualCost}
      ytdSpent={metrics.ytdSpent}
      isDark={isDark}
    />
  </View>
)}
```

- [ ] **Step 5: Add insight engine input computation and InsightCards**

Inside `DashboardScreen`, add the async data loading for insights. After the existing hook calls (around line 62), add:

```typescript
const [insightInput, setInsightInput] = useState<InsightEngineInput | null>(null);

useEffect(() => {
  if (!activeVehicle || eventCount === 0) {
    setInsightInput(null);
    return;
  }
  let cancelled = false;

  async function loadInsightData() {
    const events = useEventStore.getState().events;
    const [serviceEventsByType, crossFills] = await Promise.all([
      getServiceEventsByType(activeVehicle!.id),
      getFuelEventsByFuelType(activeVehicle!.fuelType),
    ]);

    const fuelEvents = events
      .filter(e => e.type === 'fuel' && e.odometer != null)
      .sort((a, b) => a.odometer! - b.odometer!);
    const effResult = computeFuelEfficiency(fuelEvents);

    // Rolling 3-fill avg: last 3 full-fill efficiency segments
    const fullSegments = effResult.segments.filter(s => !s.isPartial && s.efficiency > 0);
    const recent3 = fullSegments.slice(-3);
    const recentRollingAverage = recent3.length === 3
      ? recent3.reduce((s, seg) => s + seg.efficiency, 0) / 3
      : null;

    if (cancelled) return;

    setInsightInput({
      events,
      vehicle: activeVehicle!,
      periodMetrics: {
        totalSpent: metrics.totalSpent,
        previousPeriodTotal: metrics.previousPeriodTotal,
        costPerMile: metrics.costPerMile,
        previousCostPerMile: metrics.previousCostPerMile,
        periodLabel: metrics.periodLabel,
      },
      serviceEventsByType,
      places,
      crossVehicleFuelFills: crossFills,
      efficiencyData: {
        average: effResult.average,
        recentRollingAverage,
      },
    });
  }

  loadInsightData();
  return () => { cancelled = true; };
}, [activeVehicle?.id, eventCount, metrics.totalSpent, period]);

const { insights, dismiss } = useInsights(insightInput, activeVehicle?.id ?? null);
```

Then add the InsightCards component after the ProjectedCost block:

```typescript
<InsightCards insights={insights} isDark={isDark} onDismiss={dismiss} />
```

- [ ] **Step 6: Add SpendingBarChart after the fuel efficiency chart**

After the fuel efficiency chart's closing `</View>` (after the "Log 2 or more fill-ups" empty state), add:

```typescript
{metrics.monthlySpending.length >= 2 && (
  <View className="mx-4 mb-6">
    <SpendingBarChart
      data={metrics.monthlySpending}
      isDark={isDark}
      chartWidth={chartWidth}
      period={period}
    />
  </View>
)}
```

- [ ] **Step 7: Verify the app builds**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Test on device — verify all features**

Start the dev server: `npx expo start`

Test checklist:
1. Dashboard loads with enriched metrics — deltas visible when sufficient data
2. Switch period to "All" — deltas disappear
3. Projected annual cost bar visible when 30+ days of YTD data
4. Insight cards fade in (if data qualifies any insights)
5. Swipe an insight card to dismiss it
6. Close and reopen dashboard — dismissed insight stays hidden
7. Spending bar chart renders below fuel efficiency chart
8. Tap a bar — detail row appears below legend
9. Switch between light and dark mode — all new components render correctly
10. Switch vehicles — insight state resets

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/dashboard.tsx
git commit -m "feat: integrate smart dashboard — deltas, projected cost, insights, spending chart"
```

---

### Task 12: Update CLAUDE.md project structure

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add new files to the Project Structure section**

Update the `src/` tree in `CLAUDE.md` to include:

Under `services/`:
```
    insightEngine.ts     # Pure insight scoring engine — 8 insight types
```

Under `hooks/`:
```
    useInsights.ts       # Insight suppression and impression management
```

Under `components/`:
```
    InsightCard.tsx       # Swipe-to-dismiss insight card
    InsightCards.tsx      # Container for 0–3 insight cards
    ProjectedCost.tsx    # Projected annual cost progress bar
    SpendingBarChart.tsx  # Stacked monthly/weekly spending bar chart
```

Under `db/queries/`:
```
    insightImpressions.ts # CRUD for insight_impressions table
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update project structure with smart dashboard files"
```
