import { useRef, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
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

  const iconColor = tintColor ?? '#1C1B18';

  return (
    <>
      <Pressable
        onPress={handleOpen}
        className="flex-row items-center px-4 py-3 bg-surface dark:bg-surface-dark border-b border-divider dark:border-divider-dark"
        accessibilityLabel={`Active vehicle: ${activeVehicle?.nickname ?? 'None'}. Tap to switch vehicle.`}
        accessibilityRole="button"
      >
        {/* Vehicle photo or placeholder */}
        <View className="w-8 h-8 rounded-full bg-divider dark:bg-divider-dark items-center justify-center overflow-hidden mr-3">
          {activeVehicle?.imagePath ? (
            <Image
              source={{ uri: activeVehicle.imagePath }}
              className="w-8 h-8"
              accessibilityLabel=""
            />
          ) : (
            <Ionicons name="car" size={18} color="#A8A49D" />
          )}
        </View>

        {/* Vehicle info */}
        <View className="flex-1">
          <Text
            className="text-base font-bold text-ink dark:text-ink-on-dark"
            numberOfLines={1}
          >
            {activeVehicle?.nickname ?? 'Add a Vehicle'}
          </Text>
          {activeVehicle && (
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1}>
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
        handleIndicatorStyle={{ backgroundColor: '#E2E0DB' }}
        backgroundStyle={{ backgroundColor: '#FEFDFB' }}
      >
        <BottomSheetView>
          <Text className="px-4 pt-4 pb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Your Vehicles
          </Text>

          {vehicles.map((vehicle) => (
            <Pressable
              key={vehicle.id}
              onPress={() => handleSelectVehicle(vehicle)}
              className="flex-row items-center px-4 py-3 active:bg-surface"
              accessibilityLabel={`Select ${vehicle.nickname}`}
              accessibilityRole="button"
            >
              <View className="w-10 h-10 rounded-full bg-divider items-center justify-center overflow-hidden mr-3">
                {vehicle.imagePath ? (
                  <Image
                    source={{ uri: vehicle.imagePath }}
                    className="w-10 h-10"
                    accessibilityLabel=""
                  />
                ) : (
                  <Ionicons name="car" size={20} color="#A8A49D" />
                )}
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold text-ink" numberOfLines={1}>
                  {vehicle.nickname}
                </Text>
                <Text className="text-xs text-ink-muted" numberOfLines={1}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
              </View>

              {vehicle.isActive && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#3B82F6"
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
            className="flex-row items-center px-4 py-3 active:bg-surface"
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center mr-3">
              <Ionicons name="add" size={20} color="#3B82F6" />
            </View>
            <Text className="text-base text-primary font-medium">Add Vehicle</Text>
          </Pressable>

          <View className="h-px bg-divider mx-4 my-1" />

          <Pressable
            onPress={handleManageVehicles}
            className="flex-row items-center px-4 py-4 active:bg-surface"
            accessibilityLabel="Manage Vehicles"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color="#5C5A55" className="mr-3" />
            <Text className="text-sm text-ink-secondary ml-3">Manage Vehicles</Text>
          </Pressable>

          {/* Bottom safe area spacing */}
          <View className="h-6" />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
