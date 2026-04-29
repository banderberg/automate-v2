import { useEffect, useCallback } from 'react';
import { View, Text, Pressable, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useGuardedNavigate } from '@/src/hooks/useGuardedNavigate';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '@/src/components/ModalHeader';
import { EmptyState } from '@/src/components/EmptyState';
import { useDocumentStore } from '@/src/stores/documentStore';
import type { VehicleDocument } from '@/src/types';

const TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  registration: 'Registration',
  title: 'Title',
  emissions: 'Emissions',
  inspection: 'Inspection',
  other: 'Other',
};

function isDocumentPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf');
}

function fileExists(filePath: string): boolean {
  try {
    const file = new File(filePath);
    return file.exists;
  } catch {
    return false;
  }
}

function getExpirationColor(expirationDate: string): string {
  const now = new Date();
  const exp = new Date(expirationDate + 'T00:00:00');
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '#EF4444';
  if (diffDays <= 30) return '#F59E0B';
  return '#10B981';
}

function formatExpirationLabel(expirationDate: string): string {
  const now = new Date();
  const exp = new Date(expirationDate + 'T00:00:00');
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays <= 30) return `Expires in ${diffDays} days`;

  const d = new Date(expirationDate + 'T00:00:00');
  return `Exp. ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function DocumentRow({
  doc,
  onPress,
}: {
  doc: VehicleDocument;
  onPress: () => void;
}) {
  const exists = fileExists(doc.filePath);
  const isPdf = isDocumentPdf(doc.filePath);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 bg-card dark:bg-card-dark border-b border-divider-subtle dark:border-divider-dark active:bg-surface dark:active:bg-surface-dark"
      accessibilityLabel={`${doc.name}, ${TYPE_LABELS[doc.type] ?? doc.type}`}
      accessibilityRole="button"
    >
      <View className="w-12 h-12 rounded-lg bg-surface dark:bg-surface-dark items-center justify-center overflow-hidden mr-3">
        {!exists ? (
          <Ionicons name="alert-circle-outline" size={24} color="#A8A49D" />
        ) : isPdf ? (
          <Ionicons name="document-text" size={24} color="#EF4444" />
        ) : (
          <Image
            source={{ uri: doc.filePath }}
            className="w-12 h-12"
            resizeMode="cover"
          />
        )}
      </View>

      <View className="flex-1 mr-2">
        <Text
          className="text-base font-semibold text-ink dark:text-ink-on-dark"
          numberOfLines={1}
        >
          {doc.name}
        </Text>
        <Text
          className="text-xs text-ink-muted dark:text-ink-muted-on-dark mt-0.5"
          numberOfLines={1}
        >
          {TYPE_LABELS[doc.type] ?? doc.type}
        </Text>
        {doc.expirationDate && (
          <Text
            className="text-xs mt-0.5 font-medium"
            style={{ color: getExpirationColor(doc.expirationDate) }}
          >
            {formatExpirationLabel(doc.expirationDate)}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color="#A8A49D" />
    </Pressable>
  );
}

export default function VehicleDocumentsScreen() {
  const nav = useGuardedNavigate();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const documents = useDocumentStore((s) => s.documents);
  const isLoading = useDocumentStore((s) => s.isLoading);
  const loadForVehicle = useDocumentStore((s) => s.loadForVehicle);

  useEffect(() => {
    if (vehicleId) {
      loadForVehicle(vehicleId);
    }
  }, [vehicleId]);

  const handleAdd = useCallback(() => {
    nav.push(`/(modals)/document?vehicleId=${vehicleId}`);
  }, [vehicleId]);

  const handleDocPress = useCallback(
    (docId: string) => {
      nav.push(`/(modals)/document?documentId=${docId}`);
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: VehicleDocument }) => (
      <DocumentRow doc={item} onPress={() => handleDocPress(item.id)} />
    ),
    [handleDocPress]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title="Documents"
        onCancel={nav.back}
        onSave={handleAdd}
        saveLabel="Add"
      />

      {documents.length === 0 && !isLoading ? (
        <EmptyState
          icon={<Ionicons name="document-text-outline" size={48} color="#A8A49D" />}
          title="No Documents"
          description="Store insurance, registration, and other vehicle documents here."
          actionLabel="Add Document"
          onAction={handleAdd}
        />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

    </SafeAreaView>
  );
}
