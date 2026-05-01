import { View, Text, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRef } from 'react';

interface InsightCardProps {
  title: string;
  subtitle: string;
  icon: string;
  iconBgColor: string;
  isDark: boolean;
  onDismiss: () => void;
}

export function InsightCard({ title, subtitle, icon, iconBgColor, isDark, onDismiss }: InsightCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  function renderRightActions(_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) {
    const opacity = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          opacity,
        }}
      >
        <Text style={{ color: isDark ? '#8A8680' : '#706C67', fontSize: 12 }}>Dismiss</Text>
      </Animated.View>
    );
  }

  function handleSwipeOpen() {
    swipeableRef.current?.close();
    onDismiss();
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
    >
      <View
        style={{
          backgroundColor: isDark ? '#2A2926' : '#F0EFEC',
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: iconBgColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isDark ? '#F5F4F1' : '#1C1B18',
              lineHeight: 18,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? '#8A8680' : '#706C67',
              lineHeight: 16,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}
