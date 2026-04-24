import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, ActivityIndicator, View, ColorSchemeName } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { initializeDatabase } from '@/src/db/client';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const systemColorScheme = useColorScheme();
  const themeSetting = useSettingsStore((s) => s.settings.theme);

  const resolvedColorScheme: ColorSchemeName =
    themeSetting === 'system' ? systemColorScheme : themeSetting;

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={resolvedColorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <BottomSheetModalProvider>
          {/* colorScheme prop tells NativeWind dark: classes which scheme to use */}
          <View style={{ flex: 1, colorScheme: resolvedColorScheme ?? 'light' } as never}>
            <RootNavigator />
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
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
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
