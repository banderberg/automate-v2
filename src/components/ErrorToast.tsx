import { useEffect, useState, useRef } from 'react';
import { Text, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEventStore } from '../stores/eventStore';
import { useVehicleStore } from '../stores/vehicleStore';
import { useReminderStore } from '../stores/reminderStore';
import { useReferenceDataStore } from '../stores/referenceDataStore';
import { useToastStore } from '../stores/toastStore';
import { useColorScheme } from 'nativewind';

export function ErrorToast() {
  const eventError = useEventStore((s) => s.error);
  const vehicleError = useVehicleStore((s) => s.error);
  const reminderError = useReminderStore((s) => s.error);
  const refError = useReferenceDataStore((s) => s.error);
  const toastMessage = useToastStore((s) => s.message);
  const toastType = useToastStore((s) => s.type);
  const clearToast = useToastStore((s) => s.clear);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<'error' | 'success'>('error');

  const currentError = eventError || vehicleError || reminderError || refError;

  useEffect(() => {
    if (toastMessage) {
      setMessage(toastMessage);
      setKind(toastType);
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
          clearToast();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (currentError && !toastMessage) {
      setMessage(currentError);
      setKind('error');
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, 8000);

      return () => clearTimeout(timer);
    } else if (!currentError && !toastMessage) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [currentError]);

  if (!visible) return null;

  const isSuccess = kind === 'success';
  const bgClass = isSuccess ? 'bg-success' : 'bg-destructive';
  const icon = isSuccess ? 'checkmark-circle' : 'alert-circle';

  return (
    <Animated.View
      style={{ opacity, position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 1000 }}
    >
      <Pressable
        onPress={() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setVisible(false);
            if (isSuccess) clearToast();
          });
        }}
        className={`flex-row items-start ${bgClass} rounded-xl px-4 py-3`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
        accessibilityLabel={`${isSuccess ? 'Success' : 'Error'}: ${message}. Tap to dismiss.`}
        accessibilityRole="alert"
      >
        <Ionicons name={icon} size={18} color="white" style={{ marginTop: 1 }} />
        <Text className="text-sm text-white ml-2 font-medium" style={{ flexShrink: 1 }}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}
