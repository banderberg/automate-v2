import { View, Text, Pressable } from 'react-native';

interface ModalHeaderProps {
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  hideSave?: boolean;
}

export function ModalHeader({
  title,
  onCancel,
  onSave,
  saveDisabled = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  hideSave = false,
}: ModalHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-divider dark:border-divider-dark bg-card dark:bg-card-dark">
      <Pressable
        onPress={onCancel}
        className="min-w-[60px] py-1"
        accessibilityLabel={cancelLabel}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text className="text-base text-primary">{cancelLabel}</Text>
      </Pressable>

      <Text
        className="flex-1 text-base font-semibold text-ink dark:text-ink-on-dark text-center"
        numberOfLines={1}
      >
        {title}
      </Text>

      {!hideSave ? (
        <Pressable
          onPress={saveDisabled ? undefined : onSave}
          className="min-w-[60px] py-1 items-end"
          accessibilityLabel={saveLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled }}
          disabled={saveDisabled}
          hitSlop={8}
        >
          <Text
            className={`text-base font-semibold ${
              saveDisabled ? 'text-ink-muted dark:text-ink-faint-on-dark' : 'text-primary'
            }`}
          >
            {saveLabel}
          </Text>
        </Pressable>
      ) : (
        <View className="min-w-[60px]" />
      )}
    </View>
  );
}
