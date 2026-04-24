import { View, Text } from 'react-native';

export default function OnboardingScreen() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="text-2xl font-bold">AutoMate</Text>
      <Text className="text-base text-gray-500 mt-2">
        Track every mile, own every dollar.
      </Text>
      <Text className="text-sm text-gray-400 mt-8">Phase 1 placeholder</Text>
    </View>
  );
}
