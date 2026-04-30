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
