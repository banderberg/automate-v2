import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ModalHeader } from '@/src/components/ModalHeader';

export default function ReminderModal() {
  const router = useRouter();
  const { reminderId } = useLocalSearchParams<{ reminderId?: string }>();
  const isEditing = !!reminderId;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      <ModalHeader
        title={isEditing ? 'Edit Reminder' : 'Add Reminder'}
        onCancel={() => router.back()}
        saveDisabled
      />
      <ScrollView className="flex-1 p-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
          Reminder form coming in Phase 5.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
