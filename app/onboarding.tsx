import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { useDialog } from '@/src/hooks/useDialog';
import { reloadAllStores } from '@/src/stores/orchestrator';
import { getBackupInfo, restoreBackup } from '@/src/services/backup';
import { getVolumeUnitForFuelType } from '@/src/constants/units';
import { decodeVin } from '@/src/services/vinDecoder';
import { t } from '@/src/i18n';

type FuelType = 'gas' | 'diesel' | 'electric';
type OdometerUnit = 'miles' | 'kilometers';

export default function OnboardingScreen() {
  const router = useRouter();
  const addVehicle = useVehicleStore((s) => s.addVehicle);
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('gas');
  const [odometerUnit, setOdometerUnit] = useState<OdometerUnit>(
    settings.defaultOdometerUnit as OdometerUnit
  );
  const [vin, setVin] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [completed, setCompleted] = useState(false);
  const navigatingRef = useRef(false);
  const { showDialog, dialogProps } = useDialog();

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!nickname.trim()) return false;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) return false;
    if (!make.trim()) return false;
    if (!model.trim()) return false;
    return true;
  }, [saving, nickname, year, make, model]);

  const handleSave = useCallback(async () => {
    if (!canSave || navigatingRef.current) return;
    navigatingRef.current = true;
    setSaving(true);
    try {
      await addVehicle(
        {
          nickname: nickname.trim(),
          year: parseInt(year, 10),
          make: make.trim(),
          model: model.trim(),
          fuelType,
          odometerUnit,
          volumeUnit: getVolumeUnitForFuelType(fuelType, settings.defaultFuelUnit),
        },
        true
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCompleted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog(t('onboarding.saveErrorTitle'), msg || t('onboarding.saveErrorMessage'));
      navigatingRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [canSave, nickname, year, make, model, fuelType, odometerUnit, settings.defaultFuelUnit]);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;
      setRestoring(true);

      let info;
      try {
        info = await getBackupInfo(fileUri);
      } catch (e) {
        const message = e instanceof Error ? e.message : t('onboarding.restoreInvalidMessage');
        showDialog(t('onboarding.restoreInvalidTitle'), message);
        setRestoring(false);
        return;
      }

      setRestoring(false);

      const vehiclesPart = t(info.vehicleCount === 1 ? 'settings.vehicleCountOne' : 'settings.vehicleCountOther', { count: info.vehicleCount });
      const eventsPart = t(info.eventCount === 1 ? 'settings.eventCountOne' : 'settings.eventCountOther', { count: info.eventCount });
      const remindersPart = t(info.reminderCount === 1 ? 'settings.reminderCountOne' : 'settings.reminderCountOther', { count: info.reminderCount });
      showDialog(
        t('onboarding.restoreConfirmTitle'),
        t('onboarding.restoreConfirmMessage', {
          vehicles: vehiclesPart,
          events: eventsPart,
          reminders: remindersPart,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('onboarding.restoreCta'),
            onPress: async () => {
              setRestoring(true);
              try {
                await restoreBackup(fileUri);
                await reloadAllStores();

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {
                const message = e instanceof Error ? e.message : t('onboarding.unexpectedError');
                showDialog(t('onboarding.restoreFailedTitle'), message);
              } finally {
                setRestoring(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : t('onboarding.unexpectedError');
      showDialog(t('onboarding.restoreFailedTitle'), message);
      setRestoring(false);
    }
  }, [restoring]);

  const handleVinLookup = useCallback(async () => {
    if (vin.length !== 17 || vinLoading) return;
    setVinLoading(true);
    setVinError('');
    try {
      const result = await decodeVin(vin.trim());
      if (result) {
        if (result.year) setYear(String(result.year));
        if (result.make) setMake(result.make);
        if (result.model) setModel(result.model);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setVinError(t('onboarding.vinError'));
      }
    } catch {
      setVinError(t('onboarding.vinError'));
    } finally {
      setVinLoading(false);
    }
  }, [vin, vinLoading]);

  const handleContinue = useCallback(async () => {
    await updateSetting('hasCompletedOnboarding', true);
  }, [updateSetting]);

  if (completed) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center px-8">
        <View
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D5F2E3' }}
          className="items-center justify-center mb-6"
        >
          <Ionicons name="checkmark" size={36} color="#2EAD76" />
        </View>
        <Text className="text-2xl font-bold text-ink dark:text-ink-on-dark text-center mb-2">
          {t('onboarding.completedTitle')}
        </Text>
        <Text className="text-base text-ink-secondary dark:text-ink-secondary-on-dark text-center mb-8 leading-6">
          {t('onboarding.completedDescription')}
        </Text>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          className="bg-primary py-4 rounded-2xl w-full items-center mb-3"
          accessibilityLabel={t('onboarding.logFirstEventA11y')}
          accessibilityRole="button"
        >
          <Text className="text-lg font-semibold text-white">{t('onboarding.logFirstEvent')}</Text>
        </Pressable>
        <Pressable
          onPress={handleContinue}
          className="py-3 items-center"
          accessibilityLabel={t('onboarding.goToDashboardA11y')}
          accessibilityRole="button"
        >
          <Text className="text-sm text-primary font-medium">{t('onboarding.exploreFirst')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome header */}
          <View className="items-center pt-12 pb-8 px-8">
            <View
              className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-6"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Image
                source={require('../assets/images/icon.png')}
                className="w-16 h-16 rounded-xl"
                resizeMode="contain"
              />
            </View>

            <Text className="text-5xl font-extrabold text-ink dark:text-ink-on-dark text-center">
              {t('onboarding.appName')}
            </Text>
            <Text className="text-lg text-ink-secondary dark:text-ink-secondary-on-dark mt-2 text-center leading-7">
              {t('onboarding.tagline')}
            </Text>
          </View>

          {/* Vehicle form */}
          <View className="px-6">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-5 font-semibold uppercase tracking-wider text-center">
              {t('onboarding.addFirstVehicle')}
            </Text>

            {/* VIN lookup (optional) */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {t('onboarding.vinLabel')}
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1 bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                  <TextInput
                    className="text-base text-ink dark:text-ink-on-dark"
                    value={vin}
                    onChangeText={(text) => setVin(text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 17))}
                    placeholder={t('onboarding.vinPlaceholder')}
                    placeholderTextColor="#A8A49D"
                    maxLength={17}
                    autoCapitalize="characters"
                    accessibilityLabel={t('onboarding.vinA11y')}
                  />
                </View>
                <Pressable
                  onPress={handleVinLookup}
                  disabled={vin.length !== 17 || vinLoading}
                  className={`px-4 rounded-xl items-center justify-center ${
                    vin.length === 17 && !vinLoading
                      ? 'bg-primary'
                      : 'border border-divider dark:border-divider-dark'
                  }`}
                  accessibilityLabel={t('onboarding.vinLookupA11y')}
                  accessibilityRole="button"
                >
                  {vinLoading ? (
                    <ActivityIndicator size="small" color="#4272C4" />
                  ) : (
                    <View className="items-center">
                      <Ionicons
                        name="search"
                        size={18}
                        color={vin.length === 17 ? '#FFFFFF' : '#A8A49D'}
                      />
                      <Text className={`text-xs font-semibold mt-0.5 ${vin.length === 17 ? 'text-white' : 'text-ink-muted dark:text-ink-muted-on-dark'}`}>
                        {t('onboarding.vinLookup')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
              {vinError ? (
                <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">{vinError}</Text>
              ) : (
                <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark mt-1">
                  {t('onboarding.vinHint')}
                </Text>
              )}
            </View>

            {/* Nickname */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {t('onboarding.nicknameLabel')}
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                <TextInput
                  className="text-base text-ink dark:text-ink-on-dark"
                  value={nickname}
                  onChangeText={(text) => setNickname(text.slice(0, 30))}
                  placeholder={t('onboarding.nicknamePlaceholder')}
                  placeholderTextColor="#A8A49D"
                  maxLength={30}
                  accessibilityLabel={t('onboarding.nicknameA11y')}
                />
              </View>
            </View>

            {/* Year */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {t('onboarding.yearLabel')}
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                <TextInput
                  className="text-base text-ink dark:text-ink-on-dark"
                  value={year}
                  onChangeText={(text) => setYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder={t('onboarding.yearPlaceholder')}
                  placeholderTextColor="#A8A49D"
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel={t('onboarding.yearA11y')}
                />
              </View>
            </View>

            {/* Make */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {t('onboarding.makeLabel')}
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                <TextInput
                  className="text-base text-ink dark:text-ink-on-dark"
                  value={make}
                  onChangeText={setMake}
                  placeholder={t('onboarding.makePlaceholder')}
                  placeholderTextColor="#A8A49D"
                  accessibilityLabel={t('onboarding.makeA11y')}
                />
              </View>
            </View>

            {/* Model */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                {t('onboarding.modelLabel')}
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                <TextInput
                  className="text-base text-ink dark:text-ink-on-dark"
                  value={model}
                  onChangeText={setModel}
                  placeholder={t('onboarding.modelPlaceholder')}
                  placeholderTextColor="#A8A49D"
                  accessibilityLabel={t('onboarding.modelA11y')}
                />
              </View>
            </View>

            {/* Fuel type */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
                {t('onboarding.fuelTypeLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'gas' as FuelType, label: t('onboarding.fuelTypeGas') },
                  { value: 'diesel' as FuelType, label: t('onboarding.fuelTypeDiesel') },
                  { value: 'electric' as FuelType, label: t('onboarding.fuelTypeElectric') },
                ]}
                selectedValue={fuelType}
                onValueChange={setFuelType}
                accessibilityLabel={t('onboarding.fuelTypeA11y')}
              />
            </View>

            {/* Odometer unit */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
                {t('onboarding.odometerUnitLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'miles' as OdometerUnit, label: t('onboarding.odoMiles') },
                  { value: 'kilometers' as OdometerUnit, label: t('onboarding.odoKilometers') },
                ]}
                selectedValue={odometerUnit}
                onValueChange={setOdometerUnit}
                accessibilityLabel={t('onboarding.odometerUnitA11y')}
              />
            </View>

            {/* Save button */}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => ({ opacity: pressed && canSave ? 0.85 : 1 })}
              className={`mt-4 py-4 rounded-2xl items-center ${
                canSave ? 'bg-primary' : 'bg-divider dark:bg-divider-dark'
              }`}
              accessibilityLabel={t('onboarding.saveA11y')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                className={`text-lg font-semibold ${
                  canSave ? 'text-white' : 'text-ink-muted dark:text-ink-muted-on-dark'
                }`}
              >
                {saving ? t('onboarding.saving') : t('onboarding.addVehicle')}
              </Text>
            </Pressable>

            <Text className="text-xs text-ink-muted dark:text-ink-faint-on-dark mt-4 text-center">
              {t('onboarding.noAccountFooter')}
            </Text>

            <Pressable
              onPress={handleRestore}
              disabled={restoring}
              className="mt-6 py-2 items-center"
              accessibilityLabel={t('onboarding.restoreA11y')}
              accessibilityRole="button"
            >
              <Text className="text-sm text-primary font-medium">
                {restoring ? t('onboarding.restoring') : t('onboarding.restorePrompt')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
