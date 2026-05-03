import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { ModalHeader } from '@/src/components/ModalHeader';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { formatCurrency } from '@/src/constants/currency';
import { onImportComplete } from '@/src/stores/orchestrator';
import {
  detectFormat,
  parseFuelioCSV,
  parseFuellyCSV,
  parseAutomateCSV,
  parseDrivvoCSV,
  importData,
} from '@/src/services/dataImport';
import type { ParsedImportData, ParsedEvent } from '@/src/services/dataImport';
import { t, type TranslationKey } from '@/src/i18n';

type DetectedFormat = 'fuelio' | 'fuelly' | 'automate' | 'drivvo' | 'unknown';

let _importCache: {
  parsedData: ParsedImportData;
  detectedFormat: DetectedFormat;
  selectedVehicleId: string | null;
} | null = null;

const FORMAT_LABEL_KEYS: Record<DetectedFormat, TranslationKey> = {
  fuelio: 'importModal.formatFuelio',
  fuelly: 'importModal.formatFuelly',
  automate: 'importModal.formatAutomate',
  drivvo: 'importModal.formatDrivvo',
  unknown: 'importModal.formatUnknown',
};

const FORMAT_COLORS: Record<DetectedFormat, { bg: string; text: string }> = {
  fuelio: { bg: '#1A9A8F20', text: '#1A9A8F' },
  fuelly: { bg: '#E8772B20', text: '#E8772B' },
  automate: { bg: '#4272C420', text: '#4272C4' },
  drivvo: { bg: '#9333EA20', text: '#9333EA' },
  unknown: { bg: '#EF444420', text: '#EF4444' },
};

const EVENT_TYPE_LABEL_KEYS: Record<ParsedEvent['type'], TranslationKey> = {
  fuel: 'importModal.fuelLabel',
  service: 'importModal.serviceLabel',
  expense: 'importModal.expenseLabel',
};

function formatEventType(type: ParsedEvent['type']): string {
  return t(EVENT_TYPE_LABEL_KEYS[type]);
}

function formatCost(cost: number, cc: string): string {
  return formatCurrency(cost, cc);
}

export default function ImportModal() {
  const nav = useGuardedNavigate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const vehicles = useVehicleStore((s) => s.vehicles);
  const currencyCode = useSettingsStore((s) => s.settings.currency);

  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(
    _importCache?.detectedFormat ?? null
  );
  const [parsedData, setParsedData] = useState<ParsedImportData | null>(
    _importCache?.parsedData ?? null
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    _importCache?.selectedVehicleId ?? null
  );
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const { showDialog, dialogProps } = useDialog();

  const clearCache = useCallback(() => { _importCache = null; }, []);

  const previewEvents = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.events.slice(0, 5);
  }, [parsedData]);

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  }, [selectedVehicleId, vehicles]);

  const canImport = parsedData && parsedData.events.length > 0 && selectedVehicleId && detectedFormat !== 'unknown';

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setIsReadingFile(true);
      setParsedData(null);
      setDetectedFormat(null);

      // Read file content
      const file = new ExpoFile(asset.uri);
      const content = await file.text();

      const format = detectFormat(content);
      setDetectedFormat(format);

      if (format === 'unknown') {
        setIsReadingFile(false);
        return;
      }

      let data: ParsedImportData;
      switch (format) {
        case 'fuelio':
          data = parseFuelioCSV(content);
          break;
        case 'fuelly':
          data = parseFuellyCSV(content);
          break;
        case 'automate':
          data = parseAutomateCSV(content);
          break;
        case 'drivvo':
          data = parseDrivvoCSV(content);
          break;
      }

      setParsedData(data);
      setIsReadingFile(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('importModal.fileErrorMessage');
      showDialog(t('importModal.fileErrorTitle'), message);
      setIsReadingFile(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!parsedData || !selectedVehicleId) return;

    setIsImporting(true);
    try {
      const result = await importData(parsedData, selectedVehicleId);

      await onImportComplete(selectedVehicleId);

      const parts: string[] = [];
      if (result.eventsImported > 0) {
        parts.push(t(result.eventsImported === 1 ? 'importModal.importedEventsOne' : 'importModal.importedEventsOther', { count: result.eventsImported }));
      }
      if (result.placesCreated > 0) {
        parts.push(t(result.placesCreated === 1 ? 'importModal.createdPlacesOne' : 'importModal.createdPlacesOther', { count: result.placesCreated }));
      }
      if (result.eventsSkipped > 0) {
        parts.push(t(result.eventsSkipped === 1 ? 'importModal.skippedDupesOne' : 'importModal.skippedDupesOther', { count: result.eventsSkipped }));
      }

      const summary = parts.join(', ') + '.';

      if (result.errors.length > 0) {
        showDialog(
          t('importModal.completeWithWarningsTitle'),
          t('importModal.completeWithWarningsMessage', {
            summary,
            count: result.errors.length,
            errorWord: t(result.errors.length === 1 ? 'importModal.errorOne' : 'importModal.errorOther'),
            joined: result.errors.slice(0, 3).join('; '),
          }),
          [{ text: t('common.ok'), onPress: () => { clearCache(); nav.back(); } }]
        );
      } else {
        showDialog(
          t('importModal.completeTitle'),
          summary,
          [{ text: t('common.ok'), onPress: () => { clearCache(); nav.back(); } }]
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('importModal.unexpectedError');
      showDialog(t('importModal.failedTitle'), message);
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, selectedVehicleId, nav]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={t('importModal.title')}
        cancelLabel={t('common.done')}
        onCancel={() => { clearCache(); nav.back(); }}
        hideSave
      />

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Step 1: Select File */}
        <Text className="text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider mb-2">
          {t('importModal.selectFile')}
        </Text>
        <Pressable
          onPress={handleSelectFile}
          disabled={isReadingFile || isImporting}
          className="flex-row items-center justify-center bg-card dark:bg-card-dark rounded-card py-4 px-4 mb-4"
          style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}
          accessibilityLabel={t('importModal.selectFileA11y')}
          accessibilityRole="button"
        >
          {isReadingFile ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <Ionicons name="document-outline" size={20} color="#4272C4" />
              <Text className="text-base font-semibold text-primary ml-2">
                {parsedData ? t('importModal.chooseDifferentFile') : t('importModal.chooseCsvFile')}
              </Text>
            </>
          )}
        </Pressable>

        {/* Format badge */}
        {detectedFormat && (
          <View className="flex-row mb-4">
            <View
              style={{ backgroundColor: FORMAT_COLORS[detectedFormat].bg }}
              className="px-3 py-1.5 rounded-lg"
            >
              <Text
                style={{ color: FORMAT_COLORS[detectedFormat].text }}
                className="text-sm font-semibold"
              >
                {t(FORMAT_LABEL_KEYS[detectedFormat])}
              </Text>
            </View>
          </View>
        )}

        {/* Unknown format warning */}
        {detectedFormat === 'unknown' && (
          <View className="bg-card dark:bg-card-dark rounded-card p-4 mb-4" style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}>
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning-outline" size={20} color="#EF4444" />
              <Text className="text-base font-semibold text-destructive ml-2">
                {t('importModal.unrecognizedFormat')}
              </Text>
            </View>
            <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark">
              {t('importModal.unrecognizedMessage')}
            </Text>
          </View>
        )}

        {/* Step 2: Preview */}
        {parsedData && parsedData.events.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider mb-2">
              {t(parsedData.events.length === 1 ? 'importModal.previewOne' : 'importModal.previewOther', { count: parsedData.events.length })}
            </Text>
            <View
              className="bg-card dark:bg-card-dark rounded-card overflow-hidden mb-4"
              style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}
            >
              {previewEvents.map((event, index) => (
                <View
                  key={`${event.date}-${event.cost}-${index}`}
                  className={`flex-row items-center px-4 py-3 ${
                    index < previewEvents.length - 1
                      ? 'border-b border-divider-subtle dark:border-divider-dark'
                      : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-sm text-ink dark:text-ink-on-dark">
                      {event.date}
                    </Text>
                    <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5">
                      {formatEventType(event.type)}
                      {event.placeName ? ` • ${event.placeName}` : ''}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-semibold text-ink dark:text-ink-on-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatCost(event.cost, currencyCode)}
                  </Text>
                </View>
              ))}
              {parsedData.events.length > 5 && (
                <View className="px-4 py-2 border-t border-divider-subtle dark:border-divider-dark">
                  <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark text-center">
                    {t((parsedData.events.length - 5) === 1 ? 'importModal.andMoreOne' : 'importModal.andMoreOther', { count: parsedData.events.length - 5 })}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {parsedData && parsedData.events.length === 0 && (
          <View className="bg-card dark:bg-card-dark rounded-card p-4 mb-4" style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}>
            <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark text-center">
              {t('importModal.noEvents')}
            </Text>
          </View>
        )}

        {/* Step 3: Vehicle Picker */}
        {parsedData && parsedData.events.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider mb-2">
              {t('importModal.importIntoVehicle')}
            </Text>
            <Pressable
              onPress={() => setShowVehiclePicker(!showVehiclePicker)}
              className="flex-row items-center bg-card dark:bg-card-dark rounded-card px-4 py-3.5 mb-2"
              style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}
              accessibilityLabel={t('importModal.selectedVehicleA11y', { label: selectedVehicle?.nickname ?? t('importModal.noneSelected') })}
              accessibilityRole="button"
            >
              <Ionicons name="car-outline" size={20} color="#A8A49D" />
              <Text
                className={`flex-1 text-base ml-2 ${
                  selectedVehicle
                    ? 'text-ink dark:text-ink-on-dark'
                    : 'text-ink-muted dark:text-ink-muted-on-dark'
                }`}
              >
                {selectedVehicle?.nickname ?? t('importModal.selectVehiclePlaceholder')}
              </Text>
              <Ionicons
                name={showVehiclePicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#A8A49D"
              />
            </Pressable>

            {showVehiclePicker && (
              <View
                className="bg-card dark:bg-card-dark rounded-card overflow-hidden mb-4"
                style={{ shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3 }}
              >
                {vehicles.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setSelectedVehicleId(v.id);
                      setShowVehiclePicker(false);
                    }}
                    className={`px-4 py-3.5 border-b border-divider-subtle dark:border-divider-dark ${
                      selectedVehicleId === v.id ? 'bg-surface dark:bg-surface-dark' : ''
                    }`}
                    accessibilityLabel={t('importModal.selectVehicleItemA11y', { name: v.nickname, suffix: selectedVehicleId === v.id ? t('importModal.selectedSuffix') : '' })}
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
                    <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5">
                      {v.year} {v.make} {v.model}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setShowVehiclePicker(false);
                    if (parsedData && detectedFormat) {
                      _importCache = { parsedData, detectedFormat, selectedVehicleId };
                    }
                    nav.push('/(modals)/vehicle');
                  }}
                  className="flex-row items-center px-4 py-3.5"
                  accessibilityLabel={t('importModal.addNewVehicleA11y')}
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle-outline" size={20} color="#4272C4" />
                  <Text className="text-base text-primary font-semibold ml-2">
                    {t('importModal.addNewVehicle')}
                  </Text>
                </Pressable>
              </View>
            )}

            {!showVehiclePicker && <View className="mb-2" />}
          </>
        )}

        {/* Step 4: Import Button */}
        {parsedData && parsedData.events.length > 0 && (
          <Pressable
            onPress={handleImport}
            disabled={!canImport || isImporting}
            className={`mt-4 py-4 rounded-xl items-center ${
              canImport && !isImporting
                ? 'bg-primary'
                : 'bg-divider dark:bg-divider-dark'
            }`}
            accessibilityLabel={t('importModal.importDataA11y')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canImport || isImporting }}
          >
            {isImporting ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="cloud-upload-outline" size={20} color={canImport ? 'white' : '#A8A49D'} />
                <Text
                  className={`font-semibold text-base ${
                    canImport ? 'text-white' : 'text-ink-muted dark:text-ink-muted-on-dark'
                  }`}
                >
                  {t(parsedData.events.length === 1 ? 'importModal.importEventsOne' : 'importModal.importEventsOther', { count: parsedData.events.length })}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <View className="h-8" />
      </ScrollView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
