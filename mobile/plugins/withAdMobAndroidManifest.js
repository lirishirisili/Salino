const { withAndroidManifest } = require('@expo/config-plugins');

const APP_ID = 'ca-app-pub-1194823418071986~13363777409';

/**
 * Keeps AdMob manifest fixes after `expo prebuild --clean` (merge + disable auto-init).
 */
function withAdMobAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = {
      ...manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    const application = manifest.application?.[0];
    if (!application) return config;

    application['meta-data'] = application['meta-data'] ?? [];
    const appIdMeta = application['meta-data'].find(
      (m) => m.$?.['android:name'] === 'com.google.android.gms.ads.APPLICATION_ID',
    );
    if (appIdMeta) {
      appIdMeta.$['android:value'] = APP_ID;
      appIdMeta.$['tools:replace'] = 'android:value';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.ads.APPLICATION_ID',
          'android:value': APP_ID,
          'tools:replace': 'android:value',
        },
      });
    }

    application.provider = application.provider ?? [];
    const hasInitProvider = application.provider.some(
      (p) => p.$?.['android:name'] === 'com.google.android.gms.ads.MobileAdsInitProvider',
    );
    if (!hasInitProvider) {
      application.provider.push({
        $: {
          'android:name': 'com.google.android.gms.ads.MobileAdsInitProvider',
          'android:authorities': '${applicationId}.mobileadsinitprovider',
          'android:exported': 'false',
          'tools:node': 'remove',
        },
      });
    }

    return config;
  });
}

module.exports = withAdMobAndroidManifest;
