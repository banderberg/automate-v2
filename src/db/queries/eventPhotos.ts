import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { getDatabase } from '../client';
import type { EventPhoto } from '../../types';

interface EventPhotoRow {
  id: string;
  eventId: string;
  filePath: string;
  sortOrder: number;
  createdAt: string;
}

function mapRow(row: EventPhotoRow): EventPhoto {
  return {
    id: row.id,
    eventId: row.eventId,
    filePath: row.filePath,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export async function getByEvent(eventId: string): Promise<EventPhoto[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<EventPhotoRow>(
    'SELECT * FROM event_photo WHERE eventId = ? ORDER BY sortOrder ASC',
    [eventId]
  );
  return rows.map(mapRow);
}

export async function insert(
  eventId: string,
  filePath: string,
  sortOrder: number
): Promise<EventPhoto> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO event_photo (id, eventId, filePath, sortOrder, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [id, eventId, filePath, sortOrder, now]
  );

  return {
    id,
    eventId,
    filePath,
    sortOrder,
    createdAt: now,
  };
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  const row = await db.getFirstAsync<EventPhotoRow>(
    'SELECT * FROM event_photo WHERE id = ?',
    [id]
  );

  if (row) {
    try {
      const file = new File(row.filePath);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best effort file cleanup
    }
    await db.runAsync('DELETE FROM event_photo WHERE id = ?', [id]);
  }
}

export async function removeAllForEvent(eventId: string): Promise<void> {
  const db = getDatabase();
  const rows = await db.getAllAsync<EventPhotoRow>(
    'SELECT * FROM event_photo WHERE eventId = ?',
    [eventId]
  );

  // Delete files from disk
  for (const row of rows) {
    try {
      const file = new File(row.filePath);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best effort file cleanup
    }
  }

  // Delete DB rows
  await db.runAsync('DELETE FROM event_photo WHERE eventId = ?', [eventId]);
}
