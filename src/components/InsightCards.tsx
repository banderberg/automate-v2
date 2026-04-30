import { View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { InsightCard } from './InsightCard';
import type { DisplayedInsight } from '../hooks/useInsights';

interface InsightCardsProps {
  insights: DisplayedInsight[];
  isDark: boolean;
  onDismiss: (impressionId: string, insightType: string) => void;
}

export function InsightCards({ insights, isDark, onDismiss }: InsightCardsProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (insights.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [insights.length > 0]);

  if (insights.length === 0) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
      {insights.map((insight) => (
        <InsightCard
          key={insight.type}
          title={insight.title}
          subtitle={insight.subtitle}
          icon={insight.icon}
          iconBgColor={insight.iconBgColor}
          isDark={isDark}
          onDismiss={() => {
            if (insight.impressionId) {
              onDismiss(insight.impressionId, insight.type);
            }
          }}
        />
      ))}
    </Animated.View>
  );
}
