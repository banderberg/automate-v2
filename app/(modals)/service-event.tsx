import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '@/src/components/ModalHeader';
import { DateField } from '@/src/components/DateField';
import { OdometerField } from '@/src/components/OdometerField';
import { ChipPicker } from '@/src/components/ChipPicker';
import { PlaceAutocomplete } from '@/src/components/PlaceAutocomplete';
import { EventPhotos } from '@/src/components/EventPhotos';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useEventForm } from '@/src/hooks/useEventForm';
import { useEventStore } from '@/src/stores/eventStore';
import { useToastStore } from '@/src/stores/toastStore';
import { onEventSaved } from '@/src/stores/orchestrator';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import * as eventServiceTypeQueries from '@/src/db/queries/eventServiceTypes';
import type { VehicleEvent } from '@/src/types';

export default function ServiceEventModal() {
  const {
    router, eventId, isEditing, activeVehicle, existingEvent,
    date, setDate, odometer, setOdometer, cost, setCost, notes, setNotes, photos, setPhotos,
    odometerError, saving, setSaving, setBoundsLoaded,
    markDirty, handleOdometerBlur, handleCancel, handleDelete,
    showDialog, dialogProps,
  } = useEventForm({ type: 'service', deleteLabel: 'Service' });

  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const getSmartDefaults = useEventStore((s) => s.getSmartDefaults);
  const rawServiceTypes = useReferenceDataStore((s) => s.serviceTypes);
  const serviceLabels = useEventStore((s) => s.serviceLabels);
  const addServiceType = useReferenceDataStore((s) => s.addServiceType);
  const updateServiceType = useReferenceDataStore((s) => s.updateServiceType);
  const deleteServiceType = useReferenceDataStore((s) => s.deleteServiceType);

  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [serviceTypeError, setServiceTypeError] = useState('');
  const [estimatedOdometer, setEstimatedOdometer] = useState<number | null>(null);

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const title = isEditing ? 'Edit Service' : 'Add Service';

  const serviceTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const label of serviceLabels.values()) {
      for (const name of label.split(', ')) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...rawServiceTypes].sort((a, b) => {
      const diff = (counts.get(b.name) ?? 0) - (counts.get(a.name) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [rawServiceTypes, serviceLabels]);

  useEffect(() => {
    if (!activeVehicle) return;

    if (isEditing && eventId) {
      if (existingEvent) setPlaceId(existingEvent.placeId);
      (async () => {
        const types = await eventServiceTypeQueries.getByEvent(eventId);
        setSelectedServiceTypeIds(types.map((t) => t.id));
      })();
    } else {
      (async () => {
        const defaults = await getSmartDefaults('service', activeVehicle.id);
        if (defaults.date) setDate(defaults.date);
        if (defaults.odometer != null) setEstimatedOdometer(defaults.odometer);
        setBoundsLoaded(true);
      })();
    }
  }, []);

  const handleServiceTypesChange = useCallback((ids: string[]) => {
    markDirty();
    setSelectedServiceTypeIds(ids);
    if (ids.length > 0) setServiceTypeError('');
  }, [markDirty]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!date) return false;
    const odo = parseInt(odometer, 10);
    if (isNaN(odo) || odo <= 0) return false;
    if (selectedServiceTypeIds.length === 0) return false;
    const c = parseFloat(cost);
    if (isNaN(c) || c <= 0) return false;
    if (odometerError) return false;
    return true;
  }, [saving, date, odometer, selectedServiceTypeIds, cost, odometerError]);

  const handleSave = useCallback(async () => {
    if (selectedServiceTypeIds.length === 0) {
      setServiceTypeError('Select at least one service type');
      return;
    }
    if (!canSave || !activeVehicle) return;
    setSaving(true);
    try {
      const eventData: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        vehicleId: activeVehicle.id,
        type: 'service',
        date,
        odometer: parseInt(odometer, 10),
        cost: Math.round(parseFloat(cost) * 100) / 100,
        placeId,
        notes: notes.trim() || undefined,
      };

      const photoUris = photos.map((p) => p.uri);
      if (isEditing && eventId) {
        await updateEvent(eventId, eventData, selectedServiceTypeIds, photoUris);
        await onEventSaved(eventData, selectedServiceTypeIds);
      } else {
        const event = await addEvent(eventData, selectedServiceTypeIds, photoUris);
        await onEventSaved(event, selectedServiceTypeIds);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const costStr = cost ? `, $${parseFloat(cost).toFixed(2)}` : '';
      useToastStore.getState().show(`Service ${isEditing ? 'updated' : 'saved'}${costStr}`);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog("Couldn't Save Service", msg || 'Check your entries and try again. If this keeps happening, try restarting the app.');
    } finally {
      setSaving(false);
    }
  }, [canSave, activeVehicle, date, odometer, cost, placeId, notes, selectedServiceTypeIds, isEditing, eventId, photos]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={title}
        onCancel={handleCancel}
        onSave={handleSave}
        saveDisabled={!canSave}
        isSaving={saving}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <DateField value={date} onChange={(d) => { markDirty(); setDate(d); }} />

          <OdometerField
            value={odometer}
            onChange={(v) => { markDirty(); setOdometer(v); }}
            onBlur={handleOdometerBlur}
            unit={odometerUnit}
            estimatedOdometer={estimatedOdometer}
            error={odometerError}
            required
          />

          <ChipPicker
            items={serviceTypes}
            selectedIds={selectedServiceTypeIds}
            onSelectionChange={handleServiceTypesChange}
            multiSelect
            label="Service Types *"
            error={serviceTypeError}
            accentColor="#E8772B"
            onAdd={async (name) => { await addServiceType(name); }}
            onUpdate={async (id, name) => { await updateServiceType(id, name); }}
            onDelete={async (id) => { await deleteServiceType(id); }}
          />

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Total Cost *
            </Text>
            <View className="flex-row items-center bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mr-1">$</Text>
              <TextInput
                className="flex-1 text-base text-ink dark:text-ink-on-dark"
                value={cost}
                onChangeText={(t) => { markDirty(); setCost(t); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#A8A49D"
                accessibilityLabel="Total cost"
              />
            </View>
          </View>

          <PlaceAutocomplete
            value={placeId}
            onChange={(id) => { markDirty(); setPlaceId(id); }}
            placeType="service_shop"
          />

          <View className="mb-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">Notes</Text>
              <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark">{notes.length}/500</Text>
            </View>
            <TextInput
              className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 text-base text-ink dark:text-ink-on-dark"
              value={notes}
              onChangeText={(t) => { markDirty(); setNotes(t.slice(0, 500)); }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="Optional notes..."
              placeholderTextColor="#A8A49D"
              style={{ minHeight: 80 }}
              accessibilityLabel="Notes"
            />
          </View>

          <EventPhotos
            eventId={isEditing && eventId ? eventId : null}
            photos={photos}
            onPhotosChange={(p) => { markDirty(); setPhotos(p); }}
          />

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete service"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Service</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
