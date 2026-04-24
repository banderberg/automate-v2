import { useRef, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useVehicleStore } from '../stores/vehicleStore';
import type { Vehicle } from '../types';

interface VehicleSwitcherProps {
  tintColor?: string;
}

export function VehicleSwitcher({ tintColor }: VehicleSwitcherProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const setActiveVehicle = useVehicleStore((s) => s.setActiveVehicle);

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleSelectVehicle = useCallback(
    async (vehicle: Vehicle) => {
      if (vehicle.id !== activeVehicle?.id) {
        await setActiveVehicle(vehicle.id);
      }
      handleDismiss();
    },
    [activeVehicle?.id, setActiveVehicle, handleDismiss]
  );

  const handleManageVehicles = useCallback(() => {
    handleDismiss();
    router.push('/(modals)/manage-vehicles');
  }, [handleDismiss, router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  const iconColor = tintColor ?? '#374151';

  return (
    <>
      <Pressable
        onPress={handleOpen}
        className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
        accessibilityLabel={`Active vehicle: ${activeVehicle?.nickname ?? 'None'}. Tap to switch vehicle.`}
        accessibilityRole="button"
      >
        {/* Vehicle photo or placeholder */}
        <View className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center overflow-hidden mr-3">
          {activeVehicle?.imagePath ? (
            <Image
              source={{ uri: activeVehicle.imagePath }}
              className="w-8 h-8"
              accessibilityLabel=""
            />
          ) : (
            <Ionicons name="car" size={18} color="#9ca3af" />
          )}
        </View>

        {/* Vehicle info */}
        <View className="flex-1">
          <Text
            className="text-base font-bold text-gray-900 dark:text-gray-100"
            numberOfLines={1}
          >
            {activeVehicle?.nickname ?? 'Add a Vehicle'}
          </Text>
          {activeVehicle && (
            <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-down" size={18} color={iconColor} />
      </Pressable>

      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: 'white' }}
      >
        <BottomSheetView>
          <Text className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Your Vehicles
          </Text>

          {vehicles.map((vehicle) => (
            <Pressable
              key={vehicle.id}
              onPress={() => handleSelectVehicle(vehicle)}
              className="flex-row items-center px-4 py-3 active:bg-gray-50"
              accessibilityLabel={`Select ${vehicle.nickname}`}
              accessibilityRole="button"
            >
              <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center overflow-hidden mr-3">
                {vehicle.imagePath ? (
                  <Image
                    source={{ uri: vehicle.imagePath }}
                    className="w-10 h-10"
                    accessibilityLabel=""
                  />
                ) : (
                  <Ionicons name="car" size={20} color="#9ca3af" />
                )}
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                  {vehicle.nickname}
                </Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
              </View>

              {vehicle.isActive && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#2563eb"
                  accessibilityLabel="Active vehicle"
                />
              )}
            </Pressable>
          ))}

          <Pressable
            onPress={() => {
              handleDismiss();
              router.push('/(modals)/vehicle');
            }}
            className="flex-row items-center px-4 py-3 active:bg-gray-50"
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
              <Ionicons name="add" size={20} color="#2563eb" />
            </View>
            <Text className="text-base text-primary font-medium">Add Vehicle</Text>
          </Pressable>

          <View className="h-px bg-gray-200 mx-4 my-1" />

          <Pressable
            onPress={handleManageVehicles}
            className="flex-row items-center px-4 py-4 active:bg-gray-50"
            accessibilityLabel="Manage Vehicles"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color="#6b7280" className="mr-3" />
            <Text className="text-sm text-gray-600 ml-3">Manage Vehicles</Text>
          </Pressable>

          {/* Bottom safe area spacing */}
          <View className="h-6" />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
