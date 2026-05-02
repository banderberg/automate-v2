import React from 'react';
import { View, Text, Pressable, type TextStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency } from '../constants/currency';
import type { VehicleEvent, Place } from '../types';

interface EventRowProps {
  event: VehicleEvent;
  odometerUnit: 'miles' | 'kilometers';
  place?: Place | null;
  label?: string;
  onPress: () => void;
  currencyCode?: string;
}

const TYPE_CONFIG = {
  fuel: { color: '#1A9A8F', bgColor: '#D0F5EE', icon: 'water' as const, label: 'Fuel event' },
  service: { color: '#E8772B', bgColor: '#FFF3E6', icon: 'construct' as const, label: 'Service event' },
  expense: { color: '#2EAD76', bgColor: '#D5F2E3', icon: 'receipt-outline' as const, label: 'Expense event' },
};

const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EventRowInner({ event, odometerUnit, place, label, onPress, currencyCode = 'USD' }: EventRowProps) {
  const config = TYPE_CONFIG[event.type];
  const unitLabel = odometerUnit === 'miles' ? 'mi' : 'km';
  const dateText = formatDate(event.date);
  const odometerText = event.odometer != null
    ? `${event.odometer.toLocaleString('en-US')} ${unitLabel}`
    : '--';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-surface dark:active:bg-surface-dark"
      accessibilityLabel={`${config.label} on ${event.date}, ${formatCurrency(event.cost, currencyCode)}`}
      accessibilityRole="button"
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: config.bgColor }}
      >
        {event.type === 'fuel' ? (
          <MaterialCommunityIcons name="gas-station-outline" size={20} color={config.color} accessible={false} />
        ) : (
          <Ionicons name={config.icon} size={18} color={config.color} accessible={false} />
        )}
      </View>

      <View className="flex-1 mr-2">
        <Text className="text-sm text-ink dark:text-ink-on-dark" numberOfLines={1}>
          {dateText}
        </Text>
        {place?.name ? (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1}>
            {place.name}
          </Text>
        ) : null}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1} style={tabularNums}>
          {odometerText}
        </Text>
        {label ? (
          <Text className="text-xs font-semibold text-ink-secondary dark:text-ink-secondary-on-dark" numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>

      <Text className="text-sm font-semibold text-ink dark:text-ink-on-dark" numberOfLines={1} style={tabularNums}>
        {formatCurrency(event.cost, currencyCode)}
      </Text>
    </Pressable>
  );
}

export const EventRow = React.memo(EventRowInner);
