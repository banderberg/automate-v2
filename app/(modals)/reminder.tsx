import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function ReminderModal() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Stack.Screen options={{ title: 'Add Reminder' }} />
      <Text className="text-lg font-bold">Add/Edit Reminder</Text>
      <Text className="text-sm text-gray-500 mt-2">Phase 1 placeholder</Text>
    </View>
  );
}
