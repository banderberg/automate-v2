import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmDialog } from './ConfirmDialog';
import { useDialog } from '../hooks/useDialog';

interface MetricInfoProps {
  explanation: string;
  color: string;
}

export function MetricInfo({ explanation, color }: MetricInfoProps) {
  const { showDialog, dialogProps } = useDialog();

  return (
    <>
      <Pressable
        onPress={() => showDialog('How is this calculated?', explanation)}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        accessibilityLabel="More info"
        accessibilityHint={explanation}
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={16} color={color} />
      </Pressable>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
