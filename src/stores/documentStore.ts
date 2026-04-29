import { create } from 'zustand';
import { File } from 'expo-file-system';
import type { VehicleDocument } from '../types';
import * as vehicleDocumentQueries from '../db/queries/vehicleDocuments';
import * as notificationService from '../services/notifications';

interface DocumentStore {
  documents: VehicleDocument[];
  isLoading: boolean;
  error: string | null;

  loadForVehicle(vehicleId: string): Promise<void>;
  addDocument(
    data: Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>,
    vehicleName?: string,
    scheduleNotification?: boolean
  ): Promise<VehicleDocument>;
  updateDocument(
    id: string,
    fields: Partial<VehicleDocument>,
    newFilePath?: string,
    vehicleName?: string
  ): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  clearDocuments(): void;
}

async function scheduleExpirationNotification(
  expirationDate: string,
  documentName: string,
  vehicleName: string
): Promise<string | null> {
  const expDate = new Date(expirationDate + 'T00:00:00');
  const notifyDate = new Date(expDate);
  notifyDate.setDate(notifyDate.getDate() - 30);

  if (notifyDate.getTime() <= Date.now()) return null;

  const notifyDateStr = notifyDate.toISOString().split('T')[0];
  return notificationService.scheduleReminder(
    notifyDateStr,
    `${documentName} expires soon`,
    vehicleName
  );
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  clearDocuments() {
    set({ documents: [], error: null });
  },

  async loadForVehicle(vehicleId) {
    set({ isLoading: true, error: null });
    try {
      const documents = await vehicleDocumentQueries.getByVehicle(vehicleId);
      set({ documents, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load documents';
      set({ error: msg, isLoading: false });
    }
  },

  async addDocument(data, vehicleName = 'your vehicle', scheduleNotification = true) {
    set({ error: null });
    try {
      let notificationId: string | undefined;

      if (scheduleNotification && data.expirationDate) {
        const nid = await scheduleExpirationNotification(
          data.expirationDate,
          data.name,
          vehicleName
        );
        if (nid) notificationId = nid;
      }

      const doc = await vehicleDocumentQueries.insert({
        ...data,
        notificationId,
      });

      set((state) => ({
        documents: [...state.documents, doc],
      }));

      return doc;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add document';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async updateDocument(id, fields, newFilePath, vehicleName = 'your vehicle') {
    set({ error: null });
    try {
      const existing = get().documents.find((d) => d.id === id);
      if (!existing) throw new Error('Document not found');

      const updateFields: Partial<VehicleDocument> = { ...fields };

      if (newFilePath) {
        try {
          const oldFile = new File(existing.filePath);
          if (oldFile.exists) {
            oldFile.delete();
          }
        } catch {
          // Best effort old file cleanup
        }
        updateFields.filePath = newFilePath;
      }

      const expirationChanged =
        'expirationDate' in fields && fields.expirationDate !== existing.expirationDate;

      if (expirationChanged) {
        if (existing.notificationId) {
          await notificationService.cancelReminder(existing.notificationId);
          updateFields.notificationId = undefined;
        }

        if (fields.expirationDate) {
          const docName = fields.name ?? existing.name;

          const nid = await scheduleExpirationNotification(
            fields.expirationDate,
            docName,
            vehicleName
          );
          if (nid) updateFields.notificationId = nid;
        }
      }

      await vehicleDocumentQueries.update(id, updateFields);

      const updated = await vehicleDocumentQueries.getById(id);
      if (!updated) return;

      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? updated : d)),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update document';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  async deleteDocument(id) {
    set({ error: null });
    try {
      await vehicleDocumentQueries.remove(id);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete document';
      set({ error: msg });
      throw new Error(msg);
    }
  },
}));
