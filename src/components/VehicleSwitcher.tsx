import { useRef, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useGuardedNavigate } from '../hooks/useGuardedNavigate';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useVehicleStore } from '../stores/vehicleStore';
import { switchVehicle } from '../stores/orchestrator';
import type { Vehicle } from '../types';

interface VehicleSwitcherProps {
  tintColor?: string;
}

export function VehicleSwitcher({ tintColor }: VehicleSwitcherProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const nav = useGuardedNavigate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const vehicles = useVehicleStore((s) => s.vehicles);
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleSelectVehicle = useCallback(
    async (vehicle: Vehicle) => {
      if (vehicle.id !== activeVehicle?.id) {
        await switchVehicle(vehicle.id);
      }
      handleDismiss();
    },
    [activeVehicle?.id, handleDismiss]
  );

  const handleManageVehicles = useCallback(() => {
    handleDismiss();
    nav.push('/(modals)/manage-vehicles');
  }, [handleDismiss, nav]);

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

  const iconColor = tintColor ?? (isDark ? '#F5F4F1' : '#1C1B18');
  const multiVehicle = vehicles.length > 1;

  const header = (
    <View className="flex-row items-center px-4 py-3 bg-surface dark:bg-surface-dark border-b border-divider dark:border-divider-dark">
      <View className="w-8 h-8 rounded-full bg-divider dark:bg-divider-dark items-center justify-center overflow-hidden mr-3">
        {activeVehicle?.imagePath ? (
          <Image
            source={{ uri: activeVehicle.imagePath }}
            className="w-8 h-8"
            accessible={false}
          />
        ) : (
          <Ionicons name="car" size={18} color="#A8A49D" />
        )}
      </View>
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
      {multiVehicle && <Ionicons name="chevron-down" size={18} color={iconColor} />}
    </View>
  );

  return (
    <>
      {multiVehicle ? (
        <Pressable
          onPress={handleOpen}
          accessibilityLabel={`Active vehicle: ${activeVehicle?.nickname ?? 'None'}. Tap to switch vehicle.`}
          accessibilityRole="button"
        >
          {header}
        </Pressable>
      ) : (
        <View accessibilityLabel={`Vehicle: ${activeVehicle?.nickname ?? 'None'}`}>
          {header}
        </View>
      )}

      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: isDark ? '#2A2926' : '#E2E0DB' }}
        backgroundStyle={{ backgroundColor: isDark ? '#1A1917' : '#FEFDFB' }}
      >
        <BottomSheetView>
          <Text className="px-4 pt-4 pb-2 text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider">
            Your Vehicles
          </Text>

          {vehicles.map((vehicle) => (
            <Pressable
              key={vehicle.id}
              onPress={() => handleSelectVehicle(vehicle)}
              className="flex-row items-center px-4 py-3 active:bg-surface dark:active:bg-surface-dark"
              accessibilityLabel={`Select ${vehicle.nickname}`}
              accessibilityRole="button"
            >
              <View className="w-10 h-10 rounded-full bg-divider dark:bg-divider-dark items-center justify-center overflow-hidden mr-3">
                {vehicle.imagePath ? (
                  <Image
                    source={{ uri: vehicle.imagePath }}
                    className="w-10 h-10"
                    accessible={false}
                  />
                ) : (
                  <Ionicons name="car" size={20} color="#A8A49D" />
                )}
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold text-ink dark:text-ink-on-dark" numberOfLines={1}>
                  {vehicle.nickname}
                </Text>
                <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
              </View>

              {vehicle.isActive && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#4272C4"
                  accessibilityLabel="Active vehicle"
                />
              )}
            </Pressable>
          ))}

          <Pressable
            onPress={() => {
              handleDismiss();
              nav.push('/(modals)/vehicle');
            }}
            className="flex-row items-center px-4 py-3 active:bg-surface dark:active:bg-surface-dark"
            accessibilityLabel="Add Vehicle"
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center mr-3">
              <Ionicons name="add" size={20} color="#4272C4" />
            </View>
            <Text className="text-base text-primary font-medium">Add Vehicle</Text>
          </Pressable>

          <View className="h-px bg-divider dark:bg-divider-dark mx-4 my-1" />

          <Pressable
            onPress={handleManageVehicles}
            className="flex-row items-center px-4 py-4 active:bg-surface dark:active:bg-surface-dark"
            accessibilityLabel="Manage Vehicles"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color="#5C5A55" className="mr-3" />
            <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark ml-3">Manage Vehicles</Text>
          </Pressable>

          {/* Bottom safe area spacing */}
          <View className="h-6" />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
