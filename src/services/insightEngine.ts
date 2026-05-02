import type { Vehicle, VehicleEvent, Place } from '../types';
import { getOdometerLabel, getVolumeLabel, getEfficiencyLabel } from '../constants/units';
import { formatCurrency } from '../constants/currency';

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
  currencyCode?: string;
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
  const cc = input.currencyCode ?? 'USD';

  checkEfficiencyDrop(input, units, insights);
  checkSpendingSpike(input, units, insights, cc);
  checkExpensiveFillup(input, units, insights, cc);
  checkNextFillupCost(input, units, insights, cc);
  checkMaintenanceDue(input, units, insights);
  checkCheaperStation(input, units, insights, cc);
  checkMonthOverMonth(input, units, insights, cc);
  checkOdometerMilestone(input, units, insights);

  return insights;
}

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

function checkSpendingSpike(input: InsightEngineInput, _units: UnitLabels, insights: Insight[], cc: string): void {
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
    subtitle: `${formatCurrency(Math.round(totalSpent), cc)} vs. ${formatCurrency(Math.round(previousPeriodTotal), cc)} prev ${periodLabel}`,
    icon: '💸',
    iconBgColor: 'rgba(239, 68, 68, 0.12)',
    dataKey: `${currentRounded}|${previousRounded}`,
  });
}

function checkExpensiveFillup(input: InsightEngineInput, units: UnitLabels, insights: Insight[], cc: string): void {
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
    title: `Last ${units.fillWord} was ${formatCurrency(Math.round(mostRecent.cost), cc)} — ${pctRound}% above average`,
    subtitle: `Your typical ${units.fillWord} is ${formatCurrency(Math.round(avgCost), cc)}`,
    icon: '⚠️',
    iconBgColor: 'rgba(239, 68, 68, 0.12)',
    dataKey: mostRecent.id,
  });
}

function checkNextFillupCost(input: InsightEngineInput, units: UnitLabels, insights: Insight[], cc: string): void {
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
    title: `Next ${units.fillWord}: ~${formatCurrency(estimate, cc)}`,
    subtitle: `Based on tank size and recent prices${atPlace}`,
    icon: '🔮',
    iconBgColor: 'rgba(26, 154, 143, 0.12)',
    dataKey: `${estimate}`,
  });
}

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

function checkCheaperStation(input: InsightEngineInput, units: UnitLabels, insights: Insight[], cc: string): void {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString().slice(0, 10);

  // Regular station: active vehicle, recent fills only
  const recentFills = input.events
    .filter(e => e.type === 'fuel' && e.placeId && e.pricePerUnit != null && e.date >= cutoff);

  const visitCounts = new Map<string, number>();
  for (const fill of recentFills) {
    visitCounts.set(fill.placeId!, (visitCounts.get(fill.placeId!) ?? 0) + 1);
  }

  const regularEntry = Array.from(visitCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (!regularEntry) return;
  const regularPlaceId = regularEntry[0];

  // Price data: cross-vehicle fills for broader price sampling
  const fills = input.crossVehicleFuelFills.filter(e => e.placeId && e.pricePerUnit != null);

  const stationData = new Map<string, { totalPrice: number; count: number; totalVolume: number }>();
  for (const fill of fills) {
    const data = stationData.get(fill.placeId!) ?? { totalPrice: 0, count: 0, totalVolume: 0 };
    data.totalPrice += fill.pricePerUnit!;
    data.count += 1;
    data.totalVolume += fill.volume ?? 0;
    stationData.set(fill.placeId!, data);
  }

  const regularData = stationData.get(regularPlaceId);
  if (!regularData || regularData.count < 2) return;
  const regularAvgPrice = regularData.totalPrice / regularData.count;
  const regularAvgVolume = regularData.totalVolume / regularData.count;

  const cheapest = Array.from(stationData.entries())
    .filter(([id, d]) => id !== regularPlaceId && d.count >= 2)
    .map(([placeId, d]) => ({ placeId, avgPrice: d.totalPrice / d.count }))
    .sort((a, b) => a.avgPrice - b.avgPrice)[0];

  if (!cheapest) return;

  const priceDiff = regularAvgPrice - cheapest.avgPrice;
  if (priceDiff < 0.10) return;

  const savingsPerFill = Math.round(priceDiff * regularAvgVolume);
  const regularPlace = input.places.find(p => p.id === regularPlaceId);
  const cheapPlace = input.places.find(p => p.id === cheapest.placeId);
  if (!regularPlace || !cheapPlace) return;

  const priceDiffRounded = Math.round(priceDiff * 100) / 100;

  insights.push({
    type: 'cheaper_station',
    score: Math.min(60, Math.round(30 + priceDiff * 100)),
    title: `You'd save ~${formatCurrency(savingsPerFill, cc)}/${units.fillWord} at ${cheapPlace.name}`,
    subtitle: `Avg ${formatCurrency(regularAvgPrice, cc)}/${units.volumeUnit} at ${regularPlace.name} vs. ${formatCurrency(cheapest.avgPrice, cc)} at ${cheapPlace.name}`,
    icon: '⛽',
    iconBgColor: 'rgba(232, 119, 43, 0.12)',
    dataKey: `${cheapest.placeId}|${regularPlaceId}|${priceDiffRounded}`,
  });
}

function checkMonthOverMonth(input: InsightEngineInput, _units: UnitLabels, insights: Insight[], cc: string): void {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthTotals = new Map<string, number>();
  for (const e of input.events) {
    const month = e.date.slice(0, 7);
    if (month === currentMonth) continue;
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
    subtitle: `${formatCurrency(Math.round(recentTotal), cc)} vs. ${formatCurrency(Math.round(prevTotal), cc)}`,
    icon: '📊',
    iconBgColor: 'rgba(232, 119, 43, 0.12)',
    dataKey: `${recentMonth}|${prevMonth}|${recentRounded}|${prevRounded}`,
  });
}

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
      break;
    }
  }
}
