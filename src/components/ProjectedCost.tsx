import { View, Text } from 'react-native';
import { formatCurrency } from '../constants/currency';

interface ProjectedCostProps {
  projectedAnnual: number;
  ytdSpent: number;
  isDark: boolean;
  currencyCode?: string;
}

export function ProjectedCost({ projectedAnnual, ytdSpent, isDark, currencyCode = 'USD' }: ProjectedCostProps) {
  const progress = projectedAnnual > 0 ? ytdSpent / projectedAnnual : 0;
  const year = new Date().getFullYear();

  return (
    <View
      style={{
        backgroundColor: isDark ? '#2A2926' : '#F0EFEC',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
      accessibilityLabel={`Projected annual cost: ${formatCurrency(Math.round(projectedAnnual), currencyCode)}. ${formatCurrency(Math.round(ytdSpent), currencyCode)} spent so far.`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: isDark ? '#8A8680' : '#706C67',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Projected Annual
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#F5F4F1' : '#1C1B18',
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatCurrency(Math.round(projectedAnnual), currencyCode)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: isDark ? 'rgba(26, 154, 143, 0.2)' : 'rgba(26, 154, 143, 0.15)',
          borderRadius: 3,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: '#1A9A8F',
            height: '100%',
            width: `${Math.min(100, Math.round(progress * 100))}%`,
            borderRadius: 3,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: isDark ? '#706C67' : '#8A8680', fontVariant: ['tabular-nums'] }}>
          {formatCurrency(Math.round(ytdSpent), currencyCode)} spent
        </Text>
        <Text style={{ fontSize: 10, color: isDark ? '#706C67' : '#8A8680' }}>
          Dec {year}
        </Text>
      </View>
    </View>
  );
}
