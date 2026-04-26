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
  Image,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '@/src/components/ModalHeader';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { decodeVin } from '@/src/services/vinDecoder';
import { getVolumeUnitForFuelType } from '@/src/constants/units';
import type { Vehicle } from '@/src/types';

type FuelType = 'gas' | 'diesel' | 'electric';
type OdometerUnit = 'miles' | 'kilometers';

export default function VehicleModal() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const isEditing = !!vehicleId;

  const vehicles = useVehicleStore((s) => s.vehicles);
  const addVehicle = useVehicleStore((s) => s.addVehicle);
  const updateVehicle = useVehicleStore((s) => s.updateVehicle);
  const deleteVehicle = useVehicleStore((s) => s.deleteVehicle);
  const setActiveVehicle = useVehicleStore((s) => s.setActiveVehicle);
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const events = useEventStore((s) => s.events);
  const reminders = useReminderStore((s) => s.reminders);

  const [imagePath, setImagePath] = useState<string | undefined>();
  const [vin, setVin] = useState('');
  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gas');
  const [odometerUnit, setOdometerUnit] = useState<OdometerUnit>(
    settings.defaultOdometerUnit
  );
  const [fuelCapacity, setFuelCapacity] = useState('');
  const [vinStatus, setVinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saving, setSaving] = useState(false);

  const originalOdometerUnit = useMemo(() => {
    if (!isEditing || !vehicleId) return odometerUnit;
    const v = vehicles.find((v) => v.id === vehicleId);
    return v?.odometerUnit ?? odometerUnit;
  }, []);

  useEffect(() => {
    if (!isEditing || !vehicleId) return;
    const existing = vehicles.find((v) => v.id === vehicleId);
    if (!existing) return;

    setImagePath(existing.imagePath);
    setVin(existing.vin ?? '');
    setNickname(existing.nickname);
    setYear(String(existing.year));
    setMake(existing.make);
    setModel(existing.model);
    setTrim(existing.trim ?? '');
    setFuelType(existing.fuelType);
    setOdometerUnit(existing.odometerUnit);
    setFuelCapacity(existing.fuelCapacity ? String(existing.fuelCapacity) : '');
  }, []);

  const volumeUnit = useMemo(
    () => getVolumeUnitForFuelType(fuelType, settings.defaultFuelUnit),
    [fuelType, settings.defaultFuelUnit]
  );

  const capacityLabel = volumeUnit === 'gallons' ? 'gal' : volumeUnit === 'litres' ? 'L' : 'kWh';

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!nickname.trim()) return false;
    if (!year.trim() || isNaN(parseInt(year, 10))) return false;
    if (!make.trim()) return false;
    if (!model.trim()) return false;
    return true;
  }, [saving, nickname, year, make, model]);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };

    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const filename = `vehicle-${Crypto.randomUUID()}.${ext}`;
    const sourceFile = new File(asset.uri);
    const destFile = new File(Paths.document, filename);
    sourceFile.copy(destFile);
    setImagePath(destFile.uri);
  }, []);

  const handlePhotoPress = useCallback(() => {
    const options = imagePath
      ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel']
      : ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelIndex = options.length - 1;
    const destructiveIndex = imagePath ? 2 : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
          else if (index === 2 && imagePath) setImagePath(undefined);
        }
      );
    } else {
      Alert.alert('Vehicle Photo', '', [
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Library', onPress: () => pickImage('library') },
        ...(imagePath
          ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setImagePath(undefined) }]
          : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }, [imagePath, pickImage]);

  const handleVinBlur = useCallback(async () => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) return;

    setVinStatus('loading');
    const result = await decodeVin(cleaned);
    if (result && (result.year || result.make || result.model)) {
      if (result.year) setYear(String(result.year));
      if (result.make) setMake(result.make);
      if (result.model) setModel(result.model);
      setVinStatus('success');
    } else {
      setVinStatus('error');
    }
  }, [vin]);

  const handleFuelTypeChange = useCallback(
    (ft: FuelType) => {
      setFuelType(ft);
    },
    []
  );

  const handleOdometerUnitChange = useCallback(
    (unit: OdometerUnit) => {
      if (isEditing && unit !== originalOdometerUnit) {
        const eventCount = events.length;
        Alert.alert(
          'Convert Odometer Readings',
          `This will convert ${eventCount} odometer reading${eventCount !== 1 ? 's' : ''} from ${originalOdometerUnit} to ${unit}. Continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Convert', onPress: () => setOdometerUnit(unit) },
          ]
        );
      } else {
        setOdometerUnit(unit);
      }
    },
    [isEditing, originalOdometerUnit, events.length]
  );

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const yearNum = parseInt(year, 10);
      const capNum = fuelCapacity ? parseFloat(fuelCapacity) : undefined;

      const data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'isActive'> = {
        nickname: nickname.trim(),
        year: yearNum,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        vin: vin.trim().toUpperCase() || undefined,
        fuelType,
        odometerUnit,
        volumeUnit,
        fuelCapacity: capNum,
        imagePath,
      };

      if (isEditing && vehicleId) {
        await updateVehicle(vehicleId, { ...data, odometerUnit });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        const isFirst = vehicles.length === 0;
        if (isFirst) {
          await addVehicle(data, true);
          if (!settings.hasCompletedOnboarding) {
            await updateSetting('hasCompletedOnboarding', true);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        } else {
          Alert.alert(
            'Make Active?',
            `Make "${nickname.trim()}" the active vehicle?`,
            [
              {
                text: 'No',
                onPress: async () => {
                  await addVehicle(data, false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  router.back();
                },
              },
              {
                text: 'Yes',
                onPress: async () => {
                  await addVehicle(data, true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  router.back();
                },
              },
            ]
          );
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [canSave, nickname, year, make, model, trim, vin, fuelType, odometerUnit, volumeUnit, fuelCapacity, imagePath, isEditing, vehicleId, vehicles.length, settings.hasCompletedOnboarding]);

  const handleDelete = useCallback(() => {
    if (!vehicleId) return;

    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    const isOnly = vehicles.length <= 1;
    const isActive = vehicle.isActive;
    const others = vehicles.filter((v) => v.id !== vehicleId);

    if (isOnly) {
      Alert.alert(
        'Cannot Delete',
        'Add another vehicle before deleting this one.',
        [{ text: 'OK' }]
      );
      return;
    }

    const eventCount = events.filter((e) => e.vehicleId === vehicleId).length;
    const reminderCount = reminders.filter((r) => r.vehicleId === vehicleId).length;
    const cascadeCount = eventCount + reminderCount;

    if (isActive && others.length > 0) {
      Alert.alert(
        'Choose New Active Vehicle',
        `Choose the vehicle to activate after deleting "${vehicle.nickname}".`,
        [
          ...others.map((v) => ({
            text: v.nickname,
            onPress: async () => {
              try {
                await setActiveVehicle(v.id);
                await deleteVehicle(vehicleId);
                router.back();
              } catch {
                Alert.alert('Error', 'Failed to delete vehicle.');
              }
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    } else {
      Alert.alert(
        'Delete Vehicle',
        `Delete "${vehicle.nickname}"? This will permanently remove ${cascadeCount > 0 ? `${cascadeCount} event${cascadeCount !== 1 ? 's' : ''} and reminder${cascadeCount !== 1 ? 's' : ''}` : 'it'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteVehicle(vehicleId);
                router.back();
              } catch {
                Alert.alert('Error', 'Failed to delete vehicle.');
              }
            },
          },
        ]
      );
    }
  }, [vehicleId, vehicles, events, reminders]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={isEditing ? 'Edit Vehicle' : 'Add Vehicle'}
        onCancel={() => router.back()}
        onSave={handleSave}
        saveDisabled={!canSave}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <View className="items-center mb-6">
            <Pressable
              onPress={handlePhotoPress}
              className="w-[120px] h-[120px] rounded-full bg-surface dark:bg-surface-dark items-center justify-center overflow-hidden border-2 border-divider dark:border-divider-dark"
              accessibilityLabel={imagePath ? 'Change vehicle photo' : 'Add vehicle photo'}
              accessibilityRole="button"
            >
              {imagePath ? (
                <Image
                  source={{ uri: imagePath }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center">
                  <Ionicons name="camera-outline" size={32} color="#A8A49D" />
                  <Text className="text-xs text-ink-muted mt-1">Add Photo</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* VIN */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              VIN
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="flex-1 text-base text-ink dark:text-ink-on-dark"
                value={vin}
                onChangeText={(t) => {
                  setVin(t.toUpperCase().slice(0, 17));
                  if (vinStatus !== 'idle') setVinStatus('idle');
                }}
                onBlur={handleVinBlur}
                placeholder="17-character VIN"
                placeholderTextColor="#A8A49D"
                autoCapitalize="characters"
                maxLength={17}
                accessibilityLabel="Vehicle Identification Number"
              />
              {vinStatus === 'loading' && (
                <ActivityIndicator size="small" color="#3B82F6" />
              )}
            </View>
            {vinStatus === 'success' && (
              <Text className="text-xs text-green-600 mt-1">Auto-filled from VIN</Text>
            )}
            {vinStatus === 'error' && (
              <Text className="text-xs text-warning mt-1">Couldn't look up VIN — enter details manually</Text>
            )}
          </View>

          {/* Nickname */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Nickname *
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={nickname}
                onChangeText={(t) => setNickname(t.slice(0, 30))}
                placeholder="e.g., The Corolla"
                placeholderTextColor="#A8A49D"
                maxLength={30}
                accessibilityLabel="Vehicle nickname"
              />
            </View>
          </View>

          {/* Year */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Year *
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={year}
                onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="2024"
                placeholderTextColor="#A8A49D"
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel="Vehicle year"
              />
            </View>
          </View>

          {/* Make */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Make *
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={make}
                onChangeText={setMake}
                placeholder="Toyota"
                placeholderTextColor="#A8A49D"
                accessibilityLabel="Vehicle make"
              />
            </View>
          </View>

          {/* Model */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Model *
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={model}
                onChangeText={setModel}
                placeholder="Corolla"
                placeholderTextColor="#A8A49D"
                accessibilityLabel="Vehicle model"
              />
            </View>
          </View>

          {/* Trim */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Trim
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={trim}
                onChangeText={setTrim}
                placeholder="SE, XLE, etc."
                placeholderTextColor="#A8A49D"
                accessibilityLabel="Vehicle trim"
              />
            </View>
          </View>

          {/* Fuel Type */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
              Fuel Type
            </Text>
            <SegmentedControl
              options={[
                { value: 'gas' as FuelType, label: 'Gas' },
                { value: 'diesel' as FuelType, label: 'Diesel' },
                { value: 'electric' as FuelType, label: 'Electric' },
              ]}
              selectedValue={fuelType}
              onValueChange={handleFuelTypeChange}
              accessibilityLabel="Fuel type"
            />
          </View>

          {/* Odometer Unit */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
              Odometer Unit
            </Text>
            <SegmentedControl
              options={[
                { value: 'miles' as OdometerUnit, label: 'Miles' },
                { value: 'kilometers' as OdometerUnit, label: 'Kilometers' },
              ]}
              selectedValue={odometerUnit}
              onValueChange={handleOdometerUnitChange}
              accessibilityLabel="Odometer unit"
            />
          </View>

          {/* Fuel Capacity */}
          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Fuel Capacity
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="flex-1 text-base text-ink dark:text-ink-on-dark"
                value={fuelCapacity}
                onChangeText={setFuelCapacity}
                placeholder="Optional"
                placeholderTextColor="#A8A49D"
                keyboardType="decimal-pad"
                accessibilityLabel={`Fuel capacity in ${capacityLabel}`}
              />
              <Text className="text-sm text-ink-muted ml-2">{capacityLabel}</Text>
            </View>
          </View>

          {/* Delete button (edit mode) */}
          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="mt-4 mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete vehicle"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Vehicle</Text>
            </Pressable>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
