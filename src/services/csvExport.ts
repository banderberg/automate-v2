import { File, Paths } from 'expo-file-system';
import { getDatabase } from '../db/client';

const BOM = '﻿';
const HEADER = 'Date,EventType,Odometer,OdometerUnit,Cost,Volume,VolumeUnit,PricePerUnit,DiscountPerUnit,PartialFill,Place,ServiceTypes,Category,Notes';

export async function exportVehicleData(
  vehicleId: string | null,
  startDate?: string,
  endDate?: string
): Promise<string> {
  const db = getDatabase();

  // Build query
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (vehicleId) {
    conditions.push('e.vehicleId = ?');
    params.push(vehicleId);
  }
  if (startDate) {
    conditions.push('e.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('e.date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get events with place names, category names, and vehicle info
  const rows = await db.getAllAsync<{
    date: string;
    type: string;
    odometer: number | null;
    odometerUnit: string;
    cost: number;
    volume: number | null;
    volumeUnit: string;
    pricePerUnit: number | null;
    discountPerUnit: number | null;
    isPartialFill: number | null;
    placeName: string | null;
    categoryName: string | null;
    notes: string | null;
    eventId: string;
  }>(
    `SELECT e.id as eventId, e.date, e.type, e.odometer, v.odometerUnit, e.cost,
            e.volume, v.volumeUnit, e.pricePerUnit, e.discountPerUnit, e.isPartialFill,
            p.name as placeName, c.name as categoryName, e.notes
     FROM event e
     JOIN vehicle v ON e.vehicleId = v.id
     LEFT JOIN place p ON e.placeId = p.id
     LEFT JOIN category c ON e.categoryId = c.id
     ${whereClause}
     ORDER BY e.date ASC`,
    params
  );

  // Get service types for each service event
  const serviceEventIds = rows.filter(r => r.type === 'service').map(r => r.eventId);
  const serviceTypeMap = new Map<string, string>();

  for (const eventId of serviceEventIds) {
    const serviceTypes = await db.getAllAsync<{ name: string }>(
      `SELECT st.name FROM event_service_type est
       JOIN service_type st ON est.serviceTypeId = st.id
       WHERE est.eventId = ?
       ORDER BY st.sortOrder`,
      [eventId]
    );
    serviceTypeMap.set(eventId, serviceTypes.map(s => s.name).join('; '));
  }

  // Build CSV content
  const csvLines = [HEADER];

  for (const row of rows) {
    const serviceTypes = serviceTypeMap.get(row.eventId) ?? '';
    const line = [
      row.date,
      row.type,
      row.odometer != null ? String(row.odometer) : '',
      row.odometerUnit,
      String(row.cost),
      row.volume != null ? String(row.volume) : '',
      row.type === 'fuel' ? row.volumeUnit : '',
      row.pricePerUnit != null ? String(row.pricePerUnit) : '',
      row.discountPerUnit != null ? String(row.discountPerUnit) : '',
      row.isPartialFill ? 'Yes' : '',
      csvEscape(row.placeName ?? ''),
      csvEscape(serviceTypes),
      csvEscape(row.categoryName ?? ''),
      csvEscape(row.notes ?? ''),
    ].join(',');
    csvLines.push(line);
  }

  const content = BOM + csvLines.join('\n');

  // Write to document directory
  const fileName = vehicleId
    ? `automate-export-${vehicleId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`
    : `automate-export-all-${new Date().toISOString().split('T')[0]}.csv`;
  const file = new File(Paths.document, fileName);
  file.create({ overwrite: true });
  file.write(content);

  return file.uri;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
