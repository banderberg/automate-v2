import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '@/src/components/ModalHeader';
import { DateField } from '@/src/components/DateField';
import { OdometerField } from '@/src/components/OdometerField';
import { ChipPicker } from '@/src/components/ChipPicker';
import { EventPhotos } from '@/src/components/EventPhotos';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useToastStore } from '@/src/stores/toastStore';
import { onEventSaved } from '@/src/stores/orchestrator';
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
  const rawCategories = useReferenceDataStore((s) => s.categories);
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
  const isDirty = useRef(false);
  const { showDialog, dialogProps } = useDialog();

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const title = isEditing ? 'Edit Expense' : 'Add Expense';

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.categoryId) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
    }
    return [...rawCategories].sort((a, b) => {
      const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [rawCategories, events]);

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

  const handleCategoryChange = useCallback((ids: string[]) => {
    isDirty.current = true;
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
        await onEventSaved(eventData);
      } else {
        const event = await addEvent(eventData, undefined, photoUris);
        await onEventSaved(event);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const costStr = cost ? `, $${parseFloat(cost).toFixed(2)}` : '';
      useToastStore.getState().show(`Expense ${isEditing ? 'updated' : 'saved'}${costStr}`);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog("Couldn't Save Expense", msg || 'Check your entries and try again. If this keeps happening, try restarting the app.');
    } finally {
      setSaving(false);
    }
  }, [canSave, activeVehicle, date, odometer, cost, selectedCategoryIds, notes, isEditing, eventId]);

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
    showDialog('Delete Expense', 'This cannot be undone.', [
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
  }, [eventId, deleteEvent, router]);

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
          <DateField value={date} onChange={(d) => { isDirty.current = true; setDate(d); }} />

          <OdometerField
            value={odometer}
            onChange={(v) => { isDirty.current = true; setOdometer(v); }}
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
            accentColor="#2EAD76"
            onAdd={async (name) => { await addCategory(name); }}
            onUpdate={async (id, name) => { await updateCategory(id, name); }}
            onDelete={async (id) => { await deleteCategory(id); }}
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
                onChangeText={(t) => { isDirty.current = true; setCost(t); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#A8A49D"
                accessibilityLabel="Total cost"
              />
            </View>
          </View>

          <View className="mb-4">
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">Notes</Text>
              <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark">{notes.length}/500</Text>
            </View>
            <TextInput
              className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 text-base text-ink dark:text-ink-on-dark"
              value={notes}
              onChangeText={(t) => { isDirty.current = true; setNotes(t.slice(0, 500)); }}
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
            onPhotosChange={(p) => { isDirty.current = true; setPhotos(p); }}
          />

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete expense"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Expense</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
