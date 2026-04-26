import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '@/src/components/ModalHeader';
import { DateField } from '@/src/components/DateField';
import { OdometerField } from '@/src/components/OdometerField';
import { ChipPicker } from '@/src/components/ChipPicker';
import { EventPhotos } from '@/src/components/EventPhotos';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { validateOdometer } from '@/src/services/odometerValidator';
import * as eventQueries from '@/src/db/queries/events';
import * as eventPhotoQueries from '@/src/db/queries/eventPhotos';
import type { VehicleEvent, LocalPhoto } from '@/src/types';

export default function ExpenseEventModal() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const isEditing = !!eventId;
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const events = useEventStore((s) => s.events);
  const categories = useReferenceDataStore((s) => s.categories);
  const addCategory = useReferenceDataStore((s) => s.addCategory);
  const updateCategory = useReferenceDataStore((s) => s.updateCategory);
  const deleteCategory = useReferenceDataStore((s) => s.deleteCategory);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometer, setOdometer] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

  const [odometerError, setOdometerError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [bounds, setBounds] = useState<{ floor: number | null; ceiling: number | null }>({ floor: null, ceiling: null });
  const [saving, setSaving] = useState(false);

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const title = isEditing ? 'Edit Expense' : 'Add Expense';

  useEffect(() => {
    if (!activeVehicle) return;

    if (isEditing && eventId) {
      const existing = events.find((e) => e.id === eventId);
      if (existing) {
        setDate(existing.date);
        setOdometer(existing.odometer != null ? String(existing.odometer) : '');
        if (existing.categoryId) setSelectedCategoryIds([existing.categoryId]);
        setCost(String(existing.cost));
        setNotes(existing.notes ?? '');
      }
      (async () => {
        const existingPhotos = await eventPhotoQueries.getByEvent(eventId);
        setPhotos(
          existingPhotos.map((p) => ({
            id: p.id,
            uri: p.filePath,
            isNew: false,
          }))
        );
      })();
    } else {
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    if (!activeVehicle || !date) return;
    (async () => {
      const b = await eventQueries.getOdometerBounds(activeVehicle.id, date);
      setBounds(b);
    })();
  }, [activeVehicle?.id, date]);

  const handleOdometerBlur = useCallback(() => {
    const val = parseInt(odometer, 10);
    if (isNaN(val) || !val) {
      setOdometerError('');
      return;
    }
    const result = validateOdometer(val, bounds);
    setOdometerError(result.valid ? '' : result.message ?? 'Invalid odometer');
  }, [odometer, bounds]);

  const handleCategoryChange = useCallback((ids: string[]) => {
    setSelectedCategoryIds(ids);
    if (ids.length > 0) setCategoryError('');
  }, []);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!date) return false;
    if (selectedCategoryIds.length === 0) return false;
    const c = parseFloat(cost);
    if (isNaN(c) || c <= 0) return false;
    if (odometerError) return false;
    return true;
  }, [saving, date, selectedCategoryIds, cost, odometerError]);

  const handleSave = useCallback(async () => {
    if (selectedCategoryIds.length === 0) {
      setCategoryError('Select a category');
      return;
    }
    if (!canSave || !activeVehicle) return;
    setSaving(true);
    try {
      const odo = parseInt(odometer, 10);
      const eventData: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        vehicleId: activeVehicle.id,
        type: 'expense',
        date,
        odometer: !isNaN(odo) && odo > 0 ? odo : undefined,
        cost: Math.round(parseFloat(cost) * 100) / 100,
        categoryId: selectedCategoryIds[0],
        notes: notes.trim() || undefined,
      };

      const photoUris = photos.map((p) => p.uri);
      if (isEditing && eventId) {
        await updateEvent(eventId, eventData, undefined, photoUris);
      } else {
        await addEvent(eventData, undefined, photoUris);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save event. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [canSave, activeVehicle, date, odometer, cost, selectedCategoryIds, notes, isEditing, eventId]);

  const handleDelete = useCallback(() => {
    if (!eventId) return;
    router.back();
    setTimeout(() => deleteEvent(eventId), 100);
  }, [eventId, deleteEvent, router]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <ModalHeader
        title={title}
        onCancel={() => router.back()}
        onSave={handleSave}
        saveDisabled={!canSave}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          <DateField value={date} onChange={setDate} />

          <OdometerField
            value={odometer}
            onChange={setOdometer}
            onBlur={handleOdometerBlur}
            unit={odometerUnit}
            error={odometerError}
            label="Odometer (optional)"
          />

          <ChipPicker
            items={categories}
            selectedIds={selectedCategoryIds}
            onSelectionChange={handleCategoryChange}
            multiSelect={false}
            label="Category *"
            error={categoryError}
            accentColor="#10B981"
            onAdd={async (name) => { await addCategory(name); }}
            onUpdate={async (id, name) => { await updateCategory(id, name); }}
            onDelete={async (id) => { await deleteCategory(id); }}
          />

          <View className="mb-4">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
              Total Cost *
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3">
              <Text className="text-sm text-gray-400 mr-1">$</Text>
              <TextInput
                className="flex-1 text-base text-gray-900 dark:text-gray-100"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                accessibilityLabel="Total cost"
              />
            </View>
          </View>

          <View className="mb-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Notes</Text>
              <Text className="text-xs text-gray-400">{notes.length}/500</Text>
            </View>
            <TextInput
              className="bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 text-base text-gray-900 dark:text-gray-100"
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, 500))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="Optional notes..."
              placeholderTextColor="#9CA3AF"
              style={{ minHeight: 80 }}
              accessibilityLabel="Notes"
            />
          </View>

          <EventPhotos
            eventId={isEditing && eventId ? eventId : null}
            photos={photos}
            onPhotosChange={setPhotos}
          />

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete event"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Event</Text>
            </Pressable>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
