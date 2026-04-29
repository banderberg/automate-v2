import { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { ConfirmDialog } from './ConfirmDialog';
import { useDialog } from '../hooks/useDialog';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

interface ChipItem {
  id: string;
  name: string;
}

interface ChipPickerProps {
  items: ChipItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  multiSelect?: boolean;
  label?: string;
  error?: string;
  accentColor?: string;
  onAdd?: (name: string) => Promise<void>;
  onUpdate?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ChipPicker({
  items,
  selectedIds,
  onSelectionChange,
  multiSelect = true,
  label,
  error,
  accentColor,
  onAdd,
  onUpdate,
  onDelete,
}: ChipPickerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const manageSheetRef = useRef<BottomSheetModal>(null);
  const [newItemName, setNewItemName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { showDialog, dialogProps } = useDialog();

  const handleToggle = useCallback(
    (id: string) => {
      if (multiSelect) {
        const next = selectedIds.includes(id)
          ? selectedIds.filter((s) => s !== id)
          : [...selectedIds, id];
        onSelectionChange(next);
      } else {
        onSelectionChange([id]);
      }
    },
    [multiSelect, selectedIds, onSelectionChange]
  );

  const handleAdd = useCallback(async () => {
    const trimmed = newItemName.trim();
    if (!trimmed || !onAdd) return;
    await onAdd(trimmed);
    setNewItemName('');
  }, [newItemName, onAdd]);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editingName.trim();
    if (!trimmed || !editingId || !onUpdate) return;
    await onUpdate(editingId, trimmed);
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, onUpdate]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!onDelete) return;
      showDialog('Delete', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
      ]);
    },
    [onDelete]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    []
  );

  const canManage = onAdd || onUpdate || onDelete;

  return (
    <View className="mb-4">
      {label && (
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark font-semibold">{label}</Text>
          {canManage && (
            <Pressable
              onPress={() => manageSheetRef.current?.present()}
              hitSlop={8}
              accessibilityLabel={`Manage ${label}`}
              accessibilityRole="button"
            >
              <Text className="text-xs text-primary font-semibold">Manage</Text>
            </Pressable>
          )}
        </View>
      )}

      <View className="flex-row flex-wrap">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => handleToggle(item.id)}
              className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                selected
                  ? 'border-transparent'
                  : 'border-divider dark:border-divider-dark bg-surface dark:bg-surface-dark'
              }`}
              style={selected ? { backgroundColor: accentColor || '#4272C4' } : undefined}
              accessibilityLabel={`${item.name}${selected ? ', selected' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? 'text-white' : 'text-ink-secondary dark:text-ink-secondary-on-dark'
                }`}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
        {onAdd && (
          <Pressable
            onPress={() => manageSheetRef.current?.present()}
            className="mr-2 mb-2 px-4 py-2 rounded-full"
            style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#54524D' : '#A8A49D' }}
            accessibilityLabel={`Add custom ${label || 'item'}`}
            accessibilityRole="button"
          >
            <View className="flex-row items-center">
              <Ionicons name="add" size={14} color={isDark ? '#78756F' : '#A8A49D'} />
              <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark ml-0.5">Custom</Text>
            </View>
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-xs text-destructive mt-1.5 ml-1">{error}</Text>
      )}

      {canManage && (
        <BottomSheetModal
          ref={manageSheetRef}
          enableDynamicSizing
          backdropComponent={renderBackdrop}
          enablePanDownToClose
          handleIndicatorStyle={{ backgroundColor: isDark ? '#2A2926' : '#E2E0DB' }}
          backgroundStyle={{ backgroundColor: isDark ? '#1A1917' : '#FEFDFB' }}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <BottomSheetView style={{ paddingBottom: 40 }}>
            <Text className="px-4 pt-2 pb-3 text-base font-semibold text-ink dark:text-ink-on-dark">
              Manage {label}
            </Text>

            {items.map((item) => (
              <View key={item.id} className="flex-row items-center px-4 py-2.5">
                {editingId === item.id ? (
                  <View className="flex-1 flex-row items-center">
                    <BottomSheetTextInput
                      className="flex-1 text-sm text-ink dark:text-ink-on-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-2"
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                      onSubmitEditing={handleSaveEdit}
                      returnKeyType="done"
                    />
                    <Pressable onPress={handleSaveEdit} className="ml-2 p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Save" accessibilityRole="button">
                      <Ionicons name="checkmark" size={20} color="#4272C4" />
                    </Pressable>
                    <Pressable
                      onPress={() => { setEditingId(null); setEditingName(''); }}
                      className="ml-1 p-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel="Cancel edit"
                      accessibilityRole="button"
                    >
                      <Ionicons name="close" size={20} color="#A8A49D" />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text className="flex-1 text-sm text-ink dark:text-ink-on-dark" numberOfLines={1}>{item.name}</Text>
                    {onUpdate && (
                      <Pressable
                        onPress={() => { setEditingId(item.id); setEditingName(item.name); }}
                        className="p-2.5"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel={`Edit ${item.name}`}
                        accessibilityRole="button"
                      >
                        <Ionicons name="pencil" size={16} color="#5C5A55" />
                      </Pressable>
                    )}
                    {onDelete && (
                      <Pressable
                        onPress={() => handleDelete(item.id, item.name)}
                        className="p-2.5 ml-1"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel={`Delete ${item.name}`}
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            ))}

            {onAdd && (
              <View className="flex-row items-center px-4 pt-3 mt-2 border-t border-divider dark:border-divider-dark">
                <BottomSheetTextInput
                  className="flex-1 text-sm text-ink dark:text-ink-on-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-2"
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Add new..."
                  placeholderTextColor="#A8A49D"
                  onSubmitEditing={handleAdd}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={handleAdd}
                  className="ml-2 bg-primary px-3 py-2 rounded-lg"
                  accessibilityLabel="Add"
                  accessibilityRole="button"
                >
                  <Text className="text-white text-sm font-semibold">Add</Text>
                </Pressable>
              </View>
            )}
          </BottomSheetView>
        </BottomSheetModal>
      )}
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}
