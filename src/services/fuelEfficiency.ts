import type { VehicleEvent } from '../types';

export interface EfficiencySegment {
  date: string;
  efficiency: number;
  isPartial: boolean;
}

interface FuelEfficiencyResult {
  segments: EfficiencySegment[];
  average: number | null;
}

export function computeFuelEfficiency(
  fuelEvents: VehicleEvent[]
): FuelEfficiencyResult {
  // fuelEvents must be sorted by odometer ASC, type=fuel only
  // Filter out events without odometer
  const events = fuelEvents.filter(e => e.odometer != null);

  if (events.length < 2) {
    // Include partial markers but no efficiency
    return {
      segments: events.map(e => ({ date: e.date, efficiency: 0, isPartial: !!e.isPartialFill })),
      average: null,
    };
  }

  const segments: EfficiencySegment[] = [];
  let totalDistance = 0;
  let totalVolume = 0;
  let lastFullFillIndex = -1;
  let accumulatedPartialVolume = 0;

  // Find first non-partial fill as starting point
  for (let i = 0; i < events.length; i++) {
    if (!events[i].isPartialFill) {
      lastFullFillIndex = i;
      // First full fill is just a baseline, add as segment with 0 efficiency
      break;
    }
    // Partial fills before any full fill — add as markers
    segments.push({ date: events[i].date, efficiency: 0, isPartial: true });
  }

  if (lastFullFillIndex === -1) {
    // All partials, no efficiency can be calculated
    return {
      segments: events.map(e => ({ date: e.date, efficiency: 0, isPartial: true })),
      average: null,
    };
  }

  // Walk from the event after the first full fill
  for (let i = lastFullFillIndex + 1; i < events.length; i++) {
    const current = events[i];

    if (current.isPartialFill) {
      // Accumulate partial volume for the next full fill calculation
      accumulatedPartialVolume += current.volume ?? 0;
      segments.push({ date: current.date, efficiency: 0, isPartial: true });
    } else {
      // Full fill — calculate efficiency
      const prev = events[lastFullFillIndex];
      const distance = current.odometer! - prev.odometer!;
      const adjustedVolume = (current.volume ?? 0) + accumulatedPartialVolume;

      if (adjustedVolume > 0 && distance > 0) {
        const efficiency = distance / adjustedVolume;
        segments.push({ date: current.date, efficiency, isPartial: false });
        totalDistance += distance;
        totalVolume += adjustedVolume;
      }

      lastFullFillIndex = i;
      accumulatedPartialVolume = 0;
    }
  }

  // Average = distance-weighted mean = total distance / total volume
  const average = totalVolume > 0 ? totalDistance / totalVolume : null;

  return { segments, average };
}

export function downsampleEfficiencyData(
  points: EfficiencySegment[],
  maxPoints: number = 30,
): EfficiencySegment[] {
  if (points.length <= maxPoints) return points;

  const buckets = new Map<string, number[]>();
  for (const p of points) {
    const key = p.date.slice(0, 7);
    const arr = buckets.get(key);
    if (arr) arr.push(p.efficiency);
    else buckets.set(key, [p.efficiency]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      date: month,
      efficiency: values.reduce((s, v) => s + v, 0) / values.length,
      isPartial: false,
    }));
}
