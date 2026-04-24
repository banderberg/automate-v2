import { computeCostPerMile } from '../costPerMile';
import type { VehicleEvent } from '../../types';

function makeEvent(
  id: string,
  cost: number,
  odometer?: number,
  type: VehicleEvent['type'] = 'fuel',
): VehicleEvent {
  return {
    id,
    vehicleId: 'v1',
    type,
    date: '2026-01-01',
    cost,
    odometer,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('computeCostPerMile', () => {
  it('normal case — computes total cost divided by odometer range', () => {
    const events = [
      makeEvent('1', 50,  10000, 'fuel'),
      makeEvent('2', 200, 10500, 'service'),
      makeEvent('3', 30,  11000, 'fuel'),
    ];
    // totalCost = 280, distance = 11000 - 10000 = 1000
    expect(computeCostPerMile(events)).toBeCloseTo(0.28);
  });

  it('fewer than 2 events with odometers — returns null', () => {
    const events = [makeEvent('1', 100, undefined, 'expense')];
    expect(computeCostPerMile(events)).toBeNull();
  });

  it('mixed events — expense without odometer still contributes to cost numerator', () => {
    const events = [
      makeEvent('1', 50,  10000, 'fuel'),
      makeEvent('2', 200, undefined, 'expense'), // no odometer
      makeEvent('3', 30,  11000, 'fuel'),
    ];
    // totalCost = 280, odometer range = 11000 - 10000 = 1000
    expect(computeCostPerMile(events)).toBeCloseTo(0.28);
  });

  it('single event — returns null', () => {
    expect(computeCostPerMile([makeEvent('1', 100, 10000)])).toBeNull();
  });

  it('zero distance (same odometer on all events) — returns null, not Infinity', () => {
    const events = [
      makeEvent('1', 50,  10000),
      makeEvent('2', 200, 10000),
    ];
    expect(computeCostPerMile(events)).toBeNull();
  });

  it('empty array — returns null', () => {
    expect(computeCostPerMile([])).toBeNull();
  });
});
