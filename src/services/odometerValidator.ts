export function validateOdometer(
  value: number,
  bounds: { floor: number | null; ceiling: number | null }
): { valid: boolean; message?: string } {
  if (value <= 0) {
    return { valid: false, message: 'Odometer must be a positive number' };
  }

  if (bounds.floor != null && value < bounds.floor) {
    return { valid: false, message: `Must be at least ${bounds.floor.toLocaleString()}` };
  }

  if (bounds.ceiling != null && value > bounds.ceiling) {
    return { valid: false, message: `Must be at most ${bounds.ceiling.toLocaleString()}` };
  }

  return { valid: true };
}
