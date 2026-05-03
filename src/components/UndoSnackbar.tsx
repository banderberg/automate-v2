import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useEventStore } from '../stores/eventStore';
import { useColorScheme } from 'nativewind';
import { t } from '@/src/i18n';

export function UndoSnackbar() {
  const pendingDelete = useEventStore((s) => s.pendingDelete);
  const undoDelete = useEventStore((s) => s.undoDelete);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pendingDelete) {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [pendingDelete]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{ opacity, position: 'absolute', bottom: 96, left: 16, right: 16 }}
    >
      <View
        className="flex-row items-center justify-between rounded-xl px-4 py-3"
        style={{
          backgroundColor: '#1C1B18',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text className="text-sm" style={{ color: '#F5F4F1' }}>{t('undo.eventDeleted')}</Text>
        <Pressable
          onPress={undoDelete}
          hitSlop={8}
          accessibilityLabel={t('undo.undoA11y')}
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-primary">{t('undo.undoLabel')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
