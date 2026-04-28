import * as Crypto from 'expo-crypto';
import { getDatabase } from './client';

function uuid(): string {
  return Crypto.randomUUID();
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function gasPrice(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  const seasonal = [3.15, 3.2, 3.35, 3.45, 3.55, 3.7, 3.75, 3.7, 3.55, 3.4, 3.25, 3.15];
  let base = seasonal[month];
  if (year >= 2025) base += 0.15;
  if (year >= 2026) base += 0.1;
  return Math.round((base + rand(-0.2, 0.2)) * 1000) / 1000;
}

export async function loadTestData(): Promise<{ vehicles: number; events: number; reminders: number }> {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.execAsync('DELETE FROM event_service_type;');
  await db.execAsync('DELETE FROM event_photo;');
  await db.execAsync('DELETE FROM reminder;');
  await db.execAsync('DELETE FROM event;');
  await db.execAsync('DELETE FROM vehicle;');
  await db.execAsync('DELETE FROM place;');

  const stRows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM service_type');
  const stMap = new Map(stRows.map((r) => [r.name, r.id]));

  const catRows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM category');
  const catMap = new Map(catRows.map((r) => [r.name, r.id]));

  let eventCount = 0;

  // --- Places ---
  const placeData = [
    { id: uuid(), name: 'Shell', type: 'gas_station', address: '1200 Main St' },
    { id: uuid(), name: 'Costco Gas', type: 'gas_station', address: '800 Commerce Blvd' },
    { id: uuid(), name: 'Chevron', type: 'gas_station', address: '450 Oak Ave' },
    { id: uuid(), name: 'BP', type: 'gas_station', address: '3300 Highway 9' },
    { id: uuid(), name: 'Toyota Service Center', type: 'service_shop', address: '2100 Auto Row Dr' },
    { id: uuid(), name: 'Jiffy Lube', type: 'service_shop', address: '560 Industrial Pkwy' },
    { id: uuid(), name: 'Discount Tire', type: 'service_shop', address: '780 Tire Blvd' },
    { id: uuid(), name: 'Honda of Springfield', type: 'service_shop', address: '1500 Dealer Row' },
  ];

  for (const p of placeData) {
    await db.runAsync(
      'INSERT INTO place (id, name, type, address, latitude, longitude, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.type, p.address, null, null, now, now],
    );
  }

  const gasStations = placeData.filter((p) => p.type === 'gas_station');
  const placeByName = new Map(placeData.map((p) => [p.name, p]));

  // --- Vehicles ---
  const tacomaId = uuid();
  const civicId = uuid();

  await db.runAsync(
    'INSERT INTO vehicle (id, sortOrder, nickname, make, model, year, trim, vin, fuelType, odometerUnit, volumeUnit, fuelCapacity, imagePath, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [tacomaId, 0, 'Big Red', 'Toyota', 'Tacoma', 2022, 'TRD Off-Road', null, 'gas', 'miles', 'gallons', 21.1, null, 1, now, now],
  );
  await db.runAsync(
    'INSERT INTO vehicle (id, sortOrder, nickname, make, model, year, trim, vin, fuelType, odometerUnit, volumeUnit, fuelCapacity, imagePath, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [civicId, 1, 'City Runner', 'Honda', 'Civic', 2019, 'EX', null, 'gas', 'miles', 'gallons', 12.4, null, 0, now, now],
  );

  // --- Helper: insert event ---
  async function insertEvent(
    vehicleId: string,
    type: string,
    date: string,
    odometer: number | null,
    cost: number,
    extra: {
      volume?: number;
      pricePerUnit?: number;
      isPartialFill?: boolean;
      placeId?: string;
      categoryId?: string;
      notes?: string;
    } = {},
  ): Promise<string> {
    const eid = uuid();
    await db.runAsync(
      'INSERT INTO event (id, vehicleId, type, date, odometer, cost, volume, pricePerUnit, discountPerUnit, isPartialFill, placeId, categoryId, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        eid, vehicleId, type, date, odometer, cost,
        extra.volume ?? null, extra.pricePerUnit ?? null, null,
        extra.isPartialFill ? 1 : 0,
        extra.placeId ?? null, extra.categoryId ?? null, extra.notes ?? null,
        now, now,
      ],
    );
    eventCount++;
    return eid;
  }

  // --- Fuel events ---
  const startDate = new Date('2024-04-15');
  const endDate = new Date('2026-04-25');

  // Tacoma: ~18 MPG, starting at 24,500 mi
  let tacomaOdo = 24500;
  let d = new Date(startDate);
  while (d < endDate) {
    const miles = randInt(250, 380);
    tacomaOdo += miles;
    const mpg = rand(16.5, 19.5);
    const volume = Math.round((miles / mpg) * 100) / 100;
    const price = gasPrice(d);
    const cost = Math.round(volume * price * 100) / 100;
    await insertEvent(tacomaId, 'fuel', dateStr(d), tacomaOdo, cost, {
      volume, pricePerUnit: price, placeId: pick(gasStations).id,
    });
    d = addDays(d, randInt(7, 14));
  }

  // Civic: ~32 MPG, starting at 42,000 mi
  let civicOdo = 42000;
  d = new Date(startDate);
  while (d < endDate) {
    const miles = randInt(300, 420);
    civicOdo += miles;
    const mpg = rand(30, 35);
    const volume = Math.round((miles / mpg) * 100) / 100;
    const price = gasPrice(d);
    const cost = Math.round(volume * price * 100) / 100;
    await insertEvent(civicId, 'fuel', dateStr(d), civicOdo, cost, {
      volume, pricePerUnit: price, placeId: pick(gasStations).id,
    });
    d = addDays(d, randInt(10, 18));
  }

  // --- Service events ---
  async function insertService(
    vehicleId: string, date: string, odometer: number,
    cost: number, placeName: string, typeNames: string[], notes?: string,
  ): Promise<void> {
    const placeId = placeByName.get(placeName)?.id;
    const eid = await insertEvent(vehicleId, 'service', date, odometer, cost, { placeId, notes });
    for (const name of typeNames) {
      const stId = stMap.get(name);
      if (stId) {
        await db.runAsync('INSERT INTO event_service_type (eventId, serviceTypeId) VALUES (?, ?)', [eid, stId]);
      }
    }
  }

  // Tacoma services
  await insertService(tacomaId, '2024-08-10', 29500, 89, 'Toyota Service Center', ['Oil Change', 'Oil Filter'], 'Synthetic 0W-20');
  await insertService(tacomaId, '2024-10-05', 32000, 45, 'Discount Tire', ['Tire Rotation', 'Tire Pressure']);
  await insertService(tacomaId, '2024-12-15', 34500, 92, 'Jiffy Lube', ['Oil Change', 'Oil Filter']);
  await insertService(tacomaId, '2025-02-20', 37000, 28, 'Toyota Service Center', ['Cabin Air Filter']);
  await insertService(tacomaId, '2025-04-12', 39500, 95, 'Toyota Service Center', ['Oil Change', 'Oil Filter', 'Engine Air Filter']);
  await insertService(tacomaId, '2025-04-25', 40000, 48, 'Discount Tire', ['Tire Rotation']);
  await insertService(tacomaId, '2025-06-14', 42000, 385, 'Toyota Service Center', ['Brakes (Front)'], 'Front pads and rotors');
  await insertService(tacomaId, '2025-08-20', 44500, 88, 'Jiffy Lube', ['Oil Change', 'Oil Filter']);
  await insertService(tacomaId, '2025-10-10', 47000, 52, 'Discount Tire', ['Tire Rotation', 'Tire Pressure']);
  await insertService(tacomaId, '2025-12-05', 49500, 98, 'Toyota Service Center', ['Oil Change', 'Oil Filter']);
  await insertService(tacomaId, '2026-01-15', 50500, 195, 'Toyota Service Center', ['Battery'], 'Interstate battery');
  await insertService(tacomaId, '2026-02-28', 52000, 25, 'Jiffy Lube', ['Windshield Wipers']);
  await insertService(tacomaId, '2026-04-10', 54000, 92, 'Toyota Service Center', ['Oil Change', 'Oil Filter']);

  // Civic services
  await insertService(civicId, '2024-08-22', 47000, 62, 'Honda of Springfield', ['Oil Change', 'Oil Filter'], 'Synthetic blend');
  await insertService(civicId, '2024-10-30', 49500, 38, 'Discount Tire', ['Tire Rotation']);
  await insertService(civicId, '2025-01-18', 52000, 68, 'Honda of Springfield', ['Oil Change', 'Oil Filter']);
  await insertService(civicId, '2025-04-05', 54500, 620, 'Discount Tire', ['Tire Replacement', 'Tire Alignment'], 'Michelin Defender 2, all 4 tires');
  await insertService(civicId, '2025-06-28', 57000, 65, 'Jiffy Lube', ['Oil Change', 'Oil Filter', 'Engine Air Filter']);
  await insertService(civicId, '2025-09-12', 59000, 42, 'Discount Tire', ['Tire Rotation']);
  await insertService(civicId, '2025-11-20', 62000, 70, 'Honda of Springfield', ['Oil Change', 'Oil Filter']);
  await insertService(civicId, '2026-02-10', 64000, 165, 'Honda of Springfield', ['Spark Plugs'], 'NGK Iridium plugs');
  await insertService(civicId, '2026-04-15', 66000, 72, 'Honda of Springfield', ['Oil Change', 'Oil Filter', 'Cabin Air Filter']);

  // --- Expense events ---
  async function insertExpense(
    vehicleId: string, date: string, cost: number, catName: string, notes?: string,
  ): Promise<void> {
    await insertEvent(vehicleId, 'expense', date, null, cost, {
      categoryId: catMap.get(catName) ?? undefined, notes,
    });
  }

  // Registration
  await insertExpense(tacomaId, '2024-06-15', 225, 'Registration', 'Annual registration renewal');
  await insertExpense(tacomaId, '2025-06-12', 235, 'Registration', 'Annual registration renewal');
  await insertExpense(civicId, '2024-09-20', 185, 'Registration', 'Annual registration renewal');
  await insertExpense(civicId, '2025-09-18', 192, 'Registration', 'Annual registration renewal');

  // Insurance
  await insertExpense(tacomaId, '2024-05-01', 520, 'Insurance', '6-month premium');
  await insertExpense(tacomaId, '2024-11-01', 535, 'Insurance', '6-month premium');
  await insertExpense(tacomaId, '2025-05-01', 548, 'Insurance', '6-month premium');
  await insertExpense(tacomaId, '2025-11-01', 555, 'Insurance', '6-month premium');
  await insertExpense(civicId, '2024-07-01', 420, 'Insurance', '6-month premium');
  await insertExpense(civicId, '2025-01-01', 435, 'Insurance', '6-month premium');
  await insertExpense(civicId, '2025-07-01', 440, 'Insurance', '6-month premium');
  await insertExpense(civicId, '2026-01-01', 450, 'Insurance', '6-month premium');

  // Car washes
  const washes: Array<[string, string, number]> = [
    [tacomaId, '2024-05-18', 22], [civicId, '2024-05-25', 18],
    [tacomaId, '2024-06-22', 22], [civicId, '2024-07-13', 18],
    [tacomaId, '2024-07-27', 25], [civicId, '2024-08-17', 18],
    [tacomaId, '2024-09-07', 22], [civicId, '2024-09-28', 15],
    [tacomaId, '2024-10-19', 22], [tacomaId, '2024-11-23', 25],
    [civicId, '2024-12-07', 18], [tacomaId, '2025-01-11', 22],
    [civicId, '2025-02-01', 18], [tacomaId, '2025-02-22', 22],
    [civicId, '2025-03-15', 18], [tacomaId, '2025-04-05', 25],
    [civicId, '2025-04-26', 15], [tacomaId, '2025-05-17', 22],
    [civicId, '2025-06-07', 18], [tacomaId, '2025-07-12', 25],
    [civicId, '2025-08-02', 18], [tacomaId, '2025-08-23', 22],
    [civicId, '2025-09-13', 18], [tacomaId, '2025-10-04', 22],
    [civicId, '2025-11-01', 15], [tacomaId, '2025-11-22', 25],
    [civicId, '2025-12-13', 18], [tacomaId, '2026-01-10', 22],
    [civicId, '2026-02-07', 18], [tacomaId, '2026-03-07', 22],
    [civicId, '2026-03-28', 18], [tacomaId, '2026-04-18', 25],
  ];
  for (const [vid, date, cost] of washes) {
    await insertExpense(vid, date, cost, 'Car Wash');
  }

  // Parking
  await insertExpense(civicId, '2024-06-08', 15, 'Parking');
  await insertExpense(civicId, '2024-08-14', 25, 'Parking');
  await insertExpense(tacomaId, '2024-09-21', 20, 'Parking');
  await insertExpense(civicId, '2024-11-29', 30, 'Parking', 'Airport parking 3 days');
  await insertExpense(civicId, '2025-02-14', 18, 'Parking');
  await insertExpense(tacomaId, '2025-05-10', 12, 'Parking');
  await insertExpense(civicId, '2025-07-04', 25, 'Parking');
  await insertExpense(tacomaId, '2025-09-15', 15, 'Parking');
  await insertExpense(civicId, '2025-12-20', 35, 'Parking', 'Airport parking 4 days');
  await insertExpense(tacomaId, '2026-01-25', 12, 'Parking');
  await insertExpense(civicId, '2026-03-15', 18, 'Parking');

  // Tolls
  await insertExpense(civicId, '2024-05-15', 8.5, 'Tolls');
  await insertExpense(tacomaId, '2024-07-20', 12, 'Tolls');
  await insertExpense(civicId, '2024-09-05', 6.75, 'Tolls');
  await insertExpense(tacomaId, '2024-12-22', 15.5, 'Tolls', 'Holiday road trip');
  await insertExpense(civicId, '2025-03-08', 8.5, 'Tolls');
  await insertExpense(tacomaId, '2025-06-30', 12, 'Tolls');
  await insertExpense(civicId, '2025-08-18', 6.75, 'Tolls');
  await insertExpense(tacomaId, '2025-11-27', 15.5, 'Tolls', 'Thanksgiving trip');
  await insertExpense(civicId, '2026-02-20', 8.5, 'Tolls');

  // Accessories
  await insertExpense(tacomaId, '2024-07-04', 85, 'Accessories', 'WeatherTech floor mats');
  await insertExpense(tacomaId, '2025-03-15', 45, 'Accessories', 'Phone mount');
  await insertExpense(civicId, '2024-10-12', 35, 'Accessories', 'Trunk organizer');
  await insertExpense(civicId, '2025-08-05', 55, 'Accessories', 'Sunshade');

  // --- Reminders ---
  async function insertReminder(
    vehicleId: string,
    serviceTypeName: string | null,
    categoryName: string | null,
    distanceInterval: number | null,
    timeInterval: number | null,
    timeUnit: string | null,
    baselineOdometer: number | null,
    baselineDate: string | null,
  ): Promise<void> {
    await db.runAsync(
      'INSERT INTO reminder (id, vehicleId, serviceTypeId, categoryId, distanceInterval, timeInterval, timeUnit, baselineOdometer, baselineDate, notificationId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        uuid(), vehicleId,
        serviceTypeName ? stMap.get(serviceTypeName) ?? null : null,
        categoryName ? catMap.get(categoryName) ?? null : null,
        distanceInterval, timeInterval, timeUnit,
        baselineOdometer, baselineDate, null, now, now,
      ],
    );
  }

  // Tacoma reminders
  await insertReminder(tacomaId, 'Oil Change', null, 5000, 6, 'months', 54000, '2026-04-10');
  await insertReminder(tacomaId, 'Tire Rotation', null, 7500, null, null, 47000, '2025-10-10');
  await insertReminder(tacomaId, null, 'Registration', null, 1, 'years', null, '2025-06-12');

  // Civic reminders
  await insertReminder(civicId, 'Oil Change', null, 5000, 6, 'months', 66000, '2026-04-15');
  await insertReminder(civicId, null, 'Insurance', null, 6, 'months', null, '2026-01-01');

  // Mark onboarding complete
  await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['hasCompletedOnboarding', 'true']);

  return { vehicles: 2, events: eventCount, reminders: 5 };
}
