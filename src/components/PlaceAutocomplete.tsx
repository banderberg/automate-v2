import { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useReferenceDataStore } from '../stores/referenceDataStore';
import type { Place } from '../types';

interface PlaceAutocompleteProps {
  value: string | undefined;
  onChange: (placeId: string | undefined) => void;
  placeType: Place['type'];
  label?: string;
}

export function PlaceAutocomplete({
  value,
  onChange,
  placeType,
  label = 'Place',
}: PlaceAutocompleteProps) {
  const selectSheetRef = useRef<BottomSheetModal>(null);
  const addSheetRef = useRef<BottomSheetModal>(null);
  const places = useReferenceDataStore((s) => s.places);
  const addPlace = useReferenceDataStore((s) => s.addPlace);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const filteredPlaces = useMemo(() => {
    const typePlaces = places.filter((p) => p.type === placeType);
    if (!search.trim()) return typePlaces;
    const lower = search.toLowerCase();
    return typePlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.address && p.address.toLowerCase().includes(lower))
    );
  }, [places, placeType, search]);

  const selectedPlace = useMemo(
    () => (value ? places.find((p) => p.id === value) : null),
    [places, value]
  );

  const handleSelect = useCallback(
    (placeId: string) => {
      onChange(placeId);
      selectSheetRef.current?.dismiss();
      setSearch('');
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const handleAddPlace = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const place = await addPlace({
      name: trimmed,
      type: placeType,
      address: newAddress.trim() || undefined,
    });
    onChange(place.id);
    setNewName('');
    setNewAddress('');
    addSheetRef.current?.dismiss();
    selectSheetRef.current?.dismiss();
    setSearch('');
  }, [newName, newAddress, placeType, addPlace, onChange]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    []
  );

  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">{label}</Text>
      <Pressable
        onPress={() => selectSheetRef.current?.present()}
        className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3"
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        accessibilityRole="button"
      >
        <Ionicons name="location-outline" size={18} color="#9CA3AF" />
        <Text
          className={`flex-1 ml-2 text-base ${
            selectedPlace ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
          }`}
          numberOfLines={1}
        >
          {selectedPlace?.name ?? 'Select place (optional)'}
        </Text>
        {selectedPlace && (
          <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear place" accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </Pressable>

      <BottomSheetModal
        ref={selectSheetRef}
        snapPoints={['60%']}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: 'white' }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={{ flex: 1, paddingBottom: 20 }}>
          <View className="px-4 pb-3">
            <BottomSheetTextInput
              className="text-sm text-gray-900 bg-gray-100 rounded-xl px-3.5 py-2.5"
              value={search}
              onChangeText={setSearch}
              placeholder="Search places..."
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          </View>

          <FlatList
            data={filteredPlaces}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item.id)}
                className="flex-row items-center px-4 py-3 active:bg-gray-50"
                accessibilityLabel={`Select ${item.name}`}
                accessibilityRole="button"
              >
                <Ionicons name="location" size={16} color="#6B7280" />
                <View className="flex-1 ml-3">
                  <Text className="text-sm text-gray-900">{item.name}</Text>
                  {item.address && (
                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                </View>
                {item.id === value && (
                  <Ionicons name="checkmark" size={18} color="#3B82F6" />
                )}
              </Pressable>
            )}
            ListFooterComponent={
              <Pressable
                onPress={() => addSheetRef.current?.present()}
                className="flex-row items-center px-4 py-3 border-t border-gray-100"
                accessibilityLabel="Add new place"
                accessibilityRole="button"
              >
                <View className="w-6 h-6 rounded-full bg-primary-light items-center justify-center">
                  <Ionicons name="add" size={16} color="#3B82F6" />
                </View>
                <Text className="text-sm text-primary font-semibold ml-3">Add new place</Text>
              </Pressable>
            }
          />
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={addSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: 'white' }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        stackBehavior="push"
      >
        <BottomSheetView style={{ paddingBottom: 40 }}>
          <Text className="px-4 pt-2 pb-3 text-base font-semibold text-gray-900">
            Add New Place
          </Text>

          <View className="px-4">
            <Text className="text-xs text-gray-500 mb-1 font-semibold">Name *</Text>
            <BottomSheetTextInput
              className="text-sm text-gray-900 bg-gray-100 rounded-xl px-3.5 py-2.5 mb-3"
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g., Shell on Main St"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <Text className="text-xs text-gray-500 mb-1 font-semibold">Address</Text>
            <BottomSheetTextInput
              className="text-sm text-gray-900 bg-gray-100 rounded-xl px-3.5 py-2.5 mb-4"
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Optional"
              placeholderTextColor="#9CA3AF"
            />

            <Pressable
              onPress={handleAddPlace}
              className={`rounded-xl py-3 items-center ${
                newName.trim() ? 'bg-primary' : 'bg-gray-300'
              }`}
              disabled={!newName.trim()}
              accessibilityLabel="Save place"
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold text-sm">Save Place</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
