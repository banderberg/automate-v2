import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { DEFAULT_SERVICE_TYPES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../constants/seedData';

function generateUUID(): string {
  return Crypto.randomUUID();
}

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();

  // Only seed service types if none exist
  const existingServiceTypes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM service_type WHERE isDefault = 1'
  );
  if (!existingServiceTypes || existingServiceTypes.count === 0) {
    for (let i = 0; i < DEFAULT_SERVICE_TYPES.length; i++) {
      const id = generateUUID();
      await db.runAsync(
        'INSERT INTO service_type (id, name, isDefault, sortOrder, createdAt) VALUES (?, ?, 1, ?, ?)',
        [id, DEFAULT_SERVICE_TYPES[i], i, now]
      );
    }
  }

  // Only seed categories if none exist
  const existingCategories = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM category WHERE isDefault = 1'
  );
  if (!existingCategories || existingCategories.count === 0) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const id = generateUUID();
      await db.runAsync(
        'INSERT INTO category (id, name, isDefault, sortOrder, createdAt) VALUES (?, ?, 1, ?, ?)',
        [id, DEFAULT_CATEGORIES[i], i, now]
      );
    }
  }

  // Insert default settings (only if not already set)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.runAsync(
      'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }
}
