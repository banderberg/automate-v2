import type { Reminder } from '../types';

export interface NextDueResult {
  nextDate: string | null;
  nextOdometer: number | null;
  distanceRemaining: number | null;
  daysRemaining: number | null;
  status: 'upcoming' | 'soon' | 'overdue';
}

export function computeNextDue(
  reminder: Reminder,
  currentOdometer: number | null,
  today: string
): NextDueResult {
  let nextDate: string | null = null;
  let nextOdometer: number | null = null;
  let distanceRemaining: number | null = null;
  let daysRemaining: number | null = null;

  // Time-based calculation
  if (reminder.timeInterval != null && reminder.timeUnit != null && reminder.baselineDate != null) {
    nextDate = addInterval(reminder.baselineDate, reminder.timeInterval, reminder.timeUnit);
    daysRemaining = daysDiff(today, nextDate);
  }

  // Distance-based calculation
  if (reminder.distanceInterval != null && reminder.baselineOdometer != null) {
    nextOdometer = reminder.baselineOdometer + reminder.distanceInterval;
    if (currentOdometer != null) {
      distanceRemaining = nextOdometer - currentOdometer;
    }
  }

  // Determine status - check both conditions, worst wins
  let status: 'upcoming' | 'soon' | 'overdue' = 'upcoming';

  const isOverdueByTime = daysRemaining != null && daysRemaining < 0;
  const isOverdueByDistance = distanceRemaining != null && distanceRemaining <= 0;
  const isSoonByTime = daysRemaining != null && daysRemaining <= 30;
  const isSoonByDistance = distanceRemaining != null && distanceRemaining <= 1000;

  if (isOverdueByTime || isOverdueByDistance) {
    status = 'overdue';
  } else if (isSoonByTime || isSoonByDistance) {
    status = 'soon';
  }

  return { nextDate, nextOdometer, distanceRemaining, daysRemaining, status };
}

function addInterval(baseDate: string, interval: number, unit: 'days' | 'weeks' | 'months' | 'years'): string {
  const date = new Date(baseDate + 'T00:00:00Z');
  switch (unit) {
    case 'days':
      date.setUTCDate(date.getUTCDate() + interval);
      break;
    case 'weeks':
      date.setUTCDate(date.getUTCDate() + interval * 7);
      break;
    case 'months':
      date.setUTCMonth(date.getUTCMonth() + interval);
      break;
    case 'years':
      date.setUTCFullYear(date.getUTCFullYear() + interval);
      break;
  }
  return date.toISOString().split('T')[0];
}

function daysDiff(from: string, to: string): number {
  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate = new Date(to + 'T00:00:00Z');
  return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}
