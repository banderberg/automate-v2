import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ModalHeader } from '@/src/components/ModalHeader';

export default function ManageVehiclesModal() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <ModalHeader
        title="Manage Vehicles"
        onCancel={() => router.back()}
        hideSave
      />
      <ScrollView className="flex-1 p-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
          Vehicle management coming in Phase 5.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
