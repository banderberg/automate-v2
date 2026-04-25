import { useCallback } from 'react';
import { View, Text, Pressable, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '@/src/components/ModalHeader';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import type { Vehicle } from '@/src/types';

export default function ManageVehiclesModal() {
  const router = useRouter();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const reorderVehicles = useVehicleStore((s) => s.reorderVehicles);

  const moveVehicle = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= vehicles.length) return;
      const ids = vehicles.map((v) => v.id);
      [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
      reorderVehicles(ids);
    },
    [vehicles, reorderVehicles]
  );

  const renderVehicle = useCallback(
    ({ item, index }: { item: Vehicle; index: number }) => (
      <Pressable
        onPress={() =>
          router.push(`/(modals)/vehicle?vehicleId=${item.id}`)
        }
        className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
        accessibilityLabel={`${item.nickname}, ${item.year} ${item.make} ${item.model}${item.isActive ? ', active' : ''}`}
        accessibilityRole="button"
      >
        {/* Photo */}
        <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center overflow-hidden mr-3">
          {item.imagePath ? (
            <Image
              source={{ uri: item.imagePath }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="car" size={20} color="#9CA3AF" />
          )}
        </View>

        {/* Info */}
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
              numberOfLines={1}
            >
              {item.nickname}
            </Text>
            {item.isActive && (
              <View className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {item.year} {item.make} {item.model}
          </Text>
        </View>

        {/* Reorder buttons */}
        <View className="flex-row gap-1">
          <Pressable
            onPress={() => moveVehicle(index, -1)}
            disabled={index === 0}
            className="p-1.5"
            accessibilityLabel={`Move ${item.nickname} up`}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={index === 0 ? '#D1D5DB' : '#6B7280'}
            />
          </Pressable>
          <Pressable
            onPress={() => moveVehicle(index, 1)}
            disabled={index === vehicles.length - 1}
            className="p-1.5"
            accessibilityLabel={`Move ${item.nickname} down`}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={index === vehicles.length - 1 ? '#D1D5DB' : '#6B7280'}
            />
          </Pressable>
        </View>
      </Pressable>
    ),
    [vehicles.length, moveVehicle, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <ModalHeader
        title="Manage Vehicles"
        onCancel={() => router.back()}
        hideSave
      />
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/(modals)/vehicle')}
            className="flex-row items-center justify-center py-4 mt-4 mx-4 rounded-xl bg-primary"
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold text-base ml-1">
              Add Vehicle
            </Text>
          </Pressable>
        }
        ListFooterComponentStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
