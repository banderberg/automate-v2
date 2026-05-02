import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { Swipeable } from 'react-native-gesture-handler';
import { VehicleSwitcher } from '@/src/components/VehicleSwitcher';
import { AddEventFAB } from '@/src/components/AddEventFAB';
import { EmptyState } from '@/src/components/EmptyState';
import { EventRow } from '@/src/components/EventRow';
import { UndoSnackbar } from '@/src/components/UndoSnackbar';
import { HistorySkeleton } from '@/src/components/Skeleton';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useActiveVehicle } from '@/src/hooks/useActiveVehicle';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { formatCurrency } from '@/src/constants/currency';
import type { VehicleEvent } from '@/src/types';

type FilterType = 'all' | 'fuel' | 'service' | 'expense';

const FILTER_CHIPS: { id: FilterType; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fuel', label: 'Fuel', color: '#1A9A8F' },
  { id: 'service', label: 'Service', color: '#E8772B' },
  { id: 'expense', label: 'Expense', color: '#2EAD76' },
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
  onPress,
  onDelete,
  onLongPress,
  currencyCode: cc = 'USD',
}: {
  event: VehicleEvent;
  odometerUnit: 'miles' | 'kilometers';
  onPress: () => void;
  onDelete: () => void;
  onLongPress: () => void;
  currencyCode?: string;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const places = useReferenceDataStore((s) => s.places);
  const categories = useReferenceDataStore((s) => s.categories);
  const serviceLabels = useEventStore((s) => s.serviceLabels);
  const place = event.placeId ? places.find((p) => p.id === event.placeId) : null;
  const eventLabel = event.type === 'expense'
    ? (event.categoryId ? categories.find((c) => c.id === event.categoryId)?.name : undefined)
    : event.type === 'service'
      ? serviceLabels.get(event.id)
      : undefined;

  const renderRightActions = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        className="bg-destructive justify-center items-center px-6"
        accessibilityLabel="Delete"
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
      <Pressable onLongPress={onLongPress} delayLongPress={500} accessibilityLabel={`${event.type} event on ${event.date}, ${formatCurrency(event.cost, cc)}. Long press for options.`}>
        <View className="bg-surface dark:bg-surface-dark">
          <EventRow
            event={event}
            odometerUnit={odometerUnit}
            place={place}
            label={eventLabel}
            onPress={onPress}
            currencyCode={cc}
          />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function HistoryScreen() {
  const nav = useGuardedNavigate();
  const currencyCode = useSettingsStore((s) => s.settings.currency);
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const { activeVehicle, events } = useActiveVehicle();
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const isLoading = useEventStore((s) => s.isLoading);
  const places = useReferenceDataStore((s) => s.places);
  const categories = useReferenceDataStore((s) => s.categories);
  const serviceLabels = useEventStore((s) => s.serviceLabels);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set(['all']));
  const [searchQuery, setSearchQuery] = useState('');
  const { showDialog, dialogProps } = useDialog();

  const placeMap = useMemo(() => {
    const m = new Map<string, typeof places[0]>();
    for (const p of places) m.set(p.id, p);
    return m;
  }, [places]);

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
    let result = events;
    if (!activeFilters.has('all')) {
      result = result.filter((e) => activeFilters.has(e.type));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => {
        if (e.notes?.toLowerCase().includes(q)) return true;
        if (e.cost.toFixed(2).includes(q)) return true;
        if (e.placeId) {
          const place = placeMap.get(e.placeId);
          if (place?.name.toLowerCase().includes(q)) return true;
        }
        if (e.type === 'expense' && e.categoryId) {
          const cat = categories.find((c) => c.id === e.categoryId);
          if (cat?.name.toLowerCase().includes(q)) return true;
        }
        if (e.type === 'service') {
          const label = serviceLabels.get(e.id);
          if (label?.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    return result;
  }, [events, activeFilters, searchQuery, placeMap, categories, serviceLabels]);

  const listItems = useMemo(() => groupByMonth(filteredEvents), [filteredEvents]);

  const handleEventPress = useCallback(
    (event: VehicleEvent) => {
      const routes = {
        fuel: `/(modals)/fuel-event?eventId=${event.id}`,
        service: `/(modals)/service-event?eventId=${event.id}`,
        expense: `/(modals)/expense-event?eventId=${event.id}`,
      } as const;
      nav.push(routes[event.type]);
    },
    [nav]
  );

  const handleDelete = useCallback(
    (event: VehicleEvent) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const typeLabel = event.type === 'fuel' ? 'fill-up' : event.type;
      showDialog(`Delete ${typeLabel}?`, 'You can undo this for a few seconds after.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEvent(event.id),
        },
      ]);
    },
    [deleteEvent]
  );

  const handleLongPress = useCallback(
    (event: VehicleEvent) => {
      showDialog('Options', undefined, [
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
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
        <EmptyState
          icon={
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A9A8F10', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="receipt-outline" size={44} color="#1A9A8F" />
            </View>
          }
          title="No vehicle yet"
          description="Add a vehicle from the Dashboard tab to start logging events here."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <VehicleSwitcher />

      {/* Search bar */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3 py-2">
          <Ionicons name="search" size={16} color="#A8A49D" />
          <TextInput
            className="flex-1 text-sm text-ink dark:text-ink-on-dark ml-2"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes, places, categories..."
            placeholderTextColor="#A8A49D"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search history"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={14} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color="#A8A49D" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter bar */}
      <View className="flex-row px-4 py-3 gap-2">
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilters.has(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => handleFilterToggle(chip.id)}
              className={`px-4 py-2.5 rounded-full border ${
                isActive ? 'border-transparent' : 'border-divider dark:border-divider-dark'
              }`}
              style={
                isActive
                  ? { backgroundColor: chip.color || '#4272C4' }
                  : undefined
              }
              accessibilityLabel={`Filter ${chip.label}${isActive ? ', active' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
                }`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <HistorySkeleton />
      ) : filteredEvents.length === 0 ? (
        <View className="flex-1">
          {searchQuery.trim() || !activeFilters.has('all') ? (
            <EmptyState
              icon={<View style={{ opacity: 0.4 }}><Ionicons name="search-outline" size={64} color="#A8A49D" /></View>}
              title="No matches"
              description="Try a different search term or clear your filters."
            />
          ) : (
            <EmptyState
              icon={
                <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A9A8F10', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="receipt-outline" size={44} color="#1A9A8F" />
                </View>
              }
              title="Your timeline starts here"
              description="Tap + to log a fill-up, service, or expense. Each entry builds your car's story."
            />
          )}
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
                <View className="flex-row items-center justify-between px-4 py-2.5 bg-surface dark:bg-surface-dark border-b border-divider-subtle dark:border-divider-dark">
                  <Text className="text-sm font-semibold text-ink dark:text-ink-on-dark">
                    {item.month}
                  </Text>
                  <Text className="text-sm font-semibold text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1}>
                    {formatCurrency(item.total, currencyCode)}
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
                currencyCode={currencyCode}
              />
            );
          }}
          getItemType={(item) => item.kind}
        />
      )}

      <UndoSnackbar />
      <AddEventFAB />
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
