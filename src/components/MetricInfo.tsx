import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmDialog } from './ConfirmDialog';
import { useDialog } from '../hooks/useDialog';
import { t } from '@/src/i18n';

interface MetricInfoProps {
  explanation: string;
  color: string;
}

export function MetricInfo({ explanation, color }: MetricInfoProps) {
  const { showDialog, dialogProps } = useDialog();

  return (
    <>
      <Pressable
        onPress={() => showDialog(t('metricInfo.dialogTitle'), explanation)}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        accessibilityLabel={t('metricInfo.buttonA11y')}
        accessibilityHint={explanation}
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={16} color={color} />
      </Pressable>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
