import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { usePastePreviewStore } from './usePastePreviewStore';
import { prepareImageForAi } from './usePhotoList';

/** Shared text longer than this is cut (the AI worker accepts 4,000 chars). */
const MAX_SHARED_CHARS = 4_000;

/**
 * Text or a photo shared into Haserli (WhatsApp / Gallery → Share → Haserli) is
 * parked in the paste-preview store. Navigation happens in the (main) layout, so a share that
 * arrives before sign-in waits until the user is in their list.
 *
 * Mounted once in the root layout. iOS has no share extension yet (needs an App
 * Group + extension provisioning), so the native module is only used on Android.
 */
export function useIncomingShare(): void {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    disabled: Platform.OS !== 'android',
    resetOnBackground: true,
  });

  useEffect(() => {
    if (!hasShareIntent) return;
    // A shared photo (handwritten note, chat screenshot, recipe) → "photo to list".
    const image = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
    if (image?.path) {
      const uri = image.path.includes('://') ? image.path : `file://${image.path}`;
      prepareImageForAi(uri, image.width, image.height)
        .then((prepared) => usePastePreviewStore.getState().openImage(prepared, true))
        .catch((e) => console.warn('[SHARE] image failed', e));
      resetShareIntent();
      return;
    }
    const text = (shareIntent.text ?? shareIntent.webUrl ?? '').trim();
    if (text) {
      usePastePreviewStore.getState().open(text.slice(0, MAX_SHARED_CHARS), 'share');
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);
}
