import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import { ModalHeader } from '@/src/components/ModalHeader';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { ChipPicker } from '@/src/components/ChipPicker';
import { DateField } from '@/src/components/DateField';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useToastStore } from '@/src/stores/toastStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { getOdometerLabel } from '@/src/constants/units';
import type { Reminder } from '@/src/types';

type ReminderKind = 'maintenance' | 'expense';
type TimeUnitOption = 'days' | 'weeks' | 'months' | 'years';

const TIME_UNITS: { value: TimeUnitOption; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

export default function ReminderModal() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { reminderId } = useLocalSearchParams<{ reminderId?: string }>();
  const isEditing = !!reminderId;
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const events = useEventStore((s) => s.events);
  const reminders = useReminderStore((s) => s.reminders);
  const addReminder = useReminderStore((s) => s.addReminder);
  const updateReminder = useReminderStore((s) => s.updateReminder);
  const deleteReminder = useReminderStore((s) => s.deleteReminder);
  const serviceTypes = useReferenceDataStore((s) => s.serviceTypes);
  const categories = useReferenceDataStore((s) => s.categories);
  const addServiceType = useReferenceDataStore((s) => s.addServiceType);
  const updateServiceType = useReferenceDataStore((s) => s.updateServiceType);
  const deleteServiceType = useReferenceDataStore((s) => s.deleteServiceType);
  const addCategory = useReferenceDataStore((s) => s.addCategory);
  const updateCategory = useReferenceDataStore((s) => s.updateCategory);
  const deleteCategory = useReferenceDataStore((s) => s.deleteCategory);

  const [kind, setKind] = useState<ReminderKind>('maintenance');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  const [distanceInterval, setDistanceInterval] = useState('');
  const [timeEnabled, setTimeEnabled] = useState(true);
  const [timeInterval, setTimeInterval] = useState('');
  const [timeUnit, setTimeUnit] = useState<TimeUnitOption>('months');
  const [baselineDate, setBaselineDate] = useState(new Date().toISOString().split('T')[0]);
  const [baselineOdometer, setBaselineOdometer] = useState('');
  const [intervalError, setIntervalError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [saving, setSaving] = useState(false);
  const isDirty = useRef(false);
  const markDirty = useCallback(() => { isDirty.current = true; }, []);
  const distanceIntervalRef = useRef<TextInput>(null);
  const timeIntervalRef = useRef<TextInput>(null);
  const userToggledDistance = useRef(false);
  const userToggledTime = useRef(false);

  useEffect(() => {
    if (distanceEnabled && userToggledDistance.current) {
      userToggledDistance.current = false;
      setTimeout(() => distanceIntervalRef.current?.focus(), 100);
    }
  }, [distanceEnabled]);

  useEffect(() => {
    if (timeEnabled && userToggledTime.current) {
      userToggledTime.current = false;
      setTimeout(() => timeIntervalRef.current?.focus(), 100);
    }
  }, [timeEnabled]);
  const { showDialog, dialogProps } = useDialog();

  const odometerUnit = activeVehicle?.odometerUnit ?? 'miles';
  const odoLabel = getOdometerLabel(odometerUnit);

  useEffect(() => {
    if (!isEditing || !reminderId) return;
    const existing = reminders.find((r) => r.id === reminderId);
    if (!existing) return;

    if (existing.serviceTypeId) {
      setKind('maintenance');
      setSelectedIds([existing.serviceTypeId]);
    } else if (existing.categoryId) {
      setKind('expense');
      setSelectedIds([existing.categoryId]);
    }

    if (existing.distanceInterval != null) {
      setDistanceEnabled(true);
      setDistanceInterval(String(existing.distanceInterval));
    }
    if (existing.timeInterval != null && existing.timeUnit) {
      setTimeEnabled(true);
      setTimeInterval(String(existing.timeInterval));
      setTimeUnit(existing.timeUnit as TimeUnitOption);
    }
    if (existing.baselineDate) setBaselineDate(existing.baselineDate);
    if (existing.baselineOdometer != null) setBaselineOdometer(String(existing.baselineOdometer));
  }, []);

  const matchingEvent = useMemo(() => {
    if (selectedIds.length === 0 || !activeVehicle) return null;
    const selectedId = selectedIds[0];
    if (kind === 'expense') {
      return events.find(
        (e) => e.type === 'expense' && e.categoryId === selectedId
      ) ?? null;
    }
    return null;
  }, [events, selectedIds, kind, activeVehicle]);

  const hasBaseline = useMemo(() => {
    if (matchingEvent) return true;
    return false;
  }, [matchingEvent]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (selectedIds.length === 0) return false;
    if (!distanceEnabled && !timeEnabled) return false;
    if (distanceEnabled) {
      const d = parseInt(distanceInterval, 10);
      if (isNaN(d) || d <= 0) return false;
    }
    if (timeEnabled) {
      const t = parseInt(timeInterval, 10);
      if (isNaN(t) || t <= 0) return false;
    }
    if (!hasBaseline) {
      if (timeEnabled && !baselineDate) return false;
      if (distanceEnabled && !baselineOdometer) return false;
    }
    return true;
  }, [saving, selectedIds, distanceEnabled, timeEnabled, distanceInterval, timeInterval, hasBaseline, baselineDate, baselineOdometer]);

  const handleSave = useCallback(async () => {
    if (selectedIds.length === 0) {
      setSelectionError(kind === 'maintenance' ? 'Select a service type' : 'Select a category');
      return;
    }
    if (!distanceEnabled && !timeEnabled) {
      setIntervalError('Choose at least one repeat interval');
      return;
    }
    if (!canSave || !activeVehicle) return;
    setSaving(true);
    try {
      const blDate = hasBaseline && matchingEvent ? matchingEvent.date : baselineDate;
      const blOdo = hasBaseline && matchingEvent?.odometer != null
        ? matchingEvent.odometer
        : (baselineOdometer ? parseInt(baselineOdometer, 10) : undefined);

      const data: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'> = {
        vehicleId: activeVehicle.id,
        serviceTypeId: kind === 'maintenance' ? selectedIds[0] : undefined,
        categoryId: kind === 'expense' ? selectedIds[0] : undefined,
        distanceInterval: distanceEnabled ? parseInt(distanceInterval, 10) : undefined,
        timeInterval: timeEnabled ? parseInt(timeInterval, 10) : undefined,
        timeUnit: timeEnabled ? timeUnit : undefined,
        baselineDate: blDate,
        baselineOdometer: blOdo,
      };

      const vName = activeVehicle.nickname;
      if (isEditing && reminderId) {
        await updateReminder(reminderId, data, vName);
      } else {
        await addReminder(data, vName);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useToastStore.getState().show(`Reminder ${isEditing ? 'updated' : 'saved'}`);
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog("Couldn't Save Reminder", msg || 'Check your entries and try again. If this keeps happening, try restarting the app.');
    } finally {
      setSaving(false);
    }
  }, [canSave, activeVehicle, kind, selectedIds, distanceEnabled, distanceInterval, timeEnabled, timeInterval, timeUnit, baselineDate, baselineOdometer, hasBaseline, matchingEvent, isEditing, reminderId]);

  const handleDelete = useCallback(() => {
    if (!reminderId) return;
    showDialog('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReminder(reminderId);
          router.back();
        },
      },
    ]);
  }, [reminderId, deleteReminder, router]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    markDirty();
    if (ids.length > 0) setSelectionError('');
  }, []);

  const handleCancel = useCallback(() => {
    if (isDirty.current) {
      showDialog('Discard Changes?', 'You have unsaved changes.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [router]);

  const chipItems = kind === 'maintenance' ? serviceTypes : categories;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={isEditing ? 'Edit Reminder' : 'Add Reminder'}
        onCancel={handleCancel}
        onSave={handleSave}
        saveDisabled={!canSave}
        isSaving={saving}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Pick what */}
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 font-semibold">
            Reminder Type
          </Text>
          <View className="mb-4">
            <SegmentedControl
              options={[
                { value: 'maintenance' as ReminderKind, label: 'Maintenance' },
                { value: 'expense' as ReminderKind, label: 'Expense' },
              ]}
              selectedValue={kind}
              onValueChange={(v) => {
                setKind(v);
                setSelectedIds([]);
                markDirty();
              }}
              disabled={isEditing}
              accessibilityLabel="Reminder type"
            />
          </View>

          <ChipPicker
            items={chipItems}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            multiSelect={false}
            label={kind === 'maintenance' ? 'Service Type *' : 'Category *'}
            error={selectionError}
            accentColor={kind === 'maintenance' ? '#E8772B' : '#2EAD76'}
            onAdd={async (name) => { kind === 'maintenance' ? await addServiceType(name) : await addCategory(name); }}
            onUpdate={async (id, name) => { kind === 'maintenance' ? await updateServiceType(id, name) : await updateCategory(id, name); }}
            onDelete={async (id) => { kind === 'maintenance' ? await deleteServiceType(id) : await deleteCategory(id); }}
          />

          {selectedIds.length === 0 && (
            <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark text-center py-6">
              Pick what you want to be reminded about
            </Text>
          )}

          {selectedIds.length > 0 && (
            <>
              {/* Repeat every */}
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-2 mt-2 font-semibold">
                Repeat Every
              </Text>

              {/* Distance toggle */}
              <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-3">
                <View className="flex-1 mr-3">
                  <Text className="text-base text-ink dark:text-ink-on-dark">By Distance</Text>
                </View>
                <Switch
                  value={distanceEnabled}
                  onValueChange={(v) => {
                    userToggledDistance.current = true;
                    setDistanceEnabled(v);
                    setIntervalError('');
                    markDirty();
                  }}
                  trackColor={{ false: isDark ? '#2A2926' : '#E2E0DB', true: isDark ? '#2E5A9E' : '#A7C4E4' }}
                  thumbColor={distanceEnabled ? '#4272C4' : isDark ? '#1A1917' : '#FEFDFB'}
                  accessibilityLabel="Enable distance-based repeat"
                />
              </View>
              {distanceEnabled && (
                <View className="flex-row items-center mb-4 ml-4 gap-2">
                  <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark">Every</Text>
                  <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3 py-2">
                    <TextInput
                      ref={distanceIntervalRef}
                      className="text-base text-ink dark:text-ink-on-dark min-w-[60px] text-center"
                      value={distanceInterval}
                      onChangeText={(t) => { setDistanceInterval(t); markDirty(); }}
                      keyboardType="number-pad"
                      placeholder="5000"
                      placeholderTextColor="#A8A49D"
                      accessibilityLabel={`Distance interval in ${odoLabel}`}
                    />
                  </View>
                  <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark">{odoLabel}</Text>
                </View>
              )}

              {/* Time toggle */}
              <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-3">
                <View className="flex-1 mr-3">
                  <Text className="text-base text-ink dark:text-ink-on-dark">By Time</Text>
                </View>
                <Switch
                  value={timeEnabled}
                  onValueChange={(v) => {
                    userToggledTime.current = true;
                    setTimeEnabled(v);
                    setIntervalError('');
                    markDirty();
                  }}
                  trackColor={{ false: isDark ? '#2A2926' : '#E2E0DB', true: isDark ? '#2E5A9E' : '#A7C4E4' }}
                  thumbColor={timeEnabled ? '#4272C4' : isDark ? '#1A1917' : '#FEFDFB'}
                  accessibilityLabel="Enable time-based repeat"
                />
              </View>
              {timeEnabled && (
                <View className="flex-row items-center mb-4 ml-4 gap-2 flex-wrap">
                  <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark">Every</Text>
                  <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3 py-2">
                    <TextInput
                      ref={timeIntervalRef}
                      className="text-base text-ink dark:text-ink-on-dark min-w-[40px] text-center"
                      value={timeInterval}
                      onChangeText={(t) => { setTimeInterval(t); markDirty(); }}
                      keyboardType="number-pad"
                      placeholder="6"
                      placeholderTextColor="#A8A49D"
                      accessibilityLabel="Time interval"
                    />
                  </View>
                  <View className="flex-row gap-1">
                    {TIME_UNITS.map((u) => (
                      <Pressable
                        key={u.value}
                        onPress={() => { setTimeUnit(u.value); markDirty(); }}
                        className={`px-3 py-2.5 rounded-full ${
                          timeUnit === u.value
                            ? 'bg-primary'
                            : 'bg-surface dark:bg-surface-dark border border-divider dark:border-divider-dark'
                        }`}
                        accessibilityLabel={`${u.label}${timeUnit === u.value ? ', selected' : ''}`}
                        accessibilityRole="button"
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            timeUnit === u.value ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
                          }`}
                        >
                          {u.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {intervalError ? (
                <Text className="text-xs text-destructive mb-3">{intervalError}</Text>
              ) : null}

              {!distanceEnabled && !timeEnabled && (
                <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark text-center py-4">
                  Enable at least one interval
                </Text>
              )}
            </>
          )}

          {/* Starting from */}
          {selectedIds.length > 0 && (distanceEnabled || timeEnabled) && (
            <>
              <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1 mt-2 font-semibold">
                Starting From
              </Text>
              <Text className="text-xs text-ink-faint dark:text-ink-faint-on-dark mb-3">
                The date and odometer when the clock starts for this reminder. The next due date is calculated from here.
              </Text>
              {hasBaseline && matchingEvent ? (
                <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-4">
                  <Text className="text-sm text-ink dark:text-ink-on-dark">
                    Last recorded on {matchingEvent.date}
                    {matchingEvent.odometer != null && ` at ${matchingEvent.odometer.toLocaleString('en-US')} ${odoLabel}`}
                  </Text>
                </View>
              ) : (
                <>
                  {timeEnabled && (
                    <DateField
                      value={baselineDate}
                      onChange={(v) => { setBaselineDate(v); markDirty(); }}
                      label="Start tracking from"
                    />
                  )}
                  {distanceEnabled && (
                    <View className="mb-4">
                      <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
                        Starting Odometer
                      </Text>
                      <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
                        <TextInput
                          className="flex-1 text-base text-ink dark:text-ink-on-dark"
                          value={baselineOdometer}
                          onChangeText={(t) => { setBaselineOdometer(t); markDirty(); }}
                          keyboardType="number-pad"
                          placeholder="Current odometer"
                          placeholderTextColor="#A8A49D"
                          accessibilityLabel={`Starting odometer in ${odoLabel}`}
                        />
                        <Text className="text-sm text-ink-muted ml-2">{odoLabel}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="mt-4 mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete reminder"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Reminder</Text>
            </Pressable>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />
    </SafeAreaView>
  );
}
