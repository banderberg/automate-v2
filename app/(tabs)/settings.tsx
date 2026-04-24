import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';

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

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);

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
            value={settings.currency}
            accessibilityLabel={`Currency: ${settings.currency}`}
          />
          <RowItem
            label="Fuel Unit"
            value={settings.defaultFuelUnit}
            accessibilityLabel={`Default fuel unit: ${settings.defaultFuelUnit}`}
          />
          <RowItem
            label="Odometer Unit"
            value={settings.defaultOdometerUnit}
            accessibilityLabel={`Default odometer unit: ${settings.defaultOdometerUnit}`}
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
    </SafeAreaView>
  );
}
