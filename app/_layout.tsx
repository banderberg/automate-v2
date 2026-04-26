import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme, ActivityIndicator, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { initializeDatabase } from '@/src/db/client';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { ErrorToast } from '@/src/components/ErrorToast';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const systemColorScheme = useSystemColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();
  const themeSetting = useSettingsStore((s) => s.settings.theme);

  useEffect(() => {
    setColorScheme(themeSetting === 'system' ? 'system' : themeSetting);
  }, [themeSetting, setColorScheme]);

  const resolvedColorScheme = colorScheme ?? systemColorScheme ?? 'light';

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        await useSettingsStore.getState().initialize();
        await useVehicleStore.getState().initialize();
        await useReferenceDataStore.getState().initialize();

        const activeVehicle = useVehicleStore.getState().activeVehicle;
        if (activeVehicle) {
          await Promise.all([
            useEventStore.getState().loadForVehicle(activeVehicle.id),
            useReminderStore.getState().loadForVehicle(activeVehicle.id),
          ]);
        }
      } catch (e) {
        console.error('App initialization failed:', e);
      } finally {
        setAppReady(true);
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: systemColorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1' }}>
        <ActivityIndicator size="large" color={systemColorScheme === 'dark' ? '#F5F4F1' : '#1C1B18'} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={resolvedColorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <BottomSheetModalProvider>
          <View style={{ flex: 1 }}>
            <RootNavigator />
            <ErrorToast />
          </View>
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.settings.hasCompletedOnboarding);
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!hasCompletedOnboarding && vehicleCount === 0) {
      const inOnboarding = segments[0] === 'onboarding';
      const inModals = segments[0] === '(modals)';
      if (!inOnboarding && !inModals) {
        router.replace('/onboarding');
      }
    } else if (hasCompletedOnboarding && segments[0] === 'onboarding') {
      router.replace('/(tabs)/dashboard');
    }
  }, [hasCompletedOnboarding, vehicleCount, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(modals)" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
