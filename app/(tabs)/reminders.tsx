import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { EmptyState } from '@/src/components/EmptyState';
import { ReminderCard } from '@/src/components/ReminderCard';
import { RemindersSkeleton } from '@/src/components/Skeleton';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import * as notificationService from '@/src/services/notifications';

export default function RemindersScreen() {
  const nav = useGuardedNavigate();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const { reminders } = useActiveVehicle();
  const isLoading = useReminderStore((s) => s.isLoading);
  const [notifDenied, setNotifDenied] = useState(false);

  useEffect(() => {
    notificationService.getPermissionStatus().then((status) => {
      setNotifDenied(status === 'denied');
    });
  }, []);

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';

  const handleReminderPress = useCallback(
    (id: string) => {
      nav.push(`/(modals)/reminder?reminderId=${id}`);
    },
    [nav]
  );

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
        <EmptyState
          icon={
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#F59E0B10', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="timer-outline" size={44} color="#F59E0B" />
            </View>
          }
          title="No vehicle yet"
          description="Add a vehicle from the Dashboard tab, then set reminders for oil changes, inspections, and more."
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
          onPress={() => nav.push('/(modals)/reminder')}
          className="px-4 items-center justify-center bg-surface dark:bg-surface-dark border-b border-divider dark:border-divider-dark"
          accessibilityLabel="Add Reminder"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color="#4272C4" />
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

      {isLoading ? (
        <RemindersSkeleton />
      ) : reminders.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#F59E0B10', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="timer-outline" size={44} color="#F59E0B" />
              </View>
            }
            title="Nothing to track yet"
            description="Set a reminder for oil changes, tire rotations, or any recurring service. AutoMate counts down so you don't have to."
            actionLabel="Add Reminder"
            onAction={() => nav.push('/(modals)/reminder')}
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
