import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { EmptyState } from '@/src/components/EmptyState';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import type { ReminderWithStatus } from '@/src/types';

function statusColors(status: ReminderWithStatus['status']): {
  badge: string;
  text: string;
  bar: string;
} {
  switch (status) {
    case 'overdue':
      return { badge: '#fee2e2', text: '#b91c1c', bar: '#ef4444' };
    case 'soon':
      return { badge: '#fef9c3', text: '#92400e', bar: '#f59e0b' };
    case 'upcoming':
      return { badge: '#dcfce7', text: '#166534', bar: '#22c55e' };
  }
}

function progressRatio(reminder: ReminderWithStatus): number {
  if (reminder.distanceRemaining != null && reminder.distanceInterval != null) {
    const ratio = 1 - reminder.distanceRemaining / reminder.distanceInterval;
    return Math.max(0, Math.min(1, ratio));
  }
  if (reminder.daysRemaining != null && reminder.timeInterval != null) {
    const totalDays = reminder.timeInterval * (
      reminder.timeUnit === 'years' ? 365
        : reminder.timeUnit === 'months' ? 30
          : reminder.timeUnit === 'weeks' ? 7
            : 1
    );
    const ratio = 1 - reminder.daysRemaining / totalDays;
    return Math.max(0, Math.min(1, ratio));
  }
  return 0;
}

export default function RemindersScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { reminders } = useActiveVehicle();

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
      {/* Header row with VehicleSwitcher and Add button */}
      <View className="flex-row items-stretch">
        <View className="flex-1">
          <VehicleSwitcher />
        </View>
        <Pressable
          onPress={() => router.push('/(modals)/reminder')}
          className="px-4 items-center justify-center bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
          accessibilityLabel="Add Reminder"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color="#2563eb" />
        </Pressable>
      </View>

      {reminders.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={64} color="#9ca3af" />}
            title="No Reminders Set"
            description="Never miss an oil change — tap + to create one."
            actionLabel="Add Reminder"
            onAction={() => router.push('/(modals)/reminder')}
          />
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const colors = statusColors(item.status);
            const ratio = progressRatio(item);
            const statusLabel =
              item.status.charAt(0).toUpperCase() + item.status.slice(1);

            return (
              <Pressable
                onPress={() => router.push(`/(modals)/reminder?reminderId=${item.id}`)}
                className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 active:bg-gray-100"
                accessibilityLabel={`${item.linkedName} reminder, status: ${statusLabel}`}
                accessibilityRole="button"
              >
                {/* Name + badge */}
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1 mr-2">
                    {item.linkedName}
                  </Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: colors.badge }}
                    accessibilityLabel={`${statusLabel} reminder`}
                  >
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${ratio * 100}%`,
                      backgroundColor: colors.bar,
                    }}
                  />
                </View>

                {/* Due info */}
                <View className="gap-0.5">
                  {item.nextOdometer != null && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Next: {item.nextOdometer.toLocaleString()} mi
                    </Text>
                  )}
                  {item.nextDate != null && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Next: {item.nextDate}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
