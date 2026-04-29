import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/client';
import * as placeQueries from '../db/queries/places';
import { serviceTypeQueries, categoryQueries } from '../db/queries/namedEntities';
import type { Place, ServiceType, Category } from '../types';

export interface ParsedEvent {
  date: string;           // ISO 8601 YYYY-MM-DD
  type: 'fuel' | 'service' | 'expense';
  odometer?: number;
  cost: number;
  volume?: number;
  pricePerUnit?: number;
  isPartialFill?: boolean;
  placeName?: string;
  notes?: string;
  serviceTypes?: string[];  // for service events
  category?: string;        // for expense events
}

export interface ParsedImportData {
  events: ParsedEvent[];
  format: 'fuelio' | 'fuelly' | 'automate';
}

export interface ImportResult {
  eventsImported: number;
  eventsSkipped: number;
  placesCreated: number;
  errors: string[];
}

/**
 * Parse a single CSV line, handling quoted fields that may contain commas.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += ch;
      i++;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse a date string that could be DD/MM/YYYY or YYYY-MM-DD and return YYYY-MM-DD.
 */
function normalizeDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Detect the format of a CSV file from its content.
 */
export function detectFormat(csvContent: string): 'fuelio' | 'fuelly' | 'automate' | 'unknown' {
  const content = csvContent.trim();

  // Fuelio: starts with "## Vehicle:" header comments
  if (content.includes('## Vehicle:')) {
    return 'fuelio';
  }

  // AutoMate: header contains "EventType,Odometer,OdometerUnit"
  if (content.includes('EventType,Odometer,OdometerUnit')) {
    return 'automate';
  }

  // Fuelly: header contains "MPG,Miles,Gallons"
  if (content.includes('MPG,Miles,Gallons')) {
    return 'fuelly';
  }

  return 'unknown';
}

/**
 * Parse a Fuelio CSV export. Handles both fuel log and cost (service/expense) sections.
 */
export function parseFuelioCSV(csvContent: string): ParsedImportData {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.length > 0);
  const events: ParsedEvent[] = [];

  let section: 'fuel' | 'costs' | 'unknown' = 'unknown';

  for (const line of lines) {
    // Detect section markers
    if (line.startsWith('## Costs') || line.startsWith('## Cost')) {
      section = 'costs';
      continue;
    }
    if (line.startsWith('## Vehicle:') || line.startsWith('## Make:')) {
      if (section === 'unknown') {
        section = 'fuel';
      }
      continue;
    }
    // Skip comment lines
    if (line.startsWith('##') || line.startsWith('#')) {
      continue;
    }

    // Skip header rows
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('date,') && (lowerLine.includes('fuel station') || lowerLine.includes('odometer,title'))) {
      continue;
    }

    const fields = parseCSVLine(line);

    if (section === 'fuel' || section === 'unknown') {
      // Fuel section: Date,Fuel station,Fuel type,Payment type,Full/Partial,Price per unit,Volume,Total price,Odometer,Consumption,Notes,Latitude,Longitude
      // Need at least 8 fields for a fuel row
      if (fields.length >= 8) {
        const date = normalizeDate(fields[0]);
        if (!date) continue;

        const totalPrice = parseFloat(fields[7]);
        if (isNaN(totalPrice)) continue;

        const volume = parseFloat(fields[6]);
        const pricePerUnit = parseFloat(fields[5]);
        const odometer = parseFloat(fields[8]);
        const isPartialField = fields[4]?.trim();

        const event: ParsedEvent = {
          date,
          type: 'fuel',
          cost: totalPrice,
          volume: isNaN(volume) ? undefined : volume,
          pricePerUnit: isNaN(pricePerUnit) ? undefined : pricePerUnit,
          odometer: isNaN(odometer) ? undefined : odometer,
          isPartialFill: isPartialField === '1',
          placeName: fields[1]?.trim() || undefined,
          notes: fields[10]?.trim() || undefined,
        };

        events.push(event);
      }
    }

    if (section === 'costs') {
      // Cost section: Date,Odometer,Title,Cost,Notes,Latitude,Longitude,Type
      if (fields.length >= 4) {
        const date = normalizeDate(fields[0]);
        if (!date) continue;

        const cost = parseFloat(fields[3]);
        if (isNaN(cost)) continue;

        const odometer = parseFloat(fields[1]);
        const title = fields[2]?.trim() || '';
        const notes = fields[4]?.trim() || undefined;
        const typeField = fields[7]?.trim() || '';

        // Fuelio type field: various numbers, but we map to service by default
        const event: ParsedEvent = {
          date,
          type: 'service',
          cost,
          odometer: isNaN(odometer) ? undefined : odometer,
          notes: notes || undefined,
          serviceTypes: title ? [title] : undefined,
        };

        // If Fuelio marks it as a non-service type, treat as expense
        if (typeField && !['0', '1', ''].includes(typeField)) {
          event.type = 'expense';
          event.category = title || undefined;
          event.serviceTypes = undefined;
        }

        events.push(event);
      }
    }
  }

  return { events, format: 'fuelio' };
}

/**
 * Parse a Fuelly CSV export.
 * Format: Date,MPG,Miles,Gallons,Price/Gallon,Total Cost,Partial,Notes,Octane,Location
 */
export function parseFuellyCSV(csvContent: string): ParsedImportData {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.length > 0);
  const events: ParsedEvent[] = [];

  for (const line of lines) {
    // Skip header
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('mpg') && lowerLine.includes('gallons')) {
      continue;
    }

    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;

    const date = normalizeDate(fields[0]);
    if (!date) continue;

    const totalCost = parseFloat(fields[5]);
    if (isNaN(totalCost)) continue;

    const gallons = parseFloat(fields[3]);
    const pricePerGallon = parseFloat(fields[4]);
    const partialField = fields[6]?.trim();

    const event: ParsedEvent = {
      date,
      type: 'fuel',
      cost: totalCost,
      volume: isNaN(gallons) ? undefined : gallons,
      pricePerUnit: isNaN(pricePerGallon) ? undefined : pricePerGallon,
      isPartialFill: partialField === 'P',
      placeName: fields[9]?.trim() || undefined,
      notes: fields[7]?.trim() || undefined,
    };

    events.push(event);
  }

  return { events, format: 'fuelly' };
}

/**
 * Parse an AutoMate CSV export.
 * Format: Date,EventType,Odometer,OdometerUnit,Cost,Volume,VolumeUnit,PricePerUnit,DiscountPerUnit,PartialFill,Place,ServiceTypes,Category,Notes
 */
export function parseAutomateCSV(csvContent: string): ParsedImportData {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.length > 0);
  const events: ParsedEvent[] = [];

  for (const line of lines) {
    // Skip BOM and header
    const cleanLine = line.replace(/^﻿/, '');
    const lowerLine = cleanLine.toLowerCase();
    if (lowerLine.startsWith('date,eventtype') || lowerLine.startsWith('date,event')) {
      continue;
    }

    const fields = parseCSVLine(cleanLine);
    if (fields.length < 5) continue;

    const date = normalizeDate(fields[0]);
    if (!date) continue;

    const eventType = fields[1]?.trim().toLowerCase();
    if (eventType !== 'fuel' && eventType !== 'service' && eventType !== 'expense') continue;

    const cost = parseFloat(fields[4]);
    if (isNaN(cost)) continue;

    const odometer = parseFloat(fields[2]);
    const volume = parseFloat(fields[5]);
    const pricePerUnit = parseFloat(fields[7]);
    const partialFill = fields[9]?.trim();
    const placeName = fields[10]?.trim() || undefined;
    const serviceTypesStr = fields[11]?.trim() || '';
    const categoryStr = fields[12]?.trim() || undefined;
    const notes = fields[13]?.trim() || undefined;

    const event: ParsedEvent = {
      date,
      type: eventType,
      cost,
      odometer: isNaN(odometer) ? undefined : odometer,
      volume: isNaN(volume) ? undefined : volume,
      pricePerUnit: isNaN(pricePerUnit) ? undefined : pricePerUnit,
      isPartialFill: partialFill === 'Yes',
      placeName,
      notes,
    };

    if (eventType === 'service' && serviceTypesStr) {
      event.serviceTypes = serviceTypesStr.split(';').map((s) => s.trim()).filter(Boolean);
    }

    if (eventType === 'expense' && categoryStr) {
      event.category = categoryStr;
    }

    events.push(event);
  }

  return { events, format: 'automate' };
}

/**
 * Import parsed data into the database for a specific vehicle.
 * Runs in a transaction. Handles place creation, service type/category lookup,
 * and duplicate detection (same vehicleId + date + cost).
 */
export async function importData(
  data: ParsedImportData,
  vehicleId: string
): Promise<ImportResult> {
  const db = getDatabase();
  const result: ImportResult = {
    eventsImported: 0,
    eventsSkipped: 0,
    placesCreated: 0,
    errors: [],
  };

  // Pre-load existing places, service types, categories for lookup
  const existingPlaces = await placeQueries.getAll();
  const placeNameMap = new Map<string, Place>();
  for (const p of existingPlaces) {
    placeNameMap.set(p.name.toLowerCase(), p);
  }

  const existingServiceTypes = await serviceTypeQueries.getAll();
  const serviceTypeNameMap = new Map<string, ServiceType>();
  for (const st of existingServiceTypes) {
    serviceTypeNameMap.set(st.name.toLowerCase(), st);
  }

  const existingCategories = await categoryQueries.getAll();
  const categoryNameMap = new Map<string, Category>();
  for (const c of existingCategories) {
    categoryNameMap.set(c.name.toLowerCase(), c);
  }

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < data.events.length; i++) {
      const event = data.events[i];

      try {
        // Duplicate detection: same vehicleId + date + cost
        const duplicate = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM event WHERE vehicleId = ? AND date = ? AND cost = ?',
          [vehicleId, event.date, event.cost]
        );

        if (duplicate) {
          result.eventsSkipped++;
          continue;
        }

        // Resolve place
        let placeId: string | null = null;
        if (event.placeName) {
          const placeKey = event.placeName.toLowerCase();
          const existing = placeNameMap.get(placeKey);
          if (existing) {
            placeId = existing.id;
          } else {
            const placeType: Place['type'] =
              event.type === 'fuel' ? 'gas_station' :
              event.type === 'service' ? 'service_shop' : 'other';
            const newPlace = await placeQueries.insert({
              name: event.placeName,
              type: placeType,
            });
            placeNameMap.set(placeKey, newPlace);
            placeId = newPlace.id;
            result.placesCreated++;
          }
        }

        // Resolve category (for expense events)
        let categoryId: string | null = null;
        if (event.type === 'expense' && event.category) {
          const catKey = event.category.toLowerCase();
          const existing = categoryNameMap.get(catKey);
          if (existing) {
            categoryId = existing.id;
          } else {
            const newCategory = await categoryQueries.insert(event.category);
            categoryNameMap.set(catKey, newCategory);
            categoryId = newCategory.id;
          }
        }

        // Resolve service types
        const resolvedServiceTypeIds: string[] = [];
        if (event.type === 'service' && event.serviceTypes && event.serviceTypes.length > 0) {
          for (const stName of event.serviceTypes) {
            const stKey = stName.toLowerCase();
            const existing = serviceTypeNameMap.get(stKey);
            if (existing) {
              resolvedServiceTypeIds.push(existing.id);
            } else {
              const newSt = await serviceTypeQueries.insert(stName);
              serviceTypeNameMap.set(stKey, newSt);
              resolvedServiceTypeIds.push(newSt.id);
            }
          }
        }

        // Insert event
        const eventId = Crypto.randomUUID();
        const now = new Date().toISOString();

        await db.runAsync(
          `INSERT INTO event (id, vehicleId, type, date, odometer, cost, volume, pricePerUnit, discountPerUnit, isPartialFill, placeId, categoryId, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            vehicleId,
            event.type,
            event.date,
            event.odometer ?? null,
            event.cost,
            event.volume ?? null,
            event.pricePerUnit ?? null,
            null, // discountPerUnit - not available in imports
            event.isPartialFill != null ? (event.isPartialFill ? 1 : 0) : null,
            placeId,
            categoryId,
            event.notes ?? null,
            now,
            now,
          ]
        );

        // Link service types
        if (resolvedServiceTypeIds.length > 0) {
          for (const stId of resolvedServiceTypeIds) {
            await db.runAsync(
              'INSERT INTO event_service_type (eventId, serviceTypeId) VALUES (?, ?)',
              [eventId, stId]
            );
          }
        }

        result.eventsImported++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Error importing event ${i + 1}`;
        result.errors.push(msg);
      }
    }
  });

  return result;
}
