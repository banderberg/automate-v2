import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Modal, FlatList, ActivityIndicator, Linking } from 'react-native';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { reloadAllStores } from '@/src/stores/orchestrator';
import { createBackup, getBackupInfo, restoreBackup } from '@/src/services/backup';
import { loadTestData } from '@/src/db/testData';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { Directory, Paths } from 'expo-file-system';
import { getDatabase } from '@/src/db/client';
import { CURRENCIES } from '@/src/constants/currency';
import { t } from '@/src/i18n';

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="px-4 pt-6 pb-2 text-xs font-semibold text-ink-muted dark:text-ink-muted-on-dark uppercase tracking-wider">
      {title}
    </Text>
  );
}

function RowItem({
  label,
  subtitle,
  value,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark active:bg-surface dark:active:bg-surface-dark"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
    >
      <View className="flex-1 mr-3">
        <Text className="text-base text-ink dark:text-ink-on-dark">{label}</Text>
        {subtitle && (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5">{subtitle}</Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        {value && (
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark">{value}</Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color="#706C67" />
        )}
      </View>
    </Pressable>
  );
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selectedValue, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end" style={{ backgroundColor: 'rgba(28, 27, 24, 0.4)' }}
        onPress={onClose}
        accessibilityLabel={t('settings.closePicker')}
      >
        <Pressable
          className="bg-card dark:bg-card-dark rounded-t-2xl"
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider dark:border-divider-dark">
            <Text className="text-base font-semibold text-ink dark:text-ink-on-dark">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t('common.done')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="text-base text-primary font-semibold">{t('common.done')}</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                className="flex-row items-center justify-between px-4 py-4 border-b border-divider-subtle dark:border-divider-dark"
                accessibilityLabel={`${item.label}${selectedValue === item.value ? `, ${t('common.selected')}` : ''}`}
                accessibilityRole="button"
              >
                <Text className="text-base text-ink dark:text-ink-on-dark">
                  {item.label}
                </Text>
                {selectedValue === item.value && (
                  <Ionicons name="checkmark" size={20} color="#4272C4" />
                )}
              </Pressable>
            )}
            scrollEnabled={options.length > 6}
            style={options.length > 6 ? { maxHeight: 400 } : undefined}
          />
          <View className="h-8" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const nav = useGuardedNavigate();
  const { settings, updateSetting } = useSettingsStore();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingTestData, setIsLoadingTestData] = useState(false);
  const { showDialog, dialogProps } = useDialog();

  const handleBackup = useCallback(async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const fileUri = await createBackup();
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: t('settings.backupShareTitle'),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('settings.unexpectedError');
      showDialog(t('settings.backupFailedTitle'), message);
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp]);

  const handleRestore = useCallback(async () => {
    if (isRestoring) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;

      setIsRestoring(true);

      let info;
      try {
        info = await getBackupInfo(fileUri);
      } catch (e) {
        const message = e instanceof Error ? e.message : t('settings.restoreInvalidMessage');
        showDialog(t('settings.restoreInvalidTitle'), message);
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);

      const docNote = info.documentCount > 0 ? t('settings.restoreDocNote') : '';
      const vehiclesPart = t(info.vehicleCount === 1 ? 'settings.vehicleCountOne' : 'settings.vehicleCountOther', { count: info.vehicleCount });
      const eventsPart = t(info.eventCount === 1 ? 'settings.eventCountOne' : 'settings.eventCountOther', { count: info.eventCount });
      const remindersPart = t(info.reminderCount === 1 ? 'settings.reminderCountOne' : 'settings.reminderCountOther', { count: info.reminderCount });
      const documentsPart = t(info.documentCount === 1 ? 'settings.documentCountOne' : 'settings.documentCountOther', { count: info.documentCount });
      showDialog(
        t('settings.restoreConfirmTitle'),
        t('settings.restoreConfirmMessage', {
          vehicles: vehiclesPart,
          events: eventsPart,
          reminders: remindersPart,
          documents: documentsPart,
          docNote,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.restoreCta'),
            style: 'destructive',
            onPress: async () => {
              setIsRestoring(true);
              try {
                await restoreBackup(fileUri);
                await reloadAllStores();

                showDialog(t('settings.restoreCompleteTitle'), t('settings.restoreCompleteMessage'));
              } catch (e) {
                const message = e instanceof Error ? e.message : t('settings.unexpectedError');
                showDialog(t('settings.restoreFailedTitle'), message);
              } finally {
                setIsRestoring(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : t('settings.unexpectedError');
      showDialog(t('settings.restoreFailedTitle'), message);
      setIsRestoring(false);
    }
  }, [isRestoring]);

  const handleLoadTestData = useCallback(() => {
    showDialog(
      t('settings.loadTestDataConfirmTitle'),
      t('settings.loadTestDataConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.loadTestData'),
          style: 'destructive',
          onPress: async () => {
            setIsLoadingTestData(true);
            try {
              const result = await loadTestData();
              await reloadAllStores();
              showDialog(
                t('settings.loadTestDataLoadedTitle'),
                t('settings.loadTestDataLoadedMessage', {
                  vehicles: result.vehicles,
                  events: result.events,
                  reminders: result.reminders,
                }),
              );
            } catch (e) {
              const message = e instanceof Error ? e.message : t('settings.unexpectedError');
              showDialog(t('settings.loadTestDataFailedTitle'), message);
            } finally {
              setIsLoadingTestData(false);
            }
          },
        },
      ],
    );
  }, []);

  const handleResetAllData = useCallback(() => {
    showDialog(
      t('settings.resetAllDataConfirmTitle'),
      t('settings.resetAllDataConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.resetAllDataCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              await db.execAsync('DELETE FROM vehicle_document;');
              await db.execAsync('DELETE FROM event_service_type;');
              await db.execAsync('DELETE FROM event_photo;');
              await db.execAsync('DELETE FROM reminder;');
              await db.execAsync('DELETE FROM event;');
              await db.execAsync('DELETE FROM vehicle;');
              await db.execAsync('DELETE FROM place;');
              try {
                const docDir = new Directory(Paths.document, 'vehicle-documents');
                if (docDir.exists) docDir.delete();
              } catch {
                // Best effort cleanup
              }
              useEventStore.getState().clearEvents();
              useReminderStore.getState().clearReminders();
              await useVehicleStore.getState().initialize();
              nav.replace('/onboarding');
            } catch (e) {
              const message = e instanceof Error ? e.message : t('settings.unexpectedError');
              showDialog(t('settings.resetAllDataFailedTitle'), message);
            }
          },
        },
      ],
    );
  }, []);

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    title: string;
    options: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
  }>({ visible: false, title: '', options: [], selectedValue: '', onSelect: () => {} });

  const closePicker = useCallback(() => {
    setPickerConfig((c) => ({ ...c, visible: false }));
  }, []);

  const fuelUnits = [
    { value: 'gallons', label: t('settings.fuelGallons') },
    { value: 'litres', label: t('settings.fuelLitres') },
  ];

  const odometerUnits = [
    { value: 'miles', label: t('settings.odoMiles') },
    { value: 'kilometers', label: t('settings.odoKilometers') },
  ];

  const openCurrencyPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: t('settings.currency'),
      options: CURRENCIES,
      selectedValue: settings.currency,
      onSelect: (v) => updateSetting('currency', v),
    });
  }, [settings.currency, updateSetting]);

  const openFuelUnitPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: t('settings.fuelUnitTitle'),
      options: fuelUnits,
      selectedValue: settings.defaultFuelUnit,
      onSelect: (v) => updateSetting('defaultFuelUnit', v as 'gallons' | 'litres'),
    });
  }, [settings.defaultFuelUnit, updateSetting]);

  const openOdometerUnitPicker = useCallback(() => {
    setPickerConfig({
      visible: true,
      title: t('settings.odometerUnitTitle'),
      options: odometerUnits,
      selectedValue: settings.defaultOdometerUnit,
      onSelect: (v) => updateSetting('defaultOdometerUnit', v as 'miles' | 'kilometers'),
    });
  }, [settings.defaultOdometerUnit, updateSetting]);

  const currencyLabel = CURRENCIES.find((c) => c.value === settings.currency)?.label ?? settings.currency;
  const fuelUnitLabel = fuelUnits.find((f) => f.value === settings.defaultFuelUnit)?.label ?? settings.defaultFuelUnit;
  const odoUnitLabel = odometerUnits.find((o) => o.value === settings.defaultOdometerUnit)?.label ?? settings.defaultOdometerUnit;

  const themes = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <View className="px-4 py-4 bg-surface dark:bg-surface-dark">
        <Text className="text-2xl font-bold text-ink dark:text-ink-on-dark">{t('settings.title')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Appearance */}
        <SectionHeader title={t('settings.sectionAppearance')} />
        <View className="bg-card dark:bg-card-dark border-y border-divider-subtle dark:border-divider-dark">
          <View className="px-4 py-4">
            <Text className="text-base text-ink dark:text-ink-on-dark mb-3">{t('settings.theme')}</Text>
            <View className="flex-row gap-2">
              {themes.map(({ value, label }) => (
                <Pressable
                  key={value}
                  onPress={() => updateSetting('theme', value)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    settings.theme === value
                      ? 'bg-primary'
                      : 'bg-surface dark:bg-surface-dark'
                  }`}
                  accessibilityLabel={t('settings.themeSetTo', { label })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: settings.theme === value }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      settings.theme === value
                        ? 'text-white'
                        : 'text-ink-secondary dark:text-ink-secondary-on-dark'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Defaults */}
        <SectionHeader title={t('settings.sectionDefaults')} />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label={t('settings.currency')}
            value={currencyLabel}
            onPress={openCurrencyPicker}
            accessibilityLabel={t('settings.currencyA11y', { label: currencyLabel })}
          />
          <RowItem
            label={t('settings.fuelUnit')}
            value={fuelUnitLabel}
            onPress={openFuelUnitPicker}
            accessibilityLabel={t('settings.fuelUnitA11y', { label: fuelUnitLabel })}
          />
          <RowItem
            label={t('settings.odometerUnit')}
            value={odoUnitLabel}
            onPress={openOdometerUnitPicker}
            accessibilityLabel={t('settings.odometerUnitA11y', { label: odoUnitLabel })}
          />
        </View>

        {/* Vehicles */}
        <SectionHeader title={t('settings.sectionVehicles')} />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label={t('settings.manageVehicles')}
            value={t(vehicleCount === 1 ? 'settings.vehicleCountOne' : 'settings.vehicleCountOther', { count: vehicleCount })}
            onPress={() => nav.push('/(modals)/manage-vehicles')}
            accessibilityLabel={t('settings.manageVehicles')}
          />
        </View>

        {/* Data */}
        <SectionHeader title={t('settings.sectionData')} />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <View className="flex-row items-center bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark">
            <View className="flex-1">
              <RowItem
                label={isBackingUp ? t('settings.backupPreparing') : t('settings.backupData')}
                subtitle={t('settings.backupSubtitle')}
                onPress={isBackingUp ? undefined : handleBackup}
                accessibilityLabel={isBackingUp ? t('settings.backupInProgress') : t('settings.backupData')}
              />
            </View>
            {isBackingUp && <ActivityIndicator size="small" color="#4272C4" style={{ marginRight: 16 }} />}
          </View>
          <View className="flex-row items-center bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark">
            <View className="flex-1">
              <RowItem
                label={isRestoring ? t('settings.restoring') : t('settings.restoreData')}
                subtitle={t('settings.restoreSubtitle')}
                onPress={isRestoring ? undefined : handleRestore}
                accessibilityLabel={isRestoring ? t('settings.restoreInProgress') : t('settings.restoreData')}
              />
            </View>
            {isRestoring && <ActivityIndicator size="small" color="#4272C4" style={{ marginRight: 16 }} />}
          </View>
          <RowItem
            label={t('settings.importData')}
            onPress={() => nav.push('/(modals)/import')}
            accessibilityLabel={t('settings.importData')}
          />
          <RowItem
            label={t('settings.exportData')}
            onPress={() => nav.push('/(modals)/export')}
            accessibilityLabel={t('settings.exportData')}
          />
        </View>

        {/* Help */}
        <SectionHeader title={t('settings.sectionHelp')} />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem
            label={t('settings.helpCostPerMile')}
            subtitle={t('settings.helpCostPerMileSubtitle')}
            accessibilityLabel={t('settings.helpCostPerMileA11y')}
          />
          <RowItem
            label={t('settings.helpFuelEfficiency')}
            subtitle={t('settings.helpFuelEfficiencySubtitle')}
            accessibilityLabel={t('settings.helpFuelEfficiencyA11y')}
          />
          <RowItem
            label={t('settings.helpPartialFill')}
            subtitle={t('settings.helpPartialFillSubtitle')}
            accessibilityLabel={t('settings.helpPartialFillA11y')}
          />
          <RowItem
            label={t('settings.helpReminders')}
            subtitle={t('settings.helpRemindersSubtitle')}
            accessibilityLabel={t('settings.helpRemindersA11y')}
          />
        </View>

        {/* About */}
        <SectionHeader title={t('settings.sectionAbout')} />
        <View className="border-t border-divider-subtle dark:border-divider-dark">
          <RowItem label={t('settings.appVersion', { version: Constants.expoConfig?.version ?? '2.0' })} />
          <RowItem
            label={t('settings.rateApp')}
            onPress={() => Linking.openURL('market://details?id=com.arctosbuilt.automate')}
            accessibilityLabel={t('settings.rateAppA11y')}
          />
          <RowItem
            label={t('settings.sendFeedback')}
            onPress={() => Linking.openURL(`mailto:arctos.built@gmail.com?subject=${encodeURIComponent(t('settings.feedbackEmailSubject'))}`)}
            accessibilityLabel={t('settings.sendFeedbackA11y')}
          />
          <RowItem
            label={t('settings.privacyPolicy')}
            onPress={() => Linking.openURL('https://banderberg.github.io/arctoslabs/privacy.html')}
            accessibilityLabel={t('settings.privacyPolicyA11y')}
          />
          <RowItem
            label={t('settings.openSourceLicenses')}
            onPress={() => nav.push('/(modals)/licenses')}
            accessibilityLabel={t('settings.openSourceLicensesA11y')}
          />
        </View>

        {__DEV__ && (
          <>
            <SectionHeader title={t('settings.sectionDeveloper')} />
            <View className="border-t border-divider-subtle dark:border-divider-dark">
              <RowItem
                label={isLoadingTestData ? t('settings.loadingTestData') : t('settings.loadTestData')}
                onPress={isLoadingTestData ? undefined : handleLoadTestData}
                accessibilityLabel={t('settings.loadTestDataA11y')}
              />
              <RowItem
                label={t('settings.resetAllData')}
                subtitle={t('settings.resetAllDataSubtitle')}
                onPress={handleResetAllData}
                accessibilityLabel={t('settings.resetAllDataA11y')}
              />
              <RowItem
                label={t('settings.testErrorBoundary')}
                subtitle={t('settings.testErrorBoundarySubtitle')}
                onPress={() => { throw new Error('Test error boundary — triggered from developer settings'); }}
                accessibilityLabel={t('settings.testErrorBoundaryA11y')}
              />
            </View>
          </>
        )}
      </ScrollView>

      <PickerModal
        visible={pickerConfig.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        selectedValue={pickerConfig.selectedValue}
        onSelect={pickerConfig.onSelect}
        onClose={closePicker}
      />
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
