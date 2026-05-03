import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '@/src/components/ModalHeader';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { t } from '@/src/i18n';

const LICENSES = [
  { name: 'expo', license: 'MIT' },
  { name: 'expo-router', license: 'MIT' },
  { name: 'expo-sqlite', license: 'MIT' },
  { name: 'expo-notifications', license: 'MIT' },
  { name: 'expo-image-picker', license: 'MIT' },
  { name: 'expo-location', license: 'MIT' },
  { name: 'expo-file-system', license: 'MIT' },
  { name: 'expo-crypto', license: 'MIT' },
  { name: 'expo-haptics', license: 'MIT' },
  { name: 'expo-sharing', license: 'MIT' },
  { name: 'expo-print', license: 'MIT' },
  { name: 'react', license: 'MIT' },
  { name: 'react-native', license: 'MIT' },
  { name: 'zustand', license: 'MIT' },
  { name: 'nativewind', license: 'MIT' },
  { name: 'tailwindcss', license: 'MIT' },
  { name: 'react-native-gifted-charts', license: 'MIT' },
  { name: '@gorhom/bottom-sheet', license: 'MIT' },
  { name: '@shopify/flash-list', license: 'MIT' },
  { name: 'react-native-gesture-handler', license: 'MIT' },
  { name: 'react-native-reanimated', license: 'MIT' },
  { name: 'react-native-safe-area-context', license: 'MIT' },
  { name: '@expo/vector-icons', license: 'MIT' },
  { name: 'react-native-maps', license: 'MIT' },
];

export default function LicensesModal() {
  const nav = useGuardedNavigate();
  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader title={t('modalLicenses.title')} cancelLabel={t('common.done')} onCancel={() => nav.back()} hideSave />
      <FlatList
        data={LICENSES}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-divider-subtle dark:border-divider-dark">
            <Text className="text-sm text-ink dark:text-ink-on-dark flex-1">{item.name}</Text>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark">{item.license}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}
