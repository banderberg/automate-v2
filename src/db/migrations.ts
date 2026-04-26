import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CREATE_TABLES, CREATE_INDEXES } from './schema';
import { seedDatabase } from './seed';

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    up: async (db: SQLiteDatabase) => {
      // Create all tables
      for (const sql of ALL_CREATE_TABLES) {
        await db.execAsync(sql);
      }
      // Create indexes
      for (const sql of CREATE_INDEXES) {
        await db.execAsync(sql);
      }
      // Seed default data
      await seedDatabase(db);
    },
  },
  {
    version: 2,
    up: async (db: SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS event_photo (
          id TEXT PRIMARY KEY,
          eventId TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
          filePath TEXT NOT NULL,
          sortOrder INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        );
      `);
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_event_photo_event ON event_photo(eventId);'
      );
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Ensure _meta table exists (outside of migration versioning)
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);'
  );

  // Get current version
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM _meta WHERE key = ?',
    ['schema_version']
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      await migration.up(db);
      await db.runAsync(
        'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)',
        ['schema_version', String(migration.version)]
      );
    }
  }
}
