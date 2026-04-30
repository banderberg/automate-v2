import { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface MonthlySpending {
  label: string;
  fuel: number;
  service: number;
  expense: number;
  total: number;
}

interface SpendingBarChartProps {
  data: MonthlySpending[];
  isDark: boolean;
  chartWidth: number;
  period: string;
}

export function SpendingBarChart({ data, isDark, chartWidth, period }: SpendingBarChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const displayData = useMemo(() => {
    const capped = data.slice(-36);
    return capped;
  }, [data]);

  const stackData = useMemo(() => {
    return displayData.map((d, index) => ({
      stacks: [
        { value: d.fuel, color: '#1A9A8F', onPress: () => setSelectedIndex(index) },
        { value: d.service, color: '#E8772B', onPress: () => setSelectedIndex(index) },
        { value: d.expense, color: '#2EAD76', onPress: () => setSelectedIndex(index) },
      ],
      label: d.label,
    }));
  }, [displayData]);

  const selected = selectedIndex != null ? displayData[selectedIndex] : null;
  const needsScroll = displayData.length > 12;
  const barSpacing = Math.max(20, Math.min(44, (chartWidth - 40) / displayData.length - 24));
  const headerLabel = period === '1M' ? 'Weekly' : 'Monthly';

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1A1917' : '#FEFDFB',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#F5F4F1' : '#1C1B18' }}>
          Spending Over Time
        </Text>
        <Text style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67' }}>{headerLabel}</Text>
      </View>
      <View accessibilityLabel={`Spending bar chart, ${displayData.length} bars`}>
        <BarChart
          stackData={stackData}
          width={needsScroll ? displayData.length * (24 + barSpacing) : chartWidth}
          height={160}
          barWidth={24}
          spacing={barSpacing}
          initialSpacing={16}
          endSpacing={16}
          noOfSections={3}
          yAxisColor="transparent"
          xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
          yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
          xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
          hideRules={false}
          rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
          rulesType="solid"
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
          isAnimated
          animationDuration={400}
          scrollRef={needsScroll ? scrollRef : undefined}
          scrollToEnd={needsScroll}
        />
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', paddingVertical: 8 }}>
        <LegendDot color="#1A9A8F" label="Fuel" isDark={isDark} />
        <LegendDot color="#E8772B" label="Service" isDark={isDark} />
        <LegendDot color="#2EAD76" label="Expense" isDark={isDark} />
      </View>
      {/* Detail row */}
      {selected && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text
            style={{
              fontSize: 11,
              color: isDark ? '#C5C2BC' : '#5C5A55',
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {selected.label}: ${Math.round(selected.fuel)} fuel + ${Math.round(selected.service)} service + ${Math.round(selected.expense)} expense = ${Math.round(selected.total)}
          </Text>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label, isDark }: { color: string; label: string; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: isDark ? '#8A8680' : '#706C67' }}>{label}</Text>
    </View>
  );
}
