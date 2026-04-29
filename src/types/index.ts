export interface Vehicle {
  id: string;                    // UUID
  sortOrder: number;
  nickname: string;              // required, max 30 chars
  make: string;                  // required
  model: string;                 // required
  year: number;                  // required, 1900–current year + 1
  trim?: string;
  vin?: string;                  // 17 chars if provided
  fuelType: 'gas' | 'diesel' | 'electric';
  odometerUnit: 'miles' | 'kilometers';
  volumeUnit: 'gallons' | 'litres' | 'kWh';
  fuelCapacity?: number;
  imagePath?: string;            // local file path
  isActive: boolean;
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

export interface VehicleEvent {
  id: string;
  vehicleId: string;             // FK → Vehicle
  type: 'fuel' | 'service' | 'expense';
  date: string;                  // ISO 8601 (YYYY-MM-DD)
  odometer?: number;             // required for fuel + service, optional for expense
  cost: number;                  // total cost

  // Fuel-specific (null for other types)
  volume?: number;
  pricePerUnit?: number;
  discountPerUnit?: number;
  isPartialFill?: boolean;

  placeId?: string;              // FK → Place
  categoryId?: string;           // FK → Category (expense only)
  notes?: string;                // max 500 chars

  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface EventServiceType {
  eventId: string;
  serviceTypeId: string;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  type: 'gas_station' | 'service_shop' | 'other';
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  vehicleId: string;
  serviceTypeId?: string;        // FK → ServiceType
  categoryId?: string;           // FK → Category
  // Exactly one of serviceTypeId or categoryId must be set

  distanceInterval?: number;
  timeInterval?: number;
  timeUnit?: 'days' | 'weeks' | 'months' | 'years';
  // At least one of distance or time must be configured

  baselineOdometer?: number;
  baselineDate?: string;

  notificationId?: string;       // expo-notifications identifier

  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  currency: string;              // ISO 4217
  defaultFuelUnit: 'gallons' | 'litres';
  defaultOdometerUnit: 'miles' | 'kilometers';
  hasCompletedOnboarding: boolean;
}

export interface ReminderWithStatus extends Reminder {
  nextDate: string | null;
  nextOdometer: number | null;
  distanceRemaining: number | null;
  daysRemaining: number | null;
  status: 'upcoming' | 'soon' | 'overdue';
  linkedName: string;
}

export interface EventPhoto {
  id: string;
  eventId: string;
  filePath: string;
  sortOrder: number;
  createdAt: string;
}

export interface LocalPhoto {
  id?: string;        // undefined for unsaved photos
  uri: string;        // local file URI
  isNew?: boolean;    // true for newly added, not yet persisted
}

export type VehicleDocumentType = 'insurance' | 'registration' | 'title' | 'emissions' | 'inspection' | 'other';

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  name: string;
  type: VehicleDocumentType;
  filePath: string;
  expirationDate?: string;
  notificationId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
