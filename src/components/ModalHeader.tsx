import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { t } from '@/src/i18n';

interface ModalHeaderProps {
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  hideSave?: boolean;
  isSaving?: boolean;
}

export function ModalHeader({
  title,
  onCancel,
  onSave,
  saveDisabled = false,
  saveLabel,
  cancelLabel,
  hideSave = false,
  isSaving = false,
}: ModalHeaderProps) {
  const resolvedSaveLabel = saveLabel ?? t('common.save');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-divider dark:border-divider-dark bg-card dark:bg-card-dark">
      <Pressable
        onPress={isSaving ? undefined : onCancel}
        className="min-w-[60px] py-3"
        accessibilityLabel={resolvedCancelLabel}
        accessibilityRole="button"
        disabled={isSaving}
        hitSlop={8}
      >
        <Text className={`text-base ${isSaving ? 'text-ink-muted dark:text-ink-faint-on-dark' : 'text-primary'}`}>{resolvedCancelLabel}</Text>
      </Pressable>

      <Text
        className="flex-1 text-base font-semibold text-ink dark:text-ink-on-dark text-center"
        numberOfLines={1}
      >
        {title}
      </Text>

      {!hideSave ? (
        <Pressable
          onPress={saveDisabled || isSaving ? undefined : onSave}
          className="min-w-[60px] py-3 items-end"
          accessibilityLabel={isSaving ? t('modalHeader.savingA11y') : resolvedSaveLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled || isSaving }}
          disabled={saveDisabled || isSaving}
          hitSlop={8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#4272C4" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                saveDisabled ? 'text-ink-muted dark:text-ink-faint-on-dark' : 'text-primary'
              }`}
            >
              {resolvedSaveLabel}
            </Text>
          )}
        </Pressable>
      ) : (
        <View className="min-w-[60px]" />
      )}
    </View>
  );
}
