import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
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

function splitCurrency(amount: number): { dollars: string; cents: string } {
  const [d, c] = amount.toFixed(2).split('.');
  return { dollars: parseInt(d).toLocaleString('en-US'), cents: c };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
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
    metrics.efficiencyTrend === 'down' ? '#EF4444' : '#78756F';

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
              <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#0D9488', backgroundColor: isDark ? '#1A1917' : '#F5F4F1', borderStyle: 'dashed' }} />
            )
          : undefined,
      }));
  }, [metrics.chartData, isDark]);

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

  const { dollars, cents } = splitCurrency(metrics.totalSpent);

  // -- Empty states --

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F4F1] dark:bg-[#0E0E0C]" edges={['top']}>
        <EmptyState
          icon={<Ionicons name="car-outline" size={64} color="#B5B2AB" />}
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
      <SafeAreaView className="flex-1 bg-[#F5F4F1] dark:bg-[#0E0E0C]" edges={['top']}>
        <VehicleSwitcher />
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="bar-chart-outline" size={64} color="#B5B2AB" />}
            title="No Events Yet"
            description="Add your first fill-up or service to see your dashboard."
          />
        </View>
        <AddEventFAB />
      </SafeAreaView>
    );
  }

  // -- Main dashboard --

  return (
    <SafeAreaView className="flex-1 bg-[#F5F4F1] dark:bg-[#0E0E0C]" edges={['top']}>
      <VehicleSwitcher />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>

        {/* ── Hero: period + total spent ── */}
        <View className="px-4 pt-5">
          {/* Period tabs: bare text, weight-only selection */}
          <View className="flex-row mb-5" style={{ gap: 2 }}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                className="flex-1 items-center py-2"
                accessibilityLabel={`Period ${p}${period === p ? ', selected' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === p }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: period === p ? '700' : '500',
                    color: period === p
                      ? (isDark ? '#F5F4F1' : '#1C1B18')
                      : (isDark ? '#78756F' : '#A8A49D'),
                  }}
                >
                  {p}
                </Text>
                {period === p && (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isDark ? '#F5F4F1' : '#1C1B18',
                      marginTop: 4,
                    }}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {/* Total spent: the gravitational centre */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: isDark ? '#78756F' : '#A8A49D',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Total Spent
          </Text>
          <View className="flex-row items-baseline">
            <Text
              style={{
                fontSize: 22,
                fontWeight: '500',
                color: isDark ? '#78756F' : '#A8A49D',
                marginRight: 2,
                marginBottom: 2,
              }}
            >
              $
            </Text>
            <Text
              style={{
                fontSize: 54,
                fontWeight: '800',
                color: isDark ? '#F5F4F1' : '#1C1B18',
                lineHeight: 58,
                fontVariant: ['tabular-nums'],
              }}
            >
              {dollars}
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: isDark ? '#78756F' : '#A8A49D',
                marginBottom: 2,
              }}
            >
              .{cents}
            </Text>
          </View>
        </View>

        {/* ── Secondary metrics ── */}
        <View className="flex-row px-4 mt-4 mb-8">
          <View className="flex-1">
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: isDark ? '#78756F' : '#A8A49D',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Cost / {odoLabel}
            </Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: isDark ? '#F5F4F1' : '#1C1B18',
                fontVariant: ['tabular-nums'],
              }}
            >
              {metrics.costPerMile != null ? `$${metrics.costPerMile.toFixed(2)}` : '—'}
            </Text>
          </View>

          <View style={{ width: 1, backgroundColor: isDark ? '#2A2926' : '#E2E0DB', marginHorizontal: 20 }} />

          <View className="flex-1">
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: isDark ? '#78756F' : '#A8A49D',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Avg {effLabel}
            </Text>
            <View className="flex-row items-baseline" style={{ gap: 5 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: isDark ? '#F5F4F1' : '#1C1B18',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {metrics.efficiency.average != null ? metrics.efficiency.average.toFixed(1) : '—'}
              </Text>
              {trendIcon && (
                <Ionicons
                  name={trendIcon as 'arrow-up' | 'arrow-down'}
                  size={14}
                  color={trendColor}
                  accessibilityLabel={`Trend: ${metrics.efficiencyTrend}`}
                />
              )}
            </View>
          </View>
        </View>

        {/* ── Fuel efficiency chart ── */}
        {lineChartData.length >= 2 ? (
          <View
            className="mx-4 mb-6 overflow-hidden"
            style={{
              backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
              borderRadius: 20,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <View className="px-4 pt-4 pb-2 flex-row items-baseline justify-between">
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isDark ? '#F5F4F1' : '#1C1B18',
                }}
              >
                Fuel Efficiency
              </Text>
              <Text style={{ fontSize: 11, color: isDark ? '#78756F' : '#A8A49D' }}>{effLabel}</Text>
            </View>
            <View
              accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
            >
              <LineChart
                data={lineChartData}
                width={chartWidth}
                height={160}
                color="#0D9488"
                thickness={2.5}
                curved
                areaChart
                startFillColor="rgba(13, 148, 136, 0.10)"
                endFillColor="rgba(13, 148, 136, 0.0)"
                startOpacity={0.1}
                endOpacity={0}
                noOfSections={3}
                yAxisColor="transparent"
                xAxisColor={isDark ? '#2A2926' : '#EEECEA'}
                yAxisTextStyle={{ fontSize: 10, color: isDark ? '#78756F' : '#A8A49D' }}
                xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#78756F' : '#A8A49D' }}
                hideRules={false}
                rulesColor={isDark ? '#2A292620' : '#EEECEA80'}
                rulesType="solid"
                dataPointsColor="#0D9488"
                dataPointsRadius={4}
                spacing={lineChartData.length > 1 ? Math.max(44, chartWidth / lineChartData.length) : 100}
                initialSpacing={16}
                endSpacing={16}
                isAnimated
                animationDuration={500}
                pointerConfig={{
                  pointerStripColor: '#0D948880',
                  pointerStripWidth: 1,
                  pointerColor: '#0D9488',
                  radius: 6,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 36,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View style={{ backgroundColor: '#1C1B18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#F5F4F1', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
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
            className="mx-4 mb-6 px-4 py-6"
            style={{
              backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
              borderRadius: 20,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18', marginBottom: 8 }}>
              Fuel Efficiency
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#78756F' : '#A8A49D', textAlign: 'center', paddingVertical: 12 }}>
              Log 2 or more fill-ups to see your trend
            </Text>
          </View>
        )}

        {/* ── Spending breakdown ── */}
        {donutData.length > 0 && (
          <View
            className="mx-4 mb-6"
            style={{
              backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
              borderRadius: 20,
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
            accessibilityLabel={`Spending: fuel $${metrics.spendingBreakdown.fuel.toFixed(0)}, service $${metrics.spendingBreakdown.service.toFixed(0)}, expense $${metrics.spendingBreakdown.expense.toFixed(0)}`}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18', marginBottom: 16 }}>
              Spending
            </Text>
            <View className="flex-row items-center">
              <PieChart
                data={donutData}
                donut
                innerRadius={38}
                radius={58}
                innerCircleColor={isDark ? '#1A1917' : '#FEFDFB'}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#F5F4F1' : '#1C1B18', fontVariant: ['tabular-nums'] }}>
                      ${metrics.spendingBreakdown.total.toFixed(0)}
                    </Text>
                  </View>
                )}
              />
              <View className="flex-1 ml-6" style={{ gap: 14 }}>
                <SpendingRow isDark={isDark} color="#0D9488" label="Fuel" amount={metrics.spendingBreakdown.fuel} total={metrics.spendingBreakdown.total} />
                <SpendingRow isDark={isDark} color="#F97316" label="Service" amount={metrics.spendingBreakdown.service} total={metrics.spendingBreakdown.total} />
                <SpendingRow isDark={isDark} color="#10B981" label="Expense" amount={metrics.spendingBreakdown.expense} total={metrics.spendingBreakdown.total} />
              </View>
            </View>
          </View>
        )}

        {/* ── Recent ── */}
        {metrics.recentEvents.length > 0 && (
          <View className="mx-4 mb-6">
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18' }}>
                Recent
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/history')}
                accessibilityLabel="See all events"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={{ fontSize: 13, color: '#3B82F6' }}>See all</Text>
              </Pressable>
            </View>
            <View
              style={{
                backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: isDark ? 0 : 0.04,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
              }}
            >
              {metrics.recentEvents.map((event, index) => {
                const place = event.placeId ? places.find((p) => p.id === event.placeId) : null;
                return (
                  <View key={event.id}>
                    {index > 0 && (
                      <View style={{ height: 1, backgroundColor: isDark ? '#2A2926' : '#F0EFEC', marginLeft: 56 }} />
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
        )}
      </ScrollView>

      <AddEventFAB />
    </SafeAreaView>
  );
}

function SpendingRow({
  isDark,
  color,
  label,
  amount,
  total,
}: {
  isDark: boolean;
  color: string;
  label: string;
  amount: number;
  total: number;
}) {
  if (amount <= 0) return null;
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ flex: 1, fontSize: 13, color: isDark ? '#C5C2BC' : '#5C5A55' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18', fontVariant: ['tabular-nums'] }}>
        ${amount.toFixed(0)}
      </Text>
      <Text style={{ fontSize: 11, color: isDark ? '#78756F' : '#A8A49D', minWidth: 28, textAlign: 'right' }}>
        {pct}%
      </Text>
    </View>
  );
}
