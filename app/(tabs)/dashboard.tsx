import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';

export default function DashboardScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, eventCount } = useActiveVehicle();
  const metrics = useDashboardMetrics('3M');

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

  if (!activeVehicle || eventCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
        <VehicleSwitcher />
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="bar-chart-outline" size={64} color="#9ca3af" />}
            title="No Events Yet"
            description="Add your first event to see your dashboard. Tap + to get started."
          />
        </View>
        <AddEventFAB />
      </SafeAreaView>
    );
  }

  const trendIcon =
    metrics.efficiencyTrend === 'up'
      ? 'arrow-up'
      : metrics.efficiencyTrend === 'down'
        ? 'arrow-down'
        : null;
  const trendColor =
    metrics.efficiencyTrend === 'up'
      ? '#10b981'
      : metrics.efficiencyTrend === 'down'
        ? '#ef4444'
        : '#6b7280';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <VehicleSwitcher />

      <View className="flex-1 px-4 pt-4">
        {/* Key metrics row */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Spent</Text>
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ${metrics.totalSpent.toFixed(2)}
            </Text>
          </View>

          <View className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Cost/{activeVehicle.odometerUnit === 'miles' ? 'mi' : 'km'}
            </Text>
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {metrics.costPerMile != null ? `$${metrics.costPerMile.toFixed(2)}` : '—'}
            </Text>
          </View>

          <View className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Efficiency</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {metrics.efficiency.average != null
                  ? metrics.efficiency.average.toFixed(1)
                  : '—'}
              </Text>
              {trendIcon && (
                <Ionicons name={trendIcon as never} size={14} color={trendColor} />
              )}
            </View>
          </View>
        </View>

        {/* Spending breakdown */}
        <View className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-5">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Spending Breakdown (3M)
          </Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <View className="w-3 h-3 rounded-full bg-teal-500 mb-1" />
              <Text className="text-xs text-gray-500">Fuel</Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${metrics.spendingBreakdown.fuel.toFixed(0)}
              </Text>
            </View>
            <View className="items-center">
              <View className="w-3 h-3 rounded-full bg-orange-500 mb-1" />
              <Text className="text-xs text-gray-500">Service</Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${metrics.spendingBreakdown.service.toFixed(0)}
              </Text>
            </View>
            <View className="items-center">
              <View className="w-3 h-3 rounded-full bg-emerald-500 mb-1" />
              <Text className="text-xs text-gray-500">Expense</Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                ${metrics.spendingBreakdown.expense.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent events preview */}
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Recent Activity
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/history')}
            accessibilityLabel="See all events"
            accessibilityRole="button"
          >
            <Text className="text-sm text-primary">See all →</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-gray-500">
          {eventCount} total event{eventCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <AddEventFAB />
    </SafeAreaView>
  );
}
