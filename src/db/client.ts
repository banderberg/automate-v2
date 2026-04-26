import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('automate.db');

  // Enable WAL mode for concurrent read performance
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(db);

  return db;
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

export const DATABASE_NAME = 'automate.db';
