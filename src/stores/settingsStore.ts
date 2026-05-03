import { create } from 'zustand';
import type { AppSettings } from '../types';
import * as settingsQueries from '../db/queries/settings';
import { logError } from '../services/logger';

interface SettingsStore {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;

  initialize(): Promise<void>;
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  currency: 'USD',
  defaultFuelUnit: 'gallons',
  defaultOdometerUnit: 'miles',
  hasCompletedOnboarding: false,
  totalEventsLogged: 0,
  lastReviewPromptDate: '',
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,

  async initialize() {
    set({ isLoading: true, error: null });
    try {
      const settings = await settingsQueries.get();
      set({ settings, isLoading: false });
    } catch (e) {
      logError(e, { store: 'settingsStore', action: 'initialize' });
      const msg = e instanceof Error ? e.message : 'Failed to load settings';
      set({ error: msg, isLoading: false });
    }
  },

  async updateSetting(key, value) {
    set({ error: null });
    try {
      const stringValue = typeof value === 'boolean' ? String(value) : String(value);
      await settingsQueries.set(key, stringValue);
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch (e) {
      logError(e, { store: 'settingsStore', action: 'updateSetting', key });
      const msg = e instanceof Error ? e.message : 'Failed to update setting';
      set({ error: msg });
    }
  },
}));
