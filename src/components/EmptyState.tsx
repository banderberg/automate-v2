import { View, Text, Pressable } from 'react-native';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-4 opacity-40">{icon}</View>
      <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
        {title}
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-5">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="mt-6 bg-primary px-6 py-3 rounded-xl"
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Text className="text-white font-semibold text-sm">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
