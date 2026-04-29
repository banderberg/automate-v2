import { create } from 'zustand';
import type { ServiceType, Category, Place } from '../types';
import { serviceTypeQueries, categoryQueries } from '../db/queries/namedEntities';
import * as placeQueries from '../db/queries/places';

interface ReferenceDataStore {
  serviceTypes: ServiceType[];
  categories: Category[];
  places: Place[];
  isLoading: boolean;
  error: string | null;

  initialize(): Promise<void>;

  addServiceType(name: string): Promise<ServiceType>;
  updateServiceType(id: string, name: string): Promise<void>;
  deleteServiceType(id: string): Promise<void>;

  addCategory(name: string): Promise<Category>;
  updateCategory(id: string, name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  addPlace(data: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>): Promise<Place>;
  updatePlace(id: string, fields: Partial<Place>): Promise<void>;
  deletePlace(id: string): Promise<void>;
}

export const useReferenceDataStore = create<ReferenceDataStore>((set, get) => ({
  serviceTypes: [],
  categories: [],
  places: [],
  isLoading: false,
  error: null,

  async initialize() {
    set({ isLoading: true, error: null });
    try {
      const [serviceTypes, categories, places] = await Promise.all([
        serviceTypeQueries.getAll(),
        categoryQueries.getAll(),
        placeQueries.getAll(),
      ]);
      set({ serviceTypes, categories, places, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load reference data';
      set({ error: msg, isLoading: false });
    }
  },

  async addServiceType(name) {
    set({ error: null });
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name cannot be empty');
      const exists = get().serviceTypes.some(
        (st) => st.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) throw new Error(`"${trimmed}" already exists`);
      const serviceType = await serviceTypeQueries.insert(trimmed);
      set((state) => ({ serviceTypes: [...state.serviceTypes, serviceType] }));
      return serviceType;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add service type';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateServiceType(id, name) {
    set({ error: null });
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name cannot be empty');
      const exists = get().serviceTypes.some(
        (st) => st.id !== id && st.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) throw new Error(`"${trimmed}" already exists`);
      await serviceTypeQueries.update(id, trimmed);
      set((state) => ({
        serviceTypes: state.serviceTypes.map((st) =>
          st.id === id ? { ...st, name: trimmed } : st
        ),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update service type';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteServiceType(id) {
    set({ error: null });
    try {
      await serviceTypeQueries.remove(id);
      set((state) => ({
        serviceTypes: state.serviceTypes.filter((st) => st.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete service type';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async addCategory(name) {
    set({ error: null });
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name cannot be empty');
      const exists = get().categories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) throw new Error(`"${trimmed}" already exists`);
      const category = await categoryQueries.insert(trimmed);
      set((state) => ({ categories: [...state.categories, category] }));
      return category;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add category';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateCategory(id, name) {
    set({ error: null });
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name cannot be empty');
      const exists = get().categories.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) throw new Error(`"${trimmed}" already exists`);
      await categoryQueries.update(id, trimmed);
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? { ...c, name: trimmed } : c
        ),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update category';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteCategory(id) {
    set({ error: null });
    try {
      await categoryQueries.remove(id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete category';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async addPlace(data) {
    set({ error: null });
    try {
      const trimmedName = data.name.trim();
      if (!trimmedName) throw new Error('Name cannot be empty');
      const exists = get().places.some(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (exists) throw new Error(`"${trimmedName}" already exists`);
      const place = await placeQueries.insert({ ...data, name: trimmedName });
      set((state) => ({
        places: [...state.places, place].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return place;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add place';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updatePlace(id, fields) {
    set({ error: null });
    try {
      const updatedFields = { ...fields };
      if (updatedFields.name !== undefined) {
        const trimmedName = updatedFields.name.trim();
        if (!trimmedName) throw new Error('Name cannot be empty');
        const exists = get().places.some(
          (p) => p.id !== id && p.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (exists) throw new Error(`"${trimmedName}" already exists`);
        updatedFields.name = trimmedName;
      }
      await placeQueries.update(id, updatedFields);
      set((state) => ({
        places: state.places
          .map((p) => (p.id === id ? { ...p, ...updatedFields } : p))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update place';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deletePlace(id) {
    set({ error: null });
    try {
      await placeQueries.remove(id);
      set((state) => ({
        places: state.places.filter((p) => p.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete place';
      set({ error: msg });
      throw new Error(msg);
    }
  },
}));
