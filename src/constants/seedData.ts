// Service Types (23 items)
export const DEFAULT_SERVICE_TYPES: string[] = [
  'Oil Change', 'Oil Filter', 'Tire Rotation', 'Tire Replacement', 'Tire Alignment',
  'Tire Pressure', 'Brakes (Front)', 'Brakes (Rear)', 'Brake Fluid', 'Battery',
  'Cabin Air Filter', 'Engine Air Filter', 'Coolant', 'Transmission Fluid',
  'Power Steering Fluid', 'Spark Plugs', 'Windshield Wipers', 'Headlights',
  'Brake Lights', 'Air Conditioning', 'Radiator', 'Windshield', 'Fuel Filter',
];

// Categories (7 items)
export const DEFAULT_CATEGORIES: string[] = [
  'Registration', 'Insurance', 'Parking', 'Tolls', 'Car Wash', 'Accessories', 'Other',
];

// Default app settings
export const DEFAULT_SETTINGS = {
  theme: 'system',
  currency: 'USD',
  defaultFuelUnit: 'gallons',
  defaultOdometerUnit: 'miles',
  hasCompletedOnboarding: 'false',
} as const;
