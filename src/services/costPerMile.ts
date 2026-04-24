import type { VehicleEvent } from '../types';

export function computeCostPerMile(events: VehicleEvent[]): number | null {
  // events = all types for one vehicle in a period
  const totalCost = events.reduce((sum, e) => sum + e.cost, 0);

  // Only events with odometer readings contribute to denominator
  const odometers = events
    .filter(e => e.odometer != null)
    .map(e => e.odometer!);

  if (odometers.length < 2) return null;

  const maxOdometer = Math.max(...odometers);
  const minOdometer = Math.min(...odometers);
  const distance = maxOdometer - minOdometer;

  if (distance <= 0) return null;

  return totalCost / distance;
}
