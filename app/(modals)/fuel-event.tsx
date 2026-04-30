import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '@/src/components/ModalHeader';
import { DateField } from '@/src/components/DateField';
import { OdometerField } from '@/src/components/OdometerField';
import { PlaceAutocomplete } from '@/src/components/PlaceAutocomplete';
import { EventPhotos } from '@/src/components/EventPhotos';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useEventForm } from '@/src/hooks/useEventForm';
import { useEventStore } from '@/src/stores/eventStore';
import { useToastStore } from '@/src/stores/toastStore';
import { onEventSaved } from '@/src/stores/orchestrator';
import { getVolumeLabel } from '@/src/constants/units';
import type { VehicleEvent } from '@/src/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FUEL_TEAL = '#1A9A8F';
const FUEL_TEAL_BG = '#D0F5EE';

function SmartTag({ label }: { label: string }) {
  return (
    <View className="ml-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: FUEL_TEAL_BG }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: FUEL_TEAL, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

function calcCardShadow(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 3,
  } as const;
}

export default function FuelEventModal() {
  const {
    router, eventId, isEditing, activeVehicle, existingEvent,
    date, setDate, odometer, setOdometer, notes, setNotes, photos, setPhotos,
    odometerError, saving, setSaving, setBoundsLoaded,
    markDirty, handleOdometerBlur, handleCancel, handleDelete,
    showDialog, dialogProps,
  } = useEventForm({ type: 'fuel', deleteLabel: 'Fill-Up' });

  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const getSmartDefaults = useEventStore((s) => s.getSmartDefaults);

  const [volume, setVolume] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [discountPerUnit, setDiscountPerUnit] = useState('');
  const [entryMode, setEntryMode] = useState<'price' | 'total'>('price');
  const [showDiscount, setShowDiscount] = useState(false);
  const [isPartialFill, setIsPartialFill] = useState(false);
  const [placeId, setPlaceId] = useState<string | undefined>();

  const discountRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const totalRef = useRef<TextInput>(null);

  const [odometerTag, setOdometerTag] = useState<string | null>(null);
  const [priceTag, setPriceTag] = useState<string | null>(null);

  const volumeUnit = activeVehicle?.volumeUnit ?? 'gallons';
  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isElectric = activeVehicle?.fuelType === 'electric';
  const volumeLabel = getVolumeLabel(volumeUnit);
  const title = isEditing
    ? isElectric ? 'Edit Charge' : 'Edit Fill-Up'
    : isElectric ? 'Add Charge' : 'Add Fill-Up';

  useEffect(() => {
    if (!activeVehicle) return;

    if (isEditing && existingEvent) {
      setVolume(existingEvent.volume != null ? String(existingEvent.volume) : '');
      setPricePerUnit(existingEvent.pricePerUnit != null ? String(existingEvent.pricePerUnit) : '');
      setDiscountPerUnit(existingEvent.discountPerUnit != null ? String(existingEvent.discountPerUnit) : '');
      setIsPartialFill(!!existingEvent.isPartialFill);
      if (existingEvent.cost != null) setTotalCost(String(existingEvent.cost));
      setPlaceId(existingEvent.placeId);
      if (existingEvent.discountPerUnit) setShowDiscount(true);
    } else {
      (async () => {
        const defaults = await getSmartDefaults('fuel', activeVehicle.id);
        if (defaults.date) setDate(defaults.date);
        if (defaults.odometer != null) {
          setOdometer(String(defaults.odometer));
          setOdometerTag('Estimated');
        }
        if (defaults.pricePerUnit != null) {
          setPricePerUnit(String(defaults.pricePerUnit));
          setPriceTag('Last fill-up');
        }
        if (defaults.discountPerUnit != null && defaults.discountPerUnit > 0) {
          setDiscountPerUnit(String(defaults.discountPerUnit));
          setShowDiscount(true);
        }
        setBoundsLoaded(true);
      })();
    }
  }, []);

  const computedTotal = useMemo(() => {
    if (entryMode !== 'price') return null;
    const vol = parseFloat(volume);
    const price = parseFloat(pricePerUnit);
    const discount = parseFloat(discountPerUnit) || 0;
    if (isNaN(vol) || isNaN(price) || vol <= 0 || price <= 0) return null;
    return (vol * Math.max(0, price - discount)).toFixed(2);
  }, [volume, pricePerUnit, discountPerUnit, entryMode]);

  const computedPrice = useMemo(() => {
    if (entryMode !== 'total') return null;
    const vol = parseFloat(volume);
    const total = parseFloat(totalCost);
    const discount = parseFloat(discountPerUnit) || 0;
    if (isNaN(vol) || isNaN(total) || vol <= 0 || total <= 0) return null;
    return ((total / vol) + discount).toFixed(3);
  }, [volume, totalCost, discountPerUnit, entryMode]);

  const resolvedCost = useMemo(() => {
    if (entryMode === 'price') {
      return computedTotal != null ? parseFloat(computedTotal) : null;
    }
    const total = parseFloat(totalCost);
    return !isNaN(total) && total > 0 ? Math.round(total * 100) / 100 : null;
  }, [entryMode, computedTotal, totalCost]);

  const resolvedPricePerUnit = useMemo(() => {
    if (entryMode === 'total') {
      return computedPrice != null ? parseFloat(computedPrice) : null;
    }
    const price = parseFloat(pricePerUnit);
    return !isNaN(price) && price > 0 ? price : null;
  }, [entryMode, computedPrice, pricePerUnit]);

  const handleOdometerChange = useCallback((text: string) => {
    setOdometer(text);
    setOdometerTag(null);
    markDirty();
  }, [setOdometer, markDirty]);

  const handlePriceChange = useCallback((text: string) => {
    setPricePerUnit(text);
    setPriceTag(null);
    markDirty();
  }, [markDirty]);

  const handleModeSwitch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (entryMode === 'price') {
      if (computedTotal) setTotalCost(computedTotal);
      setEntryMode('total');
      setTimeout(() => totalRef.current?.focus(), 100);
    } else {
      if (computedPrice) setPricePerUnit(computedPrice);
      setEntryMode('price');
      setTimeout(() => priceRef.current?.focus(), 100);
    }
    setPriceTag(null);
  }, [entryMode, computedTotal, computedPrice]);

  const handleToggleDiscount = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (showDiscount) {
      setDiscountPerUnit('');
      setShowDiscount(false);
    } else {
      setShowDiscount(true);
    }
  }, [showDiscount]);

  useEffect(() => {
    if (showDiscount) {
      setTimeout(() => discountRef.current?.focus(), 100);
    }
  }, [showDiscount]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!date) return false;
    const odo = parseInt(odometer, 10);
    if (isNaN(odo) || odo <= 0) return false;
    const vol = parseFloat(volume);
    if (isNaN(vol) || vol <= 0) return false;
    if (odometerError) return false;
    if (resolvedCost == null || resolvedCost <= 0) return false;
    if (resolvedPricePerUnit == null || resolvedPricePerUnit <= 0) return false;
    return true;
  }, [saving, date, odometer, volume, odometerError, resolvedCost, resolvedPricePerUnit]);

  const handleSave = useCallback(async () => {
    if (!canSave || !activeVehicle || resolvedCost == null || resolvedPricePerUnit == null) return;
    setSaving(true);
    try {
      const eventData: Omit<VehicleEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        vehicleId: activeVehicle.id,
        type: 'fuel',
        date,
        odometer: parseInt(odometer, 10),
        cost: resolvedCost,
        volume: parseFloat(volume),
        pricePerUnit: resolvedPricePerUnit,
        discountPerUnit: parseFloat(discountPerUnit) || undefined,
        isPartialFill: isPartialFill || undefined,
        placeId,
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
      const label = isElectric ? 'Charge' : 'Fill-up';
      const costStr = resolvedCost != null ? `, $${resolvedCost.toFixed(2)}` : '';
      useToastStore.getState().show(`${label} ${isEditing ? 'updated' : 'saved'}${costStr}`);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog("Couldn't Save Fill-Up", msg || 'Check your entries and try again. If this keeps happening, try restarting the app.');
    } finally {
      setSaving(false);
    }
  }, [canSave, activeVehicle, date, odometer, volume, resolvedCost, resolvedPricePerUnit, discountPerUnit, isPartialFill, placeId, notes, isEditing, eventId, photos]);

  const ghostColor = isDark ? '#54524D' : '#A8A49D';

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
          {/* ── Tier 1: Essentials ── */}
          <DateField value={date} onChange={setDate} />

          <OdometerField
            value={odometer}
            onChange={handleOdometerChange}
            onBlur={handleOdometerBlur}
            unit={odometerUnit}
            tag={odometerTag ?? undefined}
            selectTextOnFocus={!!odometerTag}
            error={odometerError}
            required
          />

          {/* ── Tier 2: Calculation Card ── */}
          <View style={calcCardShadow(isDark)} className="px-4 py-5 mt-2 mb-6">
            {/* Volume */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {isElectric ? 'Energy Added' : 'Fuel Added'} *
              </Text>
              <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                <TextInput
                  className="flex-1 text-base text-ink dark:text-ink-on-dark"
                  value={volume}
                  onChangeText={(t) => { setVolume(t); markDirty(); }}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#A8A49D"
                  accessibilityLabel={`Volume in ${volumeLabel}`}
                />
                <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark ml-2">
                  {volumeLabel}
                </Text>
              </View>
            </View>

            {/* Price + Total (side by side) */}
            <View className="flex-row gap-3 mb-3">
              {/* Price per unit */}
              <View className="flex-1">
                <View className="flex-row items-center mb-1.5">
                  <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold" numberOfLines={1}>
                    Price / {volumeLabel}{entryMode === 'price' ? ' *' : ''}
                  </Text>
                  {entryMode === 'price' && priceTag != null && <SmartTag label={priceTag} />}
                  {entryMode === 'total' && <SmartTag label="Calculated" />}
                </View>
                {entryMode === 'price' ? (
                  <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                    <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mr-1">$</Text>
                    <TextInput
                      ref={priceRef}
                      className="flex-1 text-base text-ink dark:text-ink-on-dark"
                      value={pricePerUnit}
                      onChangeText={handlePriceChange}
                      keyboardType="decimal-pad"
                      placeholder="0.000"
                      placeholderTextColor="#A8A49D"
                      selectTextOnFocus={!!priceTag}
                      accessibilityLabel={`Price per ${volumeLabel}`}
                    />
                  </View>
                ) : (
                  <View className="rounded-xl px-3.5 py-3">
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        color: computedPrice ? FUEL_TEAL : ghostColor,
                        fontVariant: ['tabular-nums'],
                      }}
                      accessibilityLabel={`Calculated price: ${computedPrice ? `$${computedPrice}` : 'waiting for input'} per ${volumeLabel}`}
                    >
                      ${computedPrice || '0.000'}/{volumeLabel}
                    </Text>
                  </View>
                )}
              </View>

              {/* Total cost */}
              <View className="flex-1">
                <View className="flex-row items-center mb-1.5">
                  <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">
                    Total{entryMode === 'total' ? ' *' : ''}
                  </Text>
                  {entryMode === 'price' && <SmartTag label="Calculated" />}
                </View>
                {entryMode === 'total' ? (
                  <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                    <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mr-1">$</Text>
                    <TextInput
                      ref={totalRef}
                      className="flex-1 text-base text-ink dark:text-ink-on-dark"
                      value={totalCost}
                      onChangeText={(t) => { setTotalCost(t); markDirty(); }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#A8A49D"
                      accessibilityLabel="Total cost"
                      style={{ fontVariant: ['tabular-nums'] }}
                    />
                  </View>
                ) : (
                  <View className="rounded-xl px-3.5 py-3">
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: computedTotal ? FUEL_TEAL : ghostColor,
                        fontVariant: ['tabular-nums'],
                      }}
                      accessibilityLabel={`Calculated total: ${computedTotal ? `$${computedTotal}` : 'waiting for input'}`}
                    >
                      = ${computedTotal || '0.00'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Discount (slides in) */}
            {showDiscount && (
              <View className="mb-3">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">
                    Discount / {volumeLabel}
                  </Text>
                  <Pressable
                    onPress={handleToggleDiscount}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Remove discount"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={16} color={isDark ? '#78756F' : '#A8A49D'} />
                  </Pressable>
                </View>
                <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                  <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mr-1">$</Text>
                  <TextInput
                    ref={discountRef}
                    className="flex-1 text-base text-ink dark:text-ink-on-dark"
                    value={discountPerUnit}
                    onChangeText={(t) => { setDiscountPerUnit(t); markDirty(); }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#A8A49D"
                    accessibilityLabel={`Discount per ${volumeLabel}`}
                  />
                </View>
                {(() => {
                  const d = parseFloat(discountPerUnit);
                  const p = parseFloat(pricePerUnit);
                  return !isNaN(d) && !isNaN(p) && d > 0 && d >= p;
                })() && (
                  <Text className="text-xs text-warning mt-1 ml-1" accessibilityRole="alert">
                    Discount exceeds price. Total will be $0.00.
                  </Text>
                )}
              </View>
            )}

            {/* Action links */}
            <View className="flex-row items-center justify-between mb-4">
              {!showDiscount ? (
                <Pressable
                  onPress={handleToggleDiscount}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="py-1"
                  accessibilityLabel="Add a per-unit discount"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-medium text-primary">Add discount</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                onPress={handleModeSwitch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="py-1"
                accessibilityLabel={entryMode === 'price' ? 'Switch to entering total cost' : 'Switch to entering price per unit'}
                accessibilityRole="button"
              >
                <Text className="text-sm font-medium text-primary">
                  {entryMode === 'price' ? 'Enter total instead' : 'Enter price instead'}
                </Text>
              </Pressable>
            </View>

            {/* Partial fill */}
            <View className="flex-row items-center justify-between pt-3 border-t border-divider-subtle dark:border-divider-dark">
              <View className="flex-1 mr-3">
                <Text className="text-base text-ink dark:text-ink-on-dark">Partial fill</Text>
                <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5">
                  Excluded from efficiency calculations
                </Text>
              </View>
              <Switch
                value={isPartialFill}
                onValueChange={(v) => { setIsPartialFill(v); markDirty(); }}
                trackColor={{ false: isDark ? '#2A2926' : '#E2E0DB', true: isDark ? '#2E5A9E' : '#A7C4E4' }}
                thumbColor={isPartialFill ? '#4272C4' : isDark ? '#1A1917' : '#FEFDFB'}
                accessibilityLabel="This is a partial fill"
              />
            </View>
          </View>

          {/* ── Tier 3: Details ── */}
          <View>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold uppercase tracking-wider mb-3">
              Details
            </Text>

            <PlaceAutocomplete
              value={placeId}
              onChange={(id) => { setPlaceId(id); markDirty(); }}
              placeType="gas_station"
            />

            <View className="mb-4">
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">Notes</Text>
                <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark">{notes.length}/500</Text>
              </View>
              <TextInput
                className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 text-base text-ink dark:text-ink-on-dark"
                value={notes}
                onChangeText={(t) => { setNotes(t.slice(0, 500)); markDirty(); }}
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
              onPhotosChange={(p) => { setPhotos(p); markDirty(); }}
            />
          </View>

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete fill-up"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Fill-Up</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
