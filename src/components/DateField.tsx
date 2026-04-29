import { useState, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface DateFieldProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  maxDate?: Date;
  minDate?: Date;
  required?: boolean;
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateField({
  value,
  onChange,
  label = 'Date',
  maxDate,
  minDate,
  required = true,
}: DateFieldProps) {
  const { colorScheme } = useColorScheme();
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
      <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
        {label}{required ? ' *' : ''}
      </Text>
      <Pressable
        onPress={() => setShowPicker(!showPicker)}
        className="flex-row items-center bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3"
        accessibilityLabel={`${label}: ${formatDisplayDate(value)}`}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={18} color="#A8A49D" />
        <Text className="flex-1 ml-2 text-base text-ink dark:text-ink-on-dark">
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
            minimumDate={minDate}
            themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={() => setShowPicker(false)}
              className="items-center py-3"
              hitSlop={8}
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
