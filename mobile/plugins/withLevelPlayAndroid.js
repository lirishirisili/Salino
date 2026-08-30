// Expo config plugin: Play Services IDs + Meta Audience Network + Unity Ads
// adapters for LevelPlay. Banner mediation only (no direct Meta / Unity Ads loads).
// Architecture matches PoofCam / Scent of Home.

const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLAY_SERVICES_DEPENDENCIES = [
  "implementation 'com.google.android.gms:play-services-appset:16.0.2'",
  "implementation 'com.google.android.gms:play-services-ads-identifier:18.0.1'",
  "implementation 'com.google.android.gms:play-services-basement:18.3.0'",
];

const META_ADAPTER_DEPENDENCIES = [
  "implementation 'com.unity3d.ads-mediation:facebook-adapter:5.4.0'",
  "implementation 'com.facebook.android:audience-network-sdk:6.22.0'",
];

const UNITY_ADS_ADAPTER_DEPENDENCIES = [
  "implementation 'com.unity3d.ads-mediation:unityads-adapter:5.12.0'",
  "implementation 'com.unity3d.ads:unity-ads:4.20.0'",
];

const PLAY_SERVICES_MARKER =
  '// @levelplay-play-services (managed by withLevelPlayAndroid.js)';
const META_ADAPTER_MARKER =
  '// @levelplay-meta-adapter (managed by withLevelPlayAndroid.js)';
const UNITY_ADAPTER_MARKER =
  '// @levelplay-unityads-adapter (managed by withLevelPlayAndroid.js)';
const LEGACY_MARKER = '// LevelPlay Play Services dependencies';
const META_PROGUARD_MARKER =
  '# @levelplay-meta-proguard (managed by withLevelPlayAndroid.js)';

const IOS_META_POD_MARKER =
  '# @levelplay-meta-adapter (managed by withLevelPlayAndroid.js)';
const IOS_UNITY_POD_MARKER =
  '# @levelplay-unityads-adapter (managed by withLevelPlayAndroid.js)';
const IOS_META_POD = "pod 'IronSourceFacebookAdapter', '5.4.0'";
// Must match IronSourceSDK 9.x from unity-levelplay-mediation 9.2.0.
const IOS_UNITY_POD = "pod 'IronSourceUnityAdsAdapter', '5.9.0.0'";

const META_PROGUARD_RULES = [
  '-dontwarn com.facebook.ads.internal.**',
  '-keeppackagenames com.facebook.*',
  '-keep public class com.facebook.ads.** {*;}',
];

const META_NETWORK_SECURITY_MARKER =
  '<!-- @levelplay-meta-network-security (managed by withLevelPlayAndroid.js) -->';
const META_NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    ${META_NETWORK_SECURITY_MARKER}
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>
`;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function syncGradleDeps(contents, marker, deps) {
  const markerLine = `    ${marker}`;
  const depBlock = [markerLine, ...deps.map((dep) => `    ${dep}`)].join('\n');
  const blockRegex = new RegExp(
    `${escapeRegex(markerLine)}\\n(?:    implementation '[^']+'\\n)+`,
  );
  if (blockRegex.test(contents)) {
    return contents.replace(blockRegex, `${depBlock}\n`);
  }
  return insertGradleDeps(contents, marker, deps);
}

function insertGradleDeps(contents, marker, deps) {
  if (contents.includes(marker)) {
    return contents;
  }
  const block = [
    '',
    `    ${marker}`,
    ...deps.map((dep) => `    ${dep}`),
  ].join('\n');
  const dependenciesBlock = /\ndependencies\s*\{/;
  if (!dependenciesBlock.test(contents)) {
    throw new Error(
      "withLevelPlayAndroid: could not find a top-level 'dependencies {' block in app/build.gradle",
    );
  }
  return contents.replace(dependenciesBlock, (match) => `${match}\n${block}`);
}

function upsertIosPod(podfile, marker, podLine) {
  if (podfile.includes(marker)) {
    const podName = podLine.match(/pod '([^']+)'/)?.[1];
    if (podName) {
      const podRegex = new RegExp(`pod '${podName}',\\s*'[^']+'`);
      return podfile.replace(podRegex, podLine);
    }
    return podfile;
  }
  const targetMatch = podfile.match(/target ['"]Haserli['"] do/);
  if (!targetMatch || targetMatch.index == null) {
    // Podfile may not exist yet during early prebuild; skip quietly.
    return podfile;
  }
  const insertAt = targetMatch.index + targetMatch[0].length;
  const snippet = `\n  ${marker}\n  ${podLine}`;
  return podfile.slice(0, insertAt) + snippet + podfile.slice(insertAt);
}

function upsertProguardRules(contents) {
  if (contents.includes(META_PROGUARD_MARKER)) {
    return contents;
  }
  const block = ['', META_PROGUARD_MARKER, ...META_PROGUARD_RULES].join('\n');
  return `${contents.trimEnd()}\n${block}\n`;
}

function ensureMetaAndroidManifest(manifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

  mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';

  AndroidConfig.Permissions.ensurePermissions(manifest, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'com.google.android.gms.permission.AD_ID',
  ]);

  // Survive clean prebuild: Firebase Messaging also declares this meta-data.
  const metaData = mainApplication['meta-data'];
  const metaList = metaData
    ? Array.isArray(metaData)
      ? metaData
      : [metaData]
    : [];
  for (const item of metaList) {
    if (
      item?.$?.['android:name'] ===
      'com.google.firebase.messaging.default_notification_color'
    ) {
      item.$['tools:replace'] = 'android:resource';
    }
  }

  // AudienceNetworkActivity is declared by audience-network-sdk; do not redeclare
  // it here (configChanges clash causes manifest merger failure).

  return manifest;
}

function upsertMetaNetworkSecurityConfig(platformRoot) {
  const xmlDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
  const xmlPath = path.join(xmlDir, 'network_security_config.xml');
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.writeFileSync(xmlPath, META_NETWORK_SECURITY_XML);
}

function withLevelPlayAndroid(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureMetaAndroidManifest(cfg.modResults);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withLevelPlayAndroid: expected groovy build.gradle, received ${cfg.modResults.language}`,
      );
    }
    let contents = cfg.modResults.contents;
    // Skip Play Services if already injected by this plugin or the legacy marker.
    if (
      !contents.includes(PLAY_SERVICES_MARKER) &&
      !contents.includes(LEGACY_MARKER)
    ) {
      contents = insertGradleDeps(
        contents,
        PLAY_SERVICES_MARKER,
        PLAY_SERVICES_DEPENDENCIES,
      );
    } else if (contents.includes(PLAY_SERVICES_MARKER)) {
      contents = syncGradleDeps(
        contents,
        PLAY_SERVICES_MARKER,
        PLAY_SERVICES_DEPENDENCIES,
      );
    }
    contents = syncGradleDeps(contents, META_ADAPTER_MARKER, META_ADAPTER_DEPENDENCIES);
    contents = syncGradleDeps(
      contents,
      UNITY_ADAPTER_MARKER,
      UNITY_ADS_ADAPTER_DEPENDENCIES,
    );
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      if (fs.existsSync(proguardPath)) {
        const proguard = fs.readFileSync(proguardPath, 'utf8');
        fs.writeFileSync(proguardPath, upsertProguardRules(proguard));
      }
      upsertMetaNetworkSecurityConfig(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      podfile = upsertIosPod(podfile, IOS_META_POD_MARKER, IOS_META_POD);
      podfile = upsertIosPod(podfile, IOS_UNITY_POD_MARKER, IOS_UNITY_POD);
      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);

  return config;
}

module.exports = withLevelPlayAndroid;
