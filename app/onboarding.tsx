import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function OnboardingScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/(modals)/vehicle');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-1 items-center justify-center px-8">
        {/* App icon placeholder */}
        <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-6">
          <Text className="text-4xl">🚗</Text>
        </View>

        <Text className="text-4xl font-bold text-ink dark:text-ink-on-dark text-center">
          AutoMate
        </Text>
        <Text className="text-lg text-ink-secondary dark:text-ink-secondary-on-dark mt-3 text-center leading-7">
          Track every mile,{'\n'}own every dollar.
        </Text>

        <Pressable
          onPress={handleGetStarted}
          className="mt-12 bg-primary px-10 py-4 rounded-2xl w-full items-center"
          accessibilityLabel="Get Started"
          accessibilityRole="button"
        >
          <Text className="text-white text-lg font-semibold">Get Started</Text>
        </Pressable>

        <Text className="text-xs text-ink-muted dark:text-ink-faint-on-dark mt-4 text-center">
          No account required. Your data stays on your device.
        </Text>
      </View>
    </SafeAreaView>
  );
}
