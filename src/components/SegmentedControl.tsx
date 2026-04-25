import { View, Text, Pressable } from 'react-native';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  selectedValue,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      className="flex-row bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 p-1"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
    >
      {options.map(({ value, label }) => {
        const selected = value === selectedValue;
        return (
          <Pressable
            key={value}
            onPress={() => !disabled && onValueChange(value)}
            className={`flex-1 py-2 rounded-lg items-center ${
              selected ? 'bg-primary' : ''
            }`}
            disabled={disabled}
            accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
          >
            <Text
              className={`text-sm font-semibold ${
                selected
                  ? 'text-white'
                  : disabled
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
