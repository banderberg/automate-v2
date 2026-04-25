import { getDatabase } from '../db/client';
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

export async function convertVehicleOdometers(
  vehicleId: string,
  to: 'miles' | 'kilometers'
): Promise<number> {
  const db = getDatabase();
  const factor = to === 'kilometers' ? MILES_TO_KM : KM_TO_MILES;
  const now = new Date().toISOString();
  let totalChanges = 0;

  await db.withTransactionAsync(async () => {
    const eventResult = await db.runAsync(
      `UPDATE event SET odometer = ROUND(odometer * ?, 0), updatedAt = ?
       WHERE vehicleId = ? AND odometer IS NOT NULL`,
      [factor, now, vehicleId]
    );

    const reminderDistResult = await db.runAsync(
      `UPDATE reminder SET distanceInterval = ROUND(distanceInterval * ?, 0), updatedAt = ?
       WHERE vehicleId = ? AND distanceInterval IS NOT NULL`,
      [factor, now, vehicleId]
    );

    const reminderBaseResult = await db.runAsync(
      `UPDATE reminder SET baselineOdometer = ROUND(baselineOdometer * ?, 0), updatedAt = ?
       WHERE vehicleId = ? AND baselineOdometer IS NOT NULL`,
      [factor, now, vehicleId]
    );

    totalChanges = eventResult.changes + reminderDistResult.changes + reminderBaseResult.changes;
  });

  return totalChanges;
}
