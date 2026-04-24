import { create } from 'zustand';
import type { AppSettings } from '../types';
import * as settingsQueries from '../db/queries/settings';

interface SettingsStore {
  settings: AppSettings;
  isLoading: boolean;

  initialize(): Promise<void>;
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  currency: 'USD',
  defaultFuelUnit: 'gallons',
  defaultOdometerUnit: 'miles',
  hasCompletedOnboarding: false,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  async initialize() {
    set({ isLoading: true });
    try {
      const settings = await settingsQueries.get();
      set({ settings, isLoading: false });
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoading: false });
    }
  },

  async updateSetting(key, value) {
    const stringValue = typeof value === 'boolean' ? String(value) : String(value);
    await settingsQueries.set(key, stringValue);
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },
}));
