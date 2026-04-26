import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5 bg-surface dark:bg-surface-dark">
        <Text className="text-xl font-bold text-ink dark:text-ink-on-dark">This screen doesn't exist.</Text>
        <Link href={"/" as never} className="mt-4 py-4">
          <Text className="text-sm text-primary">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
