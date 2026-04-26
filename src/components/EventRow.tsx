import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VehicleEvent, Place } from '../types';

interface EventRowProps {
  event: VehicleEvent;
  odometerUnit: 'miles' | 'kilometers';
  place?: Place | null;
  onPress: () => void;
  currency?: string;
}

const TYPE_CONFIG = {
  fuel: { color: '#0D9488', bgColor: '#CCFBF1', icon: 'water' as const, label: 'Fuel event' },
  service: { color: '#F97316', bgColor: '#FFF7ED', icon: 'construct' as const, label: 'Service event' },
  expense: { color: '#10B981', bgColor: '#D1FAE5', icon: 'cash' as const, label: 'Expense event' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EventRow({ event, odometerUnit, place, onPress, currency = '$' }: EventRowProps) {
  const config = TYPE_CONFIG[event.type];
  const unitLabel = odometerUnit === 'miles' ? 'mi' : 'km';
  const dateText = formatDate(event.date);
  const placeName = place?.name;
  const topLine = placeName ? `${dateText} · ${placeName}` : dateText;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-surface dark:active:bg-surface-dark"
      accessibilityLabel={`${config.label} on ${event.date}, ${currency}${event.cost.toFixed(2)}`}
      accessibilityRole="button"
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: config.bgColor }}
      >
        <Ionicons name={config.icon} size={18} color={config.color} accessibilityLabel={config.label} />
      </View>

      <View className="flex-1 mr-2">
        <Text className="text-sm text-ink dark:text-ink-on-dark" numberOfLines={1}>
          {topLine}
        </Text>
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark">
          {event.odometer != null
            ? `${event.odometer.toLocaleString('en-US')} ${unitLabel}`
            : '—'}
        </Text>
      </View>

      <Text className="text-sm font-semibold text-ink dark:text-ink-on-dark">
        {currency}{event.cost.toFixed(2)}
      </Text>
    </Pressable>
  );
}
