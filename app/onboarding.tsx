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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { useDialog } from '@/src/hooks/useDialog';
import { getBackupInfo, restoreBackup } from '@/src/services/backup';
import { getVolumeUnitForFuelType } from '@/src/constants/units';

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
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
      await updateSetting('hasCompletedOnboarding', true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog("Couldn't Save Vehicle", msg || 'Check your entries and try again. If this keeps happening, try restarting the app.');
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
        const message = e instanceof Error ? e.message : 'Could not read the selected file.';
        showDialog('Invalid Backup', message);
        setRestoring(false);
        return;
      }

      setRestoring(false);

      showDialog(
        'Restore Backup?',
        `This backup contains ${info.vehicleCount} vehicle${info.vehicleCount !== 1 ? 's' : ''}, ${info.eventCount} event${info.eventCount !== 1 ? 's' : ''}, and ${info.reminderCount} reminder${info.reminderCount !== 1 ? 's' : ''}.\n\nThis will restore all your data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              setRestoring(true);
              try {
                await restoreBackup(fileUri);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {
                const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
                showDialog('Restore Failed', message);
              } finally {
                setRestoring(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      showDialog('Restore Failed', message);
      setRestoring(false);
    }
  }, [restoring]);

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
              AutoMate
            </Text>
            <Text className="text-lg text-ink-secondary dark:text-ink-secondary-on-dark mt-2 text-center leading-7">
              Track every mile, own every dollar.
            </Text>
          </View>

          {/* Vehicle form */}
          <View className="px-6">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-5 font-semibold uppercase tracking-wider text-center">
              Add your first vehicle
            </Text>

            {/* Nickname */}
            <View className="mb-4">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                Nickname
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
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
                Year
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
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
                Make
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
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
                Model
              </Text>
              <View className="bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
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

            {/* Fuel type */}
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
                onValueChange={setFuelType}
                accessibilityLabel="Fuel type"
              />
            </View>

            {/* Odometer unit */}
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
                onValueChange={setOdometerUnit}
                accessibilityLabel="Odometer unit"
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
              accessibilityLabel="Save vehicle and continue"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                className={`text-lg font-semibold ${
                  canSave ? 'text-white' : 'text-ink-muted dark:text-ink-muted-on-dark'
                }`}
              >
                {saving ? 'Saving...' : 'Add Vehicle'}
              </Text>
            </Pressable>

            <Text className="text-xs text-ink-muted dark:text-ink-faint-on-dark mt-4 text-center">
              No account required. Your data stays on your device.
            </Text>

            <Pressable
              onPress={handleRestore}
              disabled={restoring}
              className="mt-6 py-2 items-center"
              accessibilityLabel="Restore from a backup file"
              accessibilityRole="button"
            >
              <Text className="text-sm text-primary font-medium">
                {restoring ? 'Restoring...' : 'Have a backup? Restore it'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
