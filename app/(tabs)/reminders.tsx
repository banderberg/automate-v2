import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { EmptyState } from '@/src/components/EmptyState';
import { ReminderCard } from '@/src/components/ReminderCard';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import * as notificationService from '@/src/services/notifications';

export default function RemindersScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const { reminders } = useActiveVehicle();
  const [notifDenied, setNotifDenied] = useState(false);

  useEffect(() => {
    notificationService.getPermissionStatus().then((status) => {
      setNotifDenied(status === 'denied');
    });
  }, []);

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';

  const handleReminderPress = useCallback(
    (id: string) => {
      router.push(`/(modals)/reminder?reminderId=${id}`);
    },
    [router]
  );

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
        <EmptyState
          icon={<Ionicons name="car-outline" size={64} color="#A8A49D" />}
          title="Add a Vehicle to Get Started"
          description="Track fuel, service, and expenses for your vehicle."
          actionLabel="Add Vehicle"
          onAction={() => router.push('/(modals)/vehicle')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      {/* Header row with VehicleSwitcher and Add button */}
      <View className="flex-row items-stretch">
        <View className="flex-1">
          <VehicleSwitcher />
        </View>
        <Pressable
          onPress={() => router.push('/(modals)/reminder')}
          className="px-4 items-center justify-center bg-surface dark:bg-surface-dark border-b border-divider dark:border-divider-dark"
          accessibilityLabel="Add Reminder"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color="#2563eb" />
        </Pressable>
      </View>

      {/* Notification denied banner */}
      {notifDenied && (
        <Pressable
          onPress={notificationService.openNotificationSettings}
          className="flex-row items-center bg-warning-light px-4 py-3 gap-2"
          accessibilityLabel="Notifications are off. Tap to enable in Settings."
          accessibilityRole="button"
        >
          <Ionicons name="notifications-off-outline" size={18} color="#92400E" />
          <Text className="flex-1 text-sm text-yellow-800">
            Notifications are off. You'll only see reminders in the app.
          </Text>
          <Text className="text-sm text-primary font-semibold">Enable</Text>
        </Pressable>
      )}

      {reminders.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={64} color="#A8A49D" />}
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
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              odometerUnit={odometerUnit}
              onPress={() => handleReminderPress(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
