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

describe('efficiency_drop', () => {
  it('fires when rolling 3-fill avg drops >10% below overall', () => {
    const input = emptyInput();
    input.efficiencyData = {
      average: 30,
      recentRollingAverage: 24,
    };
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

describe('maintenance_due', () => {
  it('fires when current mileage exceeds 80% of historical interval', () => {
    const input = emptyInput();
    input.serviceEventsByType = new Map([
      ['st1', [
        { eventId: 's1', date: '2025-06-01', odometer: 30000, serviceTypeName: 'Oil Change' },
        { eventId: 's2', date: '2025-12-01', odometer: 35000, serviceTypeName: 'Oil Change' },
      ]],
    ]);
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

describe('month_over_month', () => {
  it('fires when spending changes >15% between two most recent complete months', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-02-05', 200, 1000, 10),
      makeExpenseEvent('e1', '2026-02-15', 200),
      makeFuelEvent('f2', '2026-03-05', 300, 1300, 10),
      makeServiceEvent('s1', '2026-03-15', 300, 1500),
    ];
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

describe('odometer_milestone', () => {
  it('fires when most recent reading crosses a milestone boundary', () => {
    const input = emptyInput();
    input.events = [
      makeFuelEvent('f1', '2026-02-01', 40, 49800, 10),
      makeFuelEvent('f2', '2026-03-01', 40, 50200, 10),
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
      makeFuelEvent('f2', '2026-03-01', 40, 101000, 10),
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
