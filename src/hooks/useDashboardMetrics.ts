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
}

function getDateRange(period: string): { startDate: string; endDate: string } {
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

function getPreviousPeriodRange(period: string): { startDate: string; endDate: string } {
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

    return {
      totalSpent,
      costPerMile,
      efficiency,
      efficiencyTrend,
      spendingBreakdown,
      chartData,
      recentEvents,
    };
  }, [events, period]);
}
