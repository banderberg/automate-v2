import { useEffect, useState } from 'react';
import { Text, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventStore } from '../stores/eventStore';
import { useVehicleStore } from '../stores/vehicleStore';
import { useReminderStore } from '../stores/reminderStore';
import { useReferenceDataStore } from '../stores/referenceDataStore';

export function ErrorToast() {
  const eventError = useEventStore((s) => s.error);
  const vehicleError = useVehicleStore((s) => s.error);
  const reminderError = useReminderStore((s) => s.error);
  const refError = useReferenceDataStore((s) => s.error);
  const [opacity] = useState(new Animated.Value(0));
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const currentError = eventError || vehicleError || reminderError || refError;

  useEffect(() => {
    if (currentError) {
      setMessage(currentError);
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
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [currentError]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{ opacity, position: 'absolute', top: 60, left: 16, right: 16, zIndex: 1000 }}
    >
      <Pressable
        onPress={() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start(() => setVisible(false));
        }}
        className="flex-row items-center bg-destructive rounded-xl px-4 py-3"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
        accessibilityLabel={`Error: ${message}. Tap to dismiss.`}
        accessibilityRole="alert"
      >
        <Ionicons name="alert-circle" size={18} color="white" />
        <Text className="flex-1 text-sm text-white ml-2" numberOfLines={2}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}
