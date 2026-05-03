import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths, Directory } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import type { LocalPhoto } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useDialog } from '../hooks/useDialog';
import { t } from '@/src/i18n';

interface EventPhotosProps {
  eventId: string | null;
  photos: LocalPhoto[];
  onPhotosChange: (photos: LocalPhoto[]) => void;
}

const PHOTO_DIR = 'event-photos';

function ensurePhotoDirectory(): void {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) {
    dir.create();
  }
}

export function EventPhotos({ eventId, photos, onPhotosChange }: EventPhotosProps) {
  const [previewPhoto, setPreviewPhoto] = useState<LocalPhoto | null>(null);
  const { showDialog, dialogProps } = useDialog();

  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      };

      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showDialog(
            t('photos.permissionTitle'),
            t('photos.cameraPermissionMessage')
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filename = `${Crypto.randomUUID()}.${ext}`;

      ensurePhotoDirectory();

      const sourceFile = new File(asset.uri);
      const destFile = new File(Paths.document, `${PHOTO_DIR}/${filename}`);
      sourceFile.copy(destFile);

      const newPhoto: LocalPhoto = {
        uri: destFile.uri,
        isNew: true,
      };
      onPhotosChange([...photos, newPhoto]);
    },
    [photos, onPhotosChange]
  );

  const handleAddPress = useCallback(() => {
    const options = [t('photos.takePhoto'), t('photos.chooseFromLibrary'), t('common.cancel')];
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
        }
      );
    } else {
      showDialog(t('photos.addPhotoSheetTitle'), undefined, [
        { text: t('photos.takePhoto'), onPress: () => pickImage('camera') },
        { text: t('photos.chooseFromLibrary'), onPress: () => pickImage('library') },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  }, [pickImage]);

  const handleDeletePhoto = useCallback(
    (photo: LocalPhoto) => {
      showDialog(t('photos.deleteConfirmTitle'), t('photos.deleteConfirmMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (photo.isNew) {
              try {
                const file = new File(photo.uri);
                if (file.exists) {
                  file.delete();
                }
              } catch {
                // Best effort cleanup
              }
            }
            onPhotosChange(photos.filter((p) => p.uri !== photo.uri));
            setPreviewPhoto(null);
          },
        },
      ]);
    },
    [photos, onPhotosChange]
  );

  return (
    <View className="mb-4">
      <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark mb-1.5 font-semibold">
        {t('photos.label')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {photos.map((photo, index) => (
          <Pressable
            key={photo.id ?? photo.uri}
            onPress={() => setPreviewPhoto(photo)}
            accessibilityLabel={t('photos.photoNumberA11y', { n: index + 1 })}
            accessibilityRole="button"
          >
            <Image
              source={{ uri: photo.uri }}
              className="w-[80px] h-[80px] rounded-xl"
              resizeMode="cover"
              accessible={false}
            />
          </Pressable>
        ))}

        <Pressable
          onPress={handleAddPress}
          className="w-[80px] h-[80px] rounded-xl border-2 border-dashed border-divider dark:border-divider-dark items-center justify-center bg-surface dark:bg-surface-dark"
          accessibilityLabel={t('photos.addA11y')}
          accessibilityRole="button"
        >
          <Ionicons name="camera-outline" size={24} color="#A8A49D" />
          <Text className="text-[10px] text-ink-faint dark:text-ink-faint-on-dark mt-0.5">
            {t('photos.addLabel')}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Full-screen photo preview modal */}
      <Modal
        visible={previewPhoto !== null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#0E0E0C' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable
              onPress={() => setPreviewPhoto(null)}
              accessibilityLabel={t('photos.previewCloseA11y')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color="#F5F4F1" />
            </Pressable>
            <Text className="text-white text-base font-semibold">{t('photos.previewTitle')}</Text>
            <View className="w-7" />
          </View>

          {/* Image */}
          <View className="flex-1 items-center justify-center">
            {previewPhoto && (
              <Image
                source={{ uri: previewPhoto.uri }}
                className="w-full h-full"
                resizeMode="contain"
                accessibilityLabel={t('photos.previewFullscreenA11y')}
              />
            )}
          </View>

          {/* Delete button */}
          <View className="px-4 pb-4">
            <Pressable
              onPress={() => {
                if (previewPhoto) handleDeletePhoto(previewPhoto);
              }}
              className="bg-destructive rounded-xl py-3.5 items-center"
              accessibilityLabel={t('photos.deletePhotoA11y')}
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold text-base">
                {t('photos.deletePhoto')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}
