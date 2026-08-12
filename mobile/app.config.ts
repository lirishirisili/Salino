import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_LINK_HOST = 'hsr.lirshir.com';
const APP_LINK_BASE_URL = `https://${APP_LINK_HOST}`;
const ANDROID_PACKAGE = 'com.salino.sali';
const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.salino.sali&hl=he';
const IOS_STORE_URL =
  'https://apps.apple.com/il/app/%D7%97%D7%A1%D7%A8%D7%9C%D7%99-%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%A7%D7%A0%D7%99%D7%95%D7%AA/id6768352555?l=he';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = config as ExpoConfig;
  return {
    ...baseConfig,
    ios: {
      ...baseConfig.ios,
      associatedDomains: Array.from(
        new Set([...(baseConfig.ios?.associatedDomains ?? []), `applinks:${APP_LINK_HOST}`])
      ),
    },
    android: {
      ...baseConfig.android,
      intentFilters: [
        ...((baseConfig.android?.intentFilters as NonNullable<ExpoConfig['android']>['intentFilters']) ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: APP_LINK_HOST,
              pathPrefix: '/join',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: {
      ...baseConfig.extra,
      appLinkHost: APP_LINK_HOST,
      appLinkBaseUrl: APP_LINK_BASE_URL,
      androidStoreUrl: ANDROID_STORE_URL,
      iosStoreUrl: IOS_STORE_URL,
      androidPackage: ANDROID_PACKAGE,
    },
  };
};
