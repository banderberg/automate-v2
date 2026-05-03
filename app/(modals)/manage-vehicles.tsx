import { useCallback } from 'react';
import { View, Text, Pressable, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '@/src/components/ModalHeader';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import type { Vehicle } from '@/src/types';
import { t } from '@/src/i18n';

export default function ManageVehiclesModal() {
  const nav = useGuardedNavigate();
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
          nav.push(`/(modals)/vehicle?vehicleId=${item.id}`)
        }
        className="flex-row items-center px-4 py-3 bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark active:bg-surface dark:active:bg-surface-dark"
        accessibilityLabel={t('manageVehicles.vehicleA11y', {
          name: item.nickname,
          year: item.year,
          make: item.make,
          model: item.model,
          activeSuffix: item.isActive ? t('manageVehicles.activeSuffix') : '',
        })}
        accessibilityRole="button"
      >
        {/* Photo */}
        <View className="w-10 h-10 rounded-full bg-surface dark:bg-surface-dark items-center justify-center overflow-hidden mr-3">
          {item.imagePath ? (
            <Image
              source={{ uri: item.imagePath }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="car" size={20} color="#A8A49D" />
          )}
        </View>

        {/* Info */}
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-base font-semibold text-ink dark:text-ink-on-dark"
              numberOfLines={1}
            >
              {item.nickname}
            </Text>
            {item.isActive && (
              <View className="w-2 h-2 rounded-full bg-success" />
            )}
          </View>
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark" numberOfLines={1}>
            {item.year} {item.make} {item.model}
          </Text>
        </View>

        {/* Reorder buttons */}
        <View className="flex-row gap-1">
          <Pressable
            onPress={() => moveVehicle(index, -1)}
            disabled={index === 0}
            className="p-1.5"
            accessibilityLabel={t('manageVehicles.moveUpA11y', { name: item.nickname })}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={index === 0 ? '#E2E0DB' : '#5C5A55'}
            />
          </Pressable>
          <Pressable
            onPress={() => moveVehicle(index, 1)}
            disabled={index === vehicles.length - 1}
            className="p-1.5"
            accessibilityLabel={t('manageVehicles.moveDownA11y', { name: item.nickname })}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={index === vehicles.length - 1 ? '#E2E0DB' : '#5C5A55'}
            />
          </Pressable>
        </View>
      </Pressable>
    ),
    [vehicles.length, moveVehicle, nav]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={t('manageVehicles.title')}
        cancelLabel={t('common.done')}
        onCancel={() => nav.back()}
        hideSave
      />
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
        ListFooterComponent={
          <Pressable
            onPress={() => nav.push('/(modals)/vehicle')}
            className="flex-row items-center justify-center py-4 mt-4 mx-4 rounded-xl bg-primary"
            accessibilityLabel={t('manageVehicles.addVehicleA11y')}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold text-base ml-1">
              {t('manageVehicles.addVehicle')}
            </Text>
          </Pressable>
        }
        ListFooterComponentStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
