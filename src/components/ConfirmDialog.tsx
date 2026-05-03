import { Modal, View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { t } from '@/src/i18n';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: DialogButton[];
  onDismiss?: () => void;
}

export function ConfirmDialog({ visible, title, message, buttons, onDismiss }: ConfirmDialogProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const resolvedButtons: DialogButton[] = buttons?.length
    ? buttons
    : [{ text: t('common.ok'), style: 'default', onPress: onDismiss }];

  const cancelBtn = resolvedButtons.find((b) => b.style === 'cancel');
  const actionBtns = resolvedButtons.filter((b) => b.style !== 'cancel');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable
        className="flex-1 justify-center items-center px-8"
        style={{ backgroundColor: 'rgba(28, 27, 24, 0.5)' }}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.closeDialog')}
      >
        <Pressable
          className="w-full rounded-card bg-card dark:bg-card-dark overflow-hidden"
          style={
            isDark
              ? undefined
              : {
                  shadowColor: '#1C1B18',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.12,
                  shadowRadius: 24,
                  elevation: 8,
                }
          }
          onPress={() => {}}
          accessible={false}
        >
          <View className="px-6 pt-6 pb-2">
            <Text className="text-base font-bold text-ink dark:text-ink-on-dark text-center">
              {title}
            </Text>
            {message ? (
              <Text className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark text-center mt-2 leading-5">
                {message}
              </Text>
            ) : null}
          </View>

          <View className="px-4 pb-4 pt-3">
            {actionBtns.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    btn.onPress?.();
                  }}
                  className="py-3.5 rounded-xl items-center mt-1"
                  style={{
                    backgroundColor: isDestructive
                      ? '#EF4444'
                      : isDark
                        ? '#4272C4'
                        : '#4272C4',
                    opacity: 1,
                  }}
                  accessibilityLabel={btn.text}
                  accessibilityRole="button"
                >
                  {({ pressed }) => (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: '#FEFDFB', opacity: pressed ? 0.7 : 1 }}
                    >
                      {btn.text}
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {cancelBtn ? (
              <Pressable
                onPress={() => {
                  cancelBtn.onPress?.();
                }}
                className="py-3.5 rounded-xl items-center mt-1"
                accessibilityLabel={cancelBtn.text}
                accessibilityRole="button"
              >
                {({ pressed }) => (
                  <Text
                    className="text-base font-semibold text-ink-secondary dark:text-ink-secondary-on-dark"
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  >
                    {cancelBtn.text}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
