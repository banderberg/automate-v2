import { useState, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface DateFieldProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  maxDate?: Date;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function DateField({
  value,
  onChange,
  label = 'Date',
  maxDate,
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const dateValue = new Date(value + 'T12:00:00');
  const today = maxDate ?? new Date();

  const handleChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowPicker(false);
      }
      if (selectedDate) {
        onChange(toISODate(selectedDate));
      }
    },
    [onChange]
  );

  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
        {label} *
      </Text>
      <Pressable
        onPress={() => setShowPicker(!showPicker)}
        className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3"
        accessibilityLabel={`${label}: ${formatDisplayDate(value)}`}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
        <Text className="flex-1 ml-2 text-base text-gray-900 dark:text-gray-100">
          {formatDisplayDate(value)}
        </Text>
      </Pressable>

      {showPicker && (
        <View className="mt-1">
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            maximumDate={today}
            themeVariant="light"
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={() => setShowPicker(false)}
              className="items-center py-2"
              accessibilityLabel="Done selecting date"
              accessibilityRole="button"
            >
              <Text className="text-sm text-primary font-semibold">Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
