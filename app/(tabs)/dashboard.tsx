import { View, Text } from 'react-native';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';

export default function DashboardScreen() {
  const { activeVehicle, eventCount } = useActiveVehicle();
  const metrics = useDashboardMetrics('3M');

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

  if (eventCount === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-bold">Dashboard</Text>
        <Text className="text-base mt-2">{activeVehicle.nickname}</Text>
        <Text className="text-sm text-gray-500 mt-1">
          {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
        </Text>
        <Text className="text-sm text-gray-400 mt-4">
          Add your first event to see your dashboard. Tap + to get started.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4">
      <Text className="text-lg font-bold">Dashboard</Text>
      <Text className="text-base mt-2">{activeVehicle.nickname}</Text>
      <Text className="text-sm text-gray-500">
        {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
      </Text>
      <View className="mt-4 space-y-2">
        <Text className="text-sm">Events: {eventCount}</Text>
        <Text className="text-sm">
          Total Spent (3M): ${metrics.totalSpent.toFixed(2)}
        </Text>
        <Text className="text-sm">
          Cost/Mile:{' '}
          {metrics.costPerMile != null
            ? `$${metrics.costPerMile.toFixed(2)}`
            : '—'}
        </Text>
        <Text className="text-sm">
          Avg Efficiency:{' '}
          {metrics.efficiency.average != null
            ? metrics.efficiency.average.toFixed(1)
            : '—'}{' '}
          {metrics.efficiencyTrend === 'up'
            ? '↑'
            : metrics.efficiencyTrend === 'down'
              ? '↓'
              : ''}
        </Text>
        <Text className="text-sm">
          Fuel: ${metrics.spendingBreakdown.fuel.toFixed(2)} | Service: $
          {metrics.spendingBreakdown.service.toFixed(2)} | Expense: $
          {metrics.spendingBreakdown.expense.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
