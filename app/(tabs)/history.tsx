import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Swipeable } from 'react-native-gesture-handler';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { EventRow } from '@/src/components/EventRow';
import { UndoSnackbar } from '@/src/components/UndoSnackbar';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import type { VehicleEvent } from '@/src/types';

type FilterType = 'all' | 'fuel' | 'service' | 'expense';

const FILTER_CHIPS: { id: FilterType; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fuel', label: 'Fuel', color: '#0D9488' },
  { id: 'service', label: 'Service', color: '#F97316' },
  { id: 'expense', label: 'Expense', color: '#10B981' },
];

interface SectionHeader {
  kind: 'header';
  month: string;
  total: number;
}

interface EventItem {
  kind: 'event';
  event: VehicleEvent;
}

type ListItem = SectionHeader | EventItem;

function groupByMonth(events: VehicleEvent[]): ListItem[] {
  const items: ListItem[] = [];
  const groups = new Map<string, VehicleEvent[]>();

  for (const event of events) {
    const d = new Date(event.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  for (const key of sortedKeys) {
    const groupEvents = groups.get(key)!;
    const total = groupEvents.reduce((s, e) => s + e.cost, 0);
    const d = new Date(key + '-01T00:00:00');
    const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    items.push({ kind: 'header', month: monthLabel, total });
    for (const event of groupEvents) {
      items.push({ kind: 'event', event });
    }
  }

  return items;
}

function SwipeableEventRow({
  event,
  odometerUnit,
  placeName,
  onPress,
  onDelete,
  onLongPress,
}: {
  event: VehicleEvent;
  odometerUnit: 'miles' | 'kilometers';
  placeName?: string;
  onPress: () => void;
  onDelete: () => void;
  onLongPress: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const places = useReferenceDataStore((s) => s.places);
  const place = event.placeId ? places.find((p) => p.id === event.placeId) : null;

  const renderRightActions = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        className="bg-destructive justify-center items-center px-6"
        accessibilityLabel="Delete event"
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text className="text-white text-xs mt-1 font-semibold">Delete</Text>
      </Pressable>
    ),
    [onDelete]
  );

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable onLongPress={onLongPress} delayLongPress={500}>
        <View className="bg-white dark:bg-gray-950">
          <EventRow
            event={event}
            odometerUnit={odometerUnit}
            place={place}
            onPress={onPress}
          />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, events } = useActiveVehicle();
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set(['all']));

  const handleFilterToggle = useCallback((filter: FilterType) => {
    setActiveFilters((prev) => {
      if (filter === 'all') return new Set(['all']);
      const next = new Set(prev);
      next.delete('all');
      if (next.has(filter)) {
        next.delete(filter);
        return next.size === 0 ? new Set(['all']) : next;
      }
      next.add(filter);
      return next;
    });
  }, []);

  const filteredEvents = useMemo(() => {
    if (activeFilters.has('all')) return events;
    return events.filter((e) => activeFilters.has(e.type));
  }, [events, activeFilters]);

  const listItems = useMemo(() => groupByMonth(filteredEvents), [filteredEvents]);

  const handleEventPress = useCallback(
    (event: VehicleEvent) => {
      router.push(`/(modals)/${event.type}-event?eventId=${event.id}`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (event: VehicleEvent) => {
      deleteEvent(event.id);
    },
    [deleteEvent]
  );

  const handleLongPress = useCallback(
    (event: VehicleEvent) => {
      Alert.alert('Event Options', '', [
        {
          text: 'Edit',
          onPress: () => handleEventPress(event),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(event),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [handleEventPress, handleDelete]
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <VehicleSwitcher />

      {/* Filter bar */}
      <View className="flex-row px-4 py-3 gap-2">
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilters.has(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => handleFilterToggle(chip.id)}
              className={`px-4 py-1.5 rounded-full border ${
                isActive ? 'border-transparent' : 'border-gray-200 dark:border-gray-700'
              }`}
              style={
                isActive
                  ? { backgroundColor: chip.color || '#3B82F6' }
                  : undefined
              }
              accessibilityLabel={`Filter ${chip.label}${isActive ? ', active' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filteredEvents.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={<Ionicons name="time-outline" size={64} color="#9ca3af" />}
            title="No Events Yet"
            description="No events yet. Tap + to log your first fill-up, service, or expense."
          />
        </View>
      ) : (
        <FlashList
          data={listItems}
          keyExtractor={(item, index) =>
            item.kind === 'header' ? `header-${item.month}` : item.event.id
          }
          stickyHeaderIndices={listItems
            .map((item, index) => (item.kind === 'header' ? index : -1))
            .filter((i) => i >= 0)}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View className="flex-row items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.month}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    ${item.total.toFixed(2)}
                  </Text>
                </View>
              );
            }
            return (
              <SwipeableEventRow
                event={item.event}
                odometerUnit={activeVehicle?.odometerUnit ?? 'miles'}
                onPress={() => handleEventPress(item.event)}
                onDelete={() => handleDelete(item.event)}
                onLongPress={() => handleLongPress(item.event)}
              />
            );
          }}
          getItemType={(item) => item.kind}
        />
      )}

      <UndoSnackbar />
      <AddEventFAB />
    </SafeAreaView>
  );
}
