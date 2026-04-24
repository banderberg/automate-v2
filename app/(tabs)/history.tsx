import { View, Text, FlatList } from 'react-native';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';

export default function HistoryScreen() {
  const { activeVehicle, events } = useActiveVehicle();

  if (!activeVehicle) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-bold">No Vehicle</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Add a vehicle to get started.
        </Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-bold">History</Text>
        <Text className="text-sm text-gray-400 mt-4">
          No events yet. Tap + to log your first fill-up, service, or expense.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-bold mb-4">
        History — {events.length} events
      </Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row justify-between py-2 border-b border-gray-200">
            <View>
              <Text className="text-sm font-medium capitalize">{item.type}</Text>
              <Text className="text-xs text-gray-500">{item.date}</Text>
            </View>
            <Text className="text-sm font-medium">${item.cost.toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}
