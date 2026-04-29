import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { closeDatabase, initializeDatabase, DATABASE_NAME } from '../db/client';

export interface BackupInfo {
  vehicleCount: number;
  eventCount: number;
  reminderCount: number;
}

export async function createBackup(): Promise<string> {
  const sourceDb = await initializeDatabase();

  await sourceDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  const timestamp = new Date().toISOString().split('T')[0];
  const backupFileName = `automate-backup-${timestamp}.db`;

  const destDb = await SQLite.openDatabaseAsync(
    backupFileName,
    { useNewConnection: true },
    Paths.cache.uri
  );

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: sourceDb,
      destDatabase: destDb,
    });
  } finally {
    await destDb.closeAsync();
  }

  const backupFile = new File(Paths.cache, backupFileName);
  return backupFile.uri;
}

export async function getBackupInfo(fileUri: string): Promise<BackupInfo> {
  const sourceFile = new File(fileUri);
  if (!sourceFile.exists) {
    throw new Error('Backup file not found.');
  }

  const stagingName = `backup-inspect-${Date.now()}.db`;
  const stagingFile = new File(Paths.cache, stagingName);

  try {
    sourceFile.copy(stagingFile);

    const inspectDb = await SQLite.openDatabaseAsync(
      stagingName,
      { useNewConnection: true },
      Paths.cache.uri
    );

    try {
      const vehicleRow = await inspectDb.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM vehicle'
      );
      const eventRow = await inspectDb.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM event'
      );
      const reminderRow = await inspectDb.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM reminder'
      );

      return {
        vehicleCount: vehicleRow?.count ?? 0,
        eventCount: eventRow?.count ?? 0,
        reminderCount: reminderRow?.count ?? 0,
      };
    } finally {
      await inspectDb.closeAsync();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('no such table') || message.includes('not a database') || message.includes('file is not a database')) {
      throw new Error('This file is not a valid AutoMate backup.');
    }
    throw e;
  } finally {
    if (stagingFile.exists) {
      stagingFile.delete();
    }
  }
}

export async function restoreBackup(fileUri: string): Promise<void> {
  const sourceFile = new File(fileUri);
  if (!sourceFile.exists) {
    throw new Error('Backup file not found.');
  }

  const stagingName = `backup-restore-${Date.now()}.db`;
  const stagingFile = new File(Paths.cache, stagingName);

  try {
    sourceFile.copy(stagingFile);

    const testDb = await SQLite.openDatabaseAsync(
      stagingName,
      { useNewConnection: true },
      Paths.cache.uri
    );
    try {
      await testDb.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM vehicle');
      await testDb.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM event');
    } finally {
      await testDb.closeAsync();
    }
  } catch (e) {
    if (stagingFile.exists) {
      stagingFile.delete();
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('no such table') || message.includes('not a database') || message.includes('file is not a database')) {
      throw new Error('This file is not a valid AutoMate backup.');
    }
    throw e;
  }

  await closeDatabase();

  try {
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  } catch {
    // Database file may not exist yet on fresh installs
  }

  const restoredDb = await SQLite.openDatabaseAsync(
    DATABASE_NAME,
    { useNewConnection: true }
  );
  const stagingDb = await SQLite.openDatabaseAsync(
    stagingName,
    { useNewConnection: true },
    Paths.cache.uri
  );

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: stagingDb,
      destDatabase: restoredDb,
    });
  } finally {
    await stagingDb.closeAsync();
    await restoredDb.closeAsync();
    if (stagingFile.exists) {
      stagingFile.delete();
    }
  }

  await initializeDatabase();
}
