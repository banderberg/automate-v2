import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { EventRow } from '@/src/components/EventRow';
import { MetricInfo } from '@/src/components/MetricInfo';
import { DashboardSkeleton } from '@/src/components/Skeleton';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import { getOdometerLabel, getEfficiencyLabel } from '@/src/constants/units';
import { ProjectedCost } from '@/src/components/ProjectedCost';
import { InsightCards } from '@/src/components/InsightCards';
import { SpendingBarChart } from '@/src/components/SpendingBarChart';
import { useInsights } from '@/src/hooks/useInsights';
import { getServiceEventsByType } from '@/src/db/queries/eventServiceTypes';
import { getFuelEventsByFuelType } from '@/src/db/queries/events';
import type { InsightEngineInput } from '@/src/services/insightEngine';
import { computeFuelEfficiency } from '@/src/services/fuelEfficiency';

const PERIODS = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
] as const;

function cardShadow(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  } as const;
}

function splitCurrency(amount: number): { dollars: string; cents: string } {
  const [d, c] = amount.toFixed(2).split('.');
  return { dollars: parseInt(d).toLocaleString('en-US'), cents: c };
}

export default function DashboardScreen() {
  const nav = useGuardedNavigate();
  const { width } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, eventCount } = useActiveVehicle();
  const places = useReferenceDataStore((s) => s.places);
  const categories = useReferenceDataStore((s) => s.categories);
  const serviceLabels = useEventStore((s) => s.serviceLabels);
  const isLoading = useEventStore((s) => s.isLoading);
  const [period, setPeriod] = useState<string>('3M');
  const [showCelebration, setShowCelebration] = useState(false);
  const prevEventCountRef = useRef(eventCount);
  const prevVehicleIdRef = useRef(activeVehicle?.id);
  const metrics = useDashboardMetrics(period);

  const [insightInput, setInsightInput] = useState<InsightEngineInput | null>(null);

  useEffect(() => {
    if (!activeVehicle || eventCount === 0) {
      setInsightInput(null);
      return;
    }
    let cancelled = false;

    async function loadInsightData() {
      const events = useEventStore.getState().events;
      const [serviceEventsByType, crossFills] = await Promise.all([
        getServiceEventsByType(activeVehicle!.id),
        getFuelEventsByFuelType(activeVehicle!.fuelType),
      ]);

      const fuelEvents = events
        .filter(e => e.type === 'fuel' && e.odometer != null)
        .sort((a, b) => a.odometer! - b.odometer!);
      const effResult = computeFuelEfficiency(fuelEvents);

      const fullSegments = effResult.segments.filter(s => !s.isPartial && s.efficiency > 0);
      const recent3 = fullSegments.slice(-3);
      const recentRollingAverage = recent3.length === 3
        ? recent3.reduce((s, seg) => s + seg.efficiency, 0) / 3
        : null;

      if (cancelled) return;

      setInsightInput({
        events,
        vehicle: activeVehicle!,
        periodMetrics: {
          totalSpent: metrics.totalSpent,
          previousPeriodTotal: metrics.previousPeriodTotal,
          costPerMile: metrics.costPerMile,
          previousCostPerMile: metrics.previousCostPerMile,
          periodLabel: metrics.periodLabel,
        },
        serviceEventsByType,
        places,
        crossVehicleFuelFills: crossFills,
        efficiencyData: {
          average: effResult.average,
          recentRollingAverage,
        },
      });
    }

    loadInsightData();
    return () => { cancelled = true; };
  }, [activeVehicle?.id, metrics, places]);

  const { insights, dismiss } = useInsights(insightInput, activeVehicle?.id ?? null);

  useEffect(() => {
    if (activeVehicle?.id !== prevVehicleIdRef.current) {
      prevVehicleIdRef.current = activeVehicle?.id;
      prevEventCountRef.current = eventCount;
      return;
    }
    if (prevEventCountRef.current === 0 && eventCount > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
    prevEventCountRef.current = eventCount;
  }, [eventCount, activeVehicle?.id]);

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
        dataPointColor: d.isPartial ? 'transparent' : '#1A9A8F',
        dataPointRadius: d.isPartial ? 4 : 5,
        customDataPoint: d.isPartial
          ? () => (
              <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#1A9A8F', backgroundColor: isDark ? '#1A1917' : '#F5F4F1', borderStyle: 'dashed' }} />
            )
          : undefined,
      }));
  }, [metrics.chartData, isDark]);

  const donutData = useMemo(() => {
    const { fuel, service, expense, total } = metrics.spendingBreakdown;
    if (total === 0) return [];
    return [
      { value: fuel || 0.001, color: fuel > 0 ? '#1A9A8F' : '#E2E0DB', text: '' },
      { value: service || 0.001, color: service > 0 ? '#E8772B' : '#E2E0DB', text: '' },
      { value: expense || 0.001, color: expense > 0 ? '#2EAD76' : '#E2E0DB', text: '' },
    ];
  }, [metrics.spendingBreakdown]);

  const placeMap = useMemo(() => {
    const m = new Map<string, typeof places[0]>();
    for (const p of places) m.set(p.id, p);
    return m;
  }, [places]);

  const handleEventPress = useCallback(
    (eventId: string, type: 'fuel' | 'service' | 'expense') => {
      const routes = {
        fuel: `/(modals)/fuel-event?eventId=${eventId}`,
        service: `/(modals)/service-event?eventId=${eventId}`,
        expense: `/(modals)/expense-event?eventId=${eventId}`,
      } as const;
      nav.push(routes[type]);
    },
    [nav]
  );

  const { dollars, cents } = splitCurrency(metrics.totalSpent);

  // -- Empty states --

  if (vehicleCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
        <EmptyState
          icon={
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#4272C410', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="car-sport-outline" size={44} color="#4272C4" />
            </View>
          }
          title="Add your first vehicle"
          description="AutoMate tracks what you spend, so you always know where the money goes."
          actionLabel="Get Started"
          onAction={() => nav.push('/(modals)/vehicle')}
        />
      </SafeAreaView>
    );
  }

  if (!activeVehicle || eventCount === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
        <VehicleSwitcher />
        <View className="flex-1">
          <EmptyState
            icon={
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#4272C410', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="wallet-outline" size={44} color="#4272C4" />
              </View>
            }
            title="Ready when you are"
            description="Your next fill-up or service visit will start building your dashboard."
          />
        </View>
        <AddEventFAB />
      </SafeAreaView>
    );
  }

  // -- Main dashboard --

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <VehicleSwitcher />
      {isLoading ? (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
          <DashboardSkeleton />
        </ScrollView>
      ) : (
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>

        {/* ── First-event celebration banner ── */}
        {showCelebration && (
          <View className="bg-success-light rounded-card mx-4 mb-4 px-4 py-3 flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text className="text-sm font-semibold text-ink dark:text-ink-on-dark ml-2">
              First one logged! You're tracking now.
            </Text>
          </View>
        )}

        {/* ── Hero: period + total spent ── */}
        <View className="px-4 pt-5">
          {/* Period tabs: bare text, weight-only selection */}
          <View className="flex-row mb-5" style={{ gap: 2 }}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                className="flex-1 items-center py-2"
                accessibilityLabel={`Period ${p.label}${period === p.value ? ', selected' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === p.value }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: period === p.value ? '700' : '500',
                    color: period === p.value
                      ? (isDark ? '#F5F4F1' : '#1C1B18')
                      : (isDark ? '#8A8680' : '#706C67'),
                  }}
                >
                  {p.label}
                </Text>
                {period === p.value && (
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
              color: isDark ? '#8A8680' : '#706C67',
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
                color: isDark ? '#8A8680' : '#706C67',
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
                color: isDark ? '#8A8680' : '#706C67',
                marginBottom: 2,
              }}
            >
              .{cents}
            </Text>
          </View>
          {metrics.totalSpentDelta && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: metrics.totalSpentDelta.direction === 'up' ? '#EF4444' : '#10B981',
                marginTop: 4,
              }}
            >
              {metrics.totalSpentDelta.direction === 'up' ? '↑' : '↓'} {Math.round(Math.abs(metrics.totalSpentDelta.percentage) * 100)}% vs prev {metrics.periodLabel}
            </Text>
          )}
        </View>

        {/* ── Secondary metrics ── */}
        <View className="flex-row px-4 mt-4 mb-8">
          <View className="flex-1" accessibilityLabel={`Cost per ${odoLabel}: ${metrics.costPerMile != null ? `$${metrics.costPerMile.toFixed(2)}` : 'not enough data'}`} accessibilityHint="Total spending divided by distance driven">
            <View className="flex-row items-center" style={{ gap: 4, marginBottom: 2 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: isDark ? '#8A8680' : '#706C67',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                Cost / {odoLabel}
              </Text>
              <MetricInfo
                explanation={`Total spending divided by total ${odoLabel} driven in the selected period.`}
                color={isDark ? '#8A8680' : '#706C67'}
              />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: isDark ? '#F5F4F1' : '#1C1B18',
                fontVariant: ['tabular-nums'],
              }}
            >
              {metrics.costPerMile != null ? `$${metrics.costPerMile.toFixed(2)}` : '--'}
            </Text>
            {metrics.costPerMileDelta && (
              <Text style={{ fontSize: 11, color: metrics.costPerMileDelta.direction === 'up' ? '#EF4444' : '#10B981', marginTop: 2 }}>
                {metrics.costPerMileDelta.direction === 'up' ? '↑' : '↓'} ${Math.abs(metrics.costPerMileDelta.value).toFixed(2)}
              </Text>
            )}
          </View>

          <View style={{ width: 1, backgroundColor: isDark ? '#2A2926' : '#E2E0DB', marginHorizontal: 20 }} />

          <View className="flex-1" accessibilityLabel={`Average efficiency: ${metrics.efficiency.average != null ? `${metrics.efficiency.average.toFixed(1)} ${effLabel}` : 'not enough data'}${metrics.efficiencyTrend !== 'flat' && metrics.efficiencyTrend !== null ? `, trending ${metrics.efficiencyTrend}` : ''}`} accessibilityHint="Calculated from full fill-ups only">
            <View className="flex-row items-center" style={{ gap: 4, marginBottom: 2 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: isDark ? '#8A8680' : '#706C67',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                Avg {effLabel}
              </Text>
              <MetricInfo
                explanation="Average fuel efficiency from full fill-ups only. Partial fills are excluded."
                color={isDark ? '#8A8680' : '#706C67'}
              />
            </View>
            <View className="flex-row items-baseline" style={{ gap: 5 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: isDark ? '#F5F4F1' : '#1C1B18',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {metrics.efficiency.average != null ? metrics.efficiency.average.toFixed(1) : '--'}
              </Text>
              {trendIcon && (
                <Ionicons
                  name={trendIcon as 'arrow-up' | 'arrow-down'}
                  size={14}
                  color={trendColor}
                  accessibilityLabel={trendIcon === 'arrow-up' ? 'Improving' : 'Declining'}
                />
              )}
            </View>
            {metrics.efficiencyDelta && (
              <Text style={{ fontSize: 11, color: metrics.efficiencyDelta.direction === 'up' ? '#10B981' : '#EF4444', marginTop: 2 }}>
                {metrics.efficiencyDelta.value > 0 ? '+' : ''}{metrics.efficiencyDelta.value.toFixed(1)}
              </Text>
            )}
          </View>
        </View>

        {metrics.projectedAnnualCost != null && metrics.ytdSpent != null && (
          <View className="px-4 mb-6">
            <ProjectedCost
              projectedAnnual={metrics.projectedAnnualCost}
              ytdSpent={metrics.ytdSpent}
              isDark={isDark}
            />
          </View>
        )}

        <InsightCards insights={insights} isDark={isDark} onDismiss={dismiss} />

        {/* ── Fuel efficiency chart ── */}
        {lineChartData.length >= 2 ? (
          <View
            className="mx-4 mb-6 overflow-hidden"
            style={cardShadow(isDark)}
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
              <Text style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67' }}>{effLabel}</Text>
            </View>
            <View
              accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
            >
              <LineChart
                data={lineChartData}
                width={chartWidth}
                height={160}
                color="#1A9A8F"
                thickness={2.5}
                curved
                areaChart
                startFillColor="rgba(26, 154, 143, 0.10)"
                endFillColor="rgba(26, 154, 143, 0.0)"
                startOpacity={0.1}
                endOpacity={0}
                noOfSections={3}
                yAxisColor="transparent"
                xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
                yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
                xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
                hideRules={false}
                rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
                rulesType="solid"
                dataPointsColor="#1A9A8F"
                dataPointsRadius={4}
                spacing={lineChartData.length > 1 ? Math.max(28, chartWidth / lineChartData.length) : 100}
                scrollToEnd
                initialSpacing={16}
                endSpacing={16}
                isAnimated
                animationDuration={500}
                pointerConfig={{
                  pointerStripColor: '#1A9A8F80',
                  pointerStripWidth: 1,
                  pointerColor: '#1A9A8F',
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
            {metrics.chartData.some((d) => d.isPartial) && (
              <Text style={{ fontSize: 10, color: isDark ? '#54524D' : '#706C67', paddingHorizontal: 16, paddingBottom: 12 }}>
                Hollow dots = partial fills (excluded from average)
              </Text>
            )}
          </View>
        ) : (
          <View
            className="mx-4 mb-6 px-4 py-6"
            style={cardShadow(isDark)}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18', marginBottom: 8 }}>
              Fuel Efficiency
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#8A8680' : '#706C67', textAlign: 'center', paddingVertical: 12 }}>
              Log 2 or more fill-ups to see your trend
            </Text>
          </View>
        )}

        {metrics.monthlySpending.length >= 2 && (
          <View className="mx-4 mb-6">
            <SpendingBarChart
              data={metrics.monthlySpending}
              isDark={isDark}
              chartWidth={chartWidth}
              period={period}
            />
          </View>
        )}

        {/* ── Spending breakdown ── */}
        {donutData.length > 0 && (
          <View
            className="mx-4 mb-6"
            style={{ ...cardShadow(isDark), padding: 16 }}
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
                      ${metrics.spendingBreakdown.total < 100 ? metrics.spendingBreakdown.total.toFixed(2) : metrics.spendingBreakdown.total.toFixed(0)}
                    </Text>
                  </View>
                )}
              />
              <View className="flex-1 ml-6" style={{ gap: 14 }}>
                <SpendingRow isDark={isDark} color="#1A9A8F" label="Fuel" amount={metrics.spendingBreakdown.fuel} total={metrics.spendingBreakdown.total} />
                <SpendingRow isDark={isDark} color="#E8772B" label="Service" amount={metrics.spendingBreakdown.service} total={metrics.spendingBreakdown.total} />
                <SpendingRow isDark={isDark} color="#2EAD76" label="Expense" amount={metrics.spendingBreakdown.expense} total={metrics.spendingBreakdown.total} />
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
                onPress={() => nav.push('/(tabs)/history')}
                className="py-2"
                accessibilityLabel="See all history"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text className="text-primary" style={{ fontSize: 13 }}>See all</Text>
              </Pressable>
            </View>
            <View
              style={{ ...cardShadow(isDark), overflow: 'hidden' }}
            >
              {metrics.recentEvents.map((event, index) => {
                const place = event.placeId ? placeMap.get(event.placeId) ?? null : null;
                const eventLabel = event.type === 'expense'
                  ? (event.categoryId ? categories.find((c) => c.id === event.categoryId)?.name : undefined)
                  : event.type === 'service'
                    ? serviceLabels.get(event.id)
                    : undefined;
                return (
                  <View key={event.id}>
                    {index > 0 && (
                      <View style={{ height: 1, backgroundColor: isDark ? '#2A2926' : '#F0EFEC', marginLeft: 56 }} />
                    )}
                    <EventRow
                      event={event}
                      odometerUnit={odometerUnit}
                      place={place}
                      label={eventLabel}
                      onPress={() => handleEventPress(event.id, event.type)}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
      )}

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
      <View accessible={false} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ flex: 1, fontSize: 13, color: isDark ? '#C5C2BC' : '#5C5A55' }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18', fontVariant: ['tabular-nums'] }}>
        ${amount.toFixed(0)}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67', minWidth: 28, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {pct}%
      </Text>
    </View>
  );
}
