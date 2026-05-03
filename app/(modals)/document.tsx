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
import { t, type TranslationKey } from '@/src/i18n';

const DOC_DIR = 'vehicle-documents';

function getDocumentTypes(): { id: VehicleDocumentType; name: string }[] {
  return [
    { id: 'insurance', name: t('documentModal.typeInsurance') },
    { id: 'registration', name: t('documentModal.typeRegistration') },
    { id: 'title', name: t('documentModal.typeTitle') },
    { id: 'emissions', name: t('documentModal.typeEmissions') },
    { id: 'inspection', name: t('documentModal.typeInspection') },
    { id: 'other', name: t('documentModal.typeOther') },
  ];
}

const TYPE_NAME_KEYS: Record<VehicleDocumentType, TranslationKey | null> = {
  insurance: 'documentModal.namePrefillInsurance',
  registration: 'documentModal.namePrefillRegistration',
  title: 'documentModal.namePrefillTitle',
  emissions: 'documentModal.namePrefillEmissions',
  inspection: 'documentModal.namePrefillInspection',
  other: null,
};

function isDocumentPdf(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf');
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() ?? t('documentModal.fallbackFileName');
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
  const vehicleName = activeVehicle?.nickname ?? t('documentModal.yourVehicleFallback');
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
        const prefillKey = TYPE_NAME_KEYS[newType];
        if (prefillKey) {
          setName(t(prefillKey));
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
          showDialog(t('documentModal.permissionTitle'), t('documentModal.cameraPermissionMessage'));
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
    const options = [t('documentModal.takePhoto'), t('documentModal.chooseFromLibrary'), t('documentModal.choosePdf'), t('common.cancel')];
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
      showDialog(t('documentModal.attachSheetTitle'), undefined, [
        { text: t('documentModal.takePhoto'), onPress: () => pickImage('camera') },
        { text: t('documentModal.chooseFromLibrary'), onPress: () => pickImage('library') },
        { text: t('documentModal.choosePdf'), onPress: () => pickPdf() },
        { text: t('common.cancel'), style: 'cancel' as const },
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
        useToastStore.getState().show(t('documentModal.updatedToast'));
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
        useToastStore.getState().show(t('documentModal.savedToast'));
      }
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showDialog(
        t('documentModal.saveErrorTitle'),
        msg || t('documentModal.saveErrorMessage')
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
    showDialog(t('documentModal.deleteDocument'), t('documentModal.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(documentId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          useToastStore.getState().show(t('documentModal.deletedToast'));
          router.back();
        },
      },
    ]);
  }, [documentId, deleteDocument, router]);

  const handleCancel = useCallback(() => {
    if (isDirty.current) {
      showDialog(t('eventForm.discardTitle'), t('eventForm.discardMessage'), [
        { text: t('eventForm.keepEditing'), style: 'cancel' },
        { text: t('eventForm.discard'), style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [router]);

  const handleShareFile = useCallback(async () => {
    if (!filePath) return;
    try {
      await Sharing.shareAsync(filePath, {
        dialogTitle: t('documentModal.saveDialogTitle'),
      });
    } catch {
      showDialog(t('documentModal.shareFailedTitle'), t('documentModal.shareFailedMessage'));
    }
  }, [filePath]);

  const renderFilePreview = () => {
    if (!filePath) {
      return (
        <Pressable
          onPress={handleFilePress}
          className="w-full h-48 rounded-xl bg-surface dark:bg-surface-dark border-2 border-dashed border-divider dark:border-divider-dark items-center justify-center mb-4"
          accessibilityLabel={t('documentModal.attachA11y')}
          accessibilityRole="button"
        >
          <Ionicons name="document-attach-outline" size={40} color="#A8A49D" />
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mt-2">
            {t('documentModal.tapToAttach')}
          </Text>
        </Pressable>
      );
    }

    if (fileMissing) {
      return (
        <Pressable
          onPress={handleFilePress}
          className="w-full h-48 rounded-xl bg-surface dark:bg-surface-dark border-2 border-dashed border-divider dark:border-divider-dark items-center justify-center mb-4"
          accessibilityLabel={t('documentModal.fileMissingA11y')}
          accessibilityRole="button"
        >
          <Ionicons name="alert-circle-outline" size={40} color="#F59E0B" />
          <Text className="text-sm text-ink-muted dark:text-ink-muted-on-dark mt-2 text-center px-4">
            {t('documentModal.fileMissingMessage')}
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
            accessibilityLabel={isEditing ? t('documentModal.exportPdfA11y') : t('documentModal.replacePdfA11y')}
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
                accessibilityLabel={t('documentModal.exportPdfBtnA11y')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name="download-outline" size={16} color="#4272C4" />
                <Text className="text-sm text-primary font-semibold ml-1.5">{t('documentModal.exportLabel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleFilePress}
                className="flex-row items-center px-3 py-1.5"
                accessibilityLabel={t('documentModal.replacePdfBtnA11y')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#4272C4" />
                <Text className="text-sm text-primary font-semibold ml-1.5">{t('documentModal.replaceLabel')}</Text>
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
          accessibilityLabel={t('documentModal.tapToChangePhoto')}
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
          accessibilityLabel={t('documentModal.viewFullPhoto')}
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
            accessibilityLabel={t('documentModal.exportPhotoA11y')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="download-outline" size={16} color="#4272C4" />
            <Text className="text-sm text-primary font-semibold ml-1.5">{t('documentModal.exportLabel')}</Text>
          </Pressable>
          <Pressable
            onPress={handleFilePress}
            className="flex-row items-center px-3 py-1.5"
            accessibilityLabel={t('documentModal.replacePhotoA11y')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#4272C4" />
            <Text className="text-sm text-primary font-semibold ml-1.5">{t('documentModal.replaceLabel')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={['top']}>
      <ModalHeader
        title={isEditing ? t('documentModal.editTitle') : t('documentModal.addTitle')}
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
              {t('documentModal.nameLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={name}
                onChangeText={handleNameChange}
                placeholder={t('documentModal.namePlaceholder')}
                placeholderTextColor="#A8A49D"
                maxLength={50}
                accessibilityLabel={t('documentModal.nameA11y')}
              />
            </View>
          </View>

          <ChipPicker
            items={getDocumentTypes()}
            selectedIds={[docType]}
            onSelectionChange={handleTypeChange}
            multiSelect={false}
            label={t('documentModal.typeLabel')}
          />

          <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3 mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base text-ink dark:text-ink-on-dark">{t('documentModal.expirationLabel')}</Text>
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
              accessibilityLabel={t('documentModal.expirationA11y')}
            />
          </View>

          {expirationEnabled && (
            <DateField
              value={expirationDate}
              onChange={(v) => {
                setExpirationDate(v);
                markDirty();
              }}
              label={t('documentModal.expiresOnLabel')}
              minDate={new Date()}
              maxDate={new Date(2100, 0, 1)}
              required={false}
            />
          )}

          <View className="mb-4">
            <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
              {t('documentModal.notesLabel')}
            </Text>
            <View className="bg-surface dark:bg-surface-dark rounded-xl border border-divider dark:border-divider-dark px-3.5 py-3">
              <TextInput
                className="text-base text-ink dark:text-ink-on-dark"
                value={notes}
                onChangeText={(text) => {
                  setNotes(text.slice(0, 500));
                  markDirty();
                }}
                placeholder={t('documentModal.notesPlaceholder')}
                placeholderTextColor="#A8A49D"
                multiline
                numberOfLines={3}
                maxLength={500}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
                accessibilityLabel={t('documentModal.notesA11y')}
              />
            </View>
          </View>

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="mt-4 mb-8 py-3 rounded-xl border border-destructive items-center"
              accessibilityLabel={t('documentModal.deleteDocumentA11y')}
              accessibilityRole="button"
            >
              <Text className="text-destructive font-semibold text-base">{t('documentModal.deleteDocument')}</Text>
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
                accessibilityLabel={t('documentModal.viewerCloseA11y')}
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
                accessibilityLabel={t('documentModal.viewerSaveA11y')}
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
