import { useRef, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGuardedNavigate } from '../hooks/useGuardedNavigate';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useVehicleStore } from '../stores/vehicleStore';
import { t } from '@/src/i18n';

type EventRoute = '/(modals)/fuel-event' | '/(modals)/service-event' | '/(modals)/expense-event';

const TYPE_ROUTES: Record<string, EventRoute> = {
  fuel: '/(modals)/fuel-event',
  service: '/(modals)/service-event',
  expense: '/(modals)/expense-event',
};

export function AddEventFAB() {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const nav = useGuardedNavigate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const isElectric = activeVehicle?.fuelType === 'electric';

  const handleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleNavigate = useCallback(
    (route: EventRoute) => {
      handleDismiss();
      nav.push(route);
    },
    [handleDismiss, nav]
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
      <Pressable
        onPress={handleTap}
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        accessibilityLabel={t('fab.logActivityA11y')}
        accessibilityRole="button"
        style={{
          shadowColor: '#1C1B18',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0 : 0.25,
          shadowRadius: 4,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color="white" />
      </Pressable>
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: isDark ? '#2A2926' : '#E2E0DB' }}
        backgroundStyle={{ backgroundColor: isDark ? '#1A1917' : '#FEFDFB' }}
      >
        <BottomSheetView>
          <Text className="px-4 pt-4 pb-3 text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider">
            {t('fab.logActivity')}
          </Text>

          <Pressable
            onPress={() => handleNavigate('/(modals)/fuel-event')}
            className="flex-row items-center px-4 py-4 active:bg-surface dark:active:bg-surface-dark"
            accessibilityLabel={isElectric ? t('fab.addChargeA11y') : t('fab.addFillUpA11y')}
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: '#D0F5EE' }}>
              {isElectric ? (
                <Ionicons name="flash" size={20} color="#1A9A8F" />
              ) : (
                <MaterialCommunityIcons name="gas-station-outline" size={22} color="#1A9A8F" />
              )}
            </View>
            <Text className="text-base font-medium text-ink dark:text-ink-on-dark">
              {isElectric ? t('fab.charge') : t('fab.fillUp')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleNavigate('/(modals)/service-event')}
            className="flex-row items-center px-4 py-4 active:bg-surface dark:active:bg-surface-dark"
            accessibilityLabel={t('fab.addServiceA11y')}
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: '#FFF3E6' }}>
              <Ionicons name="construct" size={20} color="#E8772B" />
            </View>
            <Text className="text-base font-medium text-ink dark:text-ink-on-dark">{t('fab.service')}</Text>
          </Pressable>

          <Pressable
            onPress={() => handleNavigate('/(modals)/expense-event')}
            className="flex-row items-center px-4 py-4 active:bg-surface dark:active:bg-surface-dark"
            accessibilityLabel={t('fab.addExpenseA11y')}
            accessibilityRole="button"
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: '#D5F2E3' }}>
              <Ionicons name="receipt-outline" size={20} color="#2EAD76" />
            </View>
            <Text className="text-base font-medium text-ink dark:text-ink-on-dark">{t('fab.expense')}</Text>
          </Pressable>

          <View className="h-8" />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
