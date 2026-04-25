import { create } from 'zustand';
import type { Reminder, ReminderWithStatus, VehicleEvent } from '../types';
import * as reminderQueries from '../db/queries/reminders';
import * as eventQueries from '../db/queries/events';
import { computeNextDue } from '../services/reminderScheduler';
import { useReferenceDataStore } from './referenceDataStore';
import * as notificationService from '../services/notifications';

interface ReminderStore {
  reminders: ReminderWithStatus[];
  isLoading: boolean;
  error: string | null;

  loadForVehicle(vehicleId: string): Promise<void>;
  addReminder(data: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>): Promise<Reminder>;
  updateReminder(id: string, fields: Partial<Reminder>): Promise<void>;
  deleteReminder(id: string): Promise<void>;
  recalculateForEvent(event: VehicleEvent, serviceTypeIds?: string[]): Promise<void>;
}

function getLinkedName(reminder: Reminder): string {
  const { serviceTypes, categories } = useReferenceDataStore.getState();
  if (reminder.serviceTypeId) {
    const st = serviceTypes.find((s) => s.id === reminder.serviceTypeId);
    return st?.name ?? 'Unknown';
  }
  if (reminder.categoryId) {
    const cat = categories.find((c) => c.id === reminder.categoryId);
    return cat?.name ?? 'Unknown';
  }
  return 'Unknown';
}

async function enrichReminder(
  reminder: Reminder,
  currentOdometer: number | null,
  today: string
): Promise<ReminderWithStatus> {
  const nextDue = computeNextDue(reminder, currentOdometer, today);
  return {
    ...reminder,
    ...nextDue,
    linkedName: getLinkedName(reminder),
  };
}

async function scheduleNotificationForReminder(
  reminder: Reminder,
  linkedName: string,
  nextDate: string | null
): Promise<string | undefined> {
  if (!nextDate) return undefined;
  try {
    const { useVehicleStore } = await import('./vehicleStore');
    const vehicle = useVehicleStore.getState().vehicles.find((v) => v.id === reminder.vehicleId);
    const vehicleName = vehicle?.nickname ?? 'your vehicle';

    if (reminder.notificationId) {
      await notificationService.cancelReminder(reminder.notificationId);
    }

    const notifId = await notificationService.scheduleReminder(nextDate, linkedName, vehicleName);
    if (notifId) {
      await reminderQueries.update(reminder.id, { notificationId: notifId });
      return notifId;
    }
  } catch {
    // Notifications are best-effort
  }
  return undefined;
}

function sortByUrgency(a: ReminderWithStatus, b: ReminderWithStatus): number {
  const statusOrder = { overdue: 0, soon: 1, upcoming: 2 };
  const diff = statusOrder[a.status] - statusOrder[b.status];
  if (diff !== 0) return diff;

  const aUrgency = Math.min(
    a.daysRemaining ?? Infinity,
    a.distanceRemaining ?? Infinity
  );
  const bUrgency = Math.min(
    b.daysRemaining ?? Infinity,
    b.distanceRemaining ?? Infinity
  );
  return aUrgency - bUrgency;
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  reminders: [],
  isLoading: false,
  error: null,

  async loadForVehicle(vehicleId) {
    set({ isLoading: true, error: null });
    try {
      const reminders = await reminderQueries.getByVehicle(vehicleId);
      const maxOdometer = await eventQueries.getMaxOdometer(vehicleId);
      const today = new Date().toISOString().split('T')[0];

      const enriched = await Promise.all(
        reminders.map((r) => enrichReminder(r, maxOdometer, today))
      );
      enriched.sort(sortByUrgency);

      set({ reminders: enriched, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load reminders';
      set({ error: msg, isLoading: false });
    }
  },

  async addReminder(data) {
    set({ error: null });
    try {
      const reminder = await reminderQueries.insert(data);
      const maxOdometer = await eventQueries.getMaxOdometer(data.vehicleId);
      const today = new Date().toISOString().split('T')[0];
      const enriched = await enrichReminder(reminder, maxOdometer, today);

      const notifId = await scheduleNotificationForReminder(reminder, enriched.linkedName, enriched.nextDate);
      if (notifId) {
        enriched.notificationId = notifId;
      }

      set((state) => {
        const updated = [...state.reminders, enriched];
        updated.sort(sortByUrgency);
        return { reminders: updated };
      });

      return reminder;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add reminder';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateReminder(id, fields) {
    set({ error: null });
    try {
      await reminderQueries.update(id, fields);
      const updated = await reminderQueries.getById(id);
      if (!updated) return;

      const existing = get().reminders.find((r) => r.id === id);
      const vehicleId = existing?.vehicleId ?? updated.vehicleId;
      const maxOdometer = await eventQueries.getMaxOdometer(vehicleId);
      const today = new Date().toISOString().split('T')[0];
      const enriched = await enrichReminder(updated, maxOdometer, today);

      const notifId = await scheduleNotificationForReminder(updated, enriched.linkedName, enriched.nextDate);
      if (notifId) {
        enriched.notificationId = notifId;
      }

      set((state) => {
        const reminders = state.reminders.map((r) =>
          r.id === id ? enriched : r
        );
        reminders.sort(sortByUrgency);
        return { reminders };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update reminder';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteReminder(id) {
    set({ error: null });
    try {
      const existing = get().reminders.find((r) => r.id === id);
      if (existing?.notificationId) {
        await notificationService.cancelReminder(existing.notificationId);
      }
      await reminderQueries.remove(id);
      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete reminder';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async recalculateForEvent(event, serviceTypeIds) {
    try {
      const { reminders } = get();
      let matchingIds: string[] = [];

      if (event.type === 'service' && serviceTypeIds && serviceTypeIds.length > 0) {
        matchingIds = reminders
          .filter((r) => r.serviceTypeId && serviceTypeIds.includes(r.serviceTypeId))
          .map((r) => r.id);
      } else if (event.type === 'expense' && event.categoryId) {
        matchingIds = reminders
          .filter((r) => r.categoryId === event.categoryId)
          .map((r) => r.id);
      }

      if (matchingIds.length === 0) return;

      for (const id of matchingIds) {
        const fields: Partial<Reminder> = {
          baselineDate: event.date,
        };
        if (event.odometer != null) {
          fields.baselineOdometer = event.odometer;
        }
        await reminderQueries.update(id, fields);
      }

      const vehicleId = event.vehicleId;
      const maxOdometer = await eventQueries.getMaxOdometer(vehicleId);
      const today = new Date().toISOString().split('T')[0];

      set((state) => {
        const updatedReminders = state.reminders.map((r) => {
          if (!matchingIds.includes(r.id)) return r;
          const updatedReminder: Reminder = {
            ...r,
            baselineDate: event.date,
            ...(event.odometer != null ? { baselineOdometer: event.odometer } : {}),
          };
          const nextDue = computeNextDue(updatedReminder, maxOdometer, today);
          return {
            ...updatedReminder,
            ...nextDue,
            linkedName: r.linkedName,
          } as ReminderWithStatus;
        });
        updatedReminders.sort(sortByUrgency);
        return { reminders: updatedReminders };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to recalculate reminders';
      set({ error: msg });
    }
  },
}));
