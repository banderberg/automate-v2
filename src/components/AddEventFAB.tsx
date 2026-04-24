import { useRef, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useVehicleStore } from '../stores/vehicleStore';

export function AddEventFAB() {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const isElectric = activeVehicle?.fuelType === 'electric';

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleNavigate = useCallback(
    (route: '/(modals)/fuel-event' | '/(modals)/service-event' | '/(modals)/expense-event') => {
      handleDismiss();
      router.push(route);
    },
    [handleDismiss, router]
  );

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

  return (
    <>
      {/* FAB button */}
      <Pressable
        onPress={handleOpen}
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        accessibilityLabel="Add event"
        accessibilityRole="button"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color="white" />
      </Pressable>

      {/* Action sheet */}
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: 'white' }}
      >
        <BottomSheetView>
          <Text className="px-4 pt-4 pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Add Event
          </Text>

          <Pressable
            onPress={() => handleNavigate('/(modals)/fuel-event')}
            className="flex-row items-center px-4 py-4 active:bg-gray-50"
            accessibilityLabel={isElectric ? 'Add Charge event' : 'Add Fill-Up event'}
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-teal-100 items-center justify-center mr-4">
              <Ionicons
                name={isElectric ? 'flash' : 'water'}
                size={20}
                color="#14b8a6"
              />
            </View>
            <Text className="text-base font-medium text-gray-900">
              {isElectric ? 'Charge' : 'Fill-Up'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleNavigate('/(modals)/service-event')}
            className="flex-row items-center px-4 py-4 active:bg-gray-50"
            accessibilityLabel="Add Service event"
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-4">
              <Ionicons name="construct" size={20} color="#f97316" />
            </View>
            <Text className="text-base font-medium text-gray-900">Service</Text>
          </Pressable>

          <Pressable
            onPress={() => handleNavigate('/(modals)/expense-event')}
            className="flex-row items-center px-4 py-4 active:bg-gray-50"
            accessibilityLabel="Add Expense event"
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-4">
              <Ionicons name="cash" size={20} color="#10b981" />
            </View>
            <Text className="text-base font-medium text-gray-900">Expense</Text>
          </Pressable>

          <View className="h-8" />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
