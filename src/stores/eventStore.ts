import { create } from 'zustand';
import type { VehicleEvent } from '../types';
import * as eventQueries from '../db/queries/events';
import * as eventServiceTypeQueries from '../db/queries/eventServiceTypes';
import * as eventPhotoQueries from '../db/queries/eventPhotos';
import { estimateOdometer } from '../services/odometerEstimator';

interface PendingDelete {
  event: VehicleEvent;
  serviceTypeIds: string[];
  timer: ReturnType<typeof setTimeout>;
}

interface EventStore {
  events: VehicleEvent[];
  serviceLabels: Map<string, string>;
  isLoading: boolean;
  error: string | null;
  pendingDelete: PendingDelete | null;

  loadForVehicle(vehicleId: string): Promise<void>;
  addEvent(
    data: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'>,
    serviceTypeIds?: string[],
    photoUris?: string[]
  ): Promise<VehicleEvent>;
  updateEvent(
    id: string,
    fields: Partial<VehicleEvent>,
    serviceTypeIds?: string[],
    photoUris?: string[]
  ): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  undoDelete(): Promise<void>;
  getSmartDefaults(
    type: VehicleEvent['type'],
    vehicleId: string
  ): Promise<Partial<VehicleEvent>>;

  clearEvents(): void;
  fuelEvents(): VehicleEvent[];
  serviceEvents(): VehicleEvent[];
  expenseEvents(): VehicleEvent[];
}

function insertSorted(events: VehicleEvent[], event: VehicleEvent): VehicleEvent[] {
  const result = [...events, event];
  result.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return result;
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  serviceLabels: new Map(),
  isLoading: false,
  error: null,
  pendingDelete: null,

  fuelEvents() {
    return get().events.filter((e) => e.type === 'fuel');
  },

  serviceEvents() {
    return get().events.filter((e) => e.type === 'service');
  },

  expenseEvents() {
    return get().events.filter((e) => e.type === 'expense');
  },

  clearEvents() {
    set({ events: [], serviceLabels: new Map(), error: null, pendingDelete: null });
  },

  async loadForVehicle(vehicleId) {
    set({ isLoading: true, error: null });
    try {
      const [events, serviceLabels] = await Promise.all([
        eventQueries.getByVehicle(vehicleId),
        eventServiceTypeQueries.getLabelsByVehicle(vehicleId),
      ]);
      set({ events, serviceLabels, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load events';
      set({ error: msg, isLoading: false });
    }
  },

  async addEvent(data, serviceTypeIds, photoUris) {
    set({ error: null });
    try {
      const event = await eventQueries.insert(data);

      if (data.type === 'service' && serviceTypeIds && serviceTypeIds.length > 0) {
        await eventServiceTypeQueries.setForEvent(event.id, serviceTypeIds);
      }

      if (photoUris && photoUris.length > 0) {
        for (let i = 0; i < photoUris.length; i++) {
          await eventPhotoQueries.insert(event.id, photoUris[i], i);
        }
      }

      let serviceLabel: string | undefined;
      if (data.type === 'service' && serviceTypeIds && serviceTypeIds.length > 0) {
        const types = await eventServiceTypeQueries.getByEvent(event.id);
        serviceLabel = types.map((t) => t.name).join(', ') || undefined;
      }

      set((state) => {
        const serviceLabels = new Map(state.serviceLabels);
        if (serviceLabel) serviceLabels.set(event.id, serviceLabel);
        return { events: insertSorted(state.events, event), serviceLabels };
      });

      return event;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add event';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateEvent(id, fields, serviceTypeIds, photoUris) {
    set({ error: null });
    try {
      await eventQueries.update(id, fields);

      if (serviceTypeIds) {
        await eventServiceTypeQueries.setForEvent(id, serviceTypeIds);
      }

      if (photoUris !== undefined) {
        // Get existing photos to diff
        const existingPhotos = await eventPhotoQueries.getByEvent(id);
        const existingUris = new Set(existingPhotos.map((p) => p.filePath));
        const newUris = new Set(photoUris);

        // Remove photos that are no longer in the list
        for (const photo of existingPhotos) {
          if (!newUris.has(photo.filePath)) {
            await eventPhotoQueries.remove(photo.id);
          }
        }

        // Add new photos (those not already in the DB)
        let sortOrder = 0;
        for (const uri of photoUris) {
          if (!existingUris.has(uri)) {
            await eventPhotoQueries.insert(id, uri, sortOrder);
          }
          sortOrder++;
        }
      }

      const updatedEvent = await eventQueries.getById(id);
      if (!updatedEvent) return;

      let updatedLabel: string | undefined;
      if (serviceTypeIds) {
        if (serviceTypeIds.length > 0) {
          const types = await eventServiceTypeQueries.getByEvent(id);
          updatedLabel = types.map((t) => t.name).join(', ') || undefined;
        }
      }

      set((state) => {
        const events = state.events.map((e) => (e.id === id ? updatedEvent : e));
        events.sort((a, b) => {
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b.createdAt.localeCompare(a.createdAt);
        });
        if (serviceTypeIds === undefined) return { events };
        const serviceLabels = new Map(state.serviceLabels);
        if (updatedLabel) {
          serviceLabels.set(id, updatedLabel);
        } else {
          serviceLabels.delete(id);
        }
        return { events, serviceLabels };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update event';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteEvent(id) {
    const { pendingDelete, events } = get();

    // Finalize any pending delete immediately
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      try {
        await eventPhotoQueries.removeAllForEvent(pendingDelete.event.id);
        await eventQueries.remove(pendingDelete.event.id);
      } catch {
        // Best-effort finalization
      }
    }

    const eventToDelete = events.find((e) => e.id === id);
    if (!eventToDelete) return;

    // Get service type IDs before removing from state
    let serviceTypeIds: string[] = [];
    if (eventToDelete.type === 'service') {
      try {
        const serviceTypes = await eventServiceTypeQueries.getByEvent(id);
        serviceTypeIds = serviceTypes.map((st) => st.id);
      } catch {
        // Best effort
      }
    }

    // Remove from state immediately (optimistic)
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }));

    // Set up deferred DB delete
    const timer = setTimeout(async () => {
      try {
        // Clean up photo files before DB delete (CASCADE handles DB rows)
        await eventPhotoQueries.removeAllForEvent(id);
        await eventQueries.remove(id);
      } catch {
        // Event already removed from UI
      }
      set({ pendingDelete: null });
    }, 5000);

    set({
      pendingDelete: { event: eventToDelete, serviceTypeIds, timer },
    });
  },

  async undoDelete() {
    const { pendingDelete } = get();
    if (!pendingDelete) return;

    clearTimeout(pendingDelete.timer);
    const { event, serviceTypeIds } = pendingDelete;

    set((state) => ({
      events: insertSorted(state.events, event),
      pendingDelete: null,
    }));
  },

  async getSmartDefaults(type, vehicleId) {
    const today = new Date().toISOString().split('T')[0];
    const defaults: Partial<VehicleEvent> = {
      vehicleId,
      type,
      date: today,
    };

    try {
      if (type === 'fuel') {
        const recentFuel = await eventQueries.getRecentFuelEvents(vehicleId, 1);
        if (recentFuel.length > 0) {
          const last = recentFuel[0];
          defaults.pricePerUnit = last.pricePerUnit;
          defaults.discountPerUnit = last.discountPerUnit;
          defaults.placeId = last.placeId;
        }
      }

      if (type === 'fuel' || type === 'service') {
        const eventsWithOdo = await eventQueries.getEventsWithOdometer(vehicleId, 10);
        const estimated = estimateOdometer(eventsWithOdo, today);
        if (estimated != null) {
          defaults.odometer = estimated;
        }
      }
    } catch {
      // Defaults are best-effort
    }

    return defaults;
  },
}));
