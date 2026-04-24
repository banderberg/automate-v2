import { validateOdometer } from '../odometerValidator';

describe('validateOdometer', () => {
  it('value within bounds — valid with no message', () => {
    const result = validateOdometer(500, { floor: 400, ceiling: 600 });
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('value below floor — invalid with "Must be at least" message', () => {
    const result = validateOdometer(300, { floor: 400, ceiling: 600 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/must be at least/i);
    expect(result.message).toContain('400');
  });

  it('value above ceiling — invalid with "Must be at most" message', () => {
    const result = validateOdometer(700, { floor: 400, ceiling: 600 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/must be at most/i);
    expect(result.message).toContain('600');
  });

  it('value equal to floor — valid', () => {
    expect(validateOdometer(400, { floor: 400, ceiling: 600 }).valid).toBe(true);
  });

  it('value equal to ceiling — valid', () => {
    expect(validateOdometer(600, { floor: 400, ceiling: 600 }).valid).toBe(true);
  });

  it('value of zero — invalid regardless of bounds', () => {
    const result = validateOdometer(0, { floor: null, ceiling: null });
    expect(result.valid).toBe(false);
  });

  it('negative value — invalid', () => {
    const result = validateOdometer(-100, { floor: null, ceiling: null });
    expect(result.valid).toBe(false);
  });

  it('no floor (first event) — only ceiling is checked', () => {
    expect(validateOdometer(500, { floor: null, ceiling: 600 }).valid).toBe(true);
    expect(validateOdometer(700, { floor: null, ceiling: 600 }).valid).toBe(false);
  });

  it('no ceiling (most recent event) — only floor is checked', () => {
    expect(validateOdometer(500, { floor: 400, ceiling: null }).valid).toBe(true);
    expect(validateOdometer(300, { floor: 400, ceiling: null }).valid).toBe(false);
  });

  it('no bounds at all — any positive value is valid', () => {
    expect(validateOdometer(1, { floor: null, ceiling: null }).valid).toBe(true);
    expect(validateOdometer(999999, { floor: null, ceiling: null }).valid).toBe(true);
  });
});
