import { View, Text, Pressable } from 'react-native';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';

export default function SettingsScreen() {
  const { settings, updateSetting } = useSettingsStore();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);

  const themes = ['system', 'light', 'dark'] as const;

  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-bold mb-4">Settings</Text>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Appearance
        </Text>
        <View className="flex-row gap-2">
          {themes.map((t) => (
            <Pressable
              key={t}
              onPress={() => updateSetting('theme', t)}
              className={`px-4 py-2 rounded-full ${
                settings.theme === t
                  ? 'bg-blue-600'
                  : 'bg-gray-200'
              }`}
              accessibilityLabel={`Set theme to ${t}`}
              accessibilityRole="button"
            >
              <Text
                className={`text-sm capitalize ${
                  settings.theme === t ? 'text-white font-medium' : 'text-gray-700'
                }`}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Defaults
        </Text>
        <Text className="text-sm py-2">Currency: {settings.currency}</Text>
        <Text className="text-sm py-2">
          Fuel Unit: {settings.defaultFuelUnit}
        </Text>
        <Text className="text-sm py-2">
          Odometer Unit: {settings.defaultOdometerUnit}
        </Text>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Vehicles
        </Text>
        <Text className="text-sm py-2">
          Manage Vehicles ({vehicleCount})
        </Text>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
          Data
        </Text>
        <Text className="text-sm py-2">Export Data</Text>
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
          About
        </Text>
        <Text className="text-sm py-2">AutoMate v2.0</Text>
      </View>
    </View>
  );
}
