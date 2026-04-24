import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { EventRow } from '@/src/components/EventRow';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import { getOdometerLabel, getEfficiencyLabel } from '@/src/constants/units';

const PERIODS = ['1M', '3M', '6M', 'YTD', '1Y', 'All'] as const;

export default function DashboardScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, eventCount } = useActiveVehicle();
  const places = useReferenceDataStore((s) => s.places);
  const [period, setPeriod] = useState<string>('3M');
  const metrics = useDashboardMetrics(period);

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const volumeUnit = activeVehicle?.volumeUnit ?? 'gallons';
  const odoLabel = getOdometerLabel(odometerUnit);
  const effLabel = getEfficiencyLabel(odometerUnit, volumeUnit);

  const trendIcon =
    metrics.efficiencyTrend === 'up'
      ? 'arrow-up'
      : metrics.efficiencyTrend === 'down'
        ? 'arrow-down'
        : null;
  const trendColor =
    metrics.efficiencyTrend === 'up'
      ? '#10B981'
      : metrics.efficiencyTrend === 'down'
        ? '#EF4444'
        : '#6B7280';

  const lineChartData = useMemo(() => {
    return metrics.chartData
      .filter((d) => d.efficiency > 0)
      .map((d) => ({
        value: Math.round(d.efficiency * 10) / 10,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        dataPointColor: d.isPartial ? 'transparent' : '#0D9488',
        dataPointRadius: d.isPartial ? 4 : 5,
        customDataPoint: d.isPartial
          ? () => (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: '#0D9488',
                  backgroundColor: 'white',
                  borderStyle: 'dashed',
                }}
              />
            )
          : undefined,
      }));
  }, [metrics.chartData]);

  const donutData = useMemo(() => {
    const items = [];
    if (metrics.spendingBreakdown.fuel > 0)
      items.push({ value: metrics.spendingBreakdown.fuel, color: '#0D9488', text: '' });
    if (metrics.spendingBreakdown.service > 0)
      items.push({ value: metrics.spendingBreakdown.service, color: '#F97316', text: '' });
    if (metrics.spendingBreakdown.expense > 0)
      items.push({ value: metrics.spendingBreakdown.expense, color: '#10B981', text: '' });
    return items;
  }, [metrics.spendingBreakdown]);

  const handleEventPress = useCallback(
    (eventId: string, type: string) => {
      router.push(`/(modals)/${type}-event?eventId=${eventId}`);
    },
    [router]
  );

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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <VehicleSwitcher />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Period selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 pt-4 pb-2"
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              className={`mr-2 px-4 py-1.5 rounded-full ${
                period === p
                  ? 'bg-primary'
                  : 'bg-surface dark:bg-surface-dark border border-gray-200 dark:border-gray-700'
              }`}
              accessibilityLabel={`Period: ${p}${period === p ? ', selected' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
            >
              <Text
                className={`text-sm font-semibold ${
                  period === p ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Metric cards row */}
        <View className="flex-row gap-3 px-4 mb-4">
          <View className="flex-1 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Spent</Text>
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
              <Text className="text-sm text-gray-500 dark:text-gray-400">$</Text>
              {metrics.totalSpent.toFixed(2)}
            </Text>
          </View>

          <View className="flex-1 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Cost/{odoLabel}
            </Text>
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {metrics.costPerMile != null ? (
                <>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">$</Text>
                  {metrics.costPerMile.toFixed(2)}
                </>
              ) : (
                '—'
              )}
            </Text>
          </View>

          <View className="flex-1 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Avg {effLabel}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.efficiency.average != null
                  ? metrics.efficiency.average.toFixed(1)
                  : '—'}
              </Text>
              {trendIcon && (
                <Ionicons
                  name={trendIcon as 'arrow-up' | 'arrow-down'}
                  size={14}
                  color={trendColor}
                  style={{ marginLeft: 4 }}
                  accessibilityLabel={`Trend ${metrics.efficiencyTrend}`}
                />
              )}
            </View>
          </View>
        </View>

        {/* Fuel efficiency chart */}
        {lineChartData.length >= 2 ? (
          <View className="mx-4 mb-4 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Fuel Efficiency Trend
            </Text>
            <View
              accessibilityLabel={`Fuel efficiency chart showing ${lineChartData.length} data points. Average: ${
                metrics.efficiency.average?.toFixed(1) ?? 'N/A'
              } ${effLabel}`}
            >
              <LineChart
                data={lineChartData}
                width={280}
                height={180}
                color="#0D9488"
                thickness={2}
                curved
                areaChart
                startFillColor="rgba(13, 148, 136, 0.15)"
                endFillColor="rgba(13, 148, 136, 0.01)"
                startOpacity={0.15}
                endOpacity={0.01}
                noOfSections={4}
                yAxisColor="transparent"
                xAxisColor="#E5E7EB"
                yAxisTextStyle={{ fontSize: 10, color: '#9CA3AF' }}
                xAxisLabelTextStyle={{ fontSize: 9, color: '#9CA3AF' }}
                hideRules={false}
                rulesColor="#E5E7EB50"
                rulesType="solid"
                dataPointsColor="#0D9488"
                dataPointsRadius={4}
                spacing={lineChartData.length > 1 ? Math.max(40, 280 / lineChartData.length) : 100}
                initialSpacing={10}
                endSpacing={10}
                isAnimated
                animationDuration={600}
                pointerConfig={{
                  pointerStripColor: '#0D9488',
                  pointerStripWidth: 1,
                  pointerColor: '#0D9488',
                  radius: 5,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 40,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View className="bg-gray-900 rounded-lg px-2 py-1">
                      <Text className="text-white text-xs font-semibold">
                        {items[0]?.value?.toFixed(1)} {effLabel}
                      </Text>
                    </View>
                  ),
                }}
              />
            </View>
          </View>
        ) : (
          <View className="mx-4 mb-4 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Fuel Efficiency Trend
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">
              Log more fill-ups to see efficiency trends
            </Text>
          </View>
        )}

        {/* Spending breakdown donut */}
        {donutData.length > 0 && (
          <View className="mx-4 mb-4 bg-surface dark:bg-surface-dark rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Spending Breakdown
            </Text>
            <View className="items-center">
              <PieChart
                data={donutData}
                donut
                innerRadius={55}
                radius={80}
                innerCircleColor="#F5F5F7"
                centerLabelComponent={() => (
                  <View className="items-center">
                    <Text className="text-xs text-gray-500">Total</Text>
                    <Text className="text-base font-bold text-gray-900">
                      ${metrics.spendingBreakdown.total.toFixed(0)}
                    </Text>
                  </View>
                )}
              />
              {/* Legend */}
              <View className="flex-row justify-center gap-6 mt-4">
                <LegendItem color="#0D9488" label="Fuel" amount={metrics.spendingBreakdown.fuel} total={metrics.spendingBreakdown.total} />
                <LegendItem color="#F97316" label="Service" amount={metrics.spendingBreakdown.service} total={metrics.spendingBreakdown.total} />
                <LegendItem color="#10B981" label="Expense" amount={metrics.spendingBreakdown.expense} total={metrics.spendingBreakdown.total} />
              </View>
            </View>
          </View>
        )}

        {/* Recent events */}
        <View className="mx-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recent Activity
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/history')}
              accessibilityLabel="See all events"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="text-sm text-primary font-semibold">See all</Text>
            </Pressable>
          </View>
          <View className="bg-surface dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {metrics.recentEvents.map((event, index) => {
              const place = event.placeId
                ? places.find((p) => p.id === event.placeId)
                : null;
              return (
                <View key={event.id}>
                  {index > 0 && (
                    <View className="h-px bg-gray-100 dark:bg-gray-800 ml-14" />
                  )}
                  <EventRow
                    event={event}
                    odometerUnit={odometerUnit}
                    place={place}
                    onPress={() => handleEventPress(event.id, event.type)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <AddEventFAB />
    </SafeAreaView>
  );
}

function LegendItem({
  color,
  label,
  amount,
  total,
}: {
  color: string;
  label: string;
  amount: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View className="items-center">
      <View className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: color }} />
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-xs font-semibold text-gray-900 dark:text-gray-100">
        ${amount.toFixed(0)} ({pct}%)
      </Text>
    </View>
  );
}
