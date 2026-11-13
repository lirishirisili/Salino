import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { requestFeatureUse } from '../services/featureUnlock';
import { usePastePreviewStore, type PreviewImage } from './usePastePreviewStore';

/** Longest side sent to the AI: enough for handwriting, small enough to upload fast. */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.6;

type PickFrom = 'camera' | 'library';

/**
 * Shrinks a photo to MAX_SIDE (JPEG) and returns it as base64 for the AI worker.
 * Width / height are read from the image when the caller doesn't know them.
 */
export async function prepareImageForAi(
  uri: string,
  width?: number | null,
  height?: number | null,
): Promise<PreviewImage> {
  let w = width ?? 0;
  let h = height ?? 0;
  if (!w || !h) {
    const probe = await manipulateAsync(uri, []);
    w = probe.width;
    h = probe.height;
  }
  const resize = Math.max(w, h) > MAX_SIDE ? [{ resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const small = await manipulateAsync(uri, resize, { compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!small.base64) throw new Error('no base64');
  return { base64: small.base64, mimeType: 'image/jpeg', uri: small.uri };
}

async function pick(from: PickFrom): Promise<ImagePicker.ImagePickerAsset | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync(options);
    return res.canceled ? null : (res.assets[0] ?? null);
  }
  const res = await ImagePicker.launchImageLibraryAsync(options);
  return res.canceled ? null : (res.assets[0] ?? null);
}

/**
 * "Photo → list": pick / shoot a photo, shrink it, pass the free-use / rewarded
 * gate, then open the paste preview which sends it to the AI worker.
 * The gate runs AFTER picking so backing out of the camera doesn't burn a use.
 */
export function usePhotoList() {
  const { t } = useTranslation();
  const openImage = usePastePreviewStore((s) => s.openImage);

  const run = useCallback(
    async (from: PickFrom) => {
      try {
        const asset = await pick(from);
        if (!asset) return;
        const image = await prepareImageForAi(asset.uri, asset.width, asset.height);
        if (!(await requestFeatureUse('photo_list'))) return;
        openImage(image);
        router.push('/(main)/paste-preview');
      } catch (e) {
        console.warn('[PHOTO_LIST] failed', e);
        Alert.alert('', t('error_generic'));
      }
    },
    [openImage, t],
  );

  /** Asks camera vs. gallery, then runs the flow. */
  return useCallback(() => {
    Alert.alert(t('photo_list_title'), t('photo_list_pick_body'), [
      { text: t('photo_list_camera'), onPress: () => void run('camera') },
      { text: t('photo_list_gallery'), onPress: () => void run('library') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }, [run, t]);
}
