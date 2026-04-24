export const MILES_TO_KM = 1.60934;
export const KM_TO_MILES = 0.62137;

export type OdometerUnit = 'miles' | 'kilometers';
export type VolumeUnit = 'gallons' | 'litres' | 'kWh';
export type FuelType = 'gas' | 'diesel' | 'electric';

export function getVolumeUnitForFuelType(
  fuelType: FuelType,
  defaultFuelUnit: 'gallons' | 'litres'
): VolumeUnit {
  if (fuelType === 'electric') return 'kWh';
  return defaultFuelUnit;
}

export function getOdometerLabel(unit: OdometerUnit): string {
  return unit === 'miles' ? 'mi' : 'km';
}

export function getVolumeLabel(unit: VolumeUnit): string {
  switch (unit) {
    case 'gallons': return 'gal';
    case 'litres': return 'L';
    case 'kWh': return 'kWh';
  }
}

export function getEfficiencyLabel(odometerUnit: OdometerUnit, volumeUnit: VolumeUnit): string {
  return `${getOdometerLabel(odometerUnit)}/${getVolumeLabel(volumeUnit)}`;
}
