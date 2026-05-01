import { computeFuelEfficiency, downsampleEfficiencyData } from '../fuelEfficiency';
import type { VehicleEvent } from '../../types';
import type { EfficiencySegment } from '../fuelEfficiency';

function makeFuelEvent(
  id: string,
  odometer: number,
  volume: number,
  date: string,
  isPartialFill = false,
): VehicleEvent {
  return {
    id,
    vehicleId: 'v1',
    type: 'fuel',
    date,
    odometer,
    cost: volume * 3.5,
    volume,
    isPartialFill,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe('computeFuelEfficiency', () => {
  it('two consecutive full fills — basic MPG calculation', () => {
    const events = [
      makeFuelEvent('1', 1000, 10, '2026-01-01'),
      makeFuelEvent('2', 1300, 12, '2026-02-01'),
    ];
    const { segments, average } = computeFuelEfficiency(events);
    // 300 distance / 12 volume = 25
    expect(average).toBeCloseTo(25);
    const fullSegment = segments.find(s => !s.isPartial)!;
    expect(fullSegment.efficiency).toBeCloseTo(25);
  });

  it('partial fill between two full fills — partial volume rolls into next full fill', () => {
    const events = [
      makeFuelEvent('1', 1000, 10, '2026-01-01', false),
      makeFuelEvent('2', 1150, 5,  '2026-01-15', true),
      makeFuelEvent('3', 1300, 8,  '2026-02-01', false),
    ];
    const { segments, average } = computeFuelEfficiency(events);
    // distance = 300, adjusted volume = 8 + 5 = 13
    expect(average).toBeCloseTo(300 / 13);
    const fullSegments = segments.filter(s => !s.isPartial);
    expect(fullSegments).toHaveLength(1);
    expect(fullSegments[0].efficiency).toBeCloseTo(300 / 13);
    // partial marker should be present
    const partialSegments = segments.filter(s => s.isPartial);
    expect(partialSegments).toHaveLength(1);
  });

  it('multiple consecutive partial fills all roll into the next full fill', () => {
    const events = [
      makeFuelEvent('1', 1000, 10, '2026-01-01', false),
      makeFuelEvent('2', 1100, 4,  '2026-01-10', true),
      makeFuelEvent('3', 1150, 3,  '2026-01-20', true),
      makeFuelEvent('4', 1300, 8,  '2026-02-01', false),
    ];
    const { segments, average } = computeFuelEfficiency(events);
    // distance = 300, adjusted volume = 8 + 4 + 3 = 15
    expect(average).toBeCloseTo(300 / 15);
    expect(segments.filter(s => !s.isPartial)).toHaveLength(1);
    expect(segments.filter(s => s.isPartial)).toHaveLength(2);
  });

  it('only one event — returns a single marker segment with null average', () => {
    const events = [makeFuelEvent('1', 1000, 10, '2026-01-01')];
    const { segments, average } = computeFuelEfficiency(events);
    expect(average).toBeNull();
    expect(segments).toHaveLength(1);
    expect(segments[0].efficiency).toBe(0);
  });

  it('all partial fills — no valid segments, null average', () => {
    const events = [
      makeFuelEvent('1', 1000, 5, '2026-01-01', true),
      makeFuelEvent('2', 1100, 6, '2026-02-01', true),
    ];
    const { segments, average } = computeFuelEfficiency(events);
    expect(average).toBeNull();
    expect(segments.every(s => s.isPartial)).toBe(true);
  });

  it('empty input — returns empty segments and null average', () => {
    const { segments, average } = computeFuelEfficiency([]);
    expect(segments).toHaveLength(0);
    expect(average).toBeNull();
  });

  it('sorted input produces correct average across multiple segments', () => {
    // [full@1000/10] → [full@1300/12] → [full@1600/10]
    // Seg1: 300/12 = 25, Seg2: 300/10 = 30
    // Weighted avg: 600 total dist / 22 total vol = 27.27
    const events = [
      makeFuelEvent('1', 1000, 10, '2026-01-01', false),
      makeFuelEvent('2', 1300, 12, '2026-02-01', false),
      makeFuelEvent('3', 1600, 10, '2026-03-01', false),
    ];
    const { average } = computeFuelEfficiency(events);
    expect(average).toBeCloseTo(600 / 22);
  });

  it('unsorted input — function requires sorted input; negative distance is skipped', () => {
    // Input in wrong order: odo 1300 before odo 1000.
    // The implementation processes in array order; negative distance is skipped.
    // This documents that callers must sort by odometer ASC before calling.
    const events = [
      makeFuelEvent('2', 1300, 12, '2026-02-01', false),
      makeFuelEvent('1', 1000, 10, '2026-01-01', false),
    ];
    const { average } = computeFuelEfficiency(events);
    // No valid segment produced when distance is negative
    expect(average).toBeNull();
  });
});

describe('downsampleEfficiencyData', () => {
  function makeSegment(date: string, efficiency: number): EfficiencySegment {
    return { date, efficiency, isPartial: false };
  }

  it('returns points as-is when count <= maxPoints', () => {
    const points = [
      makeSegment('2026-01-15', 25),
      makeSegment('2026-02-10', 28),
      makeSegment('2026-03-05', 30),
    ];
    const result = downsampleEfficiencyData(points, 30);
    expect(result).toEqual(points);
  });

  it('aggregates into monthly averages when count > maxPoints', () => {
    const points = [
      makeSegment('2024-01-05', 20),
      makeSegment('2024-01-20', 30),
      makeSegment('2024-02-10', 24),
      makeSegment('2024-02-25', 26),
      makeSegment('2024-03-15', 28),
    ];
    const result = downsampleEfficiencyData(points, 4);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ date: '2024-01', efficiency: 25, isPartial: false });
    expect(result[1]).toEqual({ date: '2024-02', efficiency: 25, isPartial: false });
    expect(result[2]).toEqual({ date: '2024-03', efficiency: 28, isPartial: false });
  });

  it('uses default maxPoints of 30', () => {
    const points = Array.from({ length: 31 }, (_, i) =>
      makeSegment(`2024-01-${String(i + 1).padStart(2, '0')}`, 25)
    );
    const result = downsampleEfficiencyData(points);
    // 31 points all in January → aggregated to 1 point
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01');
    expect(result[0].efficiency).toBe(25);
  });

  it('handles exactly maxPoints (no aggregation)', () => {
    const points = Array.from({ length: 30 }, (_, i) =>
      makeSegment(`2024-01-${String(i + 1).padStart(2, '0')}`, 20 + i)
    );
    const result = downsampleEfficiencyData(points, 30);
    expect(result).toEqual(points);
  });

  it('single month with one fill-up produces one aggregated point', () => {
    const points = [makeSegment('2024-06-15', 32)];
    const result = downsampleEfficiencyData(points, 0); // force aggregation
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2024-06', efficiency: 32, isPartial: false });
  });

  it('preserves chronological order across months', () => {
    const points = [
      makeSegment('2023-12-01', 20),
      makeSegment('2024-01-15', 25),
      makeSegment('2024-02-10', 30),
      makeSegment('2024-03-20', 28),
    ];
    const result = downsampleEfficiencyData(points, 3);
    const dates = result.map(r => r.date);
    expect(dates).toEqual(['2023-12', '2024-01', '2024-02', '2024-03']);
  });
});
