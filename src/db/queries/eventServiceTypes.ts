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

export async function getLabelsByVehicle(vehicleId: string): Promise<Map<string, string>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ eventId: string; label: string }>(
    `SELECT est.eventId, GROUP_CONCAT(st.name, ', ') AS label
     FROM event_service_type est
     JOIN service_type st ON st.id = est.serviceTypeId
     JOIN event e ON e.id = est.eventId
     WHERE e.vehicleId = ?
     GROUP BY est.eventId`,
    [vehicleId]
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.eventId, row.label);
  }
  return map;
}

export async function setForEvent(
  eventId: string,
  serviceTypeIds: string[]
): Promise<void> {
  const db = getDatabase();
  await db.withTransactionAsync(async () => {
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
  });
}

export interface ServiceEventWithType {
  eventId: string;
  date: string;
  odometer: number;
  serviceTypeName: string;
  serviceTypeId: string;
}

export async function getServiceEventsByType(
  vehicleId: string
): Promise<Map<string, ServiceEventWithType[]>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{
    eventId: string;
    date: string;
    odometer: number | null;
    serviceTypeName: string;
    serviceTypeId: string;
  }>(
    `SELECT e.id AS eventId, e.date, e.odometer, st.name AS serviceTypeName, st.id AS serviceTypeId
     FROM event e
     JOIN event_service_type est ON est.eventId = e.id
     JOIN service_type st ON st.id = est.serviceTypeId
     WHERE e.vehicleId = ? AND e.odometer IS NOT NULL
     ORDER BY e.odometer ASC`,
    [vehicleId]
  );

  const map = new Map<string, ServiceEventWithType[]>();
  for (const row of rows) {
    if (row.odometer == null) continue;
    const entry: ServiceEventWithType = {
      eventId: row.eventId,
      date: row.date,
      odometer: row.odometer,
      serviceTypeName: row.serviceTypeName,
      serviceTypeId: row.serviceTypeId,
    };
    const existing = map.get(row.serviceTypeId) ?? [];
    existing.push(entry);
    map.set(row.serviceTypeId, existing);
  }
  return map;
}
