import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';

export interface InsightImpressionRow {
  id: string;
  vehicleId: string;
  insightType: string;
  dataHash: string;
  shownAt: string;
  dismissedAt: string | null;
  createdAt: string;
}

interface RawRow {
  id: string;
  vehicle_id: string;
  insight_type: string;
  data_hash: string;
  shown_at: string;
  dismissed_at: string | null;
  created_at: string;
}

function mapRow(row: RawRow): InsightImpressionRow {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    insightType: row.insight_type,
    dataHash: row.data_hash,
    shownAt: row.shown_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
  };
}

export async function getLatestByVehicle(vehicleId: string): Promise<InsightImpressionRow[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT i1.*
     FROM insight_impressions i1
     INNER JOIN (
       SELECT insight_type, MAX(shown_at) AS max_shown
       FROM insight_impressions
       WHERE vehicle_id = ?
       GROUP BY insight_type
     ) i2 ON i1.insight_type = i2.insight_type AND i1.shown_at = i2.max_shown
     WHERE i1.vehicle_id = ?`,
    [vehicleId, vehicleId]
  );
  return rows.map(mapRow);
}

export async function recordImpression(
  vehicleId: string,
  insightType: string,
  dataHash: string,
): Promise<string> {
  const db = getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO insight_impressions (id, vehicle_id, insight_type, data_hash, shown_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, insightType, dataHash, now, now]
  );
  return id;
}

export async function markDismissed(id: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE insight_impressions SET dismissed_at = ? WHERE id = ?',
    [now, id]
  );
}
