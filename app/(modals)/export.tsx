import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { ModalHeader } from '@/src/components/ModalHeader';
import { DateField } from '@/src/components/DateField';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { exportVehicleData } from '@/src/services/csvExport';

export default function ExportModal() {
  const router = useRouter();
  const vehicles = useVehicleStore((s) => s.vehicles);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!selectedVehicleId) return 'All Vehicles';
    const v = vehicles.find((v) => v.id === selectedVehicleId);
    return v?.nickname ?? 'Unknown';
  }, [selectedVehicleId, vehicles]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const fileUri = await exportVehicleData(
        selectedVehicleId,
        fromDate || undefined,
        toDate || undefined
      );

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export AutoMate Data',
        });
      } else {
        Alert.alert('Exported', `File saved to: ${fileUri}`);
      }
    } catch {
      Alert.alert('Export Failed', 'Could not export data. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [selectedVehicleId, fromDate, toDate]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <ModalHeader
        title="Export Data"
        onCancel={() => router.back()}
        hideSave
      />
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Vehicle picker */}
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">
          Vehicle
        </Text>
        <Pressable
          onPress={() => setShowVehiclePicker(!showVehiclePicker)}
          className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 mb-4"
          accessibilityLabel={`Selected vehicle: ${selectedLabel}`}
          accessibilityRole="button"
        >
          <Text className="flex-1 text-base text-gray-900 dark:text-gray-100">
            {selectedLabel}
          </Text>
          <Ionicons
            name={showVehiclePicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9CA3AF"
          />
        </Pressable>

        {showVehiclePicker && (
          <View className="mb-4 bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Pressable
              onPress={() => {
                setSelectedVehicleId(null);
                setShowVehiclePicker(false);
              }}
              className={`px-3.5 py-3 border-b border-gray-100 dark:border-gray-800 ${
                !selectedVehicleId ? 'bg-primary-light dark:bg-primary-dark' : ''
              }`}
              accessibilityLabel="All Vehicles"
              accessibilityRole="button"
            >
              <Text
                className={`text-base ${
                  !selectedVehicleId
                    ? 'text-primary font-semibold'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                All Vehicles
              </Text>
            </Pressable>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  setSelectedVehicleId(v.id);
                  setShowVehiclePicker(false);
                }}
                className={`px-3.5 py-3 border-b border-gray-100 dark:border-gray-800 ${
                  selectedVehicleId === v.id ? 'bg-primary-light dark:bg-primary-dark' : ''
                }`}
                accessibilityLabel={v.nickname}
                accessibilityRole="button"
              >
                <Text
                  className={`text-base ${
                    selectedVehicleId === v.id
                      ? 'text-primary font-semibold'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {v.nickname}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Date range */}
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">
          Date Range (optional)
        </Text>

        {fromDate ? (
          <View className="mb-2">
            <DateField
              value={fromDate}
              onChange={setFromDate}
              label="From"
            />
            <Pressable
              onPress={() => setFromDate('')}
              className="self-start mb-2"
              accessibilityLabel="Clear from date"
              accessibilityRole="button"
            >
              <Text className="text-xs text-primary">Clear</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setFromDate(new Date().toISOString().split('T')[0])}
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 mb-4"
            accessibilityLabel="Set from date"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            <Text className="flex-1 ml-2 text-base text-gray-400">From (all time)</Text>
          </Pressable>
        )}

        {toDate ? (
          <View className="mb-2">
            <DateField
              value={toDate}
              onChange={setToDate}
              label="To"
            />
            <Pressable
              onPress={() => setToDate('')}
              className="self-start mb-2"
              accessibilityLabel="Clear to date"
              accessibilityRole="button"
            >
              <Text className="text-xs text-primary">Clear</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setToDate(new Date().toISOString().split('T')[0])}
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 mb-4"
            accessibilityLabel="Set to date"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            <Text className="flex-1 ml-2 text-base text-gray-400">To (all time)</Text>
          </Pressable>
        )}

        {/* Export button */}
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          className={`mt-6 py-4 rounded-xl items-center ${
            exporting ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary'
          }`}
          accessibilityLabel="Export CSV"
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="download-outline" size={20} color="white" />
              <Text className="text-white font-semibold text-base">Export CSV</Text>
            </View>
          )}
        </Pressable>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
