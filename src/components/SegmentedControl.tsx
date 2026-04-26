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
      className="flex-row bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark p-1"
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
                    ? 'text-ink-muted dark:text-ink-faint-on-dark'
                    : 'text-ink-secondary dark:text-ink-secondary-on-dark'
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
