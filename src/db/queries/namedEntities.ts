import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';

interface NamedEntityRow {
  id: string;
  name: string;
  isDefault: number;
  sortOrder: number;
  createdAt: string;
}

interface NamedEntity {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

function mapRow(row: NamedEntityRow): NamedEntity {
  return { ...row, isDefault: !!row.isDefault };
}

function createQueries(tableName: 'service_type' | 'category') {
  return {
    async getAll(): Promise<NamedEntity[]> {
      const db = getDatabase();
      const rows = await db.getAllAsync<NamedEntityRow>(
        `SELECT * FROM ${tableName} ORDER BY sortOrder ASC`
      );
      return rows.map(mapRow);
    },

    async insert(name: string): Promise<NamedEntity> {
      const db = getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const maxRow = await db.getFirstAsync<{ maxSort: number | null }>(
        `SELECT MAX(sortOrder) AS maxSort FROM ${tableName}`
      );
      const sortOrder = (maxRow?.maxSort ?? -1) + 1;
      await db.runAsync(
        `INSERT INTO ${tableName} (id, name, isDefault, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [id, name, 0, sortOrder, now]
      );
      return { id, name, isDefault: false, sortOrder, createdAt: now };
    },

    async update(id: string, name: string): Promise<void> {
      const db = getDatabase();
      await db.runAsync(
        `UPDATE ${tableName} SET name = ? WHERE id = ?`,
        [name, id]
      );
    },

    async remove(id: string): Promise<void> {
      const db = getDatabase();
      await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    },
  };
}

export const serviceTypeQueries = createQueries('service_type');
export const categoryQueries = createQueries('category');
