import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import type { VehicleEvent } from '@/src/types';

function eventTypeColor(type: VehicleEvent['type']): string {
  switch (type) {
    case 'fuel': return '#14b8a6';
    case 'service': return '#f97316';
    case 'expense': return '#10b981';
  }
}

function eventTypeIcon(type: VehicleEvent['type']): string {
  switch (type) {
    case 'fuel': return 'water';
    case 'service': return 'construct';
    case 'expense': return 'cash';
  }
}

function eventTypeLabel(type: VehicleEvent['type']): string {
  switch (type) {
    case 'fuel': return 'Fuel event';
    case 'service': return 'Service event';
    case 'expense': return 'Expense event';
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, events } = useActiveVehicle();

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
        <EmptyState
          icon={<Ionicons name="car-outline" size={64} color="#9ca3af" />}
          title="Add a Vehicle to Get Started"
          description="Track fuel, service, and expenses for your vehicle."
          actionLabel="Add Vehicle"
          onAction={() => router.push('/(modals)/vehicle')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <VehicleSwitcher />

      {events.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="time-outline" size={64} color="#9ca3af" />}
            title="No Events Yet"
            description="No events yet. Tap + to log your first fill-up, service, or expense."
          />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(modals)/${item.type}-event?eventId=${item.id}`)
              }
              className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-900"
              accessibilityLabel={`${eventTypeLabel(item.type)} on ${item.date}, $${item.cost.toFixed(2)}`}
              accessibilityRole="button"
            >
              {/* Type icon */}
              <View
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${eventTypeColor(item.type)}20` }}
              >
                <Ionicons
                  name={eventTypeIcon(item.type) as never}
                  size={18}
                  color={eventTypeColor(item.type)}
                  accessibilityLabel={eventTypeLabel(item.type)}
                />
              </View>

              {/* Date + odometer */}
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.date}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {item.odometer != null
                    ? `${item.odometer.toLocaleString()} ${activeVehicle?.odometerUnit ?? ''}`
                    : '—'}
                </Text>
              </View>

              {/* Cost */}
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${item.cost.toFixed(2)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <AddEventFAB />
    </SafeAreaView>
  );
}
