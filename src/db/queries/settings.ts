import { getDatabase } from '../client';
import type { AppSettings } from '../../types';

export async function get(): Promise<AppSettings> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    theme: (map.get('theme') ?? 'system') as AppSettings['theme'],
    currency: map.get('currency') ?? 'USD',
    defaultFuelUnit: (map.get('defaultFuelUnit') ??
      'gallons') as AppSettings['defaultFuelUnit'],
    defaultOdometerUnit: (map.get('defaultOdometerUnit') ??
      'miles') as AppSettings['defaultOdometerUnit'],
    hasCompletedOnboarding: map.get('hasCompletedOnboarding') === 'true',
  };
}

export async function set(
  key: keyof AppSettings,
  value: string
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}
