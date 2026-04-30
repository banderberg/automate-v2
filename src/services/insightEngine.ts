import type { Vehicle, VehicleEvent, Place } from '../types';
import { getOdometerLabel, getVolumeLabel, getEfficiencyLabel } from '../constants/units';

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

  checkEfficiencyDrop(input, units, insights);
  checkSpendingSpike(input, units, insights);
  checkExpensiveFillup(input, units, insights);
  checkNextFillupCost(input, units, insights);
  checkMaintenanceDue(input, units, insights);
  checkCheaperStation(input, units, insights);
  checkMonthOverMonth(input, units, insights);
  checkOdometerMilestone(input, units, insights);

  return insights;
}

function checkEfficiencyDrop(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkSpendingSpike(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkExpensiveFillup(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkNextFillupCost(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkMaintenanceDue(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkCheaperStation(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkMonthOverMonth(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}

function checkOdometerMilestone(_input: InsightEngineInput, _units: UnitLabels, _insights: Insight[]): void {
  // Implemented in Task 6
}
