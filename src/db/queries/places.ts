import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Place } from '../../types';

interface PlaceRow {
  id: string;
  name: string;
  type: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Place['type'],
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAll(): Promise<Place[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<PlaceRow>(
    'SELECT * FROM place ORDER BY name ASC'
  );
  return rows.map(mapRow);
}

export async function getByType(type: Place['type']): Promise<Place[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<PlaceRow>(
    'SELECT * FROM place WHERE type = ? ORDER BY name ASC',
    [type]
  );
  return rows.map(mapRow);
}

export async function getById(id: string): Promise<Place | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<PlaceRow>(
    'SELECT * FROM place WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function insert(
  place: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Place> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO place (id, name, type, address, latitude, longitude, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      place.name,
      place.type,
      place.address ?? null,
      place.latitude ?? null,
      place.longitude ?? null,
      now,
      now,
    ]
  );
  return {
    id,
    name: place.name,
    type: place.type,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    createdAt: now,
    updatedAt: now,
  };
}

export async function update(
  id: string,
  fields: Partial<Omit<Place, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    type: 'type',
    address: 'address',
    latitude: 'latitude',
    longitude: 'longitude',
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
    `UPDATE place SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM place WHERE id = ?', [id]);
}
