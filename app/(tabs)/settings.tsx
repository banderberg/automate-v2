import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';

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
    <Text className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {title}
    </Text>
  );
}

function RowItem({
  label,
  value,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
    >
      <Text className="text-base text-gray-900 dark:text-gray-100">{label}</Text>
      <View className="flex-row items-center gap-2">
        {value && (
          <Text className="text-sm text-gray-500 dark:text-gray-400">{value}</Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
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
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
        accessibilityLabel="Close picker"
      >
        <Pressable
          className="bg-white dark:bg-gray-900 rounded-t-2xl"
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
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
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800"
                accessibilityLabel={`${item.label}${selectedValue === item.value ? ', selected' : ''}`}
                accessibilityRole="button"
              >
                <Text className="text-base text-gray-900 dark:text-gray-100">
                  {item.label}
                </Text>
                {selectedValue === item.value && (
                  <Ionicons name="checkmark" size={20} color="#3B82F6" />
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
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);

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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-4 py-4 bg-gray-50 dark:bg-gray-950">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View className="bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
          <View className="px-4 py-4">
            <Text className="text-base text-gray-900 dark:text-gray-100 mb-3">Theme</Text>
            <View className="flex-row gap-2">
              {themes.map(({ value, label }) => (
                <Pressable
                  key={value}
                  onPress={() => updateSetting('theme', value)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    settings.theme === value
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                  accessibilityLabel={`Set theme to ${label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: settings.theme === value }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      settings.theme === value
                        ? 'text-white'
                        : 'text-gray-700 dark:text-gray-300'
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
        <View className="border-t border-gray-100 dark:border-gray-800">
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
        <View className="border-t border-gray-100 dark:border-gray-800">
          <RowItem
            label="Manage Vehicles"
            value={`${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}`}
            onPress={() => router.push('/(modals)/manage-vehicles')}
            accessibilityLabel="Manage Vehicles"
          />
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View className="border-t border-gray-100 dark:border-gray-800">
          <RowItem
            label="Export Data"
            onPress={() => router.push('/(modals)/export')}
            accessibilityLabel="Export Data"
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View className="border-t border-gray-100 dark:border-gray-800">
          <RowItem label="AutoMate v2.0" />
        </View>
      </ScrollView>

      <PickerModal
        visible={pickerConfig.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        selectedValue={pickerConfig.selectedValue}
        onSelect={pickerConfig.onSelect}
        onClose={closePicker}
      />
    </SafeAreaView>
  );
}
