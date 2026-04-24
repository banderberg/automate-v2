import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Reminder } from '../../types';

interface ReminderRow {
  id: string;
  vehicleId: string;
  serviceTypeId: string | null;
  categoryId: string | null;
  distanceInterval: number | null;
  timeInterval: number | null;
  timeUnit: string | null;
  baselineOdometer: number | null;
  baselineDate: string | null;
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    serviceTypeId: row.serviceTypeId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    distanceInterval: row.distanceInterval ?? undefined,
    timeInterval: row.timeInterval ?? undefined,
    timeUnit: row.timeUnit
      ? (row.timeUnit as Reminder['timeUnit'])
      : undefined,
    baselineOdometer: row.baselineOdometer ?? undefined,
    baselineDate: row.baselineDate ?? undefined,
    notificationId: row.notificationId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getByVehicle(vehicleId: string): Promise<Reminder[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminder WHERE vehicleId = ? ORDER BY createdAt ASC',
    [vehicleId]
  );
  return rows.map(mapRow);
}

export async function getById(id: string): Promise<Reminder | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<ReminderRow>(
    'SELECT * FROM reminder WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function getByServiceType(
  vehicleId: string,
  serviceTypeId: string
): Promise<Reminder[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminder WHERE vehicleId = ? AND serviceTypeId = ? ORDER BY createdAt ASC',
    [vehicleId, serviceTypeId]
  );
  return rows.map(mapRow);
}

export async function getByCategory(
  vehicleId: string,
  categoryId: string
): Promise<Reminder[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminder WHERE vehicleId = ? AND categoryId = ? ORDER BY createdAt ASC',
    [vehicleId, categoryId]
  );
  return rows.map(mapRow);
}

export async function insert(
  reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Reminder> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO reminder (id, vehicleId, serviceTypeId, categoryId, distanceInterval, timeInterval, timeUnit, baselineOdometer, baselineDate, notificationId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reminder.vehicleId,
      reminder.serviceTypeId ?? null,
      reminder.categoryId ?? null,
      reminder.distanceInterval ?? null,
      reminder.timeInterval ?? null,
      reminder.timeUnit ?? null,
      reminder.baselineOdometer ?? null,
      reminder.baselineDate ?? null,
      reminder.notificationId ?? null,
      now,
      now,
    ]
  );
  const inserted = await getById(id);
  return inserted!;
}

export async function update(
  id: string,
  fields: Partial<Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    vehicleId: 'vehicleId',
    serviceTypeId: 'serviceTypeId',
    categoryId: 'categoryId',
    distanceInterval: 'distanceInterval',
    timeInterval: 'timeInterval',
    timeUnit: 'timeUnit',
    baselineOdometer: 'baselineOdometer',
    baselineDate: 'baselineDate',
    notificationId: 'notificationId',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      const val = fields[key as keyof typeof fields];
      values.push((val as string | number | null) ?? null);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE reminder SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM reminder WHERE id = ?', [id]);
}
