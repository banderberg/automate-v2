import { useState, useEffect } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MetricInfoProps {
  explanation: string;
  color: string;
}

export function MetricInfo({ explanation, color }: MetricInfoProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <View>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        accessibilityLabel="More info"
        accessibilityHint={explanation}
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={16} color={color} />
      </Pressable>
      {open && (
        <Text
          style={{ fontSize: 11, color, marginTop: 4, lineHeight: 15 }}
        >
          {explanation}
        </Text>
      )}
    </View>
  );
}
