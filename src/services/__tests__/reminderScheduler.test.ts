import { computeNextDue } from '../reminderScheduler';
import type { Reminder } from '../../types';

// Today in the test context (matches 2026-04-24 from project context, but we use
// explicit date strings in each test so the suite is date-independent).

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    vehicleId: 'v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeNextDue', () => {
  it('time-based monthly — computes nextDate and daysRemaining correctly', () => {
    const reminder = makeReminder({
      timeInterval: 6,
      timeUnit: 'months',
      baselineDate: '2026-01-15',
    });
    // nextDate = 6 months after Jan 15 = Jul 15
    const { nextDate, daysRemaining, status } = computeNextDue(reminder, null, '2026-04-24');
    expect(nextDate).toBe('2026-07-15');
    // Apr 24 → Jul 15: 6 + 31 + 30 + 15 = 82 days
    expect(daysRemaining).toBe(82);
    expect(status).toBe('upcoming'); // 82 > 30
  });

  it('distance-based — computes nextOdometer and distanceRemaining', () => {
    const reminder = makeReminder({
      distanceInterval: 5000,
      baselineOdometer: 50000,
    });
    const { nextOdometer, distanceRemaining, status } = computeNextDue(reminder, 54200, '2026-04-24');
    expect(nextOdometer).toBe(55000);
    expect(distanceRemaining).toBe(800);
    expect(status).toBe('soon'); // 800 ≤ 1000
  });

  it('both time and distance — status is the worst of the two', () => {
    const reminder = makeReminder({
      timeInterval: 6,
      timeUnit: 'months',
      baselineDate: '2026-04-01',   // nextDate = Oct 1 → upcoming
      distanceInterval: 5000,
      baselineOdometer: 10000,      // nextOdo = 15000
    });
    // currentOdometer 16000 → distanceRemaining = -1000 → overdue
    const { status } = computeNextDue(reminder, 16000, '2026-04-24');
    expect(status).toBe('overdue');
  });

  it('overdue by date — nextDate is in the past', () => {
    const reminder = makeReminder({
      timeInterval: 6,
      timeUnit: 'months',
      baselineDate: '2024-01-01', // nextDate = 2024-07-01 — well in the past
    });
    const { daysRemaining, status } = computeNextDue(reminder, null, '2026-04-24');
    expect(daysRemaining).toBeLessThan(0);
    expect(status).toBe('overdue');
  });

  it('overdue by distance — distanceRemaining ≤ 0', () => {
    const reminder = makeReminder({
      distanceInterval: 5000,
      baselineOdometer: 10000,
    });
    // currentOdometer = 15001 → remaining = -1
    const { distanceRemaining, status } = computeNextDue(reminder, 15001, '2026-04-24');
    expect(distanceRemaining).toBeLessThanOrEqual(0);
    expect(status).toBe('overdue');
  });

  it('soon by date — daysRemaining ≤ 30', () => {
    const reminder = makeReminder({
      timeInterval: 1,
      timeUnit: 'months',
      baselineDate: '2026-04-01', // nextDate = May 1 → 7 days from Apr 24
    });
    const { daysRemaining, status } = computeNextDue(reminder, null, '2026-04-24');
    expect(daysRemaining).toBe(7);
    expect(status).toBe('soon');
  });

  it('soon by distance — distanceRemaining ≤ 1000', () => {
    const reminder = makeReminder({
      distanceInterval: 5000,
      baselineOdometer: 50000,
    });
    // distanceRemaining = 55000 - 54500 = 500
    const { distanceRemaining, status } = computeNextDue(reminder, 54500, '2026-04-24');
    expect(distanceRemaining).toBe(500);
    expect(status).toBe('soon');
  });

  it('upcoming — both daysRemaining > 30 and distanceRemaining > 1000', () => {
    const reminder = makeReminder({
      timeInterval: 12,
      timeUnit: 'months',
      baselineDate: '2026-04-01', // nextDate = 2027-04-01 → ~341 days
      distanceInterval: 5000,
      baselineOdometer: 50000,
    });
    // currentOdometer = 50001 → distanceRemaining = 4999
    const { status } = computeNextDue(reminder, 50001, '2026-04-24');
    expect(status).toBe('upcoming');
  });

  it('no current odometer — distance remaining is null, status based on time only', () => {
    const reminder = makeReminder({
      timeInterval: 12,
      timeUnit: 'months',
      baselineDate: '2026-04-01', // nextDate = 2027-04-01 → upcoming
      distanceInterval: 5000,
      baselineOdometer: 50000,
    });
    const { distanceRemaining, status } = computeNextDue(reminder, null, '2026-04-24');
    expect(distanceRemaining).toBeNull();
    expect(status).toBe('upcoming'); // time alone says upcoming
  });

  it('no baseline date — time fields are null, no time condition evaluated', () => {
    const reminder = makeReminder({
      timeInterval: 6,
      timeUnit: 'months',
      // baselineDate intentionally omitted
    });
    const { nextDate, daysRemaining } = computeNextDue(reminder, null, '2026-04-24');
    expect(nextDate).toBeNull();
    expect(daysRemaining).toBeNull();
  });

  it('distance-based with exact nextOdometer match — overdue (≤ 0 remaining)', () => {
    const reminder = makeReminder({
      distanceInterval: 5000,
      baselineOdometer: 10000,
    });
    // currentOdometer = 15000 → distanceRemaining = 0 → overdue
    const { distanceRemaining, status } = computeNextDue(reminder, 15000, '2026-04-24');
    expect(distanceRemaining).toBe(0);
    expect(status).toBe('overdue');
  });
});
