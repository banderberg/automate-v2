import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function ManageVehiclesModal() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Stack.Screen options={{ title: 'Manage Vehicles' }} />
      <Text className="text-lg font-bold">Manage Vehicles</Text>
      <Text className="text-sm text-gray-500 mt-2">Phase 1 placeholder</Text>
    </View>
  );
}
