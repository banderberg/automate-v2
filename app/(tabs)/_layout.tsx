import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { t } from '@/src/i18n';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const activeTint = colorScheme === 'dark' ? '#6A9FD8' : '#4272C4'; // primary-tint / primary
  const inactiveTint = colorScheme === 'dark' ? '#8A8680' : '#706C67';
  const tabBarBg = colorScheme === 'dark' ? '#0E0E0C' : '#F5F4F1';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: colorScheme === 'dark' ? '#2A2926' : '#E2E0DB',
        },
        headerShown: false,
        sceneStyle: { backgroundColor: tabBarBg },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: t('tabsA11y.dashboard'),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: t('tabsA11y.history'),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('tabs.reminders'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: t('tabsA11y.reminders'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: t('tabsA11y.settings'),
        }}
      />
    </Tabs>
  );
}
