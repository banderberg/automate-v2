import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';

export default function ModalLayout() {
  const { colorScheme } = useColorScheme();
  const bg = colorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1';

  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        gestureEnabled: true,
        contentStyle: { backgroundColor: bg },
      }}
    >
      <Stack.Screen name="licenses" options={{ headerShown: false }} />
    </Stack>
  );
}
