import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { ModalHeader } from '@/src/components/ModalHeader';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { DateField } from '@/src/components/DateField';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { exportVehicleData } from '@/src/services/csvExport';
import { generateServiceHistoryPDF } from '@/src/services/pdfExport';

type ExportFormat = 'csv' | 'pdf';

export default function ExportModal() {
  const router = useRouter();
  const vehicles = useVehicleStore((s) => s.vehicles);

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const { showDialog, dialogProps } = useDialog();

  const selectedLabel = useMemo(() => {
    if (!selectedVehicleId) return 'All Vehicles';
    const v = vehicles.find((veh) => veh.id === selectedVehicleId);
    return v?.nickname ?? 'Unknown';
  }, [selectedVehicleId, vehicles]);

  const handleFormatChange = useCallback(
    (newFormat: ExportFormat) => {
      setFormat(newFormat);
      if (newFormat === 'pdf' && !selectedVehicleId && vehicles.length > 0) {
        setSelectedVehicleId(vehicles[0].id);
      }
    },
    [selectedVehicleId, vehicles],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      if (format === 'pdf') {
        if (!selectedVehicleId) {
          showDialog('Vehicle Required', 'Please select a vehicle for PDF export.');
          return;
        }
        const fileUri = await generateServiceHistoryPDF(
          selectedVehicleId,
          fromDate || undefined,
          toDate || undefined,
        );
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Export AutoMate Service History',
          });
        } else {
          showDialog('Exported', `File saved to: ${fileUri}`);
        }
      } else {
        const fileUri = await exportVehicleData(
          selectedVehicleId,
          fromDate || undefined,
          toDate || undefined,
        );
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export AutoMate Data',
          });
        } else {
          showDialog('Exported', `File saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog('Export Failed', msg || 'Could not generate the file. Check your storage space and try again.');
    } finally {
      setExporting(false);
    }
  }, [format, selectedVehicleId, fromDate, toDate]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title="Export Data"
        onCancel={() => router.back()}
        hideSave
      />
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Format toggle */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          Format
        </Text>
        <View className="flex-row bg-surface dark:bg-surface-dark rounded-card border border-divider dark:border-divider-dark p-1 mb-4">
          <Pressable
            onPress={() => handleFormatChange('csv')}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              format === 'csv' ? 'bg-primary' : ''
            }`}
            accessibilityLabel={`CSV format${format === 'csv' ? ', selected' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: format === 'csv' }}
          >
            <Text
              className={`text-sm font-semibold ${
                format === 'csv' ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
              }`}
            >
              CSV
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleFormatChange('pdf')}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              format === 'pdf' ? 'bg-primary' : ''
            }`}
            accessibilityLabel={`PDF format${format === 'pdf' ? ', selected' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: format === 'pdf' }}
          >
            <Text
              className={`text-sm font-semibold ${
                format === 'pdf' ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
              }`}
            >
              PDF
            </Text>
          </Pressable>
        </View>

        {format === 'pdf' && (
          <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark mb-4 -mt-2">
            PDF export is per-vehicle only
          </Text>
        )}

        {/* Vehicle picker */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          Vehicle
        </Text>
        <Pressable
          onPress={() => setShowVehiclePicker(!showVehiclePicker)}
          className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
          accessibilityLabel={`Selected vehicle: ${selectedLabel}`}
          accessibilityRole="button"
        >
          <Text className="flex-1 text-base text-ink dark:text-ink-on-dark">
            {selectedLabel}
          </Text>
          <Ionicons
            name={showVehiclePicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#A8A49D"
          />
        </Pressable>

        {showVehiclePicker && (
          <View className="mb-4 bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark overflow-hidden">
            {format !== 'pdf' && (
              <Pressable
                onPress={() => {
                  setSelectedVehicleId(null);
                  setShowVehiclePicker(false);
                }}
                className={`px-3.5 py-3 border-b border-divider-subtle dark:border-divider-dark ${
                  !selectedVehicleId ? 'bg-primary-light dark:bg-primary-dark' : ''
                }`}
                accessibilityLabel="All Vehicles"
                accessibilityRole="button"
              >
                <Text
                  className={`text-base ${
                    !selectedVehicleId
                      ? 'text-primary font-semibold'
                      : 'text-ink dark:text-ink-on-dark'
                  }`}
                >
                  All Vehicles
                </Text>
              </Pressable>
            )}
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  setSelectedVehicleId(v.id);
                  setShowVehiclePicker(false);
                }}
                className={`px-3.5 py-3 border-b border-divider-subtle dark:border-divider-dark ${
                  selectedVehicleId === v.id ? 'bg-primary-light dark:bg-primary-dark' : ''
                }`}
                accessibilityLabel={v.nickname}
                accessibilityRole="button"
              >
                <Text
                  className={`text-base ${
                    selectedVehicleId === v.id
                      ? 'text-primary font-semibold'
                      : 'text-ink dark:text-ink-on-dark'
                  }`}
                >
                  {v.nickname}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Date range */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          Date Range (optional)
        </Text>

        {fromDate ? (
          <View className="mb-2">
            <DateField
              value={fromDate}
              onChange={setFromDate}
              label="From"
              required={false}
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
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
            accessibilityLabel="Set from date"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#A8A49D" />
            <Text className="flex-1 ml-2 text-base text-ink-muted">From (all time)</Text>
          </Pressable>
        )}

        {toDate ? (
          <View className="mb-2">
            <DateField
              value={toDate}
              onChange={setToDate}
              label="To"
              required={false}
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
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
            accessibilityLabel="Set to date"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#A8A49D" />
            <Text className="flex-1 ml-2 text-base text-ink-muted">To (all time)</Text>
          </Pressable>
        )}

        {/* Export button */}
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          className={`mt-6 py-4 rounded-xl items-center ${
            exporting ? 'bg-divider dark:bg-divider-dark' : 'bg-primary'
          }`}
          accessibilityLabel={`Export ${format.toUpperCase()}`}
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={format === 'pdf' ? 'document-text-outline' : 'download-outline'}
                size={20}
                color="white"
              />
              <Text className="text-white font-semibold text-base">
                Export {format.toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        <View className="h-8" />
      </ScrollView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
