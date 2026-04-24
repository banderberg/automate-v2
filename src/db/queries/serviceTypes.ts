import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { ServiceType } from '../../types';

interface ServiceTypeRow {
  id: string;
  name: string;
  isDefault: number;
  sortOrder: number;
  createdAt: string;
}

function mapRow(row: ServiceTypeRow): ServiceType {
  return {
    ...row,
    isDefault: !!row.isDefault,
  };
}

export async function getAll(): Promise<ServiceType[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ServiceTypeRow>(
    'SELECT * FROM service_type ORDER BY sortOrder ASC'
  );
  return rows.map(mapRow);
}

export async function insert(name: string): Promise<ServiceType> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const maxRow = await db.getFirstAsync<{ maxSort: number | null }>(
    'SELECT MAX(sortOrder) AS maxSort FROM service_type'
  );
  const sortOrder = (maxRow?.maxSort ?? -1) + 1;

  await db.runAsync(
    'INSERT INTO service_type (id, name, isDefault, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, name, 0, sortOrder, now]
  );

  return {
    id,
    name,
    isDefault: false,
    sortOrder,
    createdAt: now,
  };
}

export async function update(id: string, name: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE service_type SET name = ? WHERE id = ?',
    [name, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM service_type WHERE id = ?', [id]);
}
