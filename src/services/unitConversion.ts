import { MILES_TO_KM, KM_TO_MILES } from '../constants/units';

export { MILES_TO_KM, KM_TO_MILES };

export function convertOdometer(
  value: number,
  from: 'miles' | 'kilometers',
  to: 'miles' | 'kilometers'
): number {
  if (from === to) return value;
  const factor = from === 'miles' ? MILES_TO_KM : KM_TO_MILES;
  return Math.round(value * factor);
}
