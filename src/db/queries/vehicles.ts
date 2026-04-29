import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Vehicle } from '../../types';

interface VehicleRow {
  id: string;
  sortOrder: number;
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  vin: string | null;
  fuelType: string;
  odometerUnit: string;
  volumeUnit: string;
  fuelCapacity: number | null;
  imagePath: string | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: VehicleRow): Vehicle {
  return {
    ...row,
    trim: row.trim ?? undefined,
    vin: row.vin ?? undefined,
    fuelCapacity: row.fuelCapacity ?? undefined,
    imagePath: row.imagePath ?? undefined,
    fuelType: row.fuelType as Vehicle['fuelType'],
    odometerUnit: row.odometerUnit as Vehicle['odometerUnit'],
    volumeUnit: row.volumeUnit as Vehicle['volumeUnit'],
    isActive: !!row.isActive,
  };
}

export async function getAll(): Promise<Vehicle[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<VehicleRow>(
    'SELECT * FROM vehicle ORDER BY sortOrder ASC'
  );
  return rows.map(mapRow);
}

export async function getActive(): Promise<Vehicle | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<VehicleRow>(
    'SELECT * FROM vehicle WHERE isActive = 1'
  );
  return row ? mapRow(row) : null;
}

export async function getById(id: string): Promise<Vehicle | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<VehicleRow>(
    'SELECT * FROM vehicle WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function insert(
  vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Vehicle> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO vehicle (id, sortOrder, nickname, make, model, year, trim, vin, fuelType, odometerUnit, volumeUnit, fuelCapacity, imagePath, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      vehicle.sortOrder,
      vehicle.nickname,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      vehicle.trim ?? null,
      vehicle.vin ?? null,
      vehicle.fuelType,
      vehicle.odometerUnit,
      vehicle.volumeUnit,
      vehicle.fuelCapacity ?? null,
      vehicle.imagePath ?? null,
      vehicle.isActive ? 1 : 0,
      now,
      now,
    ]
  );
  const inserted = await getById(id);
  return inserted!;
}

export async function update(
  id: string,
  fields: Partial<Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    sortOrder: 'sortOrder',
    nickname: 'nickname',
    make: 'make',
    model: 'model',
    year: 'year',
    trim: 'trim',
    vin: 'vin',
    fuelType: 'fuelType',
    odometerUnit: 'odometerUnit',
    volumeUnit: 'volumeUnit',
    fuelCapacity: 'fuelCapacity',
    imagePath: 'imagePath',
    isActive: 'isActive',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      const val = fields[key as keyof typeof fields];
      if (key === 'isActive') {
        values.push(val ? 1 : 0);
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
    `UPDATE vehicle SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM vehicle WHERE id = ?', [id]);
}

export async function setActive(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE vehicle SET isActive = 0, updatedAt = ? WHERE isActive = 1',
      [now]
    );
    await db.runAsync(
      'UPDATE vehicle SET isActive = 1, updatedAt = ? WHERE id = ?',
      [now, id]
    );
  });
}

export async function updateSortOrder(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  for (const { id, sortOrder } of updates) {
    await db.runAsync(
      'UPDATE vehicle SET sortOrder = ?, updatedAt = ? WHERE id = ?',
      [sortOrder, now, id]
    );
  }
}
