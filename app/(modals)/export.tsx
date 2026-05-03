import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { ModalHeader } from '@/src/components/ModalHeader';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { DateField } from '@/src/components/DateField';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useToastStore } from '@/src/stores/toastStore';
import { exportVehicleData } from '@/src/services/csvExport';
import { generateServiceHistoryPDF } from '@/src/services/pdfExport';
import { t } from '@/src/i18n';

type ExportFormat = 'csv' | 'pdf';

export default function ExportModal() {
  const router = useRouter();
  const currencyCode = useSettingsStore((s) => s.settings.currency);
  const vehicles = useVehicleStore((s) => s.vehicles);

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fileName, setFileName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const { showDialog, dialogProps } = useDialog();

  const selectedLabel = useMemo(() => {
    if (!selectedVehicleId) return t('exportModal.allVehicles');
    const v = vehicles.find((veh) => veh.id === selectedVehicleId);
    return v?.nickname ?? t('exportModal.unknownVehicle');
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
          showDialog(t('exportModal.vehicleRequiredTitle'), t('exportModal.vehicleRequiredMessage'));
          return;
        }
        const fileUri = await generateServiceHistoryPDF(
          selectedVehicleId,
          fromDate || undefined,
          toDate || undefined,
          currencyCode,
          fileName || undefined,
        );
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: t('exportModal.shareDialogPdf'),
          });
          useToastStore.getState().show(t('exportModal.exportComplete'));
          router.back();
        } else {
          showDialog(t('exportModal.exportedTitle'), t('exportModal.exportedMessage', { uri: fileUri }));
        }
      } else {
        const fileUri = await exportVehicleData(
          selectedVehicleId,
          fromDate || undefined,
          toDate || undefined,
          fileName || undefined,
        );
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: t('exportModal.shareDialogCsv'),
          });
          useToastStore.getState().show(t('exportModal.exportComplete'));
          router.back();
        } else {
          showDialog(t('exportModal.exportedTitle'), t('exportModal.exportedMessage', { uri: fileUri }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog(t('exportModal.exportFailedTitle'), msg || t('exportModal.exportFailedMessage'));
    } finally {
      setExporting(false);
    }
  }, [format, selectedVehicleId, fromDate, toDate, currencyCode]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={t('exportModal.title')}
        cancelLabel={t('common.done')}
        onCancel={() => router.back()}
        hideSave
      />
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Format toggle */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          {t('exportModal.format')}
        </Text>
        <View className="flex-row bg-surface dark:bg-surface-dark rounded-card border border-divider dark:border-divider-dark p-1 mb-4">
          <Pressable
            onPress={() => handleFormatChange('csv')}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              format === 'csv' ? 'bg-primary' : ''
            }`}
            accessibilityLabel={t('exportModal.csvA11y', { suffix: format === 'csv' ? t('exportModal.selectedSuffix') : '' })}
            accessibilityRole="tab"
            accessibilityState={{ selected: format === 'csv' }}
          >
            <Text
              className={`text-sm font-semibold ${
                format === 'csv' ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
              }`}
            >
              {t('exportModal.csv')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleFormatChange('pdf')}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              format === 'pdf' ? 'bg-primary' : ''
            }`}
            accessibilityLabel={t('exportModal.pdfA11y', { suffix: format === 'pdf' ? t('exportModal.selectedSuffix') : '' })}
            accessibilityRole="tab"
            accessibilityState={{ selected: format === 'pdf' }}
          >
            <Text
              className={`text-sm font-semibold ${
                format === 'pdf' ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
              }`}
            >
              {t('exportModal.pdf')}
            </Text>
          </Pressable>
        </View>

        {format === 'pdf' && (
          <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark mb-4 -mt-2">
            {t('exportModal.pdfPerVehicleHint')}
          </Text>
        )}

        {/* Vehicle picker */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          {t('exportModal.vehicle')}
        </Text>
        <Pressable
          onPress={() => setShowVehiclePicker(!showVehiclePicker)}
          className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
          accessibilityLabel={t('exportModal.vehicleSelectedA11y', { label: selectedLabel })}
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
                accessibilityLabel={t('exportModal.allVehicles')}
                accessibilityRole="button"
              >
                <Text
                  className={`text-base ${
                    !selectedVehicleId
                      ? 'text-primary font-semibold'
                      : 'text-ink dark:text-ink-on-dark'
                  }`}
                >
                  {t('exportModal.allVehicles')}
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
          {t('exportModal.dateRange')}
        </Text>

        {fromDate ? (
          <View className="mb-2">
            <DateField
              value={fromDate}
              onChange={setFromDate}
              label={t('exportModal.fromLabel')}
              required={false}
            />
            <Pressable
              onPress={() => setFromDate('')}
              className="self-start mb-2"
              accessibilityLabel={t('exportModal.clearFromA11y')}
              accessibilityRole="button"
            >
              <Text className="text-xs text-primary">{t('exportModal.clear')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setFromDate(new Date().toISOString().split('T')[0])}
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
            accessibilityLabel={t('exportModal.setFromA11y')}
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#A8A49D" />
            <Text className="flex-1 ml-2 text-base text-ink-muted">{t('exportModal.fromAllTime')}</Text>
          </Pressable>
        )}

        {toDate ? (
          <View className="mb-2">
            <DateField
              value={toDate}
              onChange={setToDate}
              label={t('exportModal.toLabel')}
              required={false}
            />
            <Pressable
              onPress={() => setToDate('')}
              className="self-start mb-2"
              accessibilityLabel={t('exportModal.clearToA11y')}
              accessibilityRole="button"
            >
              <Text className="text-xs text-primary">{t('exportModal.clear')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setToDate(new Date().toISOString().split('T')[0])}
            className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4"
            accessibilityLabel={t('exportModal.setToA11y')}
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#A8A49D" />
            <Text className="flex-1 ml-2 text-base text-ink-muted">{t('exportModal.toAllTime')}</Text>
          </Pressable>
        )}

        {/* File name */}
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
          {t('exportModal.fileNameLabel')}
        </Text>
        <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4">
          <TextInput
            className="text-base text-ink dark:text-ink-on-dark"
            value={fileName}
            onChangeText={setFileName}
            placeholder={t('exportModal.fileNamePlaceholder', { date: new Date().toISOString().split('T')[0] })}
            placeholderTextColor="#A8A49D"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('exportModal.fileNameA11y')}
          />
        </View>

        {/* Export button */}
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          className={`mt-6 py-4 rounded-xl items-center ${
            exporting ? 'bg-divider dark:bg-divider-dark' : 'bg-primary'
          }`}
          accessibilityLabel={t('exportModal.exportFmtA11y', { fmt: format.toUpperCase() })}
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
                {format === 'pdf' ? t('exportModal.exportPdf') : t('exportModal.exportCsv')}
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
