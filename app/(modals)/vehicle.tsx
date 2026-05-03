import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
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
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useToastStore } from '@/src/stores/toastStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { useDocumentStore } from '@/src/stores/documentStore';
import { switchVehicle, onVehicleAdded, onVehicleUnitChanged } from '@/src/stores/orchestrator';
import { decodeVin } from '@/src/services/vinDecoder';
import { getVolumeUnitForFuelType } from '@/src/constants/units';
import type { Vehicle } from '@/src/types';
import { t } from '@/src/i18n';

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
  const documentCount = useDocumentStore((s) => s.documents.length);
  const loadDocuments = useDocumentStore((s) => s.loadForVehicle);
  const nav = useGuardedNavigate();

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
  const isDirty = useRef(false);
  const markDirty = useCallback(() => { isDirty.current = true; }, []);
  const { showDialog, dialogProps } = useDialog();

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

  useEffect(() => {
    if (isEditing && vehicleId) {
      loadDocuments(vehicleId);
    }
  }, [isEditing, vehicleId]);

  const volumeUnit = useMemo(
    () => getVolumeUnitForFuelType(fuelType, settings.defaultFuelUnit),
    [fuelType, settings.defaultFuelUnit]
  );

  const capacityLabel = volumeUnit === 'gallons' ? 'gal' : volumeUnit === 'litres' ? 'L' : 'kWh';

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!nickname.trim()) return false;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) return false;
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
        showDialog(t('vehicleModal.permissionTitle'), t('vehicleModal.cameraPermissionMessage'));
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
    markDirty();
  }, []);

  const handlePhotoPress = useCallback(() => {
    const options = imagePath
      ? [t('vehicleModal.takePhoto'), t('vehicleModal.chooseFromLibrary'), t('vehicleModal.removePhoto'), t('common.cancel')]
      : [t('vehicleModal.takePhoto'), t('vehicleModal.chooseFromLibrary'), t('common.cancel')];
    const cancelIndex = options.length - 1;
    const destructiveIndex = imagePath ? 2 : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
          else if (index === 2 && imagePath) { setImagePath(undefined); markDirty(); }
        }
      );
    } else {
      showDialog(t('vehicleModal.photoSheetTitle'), undefined, [
        { text: t('vehicleModal.takePhoto'), onPress: () => pickImage('camera') },
        { text: t('vehicleModal.chooseFromLibrary'), onPress: () => pickImage('library') },
        ...(imagePath
          ? [{ text: t('vehicleModal.removePhoto'), style: 'destructive' as const, onPress: () => { setImagePath(undefined); markDirty(); } }]
          : []),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    }
  }, [imagePath, pickImage]);

  const handleVinBlur = useCallback(async () => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) return;

    setVinStatus('loading');
    const result = await decodeVin(cleaned);
    if (result && (result.year || result.make || result.model)) {
      const hasExisting = year.trim() || make.trim() || model.trim();
      const applyDecoded = () => {
        if (result.year) setYear(String(result.year));
        if (result.make) setMake(result.make);
        if (result.model) setModel(result.model);
        setVinStatus('success');
      };
      if (hasExisting) {
        const parts = [result.year && `${result.year}`, result.make, result.model].filter(Boolean).join(' ');
        showDialog(
          t('vehicleModal.vinReplaceTitle'),
          t('vehicleModal.vinReplaceMessage', { values: parts }),
          [
            { text: t('vehicleModal.vinKeepCurrent'), style: 'cancel', onPress: () => setVinStatus('success') },
            { text: t('vehicleModal.vinReplace'), onPress: applyDecoded },
          ]
        );
      } else {
        applyDecoded();
      }
    } else {
      setVinStatus('error');
    }
  }, [vin]);

  const handleFuelTypeChange = useCallback(
    (ft: FuelType) => {
      setFuelType(ft);
      markDirty();
    },
    []
  );

  const handleOdometerUnitChange = useCallback(
    (unit: OdometerUnit) => {
      if (isEditing && unit !== originalOdometerUnit) {
        const eventCount = events.length;
        showDialog(
          t('vehicleModal.convertOdoTitle'),
          t(eventCount === 1 ? 'vehicleModal.convertOdoMessageOne' : 'vehicleModal.convertOdoMessageOther', {
            count: eventCount,
            from: originalOdometerUnit,
            to: unit,
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('vehicleModal.convertCta'), onPress: () => setOdometerUnit(unit) },
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

      const vehicleName = nickname.trim();
      if (isEditing && vehicleId) {
        const unitChanged = odometerUnit !== originalOdometerUnit;
        await updateVehicle(vehicleId, { ...data, odometerUnit });
        if (unitChanged) {
          await onVehicleUnitChanged(vehicleId);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useToastStore.getState().show(t('vehicleModal.updatedToast', { name: vehicleName }));
        router.back();
      } else {
        const isFirst = vehicles.length === 0;
        if (isFirst) {
          const vehicle = await addVehicle(data, true);
          await onVehicleAdded(vehicle.id, true);
          if (!settings.hasCompletedOnboarding) {
            await updateSetting('hasCompletedOnboarding', true);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          useToastStore.getState().show(t('vehicleModal.addedToast', { name: vehicleName }));
          router.back();
        } else {
          showDialog(
            t('vehicleModal.makeActiveTitle'),
            t('vehicleModal.makeActiveMessage', { name: vehicleName }),
            [
              {
                text: t('vehicleModal.no'),
                onPress: async () => {
                  await addVehicle(data, false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  useToastStore.getState().show(t('vehicleModal.addedToast', { name: vehicleName }));
                  router.back();
                },
              },
              {
                text: t('vehicleModal.yes'),
                onPress: async () => {
                  const vehicle = await addVehicle(data, true);
                  await onVehicleAdded(vehicle.id, true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  useToastStore.getState().show(t('vehicleModal.addedToast', { name: vehicleName }));
                  router.back();
                },
              },
            ]
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog(t('vehicleModal.saveErrorTitle'), msg || t('vehicleModal.saveErrorMessage'));
    } finally {
      setSaving(false);
    }
  }, [canSave, nickname, year, make, model, trim, vin, fuelType, odometerUnit, volumeUnit, fuelCapacity, imagePath, isEditing, vehicleId, vehicles.length, settings.hasCompletedOnboarding]);

  const handleCancel = useCallback(() => {
    const hasInput = !isEditing && !!(nickname.trim() || year || make.trim() || model.trim());
    if (isDirty.current || hasInput) {
      showDialog(t('eventForm.discardTitle'), t('eventForm.discardMessage'), [
        { text: t('eventForm.keepEditing'), style: 'cancel' },
        { text: t('eventForm.discard'), style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [isEditing, nickname, year, make, model, router]);

  const handleDelete = useCallback(() => {
    if (!vehicleId) return;

    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    const isOnly = vehicles.length <= 1;
    const isActive = vehicle.isActive;
    const others = vehicles.filter((v) => v.id !== vehicleId);

    if (isOnly) {
      showDialog(
        t('vehicleModal.cannotDeleteTitle'),
        t('vehicleModal.cannotDeleteMessage')
      );
      return;
    }

    const eventCount = events.filter((e) => e.vehicleId === vehicleId).length;
    const reminderCount = reminders.filter((r) => r.vehicleId === vehicleId).length;
    const cascadeCount = eventCount + reminderCount;

    if (isActive && others.length > 0) {
      showDialog(
        t('vehicleModal.chooseActiveTitle'),
        t('vehicleModal.chooseActiveMessage', { name: vehicle.nickname }),
        [
          ...others.map((v) => ({
            text: v.nickname,
            onPress: async () => {
              try {
                await switchVehicle(v.id);
                await deleteVehicle(vehicleId);
                router.back();
              } catch {
                showDialog(t('vehicleModal.deleteVehicleErrorTitle'), t('vehicleModal.deleteVehicleErrorMessage'));
              }
            },
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    } else {
      const messageKey = cascadeCount === 0
        ? 'vehicleModal.deleteVehicleMessageZero'
        : cascadeCount === 1
          ? 'vehicleModal.deleteVehicleMessageOne'
          : 'vehicleModal.deleteVehicleMessageOther';
      showDialog(
        t('vehicleModal.deleteVehicleTitle'),
        t(messageKey, { name: vehicle.nickname, count: cascadeCount }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteVehicle(vehicleId);
                router.back();
              } catch {
                showDialog(t('vehicleModal.deleteVehicleErrorTitle'), t('vehicleModal.deleteVehicleErrorMessage'));
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
        title={isEditing ? t('vehicleModal.editTitle') : t('vehicleModal.addTitle')}
        onCancel={handleCancel}
        onSave={handleSave}
        saveDisabled={!canSave}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* ── Your Vehicle ── */}
          <View className="items-center mb-4">
            <Pressable
              onPress={handlePhotoPress}
              className="w-[120px] h-[120px] rounded-full bg-surface dark:bg-surface-dark items-center justify-center overflow-hidden border-2 border-divider dark:border-divider-dark"
              accessibilityLabel={imagePath ? t('vehicleModal.changePhotoA11y') : t('vehicleModal.addPhotoA11y')}
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
                  <Text className="text-xs text-ink-muted mt-1">{t('vehicleModal.addPhotoLabel')}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View className="mb-6">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.nicknameLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={nickname}
                onChangeText={(text) => { setNickname(text.slice(0, 30)); markDirty(); }}
                placeholder={t('vehicleModal.nicknamePlaceholder')}
                placeholderTextColor="#A8A49D"
                maxLength={30}
                accessibilityLabel={t('vehicleModal.nicknameA11y')}
              />
            </View>
          </View>

          {/* ── Vehicle Details ── */}
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold uppercase mb-3" style={{ letterSpacing: 1.5 }}>
            {t('vehicleModal.vehicleDetails')}
          </Text>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.vinLabel')}
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="flex-1 text-base text-ink dark:text-ink-on-dark"
                value={vin}
                onChangeText={(text) => {
                  setVin(text.toUpperCase().slice(0, 17));
                  if (vinStatus !== 'idle') setVinStatus('idle');
                  markDirty();
                }}
                onBlur={handleVinBlur}
                placeholder={t('vehicleModal.vinPlaceholder')}
                placeholderTextColor="#A8A49D"
                autoCapitalize="characters"
                maxLength={17}
                accessibilityLabel={t('vehicleModal.vinA11y')}
              />
              {vinStatus === 'loading' && (
                <ActivityIndicator size="small" color="#4272C4" />
              )}
            </View>
            {vinStatus === 'success' && (
              <View className="flex-row items-center mt-1.5 gap-1">
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text className="text-xs" style={{ color: '#10B981' }}>
                  {t('vehicleModal.vinFilledFmt', { values: [year && year, make, model].filter(Boolean).join(', ') })}
                </Text>
              </View>
            )}
            {vinStatus === 'error' && (
              <Text className="text-xs mt-1" style={{ color: '#F59E0B' }}>{t('vehicleModal.vinErrorMessage')}</Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.yearLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={year}
                onChangeText={(text) => { setYear(text.replace(/[^0-9]/g, '').slice(0, 4)); markDirty(); }}
                placeholder={t('vehicleModal.yearPlaceholder')}
                placeholderTextColor="#A8A49D"
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel={t('vehicleModal.yearA11y')}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.makeLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={make}
                onChangeText={(text) => { setMake(text); markDirty(); }}
                placeholder={t('vehicleModal.makePlaceholder')}
                placeholderTextColor="#A8A49D"
                maxLength={50}
                accessibilityLabel={t('vehicleModal.makeA11y')}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.modelLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={model}
                onChangeText={(text) => { setModel(text); markDirty(); }}
                placeholder={t('vehicleModal.modelPlaceholder')}
                placeholderTextColor="#A8A49D"
                maxLength={50}
                accessibilityLabel={t('vehicleModal.modelA11y')}
              />
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.trimLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={trim}
                onChangeText={(text) => { setTrim(text); markDirty(); }}
                placeholder={t('vehicleModal.trimPlaceholder')}
                placeholderTextColor="#A8A49D"
                maxLength={30}
                accessibilityLabel={t('vehicleModal.trimA11y')}
              />
            </View>
          </View>

          {/* ── Configuration ── */}
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold uppercase mb-3" style={{ letterSpacing: 1.5 }}>
            {t('vehicleModal.configuration')}
          </Text>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
              {t('vehicleModal.fuelTypeLabel')}
            </Text>
            <SegmentedControl
              options={[
                { value: 'gas' as FuelType, label: t('vehicleModal.fuelTypeGas') },
                { value: 'diesel' as FuelType, label: t('vehicleModal.fuelTypeDiesel') },
                { value: 'electric' as FuelType, label: t('vehicleModal.fuelTypeElectric') },
              ]}
              selectedValue={fuelType}
              onValueChange={handleFuelTypeChange}
              accessibilityLabel={t('vehicleModal.fuelTypeA11y')}
            />
          </View>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
              {t('vehicleModal.odometerUnitLabel')}
            </Text>
            <SegmentedControl
              options={[
                { value: 'miles' as OdometerUnit, label: t('vehicleModal.odoMiles') },
                { value: 'kilometers' as OdometerUnit, label: t('vehicleModal.odoKilometers') },
              ]}
              selectedValue={odometerUnit}
              onValueChange={handleOdometerUnitChange}
              accessibilityLabel={t('vehicleModal.odometerUnitA11y')}
            />
          </View>

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('vehicleModal.fuelCapacityLabel')}
            </Text>
            <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="flex-1 text-base text-ink dark:text-ink-on-dark"
                value={fuelCapacity}
                onChangeText={(text) => { setFuelCapacity(text); markDirty(); }}
                placeholder={t('vehicleModal.fuelCapacityPlaceholder')}
                placeholderTextColor="#A8A49D"
                keyboardType="decimal-pad"
                accessibilityLabel={t('vehicleModal.fuelCapacityA11y', { unit: capacityLabel })}
              />
              <Text className="text-sm text-ink-muted ml-2">{capacityLabel}</Text>
            </View>
          </View>

          {isEditing && (
            <>
              <Text
                className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold uppercase mb-3 mt-6"
                style={{ letterSpacing: 1.5 }}
              >
                {t('vehicleModal.documents')}
              </Text>
              <Pressable
                onPress={() => nav.push(`/(modals)/vehicle-documents?vehicleId=${vehicleId}`)}
                className="flex-row items-center justify-between px-4 py-4 bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark mb-4"
                accessibilityLabel={t('vehicleModal.documentsRowA11y', { count: documentCount })}
                accessibilityRole="button"
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons name="document-text-outline" size={20} color="#A8A49D" />
                  <Text className="text-base text-ink dark:text-ink-on-dark">{t('vehicleModal.documents')}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark">{documentCount}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#A8A49D" />
                </View>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                className="mt-4 mb-8 py-3 rounded-xl border border-destructive items-center"
                accessibilityLabel={t('vehicleModal.deleteVehicleA11y')}
                accessibilityRole="button"
              >
                <Text className="text-destructive font-semibold text-base">{t('vehicleModal.deleteVehicle')}</Text>
              </Pressable>
            </>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
