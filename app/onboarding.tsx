import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/stores/settingsStore';

export default function OnboardingScreen() {
  const router = useRouter();
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const handleGetStarted = async () => {
    await updateSetting('hasCompletedOnboarding', true);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-4xl font-bold">AutoMate</Text>
      <Text className="text-base text-gray-500 mt-3 text-center">
        Track every mile, own every dollar.
      </Text>
      <Pressable
        onPress={handleGetStarted}
        className="mt-12 bg-blue-600 px-8 py-4 rounded-xl"
        accessibilityLabel="Get Started"
        accessibilityRole="button"
      >
        <Text className="text-white text-lg font-semibold">Get Started</Text>
      </Pressable>
    </View>
  );
}
