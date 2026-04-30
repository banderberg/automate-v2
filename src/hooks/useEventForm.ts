import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDialog } from './useDialog';
import { useVehicleStore } from '../stores/vehicleStore';
import { useEventStore } from '../stores/eventStore';
import { validateOdometer } from '../services/odometerValidator';
import * as eventQueries from '../db/queries/events';
import * as eventPhotoQueries from '../db/queries/eventPhotos';
import type { VehicleEvent, LocalPhoto, Vehicle } from '../types';

interface UseEventFormOptions {
  type: 'fuel' | 'service' | 'expense';
  deleteLabel: string;
}

export function useEventForm({ type, deleteLabel }: UseEventFormOptions) {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const isEditing = !!eventId;
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const events = useEventStore((s) => s.events);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometer, setOdometer] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

  const [odometerError, setOdometerError] = useState('');
  const [bounds, setBounds] = useState<{ floor: number | null; ceiling: number | null }>({ floor: null, ceiling: null });
  const [boundsLoaded, setBoundsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = useRef(false);
  const { showDialog, dialogProps } = useDialog();

  const markDirty = useCallback(() => { isDirty.current = true; }, []);

  const existingEvent = useMemo(
    () => (isEditing && eventId ? events.find((e) => e.id === eventId) ?? null : null),
    [events, isEditing, eventId],
  );

  useEffect(() => {
    if (!activeVehicle || !isEditing || !existingEvent) return;
    setDate(existingEvent.date);
    setOdometer(existingEvent.odometer != null ? String(existingEvent.odometer) : '');
    if (type !== 'fuel') setCost(String(existingEvent.cost));
    setNotes(existingEvent.notes ?? '');
    setBoundsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isEditing || !eventId) return;
    (async () => {
      const existingPhotos = await eventPhotoQueries.getByEvent(eventId);
      setPhotos(
        existingPhotos.map((p) => ({
          id: p.id,
          uri: p.filePath,
          isNew: false,
        })),
      );
    })();
  }, []);

  useEffect(() => {
    if (!activeVehicle || !date || !boundsLoaded) return;
    (async () => {
      const b = await eventQueries.getOdometerBounds(activeVehicle.id, date, eventId);
      setBounds(b);
    })();
  }, [activeVehicle?.id, date, boundsLoaded]);

  useEffect(() => {
    const val = parseInt(odometer, 10);
    if (isNaN(val) || !val) return;
    const result = validateOdometer(val, bounds);
    setOdometerError(result.valid ? '' : result.message ?? 'Invalid odometer');
  }, [bounds]);

  const handleOdometerBlur = useCallback(() => {
    const val = parseInt(odometer, 10);
    if (isNaN(val) || !val) {
      setOdometerError('');
      return;
    }
    const result = validateOdometer(val, bounds);
    setOdometerError(result.valid ? '' : result.message ?? 'Invalid odometer');
  }, [odometer, bounds]);

  const handleCancel = useCallback(() => {
    if (isDirty.current) {
      showDialog('Discard Changes?', 'You have unsaved changes.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [router]);

  const handleDelete = useCallback(() => {
    if (!eventId) return;
    showDialog(`Delete ${deleteLabel}`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(eventId);
          router.back();
        },
      },
    ]);
  }, [eventId, deleteEvent, router, deleteLabel]);

  return {
    router,
    eventId,
    isEditing,
    activeVehicle,
    events,
    existingEvent,

    date,
    setDate,
    odometer,
    setOdometer,
    cost,
    setCost,
    notes,
    setNotes,
    photos,
    setPhotos,

    odometerError,
    bounds,
    boundsLoaded,
    setBoundsLoaded,
    saving,
    setSaving,

    markDirty,
    handleOdometerBlur,
    handleCancel,
    handleDelete,

    showDialog,
    dialogProps,
  };
}
