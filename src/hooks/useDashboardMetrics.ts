import { useMemo } from 'react';
import { useEventStore } from '../stores/eventStore';
import { computeFuelEfficiency } from '../services/fuelEfficiency';
import { computeCostPerMile } from '../services/costPerMile';
import type { VehicleEvent } from '../types';

interface SpendingBreakdown {
  fuel: number;
  service: number;
  expense: number;
  total: number;
}

interface EfficiencyChartPoint {
  date: string;
  efficiency: number;
  isPartial: boolean;
}

export interface PeriodDelta {
  value: number;
  percentage: number;
  direction: 'up' | 'down';
}

export interface MonthlySpending {
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

export function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let start: Date;

  switch (period) {
    case '1M':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case '3M':
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      break;
    case '6M':
      start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      break;
    case 'YTD':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case '1Y':
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'All':
      return { startDate: '1900-01-01', endDate };
    default:
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
  }

  return { startDate: start.toISOString().split('T')[0], endDate };
}

export function getPreviousPeriodRange(period: string): { startDate: string; endDate: string } {
  const current = getDateRange(period);
  const currentStart = new Date(current.startDate + 'T00:00:00Z');
  const currentEnd = new Date(current.endDate + 'T00:00:00Z');
  const durationMs = currentEnd.getTime() - currentStart.getTime();

  const prevEnd = new Date(currentStart.getTime() - 86400000); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0],
  };
}

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

export function useDashboardMetrics(period: string): DashboardMetrics {
  const events = useEventStore((s) => s.events);

  return useMemo(() => {
    const { startDate, endDate } = getDateRange(period);

    const periodEvents = events.filter(
      (e) => e.date >= startDate && e.date <= endDate
    );

    const totalSpent = periodEvents.reduce((sum, e) => sum + e.cost, 0);
    const costPerMile = computeCostPerMile(periodEvents);

    // Fuel efficiency: need fuel events sorted by odometer ASC
    const fuelEvents = periodEvents
      .filter((e) => e.type === 'fuel' && e.odometer != null)
      .sort((a, b) => a.odometer! - b.odometer!);
    const efficiency = computeFuelEfficiency(fuelEvents);

    // Trend: compare with previous period
    let efficiencyTrend: 'up' | 'down' | 'flat' | null = null;
    if (efficiency.average != null) {
      const prev = getPreviousPeriodRange(period);
      const prevFuelEvents = events
        .filter(
          (e) =>
            e.type === 'fuel' &&
            e.odometer != null &&
            e.date >= prev.startDate &&
            e.date <= prev.endDate
        )
        .sort((a, b) => a.odometer! - b.odometer!);
      const prevEfficiency = computeFuelEfficiency(prevFuelEvents);

      if (prevEfficiency.average != null) {
        const diff = efficiency.average - prevEfficiency.average;
        const threshold = 0.1;
        if (diff > threshold) efficiencyTrend = 'up';
        else if (diff < -threshold) efficiencyTrend = 'down';
        else efficiencyTrend = 'flat';
      }
    }

    const spendingBreakdown: SpendingBreakdown = {
      fuel: periodEvents.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.cost, 0),
      service: periodEvents.filter((e) => e.type === 'service').reduce((s, e) => s + e.cost, 0),
      expense: periodEvents.filter((e) => e.type === 'expense').reduce((s, e) => s + e.cost, 0),
      total: totalSpent,
    };

    const chartData: EfficiencyChartPoint[] = efficiency.segments.filter(
      (s) => s.efficiency > 0 || s.isPartial
    );

    const recentEvents = events.slice(0, 5);

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
          const prevFuelEventsForDelta = prevEvents
            .filter((e) => e.type === 'fuel' && e.odometer != null)
            .sort((a, b) => a.odometer! - b.odometer!);
          const prevEfficiency = computeFuelEfficiency(prevFuelEventsForDelta);
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
  }, [events, period]);
}
