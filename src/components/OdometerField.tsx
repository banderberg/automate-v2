import { View, Text, TextInput } from 'react-native';

interface OdometerFieldProps {
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  unit: 'miles' | 'kilometers';
  estimatedOdometer?: number | null;
  error?: string;
  required?: boolean;
  label?: string;
}

function formatWithCommas(text: string): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

function stripCommas(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

export function OdometerField({
  value,
  onChange,
  onBlur,
  unit,
  estimatedOdometer,
  error,
  required = false,
  label = 'Odometer',
}: OdometerFieldProps) {
  const unitLabel = unit === 'miles' ? 'mi' : 'km';
  const displayValue = value ? formatWithCommas(value) : '';

  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-semibold">
        {label}{required ? ' *' : ''}
      </Text>
      <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3">
        <TextInput
          className="flex-1 text-base text-gray-900 dark:text-gray-100"
          value={displayValue}
          onChangeText={(text) => onChange(stripCommas(text))}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholder={estimatedOdometer ? `~${estimatedOdometer.toLocaleString('en-US')}` : 'Enter odometer'}
          placeholderTextColor="#9CA3AF"
          accessibilityLabel={`${label} in ${unit}`}
          accessibilityHint={estimatedOdometer ? `Estimated: ${estimatedOdometer.toLocaleString()} ${unitLabel}` : undefined}
        />
        <Text className="text-sm text-gray-400 dark:text-gray-500 ml-2">{unitLabel}</Text>
      </View>
      {estimatedOdometer != null && !value && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">
          Estimated: {estimatedOdometer.toLocaleString('en-US')} {unitLabel}
        </Text>
      )}
      {error && (
        <Text className="text-xs text-destructive mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
