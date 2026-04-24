import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Category } from '../../types';

interface CategoryRow {
  id: string;
  name: string;
  isDefault: number;
  sortOrder: number;
  createdAt: string;
}

function mapRow(row: CategoryRow): Category {
  return {
    ...row,
    isDefault: !!row.isDefault,
  };
}

export async function getAll(): Promise<Category[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM category ORDER BY sortOrder ASC'
  );
  return rows.map(mapRow);
}

export async function insert(name: string): Promise<Category> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const maxRow = await db.getFirstAsync<{ maxSort: number | null }>(
    'SELECT MAX(sortOrder) AS maxSort FROM category'
  );
  const sortOrder = (maxRow?.maxSort ?? -1) + 1;

  await db.runAsync(
    'INSERT INTO category (id, name, isDefault, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)',
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
    'UPDATE category SET name = ? WHERE id = ?',
    [name, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM category WHERE id = ?', [id]);
}
