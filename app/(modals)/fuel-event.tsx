import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
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
import { PlaceAutocomplete } from '@/src/components/PlaceAutocomplete';
import { EventPhotos } from '@/src/components/EventPhotos';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { validateOdometer } from '@/src/services/odometerValidator';
import * as eventQueries from '@/src/db/queries/events';
import * as eventPhotoQueries from '@/src/db/queries/eventPhotos';
import { getVolumeLabel, getOdometerLabel } from '@/src/constants/units';
import type { VehicleEvent, LocalPhoto } from '@/src/types';

export default function FuelEventModal() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const isEditing = !!eventId;
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const getSmartDefaults = useEventStore((s) => s.getSmartDefaults);
  const events = useEventStore((s) => s.events);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometer, setOdometer] = useState('');
  const [volume, setVolume] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [discountPerUnit, setDiscountPerUnit] = useState('');
  const [isPartialFill, setIsPartialFill] = useState(false);
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');

  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

  const [odometerError, setOdometerError] = useState('');
  const [estimatedOdometer, setEstimatedOdometer] = useState<number | null>(null);
  const [bounds, setBounds] = useState<{ floor: number | null; ceiling: number | null }>({ floor: null, ceiling: null });
  const [boundsLoaded, setBoundsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const volumeUnit = activeVehicle?.volumeUnit ?? 'gallons';
  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const isElectric = activeVehicle?.fuelType === 'electric';
  const title = isEditing
    ? isElectric ? 'Edit Charge' : 'Edit Fill-Up'
    : isElectric ? 'Add Charge' : 'Add Fill-Up';

  useEffect(() => {
    if (!activeVehicle) return;

    if (isEditing && eventId) {
      const existing = events.find((e) => e.id === eventId);
      if (existing) {
        setDate(existing.date);
        setOdometer(existing.odometer != null ? String(existing.odometer) : '');
        setVolume(existing.volume != null ? String(existing.volume) : '');
        setPricePerUnit(existing.pricePerUnit != null ? String(existing.pricePerUnit) : '');
        setDiscountPerUnit(existing.discountPerUnit != null ? String(existing.discountPerUnit) : '');
        setIsPartialFill(!!existing.isPartialFill);
        setPlaceId(existing.placeId);
        setNotes(existing.notes ?? '');
        setBoundsLoaded(true);
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
      (async () => {
        const defaults = await getSmartDefaults('fuel', activeVehicle.id);
        if (defaults.date) setDate(defaults.date);
        if (defaults.odometer != null) {
          setEstimatedOdometer(defaults.odometer);
        }
        if (defaults.pricePerUnit != null) {
          setPricePerUnit(String(defaults.pricePerUnit));
        }
        if (defaults.placeId) setPlaceId(defaults.placeId);
        setBoundsLoaded(true);
      })();
    }
  }, []);

  useEffect(() => {
    if (!activeVehicle || !date) return;
    (async () => {
      const b = await eventQueries.getOdometerBounds(activeVehicle.id, date);
      setBounds(b);
    })();
  }, [activeVehicle?.id, date]);

  const computedCost = useMemo(() => {
    const vol = parseFloat(volume);
    const price = parseFloat(pricePerUnit);
    const discount = parseFloat(discountPerUnit) || 0;
    if (isNaN(vol) || isNaN(price) || vol <= 0 || price <= 0) return null;
    if (discount >= price) return null;
    return vol * (price - discount);
  }, [volume, pricePerUnit, discountPerUnit]);

  const handleOdometerBlur = useCallback(() => {
    const val = parseInt(odometer, 10);
    if (isNaN(val) || !val) {
      setOdometerError('');
      return;
    }
    const result = validateOdometer(val, bounds);
    setOdometerError(result.valid ? '' : result.message ?? 'Invalid odometer');
  }, [odometer, bounds]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!date) return false;
    const odo = parseInt(odometer, 10);
    if (isNaN(odo) || odo <= 0) return false;
    const vol = parseFloat(volume);
    if (isNaN(vol) || vol <= 0) return false;
    const price = parseFloat(pricePerUnit);
    if (isNaN(price) || price <= 0) return false;
    if (odometerError) return false;
    if (computedCost == null || computedCost <= 0) return false;
    return true;
  }, [saving, date, odometer, volume, pricePerUnit, odometerError, computedCost]);

  const handleSave = useCallback(async () => {
    if (!canSave || !activeVehicle || computedCost == null) return;
    setSaving(true);
    try {
      const eventData: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        vehicleId: activeVehicle.id,
        type: 'fuel',
        date,
        odometer: parseInt(odometer, 10),
        cost: Math.round(computedCost * 100) / 100,
        volume: parseFloat(volume),
        pricePerUnit: parseFloat(pricePerUnit),
        discountPerUnit: parseFloat(discountPerUnit) || undefined,
        isPartialFill: isPartialFill || undefined,
        placeId,
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
  }, [canSave, activeVehicle, date, odometer, volume, pricePerUnit, discountPerUnit, isPartialFill, placeId, notes, computedCost, isEditing, eventId]);

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
            estimatedOdometer={estimatedOdometer}
            error={odometerError}
            required
          />

          <View className="mb-4">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
              {isElectric ? 'Energy Added' : 'Fuel Added'} *
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3">
              <TextInput
                className="flex-1 text-base text-gray-900 dark:text-gray-100"
                value={volume}
                onChangeText={setVolume}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#9CA3AF"
                accessibilityLabel={`Volume in ${getVolumeLabel(volumeUnit)}`}
              />
              <Text className="text-sm text-gray-400 dark:text-gray-500 ml-2">
                {getVolumeLabel(volumeUnit)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
                Price / {getVolumeLabel(volumeUnit)} *
              </Text>
              <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3">
                <Text className="text-sm text-gray-400 mr-1">$</Text>
                <TextInput
                  className="flex-1 text-base text-gray-900 dark:text-gray-100"
                  value={pricePerUnit}
                  onChangeText={setPricePerUnit}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  accessibilityLabel={`Price per ${getVolumeLabel(volumeUnit)}`}
                />
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
                Discount / {getVolumeLabel(volumeUnit)}
              </Text>
              <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3">
                <Text className="text-sm text-gray-400 mr-1">$</Text>
                <TextInput
                  className="flex-1 text-base text-gray-900 dark:text-gray-100"
                  value={discountPerUnit}
                  onChangeText={setDiscountPerUnit}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  accessibilityLabel={`Discount per ${getVolumeLabel(volumeUnit)}`}
                />
              </View>
            </View>
          </View>

          {/* Computed total cost */}
          <View className="mb-4 bg-primary-light dark:bg-primary-dark rounded-xl px-4 py-3">
            <Text className="text-xs text-primary dark:text-blue-300 mb-0.5 font-semibold">
              Total Cost
            </Text>
            <Text className="text-xl font-bold text-primary dark:text-blue-200">
              {computedCost != null ? `$${computedCost.toFixed(2)}` : '$0.00'}
            </Text>
          </View>

          {/* Partial fill toggle */}
          <View className="flex-row items-center justify-between mb-4 bg-surface dark:bg-surface-dark rounded-xl px-3.5 py-3 border border-gray-200 dark:border-gray-700">
            <View className="flex-1 mr-3">
              <Text className="text-base text-gray-900 dark:text-gray-100">Partial fill</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Excluded from efficiency calculations
              </Text>
            </View>
            <Switch
              value={isPartialFill}
              onValueChange={setIsPartialFill}
              trackColor={{ false: '#d1d5db', true: '#93C5FD' }}
              thumbColor={isPartialFill ? '#3B82F6' : '#f4f3f4'}
              accessibilityLabel="This is a partial fill"
            />
          </View>

          <PlaceAutocomplete
            value={placeId}
            onChange={setPlaceId}
            placeType="gas_station"
          />

          {/* Notes */}
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
