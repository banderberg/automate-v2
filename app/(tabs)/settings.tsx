import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Modal, FlatList } from 'react-native';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { createBackup, getBackupInfo, restoreBackup } from '@/src/services/backup';
import { loadTestData } from '@/src/db/testData';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { getDatabase } from '@/src/db/client';

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CAD', label: 'CAD (C$)' },
  { value: 'AUD', label: 'AUD (A$)' },
];

const FUEL_UNITS = [
  { value: 'gallons', label: 'Gallons' },
  { value: 'litres', label: 'Litres' },
];

const ODOMETER_UNITS = [
  { value: 'miles', label: 'Miles' },
  { value: 'kilometers', label: 'Kilometers' },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="px-4 pt-6 pb-2 text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider">
      {title}
    </Text>
  );
}

function RowItem({
  label,
  subtitle,
  value,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark active:bg-surface dark:active:bg-surface-dark"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
    >
      <View className="flex-1 mr-3">
        <Text className="text-base text-ink dark:text-ink-on-dark">{label}</Text>
        {subtitle && (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5">{subtitle}</Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        {value && (
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark">{value}</Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color="#A8A49D" />
        )}
      </View>
    </Pressable>
  );
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selectedValue, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end" style={{ backgroundColor: 'rgba(28, 27, 24, 0.4)' }}
        onPress={onClose}
        accessibilityLabel="Close picker"
      >
        <Pressable
          className="bg-card dark:bg-card-dark rounded-t-2xl"
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider dark:border-divider-dark">
            <Text className="text-base font-semibold text-ink dark:text-ink-on-dark">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Done"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="text-base text-primary font-semibold">Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                className="flex-row items-center justify-between px-4 py-4 border-b border-divider-subtle dark:border-divider-dark"
                accessibilityLabel={`${item.label}${selectedValue === item.value ? ', selected' : ''}`}
                accessibilityRole="button"
              >
                <Text className="text-base text-ink dark:text-ink-on-dark">
                  {item.label}
                </Text>
                {selectedValue === item.value && (
                  <Ionicons name="checkmark" size={20} color="#4272C4" />
                )}
              </Pressable>
            )}
            scrollEnabled={false}
          />
          <View className="h-8" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const nav = useGuardedNavigate();
  const { settings, updateSetting } = useSettingsStore();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingTestData, setIsLoadingTestData] = useState(false);
  const { showDialog, dialogProps } = useDialog();

  const handleBackup = useCallback(async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const fileUri = await createBackup();
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Save AutoMate Backup',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      showDialog('Backup Failed', message);
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp]);

  const handleRestore = useCallback(async () => {
    if (isRestoring) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;

      setIsRestoring(true);

      let info;
      try {
        info = await getBackupInfo(fileUri);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not read the selected file.';
        showDialog('Invalid Backup', message);
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);

      showDialog(
        'Restore Backup?',
        `This backup contains ${info.vehicleCount} vehicle${info.vehicleCount !== 1 ? 's' : ''}, ${info.eventCount} event${info.eventCount !== 1 ? 's' : ''}, and ${info.reminderCount} reminder${info.reminderCount !== 1 ? 's' : ''}.\n\nRestoring will replace ALL current data. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setIsRestoring(true);
              try {
                await restoreBackup(fileUri);
                showDialog('Restore Complete', 'Your data has been restored successfully.');
              } catch (e) {
                const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
                showDialog('Restore Failed', message);
              } finally {
                setIsRestoring(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      showDialog('Restore Failed', message);
      setIsRestoring(false);
    }
  }, [isRestoring]);

  const handleLoadTestData = useCallback(() => {
    showDialog(
      'Load Test Data?',
      'This will replace all current vehicles, events, and reminders with 2 years of sample data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Test Data',
          style: 'destructive',
          onPress: async () => {
            setIsLoadingTestData(true);
            try {
              const result = await loadTestData();
              const vehicleStore = useVehicleStore.getState();
              await vehicleStore.initialize();
              const active = useVehicleStore.getState().activeVehicle;
              if (active) {
                await Promise.all([
                  useEventStore.getState().loadForVehicle(active.id),
                  useReminderStore.getState().loadForVehicle(active.id),
                ]);
              }
              await useSettingsStore.getState().initialize();
              showDialog(
                'Test Data Loaded',
                `Created ${result.vehicles} vehicles, ${result.events} events, and ${result.reminders} reminders spanning 2 years.`,
              );
            } catch (e) {
              const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
              showDialog('Failed', message);
            } finally {
              setIsLoadingTestData(false);
            }
          },
        },
      ],
    );
  }, []);

  const handleResetAllData = useCallback(() => {
    showDialog(
      'Reset All Data?',
      'This will permanently delete all vehicles, events, and reminders. You will be returned to the onboarding screen. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              await db.execAsync('DELETE FROM event_service_type;');
              await db.execAsync('DELETE FROM event_photo;');
              await db.execAsync('DELETE FROM reminder;');
              await db.execAsync('DELETE FROM event;');
              await db.execAsync('DELETE FROM vehicle;');
              await db.execAsync('DELETE FROM place;');
              useEventStore.getState().clearEvents();
              useReminderStore.getState().clearReminders();
              await useVehicleStore.getState().initialize();
              nav.replace('/onboarding');
            } catch (e) {
              const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
              showDialog('Reset Failed', message);
            }
          },
        },
      ],
    );
  }, []);

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    title: string;
    options: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
  }>({ visible: false, title: '', options: [], selectedValue: '', onSelect: () => {} });

  const closePicker = useCallback(() => {
    setPickerConfig((c) => ({ ...c, visible: false }));
  }, []);

  const openCurrencyPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: 'Currency',
      options: CURRENCIES,
      selectedValue: settings.currency,
      onSelect: (v) => updateSetting('currency', v),
    });
  }, [settings.currency, updateSetting]);

  const openFuelUnitPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: 'Default Fuel Unit',
      options: FUEL_UNITS,
      selectedValue: settings.defaultFuelUnit,
      onSelect: (v) => updateSetting('defaultFuelUnit', v as 'gallons' | 'litres'),
    });
  }, [settings.defaultFuelUnit, updateSetting]);

  const openOdometerUnitPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: 'Default Odometer Unit',
      options: ODOMETER_UNITS,
      selectedValue: settings.defaultOdometerUnit,
      onSelect: (v) => updateSetting('defaultOdometerUnit', v as 'miles' | 'kilometers'),
    });
  }, [settings.defaultOdometerUnit, updateSetting]);

  const currencyLabel = CURRENCIES.find((c) => c.value === settings.currency)?.label ?? settings.currency;
  const fuelUnitLabel = FUEL_UNITS.find((f) => f.value === settings.defaultFuelUnit)?.label ?? settings.defaultFuelUnit;
  const odoUnitLabel = ODOMETER_UNITS.find((o) => o.value === settings.defaultOdometerUnit)?.label ?? settings.defaultOdometerUnit;

  const themes = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <View className="px-4 py-4 bg-surface dark:bg-surface-dark">
        <Text className="text-2xl font-bold text-ink dark:text-ink-on-dark">Settings</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View className="bg-card dark:bg-card-dark border-y border-divider-subtle dark:border-divider-dark">
          <View className="px-4 py-4">
            <Text className="text-base text-ink dark:text-ink-on-dark mb-3">Theme</Text>
            <View className="flex-row gap-2">
              {themes.map(({ value, label }) => (
                <Pressable
                  key={value}
                  onPress={() => updateSetting('theme', value)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    settings.theme === value
                      ? 'bg-primary'
                      : 'bg-surface dark:bg-surface-dark'
                  }`}
                  accessibilityLabel={`Set theme to ${label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: settings.theme === value }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      settings.theme === value
                        ? 'text-white'
                        : 'text-ink-secondary dark:text-ink-secondary-on-dark'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Defaults */}
        <SectionHeader title="Defaults" />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label="Currency"
            value={currencyLabel}
            onPress={openCurrencyPicker}
            accessibilityLabel={`Currency: ${currencyLabel}`}
          />
          <RowItem
            label="Fuel Unit"
            value={fuelUnitLabel}
            onPress={openFuelUnitPicker}
            accessibilityLabel={`Default fuel unit: ${fuelUnitLabel}`}
          />
          <RowItem
            label="Odometer Unit"
            value={odoUnitLabel}
            onPress={openOdometerUnitPicker}
            accessibilityLabel={`Default odometer unit: ${odoUnitLabel}`}
          />
        </View>

        {/* Vehicles */}
        <SectionHeader title="Vehicles" />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label="Manage Vehicles"
            value={`${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}`}
            onPress={() => nav.push('/(modals)/manage-vehicles')}
            accessibilityLabel="Manage Vehicles"
          />
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label={isBackingUp ? 'Preparing backup...' : 'Backup Data'}
            subtitle="Save a copy of all vehicles and events"
            onPress={isBackingUp ? undefined : handleBackup}
            accessibilityLabel={isBackingUp ? 'Backup in progress' : 'Backup Data'}
          />
          <RowItem
            label={isRestoring ? 'Restoring...' : 'Restore Data'}
            subtitle="Replace all current data from a backup file"
            onPress={isRestoring ? undefined : handleRestore}
            accessibilityLabel={isRestoring ? 'Restore in progress' : 'Restore Data'}
          />
          <RowItem
            label="Import Data"
            onPress={() => nav.push('/(modals)/import')}
            accessibilityLabel="Import Data"
          />
          <RowItem
            label="Export Data"
            onPress={() => nav.push('/(modals)/export')}
            accessibilityLabel="Export Data"
          />
        </View>

        {/* Help */}
        <SectionHeader title="Help" />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label="How is Cost / Mile calculated?"
            subtitle="Total spending divided by total distance driven in the selected period."
            accessibilityLabel="Cost per mile is total spending divided by total distance driven"
          />
          <RowItem
            label="How is fuel efficiency calculated?"
            subtitle="Distance between full fill-ups divided by fuel volume. Partial fills are excluded."
            accessibilityLabel="Fuel efficiency is distance between full fill-ups divided by fuel volume"
          />
          <RowItem
            label="What is a partial fill?"
            subtitle="When you don't fill the tank completely. Marked partial fills are excluded from efficiency calculations because the math requires full-to-full measurements."
            accessibilityLabel="Partial fill explanation"
          />
          <RowItem
            label="How do reminders work?"
            subtitle="Set a distance or time interval. AutoMate estimates when you'll reach the threshold based on your driving patterns and notifies you."
            accessibilityLabel="Reminder explanation"
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem label={`AutoMate v${Constants.expoConfig?.version ?? '2.0'}`} />
        </View>

        {__DEV__ && (
          <>
            <SectionHeader title="Developer" />
            <View className="border-t border-divider-subtle dark:border-divider-dark">
              <RowItem
                label={isLoadingTestData ? 'Loading test data...' : 'Load Test Data'}
                onPress={isLoadingTestData ? undefined : handleLoadTestData}
                accessibilityLabel="Load test data with 2 years of sample events"
              />
              <RowItem
                label="Reset All Data"
                subtitle="Delete everything and return to onboarding"
                onPress={handleResetAllData}
                accessibilityLabel="Reset all data"
              />
            </View>
          </>
        )}
      </ScrollView>

      <PickerModal
        visible={pickerConfig.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        selectedValue={pickerConfig.selectedValue}
        onSelect={pickerConfig.onSelect}
        onClose={closePicker}
      />
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
