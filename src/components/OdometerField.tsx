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
      <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
        {label}{required ? ' *' : ''}
      </Text>
      <View className="flex-row items-center bg-card dark:bg-card-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
        <TextInput
          className="flex-1 text-base text-ink dark:text-ink-on-dark"
          value={displayValue}
          onChangeText={(text) => onChange(stripCommas(text))}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholder={estimatedOdometer ? `~${estimatedOdometer.toLocaleString('en-US')}` : 'Enter odometer'}
          placeholderTextColor="#A8A49D"
          accessibilityLabel={`${label} in ${unit}`}
          accessibilityHint={estimatedOdometer ? `Estimated: ${estimatedOdometer.toLocaleString()} ${unitLabel}` : undefined}
        />
        <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark ml-2">{unitLabel}</Text>
      </View>
      {estimatedOdometer != null && !value && (
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-1 ml-1">
          Estimated: {estimatedOdometer.toLocaleString('en-US')} {unitLabel}
        </Text>
      )}
      {error && (
        <Text className="text-xs text-destructive mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
