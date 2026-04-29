import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths, Directory } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ModalHeader } from '@/src/components/ModalHeader';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useDialog } from '@/src/hooks/useDialog';
import { ChipPicker } from '@/src/components/ChipPicker';
import { DateField } from '@/src/components/DateField';
import { useDocumentStore } from '@/src/stores/documentStore';
import { useVehicleStore } from '@/src/stores/vehicleStore';
import { useToastStore } from '@/src/stores/toastStore';
import type { VehicleDocumentType } from '@/src/types';

const DOC_DIR = 'vehicle-documents';

const DOCUMENT_TYPES: { id: VehicleDocumentType; name: string }[] = [
  { id: 'insurance', name: 'Insurance' },
  { id: 'registration', name: 'Registration' },
  { id: 'title', name: 'Title' },
  { id: 'emissions', name: 'Emissions' },
  { id: 'inspection', name: 'Inspection' },
  { id: 'other', name: 'Other' },
];

const TYPE_NAME_MAP: Record<VehicleDocumentType, string | null> = {
  insurance: 'Insurance Card',
  registration: 'Registration',
  title: 'Title',
  emissions: 'Emissions Certificate',
  inspection: 'Inspection Report',
  other: null,
};

function isDocumentPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf');
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() ?? 'Document';
}

function ensureDocDirectory(): void {
  const dir = new Directory(Paths.document, DOC_DIR);
  if (!dir.exists) {
    dir.create();
  }
}

export default function DocumentModal() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { vehicleId, documentId } = useLocalSearchParams<{
    vehicleId?: string;
    documentId?: string;
  }>();
  const isEditing = !!documentId;

  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const vehicleName = activeVehicle?.nickname ?? 'your vehicle';
  const documents = useDocumentStore((s) => s.documents);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const loadForVehicle = useDocumentStore((s) => s.loadForVehicle);

  const [filePath, setFilePath] = useState<string | undefined>();
  const [fileChanged, setFileChanged] = useState(false);
  const [name, setName] = useState('');
  const [docType, setDocType] = useState<VehicleDocumentType>('other');
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationDate, setExpirationDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileMissing, setFileMissing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const nameWasTouched = useRef(false);
  const isDirty = useRef(false);
  const markDirty = useCallback(() => { isDirty.current = true; }, []);
  const { showDialog, dialogProps } = useDialog();

  const existingDoc = useMemo(() => {
    if (!documentId) return null;
    return documents.find((d) => d.id === documentId) ?? null;
  }, [documentId, documents]);

  const resolvedVehicleId = vehicleId ?? existingDoc?.vehicleId;

  useEffect(() => {
    if (!existingDoc) return;
    setFilePath(existingDoc.filePath);
    setName(existingDoc.name);
    setDocType(existingDoc.type);
    setNotes(existingDoc.notes ?? '');
    nameWasTouched.current = true;

    if (existingDoc.expirationDate) {
      setExpirationEnabled(true);
      setExpirationDate(existingDoc.expirationDate);
    }

    try {
      const file = new File(existingDoc.filePath);
      if (!file.exists) {
        setFileMissing(true);
      }
    } catch {
      setFileMissing(true);
    }
  }, []);

  useEffect(() => {
    if (documentId && resolvedVehicleId && !existingDoc) {
      loadForVehicle(resolvedVehicleId);
    }
  }, [documentId, resolvedVehicleId]);

  const handleTypeChange = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const newType = ids[0] as VehicleDocumentType;
      setDocType(newType);
      markDirty();

      if (!nameWasTouched.current) {
        const prefill = TYPE_NAME_MAP[newType];
        if (prefill) {
          setName(prefill);
        }
      }
    },
    []
  );

  const handleNameChange = useCallback((text: string) => {
    setName(text.slice(0, 50));
    nameWasTouched.current = true;
    isDirty.current = true;
  }, []);

  const copyFileToPermanent = useCallback((sourceUri: string): string => {
    ensureDocDirectory();
    const ext = sourceUri.split('.').pop() ?? 'jpg';
    const filename = `${Crypto.randomUUID()}.${ext}`;
    const sourceFile = new File(sourceUri);
    const destFile = new File(Paths.document, DOC_DIR, filename);
    sourceFile.copy(destFile);
    return destFile.uri;
  }, []);

  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
      };

      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showDialog('Permission needed', 'Camera access is required to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets[0]) return;

      const permanentPath = copyFileToPermanent(result.assets[0].uri);
      setFilePath(permanentPath);
      setFileChanged(true);
      setFileMissing(false);
      markDirty();
    },
    [copyFileToPermanent]
  );

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const permanentPath = copyFileToPermanent(result.assets[0].uri);
    setFilePath(permanentPath);
    setFileChanged(true);
    setFileMissing(false);
    markDirty();
  }, [copyFileToPermanent]);

  const handleFilePress = useCallback(() => {
    const options = ['Take Photo', 'Choose from Library', 'Choose PDF File', 'Cancel'];
    const cancelIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
          else if (index === 2) pickPdf();
        }
      );
    } else {
      showDialog('Attach Document', undefined, [
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Library', onPress: () => pickImage('library') },
        { text: 'Choose PDF File', onPress: () => pickPdf() },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }, [pickImage, pickPdf]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!filePath) return false;
    if (!name.trim()) return false;
    return true;
  }, [saving, filePath, name]);

  const handleSave = useCallback(async () => {
    if (!canSave || !resolvedVehicleId) return;
    setSaving(true);
    try {
      if (isEditing && documentId) {
        const fields: Partial<Record<string, string | undefined>> = {
          name: name.trim(),
          type: docType,
          notes: notes.trim() || undefined,
          expirationDate: expirationEnabled ? expirationDate : undefined,
        };
        await updateDocument(
          documentId,
          fields,
          fileChanged ? filePath : undefined,
          vehicleName
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useToastStore.getState().show('Document updated');
      } else {
        await addDocument(
          {
            vehicleId: resolvedVehicleId,
            name: name.trim(),
            type: docType,
            filePath: filePath!,
            expirationDate: expirationEnabled ? expirationDate : undefined,
            notes: notes.trim() || undefined,
          },
          vehicleName
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        useToastStore.getState().show('Document saved');
      }
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog(
        "Couldn't Save Document",
        msg || 'Check your entries and try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    resolvedVehicleId,
    isEditing,
    documentId,
    name,
    docType,
    filePath,
    fileChanged,
    expirationEnabled,
    expirationDate,
    notes,
  ]);

  const handleDelete = useCallback(() => {
    if (!documentId) return;
    showDialog('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(documentId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          useToastStore.getState().show('Document deleted');
          router.back();
        },
      },
    ]);
  }, [documentId, deleteDocument, router]);

  const handleCancel = useCallback(() => {
    if (isDirty.current) {
      showDialog('Discard Changes?', 'You have unsaved changes.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [router]);

  const handleShareFile = useCallback(async () => {
    if (!filePath) return;
    try {
      await Sharing.shareAsync(filePath, {
        dialogTitle: 'Save Document',
      });
    } catch {
      showDialog('Share Failed', 'Could not share this file.');
    }
  }, [filePath]);

  const renderFilePreview = () => {
    if (!filePath) {
      return (
        <Pressable
          onPress={handleFilePress}
          className="w-full h-48 rounded-xl bg-surface dark:bg-surface-dark border-2 border-dashed border-divider dark:border-divider-dark items-center justify-center mb-4"
          accessibilityLabel="Attach a document file"
          accessibilityRole="button"
        >
          <Ionicons name="document-attach-outline" size={40} color="#A8A49D" />
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mt-2">
            Tap to attach a photo or PDF
          </Text>
        </Pressable>
      );
    }

    if (fileMissing) {
      return (
        <Pressable
          onPress={handleFilePress}
          className="w-full h-48 rounded-xl bg-surface dark:bg-surface-dark border-2 border-dashed border-divider dark:border-divider-dark items-center justify-center mb-4"
          accessibilityLabel="File unavailable, tap to re-attach"
          accessibilityRole="button"
        >
          <Ionicons name="alert-circle-outline" size={40} color="#F59E0B" />
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mt-2 text-center px-4">
            File unavailable — tap to re-attach
          </Text>
        </Pressable>
      );
    }

    if (isDocumentPdf(filePath)) {
      return (
        <View className="mb-4">
          <Pressable
            onPress={isEditing ? handleShareFile : handleFilePress}
            className="w-full h-48 rounded-xl bg-surface dark:bg-surface-dark border border-divider dark:border-divider-dark items-center justify-center"
            accessibilityLabel={isEditing ? 'Export PDF' : 'Replace PDF'}
            accessibilityRole="button"
          >
            <Ionicons name="document-text" size={48} color="#EF4444" />
            <Text
              className="text-sm text-ink-secondary dark:text-ink-secondary-on-dark mt-2 px-4"
              numberOfLines={1}
            >
              {getFileName(filePath)}
            </Text>
          </Pressable>
          {isEditing && (
            <View className="flex-row gap-3 mt-2 justify-end">
              <Pressable
                onPress={handleShareFile}
                className="flex-row items-center px-3 py-1.5"
                accessibilityLabel="Export PDF to another app"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name="download-outline" size={16} color="#4272C4" />
                <Text className="text-sm text-primary font-semibold ml-1.5">Export</Text>
              </Pressable>
              <Pressable
                onPress={handleFilePress}
                className="flex-row items-center px-3 py-1.5"
                accessibilityLabel="Replace PDF file"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#4272C4" />
                <Text className="text-sm text-primary font-semibold ml-1.5">Replace</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }

    if (!isEditing) {
      return (
        <Pressable
          onPress={handleFilePress}
          className="w-full rounded-xl overflow-hidden bg-surface dark:bg-surface-dark border border-divider dark:border-divider-dark mb-4"
          style={{ height: 192 }}
          accessibilityLabel="Tap to change photo"
          accessibilityRole="button"
        >
          <Image
            source={{ uri: filePath }}
            style={{ width: '100%', height: 192 }}
            resizeMode="cover"
          />
        </Pressable>
      );
    }

    return (
      <View className="mb-4">
        <Pressable
          onPress={() => setViewerVisible(true)}
          className="w-full rounded-xl overflow-hidden bg-surface dark:bg-surface-dark border border-divider dark:border-divider-dark"
          style={{ height: 192 }}
          accessibilityLabel="View full photo"
          accessibilityRole="imagebutton"
        >
          <Image
            source={{ uri: filePath }}
            style={{ width: '100%', height: 192 }}
            resizeMode="cover"
          />
        </Pressable>
        <View className="flex-row gap-3 mt-2 justify-end">
          <Pressable
            onPress={handleShareFile}
            className="flex-row items-center px-3 py-1.5"
            accessibilityLabel="Export photo to another app"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="download-outline" size={16} color="#4272C4" />
            <Text className="text-sm text-primary font-semibold ml-1.5">Export</Text>
          </Pressable>
          <Pressable
            onPress={handleFilePress}
            className="flex-row items-center px-3 py-1.5"
            accessibilityLabel="Replace photo"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#4272C4" />
            <Text className="text-sm text-primary font-semibold ml-1.5">Replace</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={isEditing ? 'Edit Document' : 'Add Document'}
        onCancel={handleCancel}
        onSave={handleSave}
        saveDisabled={!canSave}
        isSaving={saving}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {renderFilePreview()}

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Name *
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g., Insurance Card"
                placeholderTextColor="#A8A49D"
                maxLength={50}
                accessibilityLabel="Document name"
              />
            </View>
          </View>

          <ChipPicker
            items={DOCUMENT_TYPES}
            selectedIds={[docType]}
            onSelectionChange={handleTypeChange}
            multiSelect={false}
            label="Type"
          />

          <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base text-ink dark:text-ink-on-dark">Expiration Date</Text>
            </View>
            <Switch
              value={expirationEnabled}
              onValueChange={(v) => {
                setExpirationEnabled(v);
                markDirty();
              }}
              trackColor={{
                false: isDark ? '#2A2926' : '#E2E0DB',
                true: isDark ? '#2E5A9E' : '#A7C4E4',
              }}
              thumbColor={expirationEnabled ? '#4272C4' : isDark ? '#1A1917' : '#FEFDFB'}
              accessibilityLabel="Toggle expiration date"
            />
          </View>

          {expirationEnabled && (
            <DateField
              value={expirationDate}
              onChange={(v) => {
                setExpirationDate(v);
                markDirty();
              }}
              label="Expires On"
              minDate={new Date()}
              maxDate={new Date(2100, 0, 1)}
              required={false}
            />
          )}

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              Notes
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={notes}
                onChangeText={(t) => {
                  setNotes(t.slice(0, 500));
                  markDirty();
                }}
                placeholder="Optional notes"
                placeholderTextColor="#A8A49D"
                multiline
                numberOfLines={3}
                maxLength={500}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
                accessibilityLabel="Document notes"
              />
            </View>
          </View>

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="mt-4 mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel="Delete document"
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">Delete Document</Text>
            </Pressable>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog {...dialogProps} />

      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View className="flex-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            <View className="flex-row items-center justify-between px-4 py-3">
              <Pressable
                onPress={() => setViewerVisible(false)}
                className="p-2"
                accessibilityLabel="Close viewer"
                accessibilityRole="button"
                hitSlop={12}
              >
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setViewerVisible(false);
                  handleShareFile();
                }}
                className="p-2"
                accessibilityLabel="Save photo"
                accessibilityRole="button"
                hitSlop={12}
              >
                <Ionicons name="download-outline" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View className="flex-1 items-center justify-center px-2">
              {filePath && !isDocumentPdf(filePath) && (
                <Image
                  source={{ uri: filePath }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
