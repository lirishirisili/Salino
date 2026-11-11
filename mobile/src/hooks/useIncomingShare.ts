import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { usePastePreviewStore } from './usePastePreviewStore';

/** Shared text longer than this is cut (the AI worker accepts 4,000 chars). */
const MAX_SHARED_CHARS = 4_000;

/**
 * Text shared into Haserli (WhatsApp → Share → Haserli) is parked in the
 * paste-preview store. Navigation happens in the (main) layout, so a share that
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
    const text = (shareIntent.text ?? shareIntent.webUrl ?? '').trim();
    if (text) {
      usePastePreviewStore.getState().open(text.slice(0, MAX_SHARED_CHARS), 'share');
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);
}
