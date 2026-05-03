import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme, ActivityIndicator, View, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Application from 'expo-application';
import { initializeDatabase } from '@/src/db/client';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useReferenceDataStore } from '@/src/stores/referenceDataStore';
import { useEventStore } from '@/src/stores/eventStore';
import { useReminderStore } from '@/src/stores/reminderStore';
import { ErrorToast } from '@/src/components/ErrorToast';
import { initLogger, logError, setLoggerTag, setLoggerUser } from '@/src/services/logger';

initLogger();

export { AppErrorBoundary as ErrorBoundary } from '@/src/components/AppErrorBoundary';

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

        attachLoggerContext();
      } catch (e) {
        logError(e, { source: 'appInit' });
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: resolvedColorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1' }}>
      <ThemeProvider value={resolvedColorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <BottomSheetModalProvider>
          <View style={{ flex: 1, backgroundColor: resolvedColorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1' }}>
            <RootNavigator resolvedColorScheme={resolvedColorScheme} />
            <ErrorToast />
          </View>
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ resolvedColorScheme }: { resolvedColorScheme: string }) {
  const hasCompletedOnboarding = useSettingsStore((s) => s.settings.hasCompletedOnboarding);
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const router = useRouter();
  const segments = useSegments();
  const bg = resolvedColorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1';

  useEffect(() => {
    if (!hasCompletedOnboarding && vehicleCount === 0) {
      const inOnboarding = segments[0] === 'onboarding';
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else if (hasCompletedOnboarding && segments[0] === 'onboarding') {
      router.replace('/(tabs)/dashboard');
    }
  }, [hasCompletedOnboarding, vehicleCount, segments]);

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(modals)" options={{ headerShown: false, presentation: 'modal', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

async function attachLoggerContext(): Promise<void> {
  try {
    const deviceId =
      Platform.OS === 'android'
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
    if (deviceId) setLoggerUser(deviceId);

    const version = Application.nativeApplicationVersion;
    const build = Application.nativeBuildVersion;
    if (version) setLoggerTag('appVersion', version);
    if (build) setLoggerTag('buildVersion', build);
    setLoggerTag('platform', Platform.OS);
  } catch (e) {
    logError(e, { source: 'attachLoggerContext' });
  }
}
