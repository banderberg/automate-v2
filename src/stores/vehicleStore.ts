import { create } from 'zustand';
import type { Vehicle } from '../types';
import * as vehicleQueries from '../db/queries/vehicles';
import * as vehicleDocumentQueries from '../db/queries/vehicleDocuments';
import { convertAllForVehicle } from '../db/queries/odometerConversion';
import { logError } from '../services/logger';

interface VehicleStore {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  isLoading: boolean;
  error: string | null;

  initialize(): Promise<void>;
  setActiveVehicle(id: string): Promise<void>;
  addVehicle(
    data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'isActive'>,
    makeActive?: boolean
  ): Promise<Vehicle>;
  updateVehicle(id: string, fields: Partial<Vehicle>): Promise<void>;
  deleteVehicle(id: string): Promise<void>;
  reorderVehicles(orderedIds: string[]): Promise<void>;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicles: [],
  activeVehicle: null,
  isLoading: false,
  error: null,

  async initialize() {
    set({ isLoading: true, error: null });
    try {
      const vehicles = await vehicleQueries.getAll();
      const active = vehicles.find((v) => v.isActive) ?? null;
      set({ vehicles, activeVehicle: active, isLoading: false });
    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'initialize' });
      const msg = e instanceof Error ? e.message : 'Failed to load vehicles';
      set({ error: msg, isLoading: false });
    }
  },

  async setActiveVehicle(id) {
    set({ error: null });
    try {
      await vehicleQueries.setActive(id);
      const vehicle = get().vehicles.find((v) => v.id === id);
      if (!vehicle) return;

      set((state) => ({
        vehicles: state.vehicles.map((v) => ({
          ...v,
          isActive: v.id === id,
        })),
        activeVehicle: { ...vehicle, isActive: true },
      }));
    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'setActiveVehicle', vehicleId: id });
      const msg = e instanceof Error ? e.message : 'Failed to switch vehicle';
      set({ error: msg });
    }
  },

  async addVehicle(data, makeActive) {
    set({ error: null });
    try {
      const { vehicles } = get();
      const maxSortOrder = vehicles.length > 0
        ? Math.max(...vehicles.map((v) => v.sortOrder))
        : -1;

      const isFirst = vehicles.length === 0;
      const shouldActivate = isFirst || makeActive === true;

      const vehicleData = {
        ...data,
        sortOrder: maxSortOrder + 1,
        isActive: shouldActivate,
      };

      if (shouldActivate) {
        for (const v of vehicles) {
          if (v.isActive) {
            await vehicleQueries.update(v.id, { isActive: false });
          }
        }
      }

      const vehicle = await vehicleQueries.insert(vehicleData);

      set((state) => {
        const updatedVehicles = shouldActivate
          ? state.vehicles.map((v) => ({ ...v, isActive: false }))
          : state.vehicles;
        return {
          vehicles: [...updatedVehicles, vehicle],
          activeVehicle: shouldActivate ? vehicle : state.activeVehicle,
        };
      });

      return vehicle;
    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'addVehicle' });
      const msg = e instanceof Error ? e.message : 'Failed to add vehicle';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateVehicle(id, fields) {
    set({ error: null });
    try {
      const existing = get().vehicles.find((v) => v.id === id);
      if (!existing) throw new Error('Vehicle not found');

      const odometerUnitChanged =
        fields.odometerUnit && fields.odometerUnit !== existing.odometerUnit;

      if (odometerUnitChanged) {
        await convertAllForVehicle(id, fields.odometerUnit!);
      }

      await vehicleQueries.update(id, fields);
      const updated = await vehicleQueries.getById(id);
      if (!updated) return;

      set((state) => ({
        vehicles: state.vehicles.map((v) => (v.id === id ? updated : v)),
        activeVehicle: state.activeVehicle?.id === id ? updated : state.activeVehicle,
      }));

    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'updateVehicle', vehicleId: id });
      const msg = e instanceof Error ? e.message : 'Failed to update vehicle';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteVehicle(id) {
    set({ error: null });
    try {
      const { vehicles, activeVehicle } = get();

      if (vehicles.length <= 1 && activeVehicle?.id === id) {
        throw new Error('Cannot delete the only vehicle. Add another vehicle first.');
      }

      await vehicleDocumentQueries.removeAllForVehicle(id);
      await vehicleQueries.remove(id);

      const remaining = vehicles.filter((v) => v.id !== id);
      let newActive = activeVehicle;

      if (activeVehicle?.id === id && remaining.length > 0) {
        const nextActive = remaining[0];
        await vehicleQueries.setActive(nextActive.id);
        newActive = { ...nextActive, isActive: true };
        remaining[0] = newActive;
      } else if (activeVehicle?.id === id) {
        newActive = null;
      }

      set({
        vehicles: remaining,
        activeVehicle: newActive,
      });
    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'deleteVehicle', vehicleId: id });
      const msg = e instanceof Error ? e.message : 'Failed to delete vehicle';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async reorderVehicles(orderedIds) {
    set({ error: null });
    try {
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      await vehicleQueries.updateSortOrder(updates);

      set((state) => {
        const vehicleMap = new Map(state.vehicles.map((v) => [v.id, v]));
        const reordered = orderedIds
          .map((id, index) => {
            const v = vehicleMap.get(id);
            return v ? { ...v, sortOrder: index } : null;
          })
          .filter((v): v is Vehicle => v !== null);
        return { vehicles: reordered };
      });
    } catch (e) {
      logError(e, { store: 'vehicleStore', action: 'reorderVehicles' });
      const msg = e instanceof Error ? e.message : 'Failed to reorder vehicles';
      set({ error: msg });
      throw new Error(msg);
    }
  },
}));
