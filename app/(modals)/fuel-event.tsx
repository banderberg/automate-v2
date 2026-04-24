import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function FuelEventModal() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Stack.Screen options={{ title: 'Add Fill-Up' }} />
      <Text className="text-lg font-bold">Add/Edit Fuel Event</Text>
      <Text className="text-sm text-gray-500 mt-2">Phase 1 placeholder</Text>
    </View>
  );
}
