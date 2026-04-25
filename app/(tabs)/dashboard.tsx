import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, useColorScheme } from 'react-native';
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

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
    metrics.efficiencyTrend === 'up' ? 'arrow-up' :
    metrics.efficiencyTrend === 'down' ? 'arrow-down' : null;
  const trendColor =
    metrics.efficiencyTrend === 'up' ? '#10B981' :
    metrics.efficiencyTrend === 'down' ? '#EF4444' : '#6B7280';

  // screen width minus card margins (16px each side) and card padding (16px each side)
  const chartWidth = width - 64;

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
              <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#0D9488', backgroundColor: 'white', borderStyle: 'dashed' }} />
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
    (eventId: string, type: 'fuel' | 'service' | 'expense') => {
      const routes = {
        fuel: `/(modals)/fuel-event?eventId=${eventId}`,
        service: `/(modals)/service-event?eventId=${eventId}`,
        expense: `/(modals)/expense-event?eventId=${eventId}`,
      } as const;
      router.push(routes[type]);
    },
    [router]
  );

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8] dark:bg-gray-950">
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
      <SafeAreaView className="flex-1 bg-[#FAFAF8] dark:bg-gray-950">
        <VehicleSwitcher />
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="bar-chart-outline" size={64} color="#9ca3af" />}
            title="No Events Yet"
            description="Add your first fill-up or service to see your dashboard."
          />
        </View>
        <AddEventFAB />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF8] dark:bg-gray-950">
      <VehicleSwitcher />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Period selector */}
        <View className="mx-4 mt-4 mb-1 flex-row bg-surface dark:bg-surface-dark rounded-xl p-1 border border-gray-100 dark:border-gray-800">
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-lg items-center ${period === p ? 'bg-white dark:bg-surface-elevated-dark' : ''}`}
              style={period === p ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : undefined}
              accessibilityLabel={`Period ${p}${period === p ? ', selected' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
            >
              <Text className={`text-xs font-semibold ${period === p ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Hero metrics */}
        <View className="px-4 pt-5 pb-5">
          <Text className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
            Total Spent
          </Text>
          <View className="flex-row items-baseline">
            <Text className="text-xl font-semibold text-gray-400 dark:text-gray-500 mr-0.5 self-end mb-1">
              $
            </Text>
            <Text className="text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {metrics.totalSpent.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row mt-5">
            <View className="flex-1">
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                Cost / {odoLabel}
              </Text>
              <Text className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {metrics.costPerMile != null ? `$${metrics.costPerMile.toFixed(2)}` : '—'}
              </Text>
            </View>
            <View className="w-px bg-gray-200 dark:bg-gray-700 self-stretch mx-4" />
            <View className="flex-1">
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                Avg {effLabel}
              </Text>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Text className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {metrics.efficiency.average != null ? metrics.efficiency.average.toFixed(1) : '—'}
                </Text>
                {trendIcon && (
                  <Ionicons
                    name={trendIcon as 'arrow-up' | 'arrow-down'}
                    size={13}
                    color={trendColor}
                    accessibilityLabel={`Trend: ${metrics.efficiencyTrend}`}
                  />
                )}
              </View>
            </View>
          </View>
        </View>

        <View className="h-px bg-gray-100 dark:bg-gray-800 mx-4 mb-4" />

        {/* Fuel efficiency chart */}
        {lineChartData.length >= 2 ? (
          <View
            className="mx-4 mb-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            style={cardShadow}
          >
            <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Fuel Efficiency
              </Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">{effLabel}</Text>
            </View>
            <View
              accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
            >
              <LineChart
                data={lineChartData}
                width={chartWidth}
                height={160}
                color="#0D9488"
                thickness={2}
                curved
                areaChart
                startFillColor="rgba(13, 148, 136, 0.12)"
                endFillColor="rgba(13, 148, 136, 0.0)"
                startOpacity={0.12}
                endOpacity={0}
                noOfSections={3}
                yAxisColor="transparent"
                xAxisColor={isDark ? '#374151' : '#F3F4F6'}
                yAxisTextStyle={{ fontSize: 10, color: '#9CA3AF' }}
                xAxisLabelTextStyle={{ fontSize: 9, color: '#9CA3AF' }}
                hideRules={false}
                rulesColor={isDark ? '#37415130' : '#F3F4F660'}
                rulesType="solid"
                dataPointsColor="#0D9488"
                dataPointsRadius={4}
                spacing={lineChartData.length > 1 ? Math.max(40, chartWidth / lineChartData.length) : 100}
                initialSpacing={16}
                endSpacing={16}
                isAnimated
                animationDuration={500}
                pointerConfig={{
                  pointerStripColor: '#0D9488',
                  pointerStripWidth: 1,
                  pointerColor: '#0D9488',
                  radius: 5,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 36,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View style={{ backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>
                        {items[0]?.value?.toFixed(1)} {effLabel}
                      </Text>
                    </View>
                  ),
                }}
              />
            </View>
          </View>
        ) : (
          <View
            className="mx-4 mb-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-4"
            style={cardShadow}
          >
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Fuel Efficiency
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 py-5 text-center">
              Log 2 or more fill-ups to see your trend
            </Text>
          </View>
        )}

        {/* Spending breakdown */}
        {donutData.length > 0 && (
          <View
            className="mx-4 mb-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-4"
            style={cardShadow}
            accessibilityLabel={`Spending breakdown: fuel $${metrics.spendingBreakdown.fuel.toFixed(0)}, service $${metrics.spendingBreakdown.service.toFixed(0)}, expense $${metrics.spendingBreakdown.expense.toFixed(0)}, total $${metrics.spendingBreakdown.total.toFixed(0)}`}
          >
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Spending Breakdown
            </Text>
            <View className="flex-row items-center">
              <PieChart
                data={donutData}
                donut
                innerRadius={44}
                radius={64}
                innerCircleColor={isDark ? '#1C1C1E' : '#FFFFFF'}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Total</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F9FAFB' : '#111827' }}>
                      ${metrics.spendingBreakdown.total.toFixed(0)}
                    </Text>
                  </View>
                )}
              />
              <View className="flex-1 ml-6" style={{ gap: 12 }}>
                <SpendingRow color="#0D9488" label="Fuel" amount={metrics.spendingBreakdown.fuel} total={metrics.spendingBreakdown.total} />
                <SpendingRow color="#F97316" label="Service" amount={metrics.spendingBreakdown.service} total={metrics.spendingBreakdown.total} />
                <SpendingRow color="#10B981" label="Expense" amount={metrics.spendingBreakdown.expense} total={metrics.spendingBreakdown.total} />
              </View>
            </View>
          </View>
        )}

        {/* Recent activity */}
        {metrics.recentEvents.length > 0 && (
          <View className="mx-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/history')}
                accessibilityLabel="See all events"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text className="text-sm text-primary font-semibold">See all</Text>
              </Pressable>
            </View>
            <View
              className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
              style={cardShadow}
            >
              {metrics.recentEvents.map((event, index) => {
                const place = event.placeId ? places.find((p) => p.id === event.placeId) : null;
                return (
                  <View key={event.id}>
                    {index > 0 && <View className="h-px bg-gray-100 dark:bg-gray-800 ml-14" />}
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
        )}
      </ScrollView>

      <AddEventFAB />
    </SafeAreaView>
  );
}

function SpendingRow({
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
  if (amount <= 0) return null;
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-sm text-gray-600 dark:text-gray-300 flex-1">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        ${amount.toFixed(0)}
      </Text>
      <Text className="text-xs text-gray-400 dark:text-gray-500" style={{ minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </Text>
    </View>
  );
}
