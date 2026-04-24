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

export async function getByEvent(eventId: string): Promise<ServiceType[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<ServiceTypeRow>(
    `SELECT st.id, st.name, st.isDefault, st.sortOrder, st.createdAt
     FROM event_service_type est
     JOIN service_type st ON st.id = est.serviceTypeId
     WHERE est.eventId = ?
     ORDER BY st.sortOrder ASC`,
    [eventId]
  );
  return rows.map(mapRow);
}

export async function setForEvent(
  eventId: string,
  serviceTypeIds: string[]
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'DELETE FROM event_service_type WHERE eventId = ?',
    [eventId]
  );
  for (const serviceTypeId of serviceTypeIds) {
    await db.runAsync(
      'INSERT INTO event_service_type (eventId, serviceTypeId) VALUES (?, ?)',
      [eventId, serviceTypeId]
    );
  }
}
