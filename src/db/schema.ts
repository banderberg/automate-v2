export const CREATE_META_TABLE = `
  CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const CREATE_VEHICLE_TABLE = `
  CREATE TABLE IF NOT EXISTS vehicle (
    id TEXT PRIMARY KEY,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    nickname TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    trim TEXT,
    vin TEXT,
    fuelType TEXT NOT NULL DEFAULT 'gas',
    odometerUnit TEXT NOT NULL DEFAULT 'miles',
    volumeUnit TEXT NOT NULL DEFAULT 'gallons',
    fuelCapacity REAL,
    imagePath TEXT,
    isActive INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export const CREATE_EVENT_TABLE = `
  CREATE TABLE IF NOT EXISTS event (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    odometer REAL,
    cost REAL NOT NULL DEFAULT 0,
    volume REAL,
    pricePerUnit REAL,
    discountPerUnit REAL,
    isPartialFill INTEGER DEFAULT 0,
    placeId TEXT,
    categoryId TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (vehicleId) REFERENCES vehicle(id) ON DELETE CASCADE,
    FOREIGN KEY (placeId) REFERENCES place(id) ON DELETE SET NULL,
    FOREIGN KEY (categoryId) REFERENCES category(id) ON DELETE SET NULL
  );
`;

export const CREATE_SERVICE_TYPE_TABLE = `
  CREATE TABLE IF NOT EXISTS service_type (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
`;

export const CREATE_EVENT_SERVICE_TYPE_TABLE = `
  CREATE TABLE IF NOT EXISTS event_service_type (
    eventId TEXT NOT NULL,
    serviceTypeId TEXT NOT NULL,
    PRIMARY KEY (eventId, serviceTypeId),
    FOREIGN KEY (eventId) REFERENCES event(id) ON DELETE CASCADE,
    FOREIGN KEY (serviceTypeId) REFERENCES service_type(id) ON DELETE CASCADE
  );
`;

export const CREATE_CATEGORY_TABLE = `
  CREATE TABLE IF NOT EXISTS category (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
`;

export const CREATE_PLACE_TABLE = `
  CREATE TABLE IF NOT EXISTS place (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    address TEXT,
    latitude REAL,
    longitude REAL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export const CREATE_REMINDER_TABLE = `
  CREATE TABLE IF NOT EXISTS reminder (
    id TEXT PRIMARY KEY,
    vehicleId TEXT NOT NULL,
    serviceTypeId TEXT,
    categoryId TEXT,
    distanceInterval REAL,
    timeInterval INTEGER,
    timeUnit TEXT,
    baselineOdometer REAL,
    baselineDate TEXT,
    notificationId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (vehicleId) REFERENCES vehicle(id) ON DELETE CASCADE,
    FOREIGN KEY (serviceTypeId) REFERENCES service_type(id) ON DELETE SET NULL,
    FOREIGN KEY (categoryId) REFERENCES category(id) ON DELETE SET NULL
  );
`;

export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const CREATE_INSIGHT_IMPRESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS insight_impressions (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    shown_at TEXT NOT NULL,
    dismissed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export const CREATE_INSIGHT_IMPRESSIONS_INDEX =
  'CREATE INDEX IF NOT EXISTS idx_insight_impressions_vehicle_type ON insight_impressions(vehicle_id, insight_type);';

export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_event_vehicle_date ON event(vehicleId, date);',
  'CREATE INDEX IF NOT EXISTS idx_event_vehicle_odometer ON event(vehicleId, odometer);',
  'CREATE INDEX IF NOT EXISTS idx_reminder_vehicle ON reminder(vehicleId);',
  'CREATE INDEX IF NOT EXISTS idx_place_type ON place(type);',
];

export const ALL_CREATE_TABLES = [
  CREATE_META_TABLE,
  CREATE_VEHICLE_TABLE,
  CREATE_PLACE_TABLE,
  CREATE_CATEGORY_TABLE,
  CREATE_SERVICE_TYPE_TABLE,
  CREATE_EVENT_TABLE,
  CREATE_EVENT_SERVICE_TYPE_TABLE,
  CREATE_REMINDER_TABLE,
  CREATE_SETTINGS_TABLE,
];
