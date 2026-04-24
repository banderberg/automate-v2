import { View, Text, FlatList } from 'react-native';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';

export default function RemindersScreen() {
  const { activeVehicle, reminders } = useActiveVehicle();

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

  if (reminders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-bold">Reminders</Text>
        <Text className="text-sm text-gray-400 mt-4">
          No reminders set. Never miss an oil change.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-bold mb-4">
        Reminders — {reminders.length} active
      </Text>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="py-3 border-b border-gray-200">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-medium">{item.linkedName}</Text>
              <Text
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  item.status === 'overdue'
                    ? 'bg-red-100 text-red-700'
                    : item.status === 'soon'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
            <Text className="text-xs text-gray-500 mt-1">
              {item.daysRemaining != null && `${item.daysRemaining} days remaining`}
              {item.daysRemaining != null && item.distanceRemaining != null && ' · '}
              {item.distanceRemaining != null &&
                `${item.distanceRemaining.toLocaleString()} distance remaining`}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
