import type { VehicleEvent } from '../types';

export function estimateOdometer(
  recentEvents: VehicleEvent[],
  targetDate: string
): number | null {
  // recentEvents: events with odometer, sorted by date DESC, limit 10
  // If fewer than 3 events, return null
  const withOdometer = recentEvents.filter(e => e.odometer != null);

  if (withOdometer.length < 3) return null;

  const mostRecent = withOdometer[0];
  const oldest = withOdometer[withOdometer.length - 1];

  const daysBetween = daysDiff(oldest.date, mostRecent.date);
  if (daysBetween <= 0) return null;

  const odometerDiff = mostRecent.odometer! - oldest.odometer!;
  const avgDailyMiles = odometerDiff / daysBetween;

  const daysSinceMostRecent = daysDiff(mostRecent.date, targetDate);
  const estimate = mostRecent.odometer! + (avgDailyMiles * daysSinceMostRecent);

  return Math.round(estimate);
}

function daysDiff(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T00:00:00Z');
  const to = new Date(toDate + 'T00:00:00Z');
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
