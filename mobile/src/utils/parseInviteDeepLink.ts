import * as ExpoLinking from 'expo-linking';
import { APP_SCHEME } from '../constants/urls';

export const parseInviteCodeFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  const parsed = ExpoLinking.parse(url);
  const segments = [parsed.hostname, ...(parsed.path?.split('/') ?? [])]
    .map((segment) => segment?.trim())
    .filter(Boolean) as string[];

  const [first, second] = segments;
  if (first === 'join' && second) {
    return decodeURIComponent(second).trim().toUpperCase();
  }

  if (parsed.scheme === APP_SCHEME && parsed.hostname === 'join' && parsed.path) {
    const code = parsed.path.replace(/^\//, '').split('/')[0];
    return code ? decodeURIComponent(code).trim().toUpperCase() : null;
  }

  return null;
};
