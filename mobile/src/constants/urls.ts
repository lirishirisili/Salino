import Constants from 'expo-constants';

export const APP_SCHEME = 'haserli';

const extra = Constants.expoConfig?.extra as
  | {
      appLinkHost?: string;
      appLinkBaseUrl?: string;
      androidStoreUrl?: string;
      iosStoreUrl?: string;
    }
  | undefined;

export const PLAY_STORE_URL =
  extra?.androidStoreUrl?.trim() ||
  'https://play.google.com/store/apps/details?id=com.salino.sali&hl=he';

export const APP_STORE_URL =
  extra?.iosStoreUrl?.trim() ||
  'https://apps.apple.com/il/app/%D7%97%D7%A1%D7%A8%D7%9C%D7%99-%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%A7%D7%A0%D7%99%D7%95%D7%AA/id6768352555?l=he';

export const getAppLinkBaseUrl = (): string | null => {
  const extraBaseUrl = extra?.appLinkBaseUrl?.trim();
  if (extraBaseUrl) return extraBaseUrl;

  const extraHost = extra?.appLinkHost?.trim();
  if (extraHost) return `https://${extraHost}`;

  return 'https://hsr.lirshir.com';
};

const buildSharedUrl = (path: string): string => {
  const baseUrl = getAppLinkBaseUrl();
  if (baseUrl) return `${baseUrl}${path}`;
  return `${APP_SCHEME}://${path.replace(/^\//, '')}`;
};

export const buildInviteUrl = (code: string): string =>
  buildSharedUrl(`/join/${encodeURIComponent(code.trim().toUpperCase())}`);
