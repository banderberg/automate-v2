import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { getDatabase } from '../client';
import * as notificationService from '../../services/notifications';
import type { VehicleDocument, VehicleDocumentType } from '../../types';

interface VehicleDocumentRow {
  id: string;
  vehicleId: string;
  name: string;
  type: string;
  filePath: string;
  expirationDate: string | null;
  notificationId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: VehicleDocumentRow): VehicleDocument {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    name: row.name,
    type: row.type as VehicleDocumentType,
    filePath: row.filePath,
    expirationDate: row.expirationDate ?? undefined,
    notificationId: row.notificationId ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getByVehicle(vehicleId: string): Promise<VehicleDocument[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<VehicleDocumentRow>(
    'SELECT * FROM vehicle_document WHERE vehicleId = ? ORDER BY type ASC, name ASC',
    [vehicleId]
  );
  return rows.map(mapRow);
}

export async function getById(id: string): Promise<VehicleDocument | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<VehicleDocumentRow>(
    'SELECT * FROM vehicle_document WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function insert(
  doc: Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VehicleDocument> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO vehicle_document (id, vehicleId, name, type, filePath, expirationDate, notificationId, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      doc.vehicleId,
      doc.name,
      doc.type,
      doc.filePath,
      doc.expirationDate ?? null,
      doc.notificationId ?? null,
      doc.notes ?? null,
      now,
      now,
    ]
  );

  return {
    id,
    ...doc,
    createdAt: now,
    updatedAt: now,
  };
}

export async function update(
  id: string,
  fields: Partial<Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: (string | null)[] = [];

  const fieldMap: Record<string, string> = {
    vehicleId: 'vehicleId',
    name: 'name',
    type: 'type',
    filePath: 'filePath',
    expirationDate: 'expirationDate',
    notificationId: 'notificationId',
    notes: 'notes',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      const val = fields[key as keyof typeof fields];
      values.push((val as string | null) ?? null);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE vehicle_document SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function remove(id: string): Promise<void> {
  const db = getDatabase();
  const row = await db.getFirstAsync<VehicleDocumentRow>(
    'SELECT * FROM vehicle_document WHERE id = ?',
    [id]
  );

  if (row) {
    if (row.notificationId) {
      await notificationService.cancelReminder(row.notificationId);
    }
    try {
      const file = new File(row.filePath);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best effort file cleanup
    }
    await db.runAsync('DELETE FROM vehicle_document WHERE id = ?', [id]);
  }
}

export async function removeAllForVehicle(vehicleId: string): Promise<void> {
  const db = getDatabase();
  const rows = await db.getAllAsync<VehicleDocumentRow>(
    'SELECT * FROM vehicle_document WHERE vehicleId = ?',
    [vehicleId]
  );

  for (const row of rows) {
    if (row.notificationId) {
      await notificationService.cancelReminder(row.notificationId);
    }
    try {
      const file = new File(row.filePath);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best effort file cleanup
    }
  }

  await db.runAsync('DELETE FROM vehicle_document WHERE vehicleId = ?', [vehicleId]);
}
