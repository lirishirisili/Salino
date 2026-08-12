import { useEffect } from 'react';
import * as ExpoLinking from 'expo-linking';
import { useInviteDeepLinkStore } from './useInviteDeepLinkStore';
import { parseInviteCodeFromUrl } from '../utils/parseInviteDeepLink';

export function useInviteDeepLinkListener(): void {
  const setPendingInviteCode = useInviteDeepLinkStore((s) => s.setPendingInviteCode);

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      const code = parseInviteCodeFromUrl(url);
      if (code) {
        setPendingInviteCode(code);
      }
    };

    void ExpoLinking.getInitialURL().then(handleUrl).catch(() => {});
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [setPendingInviteCode]);
}
