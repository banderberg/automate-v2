// Mock the db/client module so expo-sqlite is never loaded in the test environment.
// Only convertOdometer (a pure function) is tested here.
jest.mock('../../db/client', () => ({ getDatabase: jest.fn() }));

import { convertOdometer, MILES_TO_KM, KM_TO_MILES } from '../unitConversion';

describe('convertOdometer', () => {
  it('miles to kilometers', () => {
    // 1000 mi × 1.60934 = 1609.34 → rounds to 1609
    expect(convertOdometer(1000, 'miles', 'kilometers')).toBe(1609);
  });

  it('kilometers to miles', () => {
    // 1609 km × 0.62137 = 999.78 → rounds to 1000
    expect(convertOdometer(1609, 'kilometers', 'miles')).toBe(1000);
  });

  it('same unit — returns value unchanged', () => {
    expect(convertOdometer(1000, 'miles', 'miles')).toBe(1000);
    expect(convertOdometer(1000, 'kilometers', 'kilometers')).toBe(1000);
  });

  it('zero — returns 0', () => {
    expect(convertOdometer(0, 'miles', 'kilometers')).toBe(0);
    expect(convertOdometer(0, 'kilometers', 'miles')).toBe(0);
  });

  it('conversion is symmetric within rounding tolerance of ±1', () => {
    const original = 1000;
    const converted = convertOdometer(original, 'miles', 'kilometers');
    const roundTripped = convertOdometer(converted, 'kilometers', 'miles');
    expect(Math.abs(roundTripped - original)).toBeLessThanOrEqual(1);
  });

  it('exports the correct conversion constants', () => {
    expect(MILES_TO_KM).toBeCloseTo(1.60934);
    expect(KM_TO_MILES).toBeCloseTo(0.62137);
  });
});
