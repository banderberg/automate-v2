import { estimateOdometer } from '../odometerEstimator';
import type { VehicleEvent } from '../../types';

function makeEvent(date: string, odometer: number): VehicleEvent {
  return {
    id: date,
    vehicleId: 'v1',
    type: 'fuel',
    date,
    odometer,
    cost: 40,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe('estimateOdometer', () => {
  it('happy path — extrapolates linearly from average daily rate', () => {
    // 30 days, 300 miles → 10 miles/day
    // sorted DESC (most recent first)
    const events = [
      makeEvent('2026-01-31', 300),
      makeEvent('2026-01-21', 200),
      makeEvent('2026-01-01', 0),
    ];
    // 5 days after most recent
    const estimate = estimateOdometer(events, '2026-02-05');
    expect(estimate).toBe(350); // 300 + 10*5
  });

  it('fewer than 3 events — returns null', () => {
    const events = [
      makeEvent('2026-01-31', 300),
      makeEvent('2026-01-01', 0),
    ];
    expect(estimateOdometer(events, '2026-02-05')).toBeNull();
  });

  it('all events on same date — returns null (avoids divide-by-zero)', () => {
    const events = [
      makeEvent('2026-01-01', 300),
      makeEvent('2026-01-01', 200),
      makeEvent('2026-01-01', 100),
    ];
    expect(estimateOdometer(events, '2026-02-01')).toBeNull();
  });

  it('target date in the past — still estimates correctly using average daily rate', () => {
    // same setup: 10 miles/day, most recent = Jan 31 @ 300
    const events = [
      makeEvent('2026-01-31', 300),
      makeEvent('2026-01-21', 200),
      makeEvent('2026-01-01', 0),
    ];
    // 5 days BEFORE most recent
    const estimate = estimateOdometer(events, '2026-01-26');
    expect(estimate).toBe(250); // 300 + 10*(-5) = 250
  });

  it('events with no odometer are filtered out before calculation', () => {
    const events: VehicleEvent[] = [
      makeEvent('2026-01-31', 300),
      { ...makeEvent('2026-01-21', 0), odometer: undefined }, // no odometer
      makeEvent('2026-01-01', 0),
    ];
    // Only 2 events with odometer — returns null
    expect(estimateOdometer(events, '2026-02-05')).toBeNull();
  });

  it('returns a rounded integer', () => {
    // 31 days, 300 miles → 300/31 ≈ 9.677 miles/day
    const events = [
      makeEvent('2026-01-31', 300),
      makeEvent('2026-01-16', 150),
      makeEvent('2026-01-01', 0),
    ];
    const estimate = estimateOdometer(events, '2026-02-07'); // 7 days later
    expect(Number.isInteger(estimate)).toBe(true);
  });
});
