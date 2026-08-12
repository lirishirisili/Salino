import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useInviteDeepLinkStore } from '../../src/hooks';

function normalizeInviteCode(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.trim()) return null;
  return decodeURIComponent(raw).trim().toUpperCase();
}

export default function JoinInviteDeepLinkScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string | string[] }>();
  const setPendingInviteCode = useInviteDeepLinkStore((s) => s.setPendingInviteCode);

  useEffect(() => {
    const code = normalizeInviteCode(inviteCode);
    if (code) {
      setPendingInviteCode(code);
    }
  }, [inviteCode, setPendingInviteCode]);

  return <Redirect href="/" />;
}
