import { useVehicleStore } from './vehicleStore';
import { useEventStore } from './eventStore';
import { useReminderStore } from './reminderStore';
import { useDocumentStore } from './documentStore';
import { useReferenceDataStore } from './referenceDataStore';
import { useSettingsStore } from './settingsStore';
import type { VehicleEvent } from '../types';

export async function switchVehicle(id: string): Promise<void> {
  await useVehicleStore.getState().setActiveVehicle(id);
  await Promise.all([
    useEventStore.getState().loadForVehicle(id),
    useReminderStore.getState().loadForVehicle(id),
    useDocumentStore.getState().loadForVehicle(id),
  ]);
}

export async function onEventSaved(
  event: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'> | VehicleEvent,
  serviceTypeIds?: string[]
): Promise<void> {
  await useReminderStore.getState().recalculateForEvent(event as VehicleEvent, serviceTypeIds);
}

export async function onVehicleAdded(vehicleId: string, wasActivated: boolean): Promise<void> {
  if (wasActivated) {
    await Promise.all([
      useEventStore.getState().loadForVehicle(vehicleId),
      useReminderStore.getState().loadForVehicle(vehicleId),
      useDocumentStore.getState().loadForVehicle(vehicleId),
    ]);
  }
}

export async function onVehicleDeleted(newActiveId: string | null): Promise<void> {
  if (newActiveId) {
    await Promise.all([
      useEventStore.getState().loadForVehicle(newActiveId),
      useReminderStore.getState().loadForVehicle(newActiveId),
      useDocumentStore.getState().loadForVehicle(newActiveId),
    ]);
  } else {
    useDocumentStore.getState().clearDocuments();
  }
}

export async function onVehicleUnitChanged(vehicleId: string): Promise<void> {
  await Promise.all([
    useEventStore.getState().loadForVehicle(vehicleId),
    useReminderStore.getState().loadForVehicle(vehicleId),
  ]);
}

export async function reloadAllStores(): Promise<void> {
  await useSettingsStore.getState().initialize();
  await useVehicleStore.getState().initialize();
  await useReferenceDataStore.getState().initialize();

  const activeVehicle = useVehicleStore.getState().activeVehicle;
  if (activeVehicle) {
    await Promise.all([
      useEventStore.getState().loadForVehicle(activeVehicle.id),
      useReminderStore.getState().loadForVehicle(activeVehicle.id),
      useDocumentStore.getState().loadForVehicle(activeVehicle.id),
    ]);
  }
}

export async function onImportComplete(vehicleId: string): Promise<void> {
  await Promise.all([
    useEventStore.getState().loadForVehicle(vehicleId),
    useReferenceDataStore.getState().initialize(),
  ]);
}
