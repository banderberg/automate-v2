import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { VehicleEvent } from '../../types';

interface EventRow {
  id: string;
  vehicleId: string;
  type: string;
  date: string;
  odometer: number | null;
  cost: number;
  volume: number | null;
  pricePerUnit: number | null;
  discountPerUnit: number | null;
  isPartialFill: number | null;
  placeId: string | null;
  categoryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: EventRow): VehicleEvent {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    type: row.type as VehicleEvent['type'],
    date: row.date,
    odometer: row.odometer ?? undefined,
    cost: row.cost,
    volume: row.volume ?? undefined,
    pricePerUnit: row.pricePerUnit ?? undefined,
    discountPerUnit: row.discountPerUnit ?? undefined,
    isPartialFill: row.isPartialFill != null ? !!row.isPartialFill : undefined,
    placeId: row.placeId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getByVehicle(
  vehicleId: string,
  filters?: {
    types?: VehicleEvent['type'][];
    startDate?: string;
    endDate?: string;
  }
): Promise<VehicleEvent[]> {
  const db = getDatabase();
  const whereClauses: string[] = ['vehicleId = ?'];
  const params: (string | number)[] = [vehicleId];

  if (filters?.types && filters.types.length > 0) {
    const placeholders = filters.types.map(() => '?').join(', ');
    whereClauses.push(`type IN (${placeholders})`);
    params.push(...filters.types);
  }

  if (filters?.startDate) {
    whereClauses.push('date >= ?');
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    whereClauses.push('date <= ?');
    params.push(filters.endDate);
  }

  const sql = `SELECT * FROM event WHERE ${whereClauses.join(' AND ')} ORDER BY date DESC, createdAt DESC`;
  const rows = await db.getAllAsync<EventRow>(sql, params);
  return rows.map(mapRow);
}

export async function getById(id: string): Promise<VehicleEvent | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<EventRow>(
    'SELECT * FROM event WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function insert(
  event: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VehicleEvent> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO event (id, vehicleId, type, date, odometer, cost, volume, pricePerUnit, discountPerUnit, isPartialFill, placeId, categoryId, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      event.vehicleId,
      event.type,
      event.date,
      event.odometer ?? null,
      event.cost,
      event.volume ?? null,
      event.pricePerUnit ?? null,
      event.discountPerUnit ?? null,
      event.isPartialFill != null ? (event.isPartialFill ? 1 : 0) : null,
      event.placeId ?? null,
      event.categoryId ?? null,
      event.notes ?? null,
      now,
      now,
    ]
  );
  const inserted = await getById(id);
  return inserted!;
}

export async function update(
  id: string,
  fields: Partial<Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    vehicleId: 'vehicleId',
    type: 'type',
    date: 'date',
    odometer: 'odometer',
    cost: 'cost',
    volume: 'volume',
    pricePerUnit: 'pricePerUnit',
    discountPerUnit: 'discountPerUnit',
    isPartialFill: 'isPartialFill',
    placeId: 'placeId',
    categoryId: 'categoryId',
    notes: 'notes',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      const val = fields[key as keyof typeof fields];
      if (key === 'isPartialFill') {
        values.push(val != null ? (val ? 1 : 0) : null);
      } else {
        values.push((val as string | number | null) ?? null);
      }
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE event SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM event WHERE id = ?', [id]);
}

export async function getLatestByVehicle(
  vehicleId: string
): Promise<VehicleEvent | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<EventRow>(
    'SELECT * FROM event WHERE vehicleId = ? ORDER BY date DESC, createdAt DESC LIMIT 1',
    [vehicleId]
  );
  return row ? mapRow(row) : null;
}

export async function getMaxOdometer(
  vehicleId: string
): Promise<number | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ maxOdo: number | null }>(
    'SELECT MAX(odometer) AS maxOdo FROM event WHERE vehicleId = ? AND odometer IS NOT NULL',
    [vehicleId]
  );
  return row?.maxOdo ?? null;
}

export async function getOdometerBounds(
  vehicleId: string,
  date: string
): Promise<{ floor: number | null; ceiling: number | null }> {
  const db = getDatabase();

  const floorRow = await db.getFirstAsync<{ val: number | null }>(
    'SELECT MAX(odometer) AS val FROM event WHERE vehicleId = ? AND date < ? AND odometer IS NOT NULL',
    [vehicleId, date]
  );

  const ceilingRow = await db.getFirstAsync<{ val: number | null }>(
    'SELECT MIN(odometer) AS val FROM event WHERE vehicleId = ? AND date > ? AND odometer IS NOT NULL',
    [vehicleId, date]
  );

  return {
    floor: floorRow?.val ?? null,
    ceiling: ceilingRow?.val ?? null,
  };
}

export async function getRecentFuelEvents(
  vehicleId: string,
  limit: number
): Promise<VehicleEvent[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM event WHERE vehicleId = ? AND type = ? ORDER BY date DESC LIMIT ?',
    [vehicleId, 'fuel', limit]
  );
  return rows.map(mapRow);
}

export async function getEventsWithOdometer(
  vehicleId: string,
  limit: number
): Promise<VehicleEvent[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM event WHERE vehicleId = ? AND odometer IS NOT NULL ORDER BY date DESC LIMIT ?',
    [vehicleId, limit]
  );
  return rows.map(mapRow);
}
