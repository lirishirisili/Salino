// Expo config plugin: Appodeal Android mediation (banner only, no AdMob).
// Replaces withLevelPlayAndroid. Meta Audience Network via Appodeal :meta adapter.
// Dependencies match docs.appodeal.com Configure Mediated Networks (AdMob unchecked).

const {
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APPODEAL_MARKER = '// @appodeal-deps (managed by withAppodealAndroid.js)';
const APPODEAL_REPO_MARKER = '// @appodeal-repo (managed by withAppodealAndroid.js)';
const APPODEAL_EXCLUDE_MARKER =
  '// @appodeal-exclude-admob (managed by withAppodealAndroid.js)';
const APPODEAL_PROGUARD_MARKER =
  '# @appodeal-proguard (managed by withAppodealAndroid.js)';
const NETWORK_SECURITY_MARKER =
  '<!-- @appodeal-network-security (managed by withAppodealAndroid.js) -->';

// Same mediation-only, no-AdMob set as native app/ (Appodeal SDK 4.3.0 wizard).
const APPODEAL_DEPENDENCIES = [
  "implementation 'com.appodeal.ads.sdk:core:4.3.0'",
  "implementation 'io.bidmachine:ads.networks.amazon:12.0.0.0'",
  "implementation 'io.bidmachine:ads.networks.meta_audience:6.21.0.1'",
  "implementation 'io.bidmachine:ads.networks.mintegral:17.1.61.1'",
  "implementation 'io.bidmachine:ads.networks.my_target:5.47.1.2'",
  "implementation 'io.bidmachine:ads.networks.vungle:7.7.4.0'",
  "implementation 'com.applovin.mediation:amazon-tam-adapter:11.3.1.0'",
  "implementation 'com.applovin.mediation:bidmachine-adapter:3.7.1.0'",
  "implementation 'com.applovin.mediation:bigoads-adapter:5.9.0.0'",
  "implementation 'com.applovin.mediation:bytedance-adapter:8.1.0.3.0'",
  "implementation 'com.applovin.mediation:chartboost-adapter:9.10.2.0'",
  "implementation 'com.applovin.mediation:facebook-adapter:6.21.0.0'",
  "implementation 'com.applovin.mediation:fyber-adapter:8.4.6.0'",
  "implementation 'com.applovin.mediation:inmobi-adapter:11.3.0.1'",
  "implementation 'com.applovin.mediation:ironsource-adapter:9.4.4.0.0'",
  "implementation 'com.applovin.mediation:mintegral-adapter:17.1.61.0'",
  "implementation 'com.applovin.mediation:mobilefuse-adapter:1.11.0.0'",
  "implementation 'com.applovin.mediation:moloco-adapter:4.3.1.0'",
  "implementation 'com.applovin.mediation:ogury-presage-adapter:6.2.0.0'",
  "implementation 'com.applovin.mediation:pubmatic-adapter:4.10.0.0'",
  "implementation 'com.applovin.mediation:smaato-adapter:22.7.2.3'",
  "implementation 'com.applovin.mediation:unityads-adapter:4.17.0.0'",
  "implementation 'com.applovin.mediation:verve-adapter:3.7.1.0'",
  "implementation 'com.applovin.mediation:vungle-adapter:7.7.4.0'",
  "implementation 'com.applovin.mediation:yandex-adapter:7.17.0.0'",
  "implementation 'org.bidon:amazon-adapter:12.0.0.0'",
  "implementation 'org.bidon:applovin-adapter:13.6.3.0'",
  "implementation 'org.bidon:bidmachine-adapter:3.7.1.1'",
  "implementation 'org.bidon:bigoads-adapter:5.9.0.0'",
  "implementation 'org.bidon:chartboost-adapter:9.10.2.0'",
  "implementation 'org.bidon:dtexchange-adapter:8.4.6.0'",
  "implementation 'org.bidon:inmobi-adapter:11.3.0.0'",
  "implementation 'org.bidon:ironsource-adapter:9.4.4.0'",
  "implementation 'org.bidon:meta-adapter:6.21.0.0'",
  "implementation 'org.bidon:mintegral-adapter:17.1.61.0'",
  "implementation 'org.bidon:mobilefuse-adapter:1.11.0.0'",
  "implementation 'org.bidon:moloco-adapter:4.3.1.0'",
  "implementation 'org.bidon:startio-adapter:5.2.4.1'",
  "implementation 'org.bidon:taurusx-adapter:1.12.2.0'",
  "implementation 'org.bidon:unityads-adapter:4.17.0.0'",
  "implementation 'org.bidon:vkads-adapter:5.47.1.0'",
  "implementation 'org.bidon:vungle-adapter:7.7.4.0'",
  "implementation 'org.bidon:yandex-adapter:7.17.0.0'",
  "implementation 'org.bidon:zmaticoo-adapter:2.0.7.0.0'",
  "implementation 'com.unity3d.ads-mediation:applovin-adapter:5.8.0'",
  "implementation 'com.unity3d.ads-mediation:bidmachine-adapter:5.7.0'",
  "implementation 'com.unity3d.ads-mediation:bigo-adapter:5.8.0'",
  "implementation 'com.unity3d.ads-mediation:facebook-adapter:5.3.0'",
  "implementation 'com.unity3d.ads-mediation:fyber-adapter:5.9.0'",
  "implementation 'com.unity3d.ads-mediation:inmobi-adapter:5.7.0'",
  "implementation 'com.unity3d.ads-mediation:mintegral-adapter:5.18.0'",
  "implementation 'com.unity3d.ads-mediation:mobilefuse-adapter:5.3.0'",
  "implementation 'com.unity3d.ads-mediation:moloco-adapter:5.6.0'",
  "implementation 'com.unity3d.ads-mediation:mytarget-adapter:5.5.0'",
  "implementation 'com.unity3d.ads-mediation:ogury-adapter:5.2.0'",
  "implementation 'com.unity3d.ads-mediation:pangle-adapter:5.18.0'",
  "implementation 'com.unity3d.ads-mediation:unityads-adapter:5.6.0'",
  "implementation 'com.unity3d.ads-mediation:verve-adapter:5.2.0'",
  "implementation 'com.unity3d.ads-mediation:vungle-adapter:5.10.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:amazon:12.0.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:applovin:13.6.3.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:applovin_max:13.6.3.1'",
  "implementation 'com.appodeal.ads.sdk.adapters:appsflyer:6.18.0.1'",
  "implementation 'com.appodeal.ads.sdk.adapters:bidmachine:3.7.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:bidon:0.14.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:bigo_ads:5.9.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:chartboost:9.10.2.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:dt_exchange:8.4.6.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:facebook_analytics:18.3.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:iab:1.8.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:inmobi:11.3.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:ironsource:9.4.4.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:level_play:9.4.4.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:meta:6.21.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:mintegral:17.1.61.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:mobilefuse:1.11.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:moloco:4.3.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:my_target:5.47.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:ogury:6.2.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:pubmatic:4.10.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:sentry_analytics:8.44.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:smaato:22.7.2.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:startio:5.2.4.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:taurusx:1.12.2.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:unity_ads:4.17.0.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:verve:3.7.1.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:vungle:7.7.4.0'",
  "implementation 'com.appodeal.ads.sdk.adapters:yandex:7.17.0.0'",
  "implementation 'com.google.android.gms:play-services-appset:16.0.2'",
  "implementation 'com.google.android.gms:play-services-ads-identifier:18.0.1'",
  "implementation 'com.google.android.gms:play-services-basement:18.3.0'",
];

const APPODEAL_PROGUARD_RULES = [
  '-keep class com.appodeal.** { *; }',
  '-keep class com.explorestack.** { *; }',
  '-keep class com.applovin.** { *; }',
  '-keep class io.bidmachine.** { *; }',
  '-keep class org.bidon.** { *; }',
  '-keep class com.facebook.ads.** { *; }',
  '-dontwarn com.appodeal.**',
  '-dontwarn com.explorestack.**',
  '-dontwarn com.facebook.ads.internal.**',
  '-keeppackagenames com.facebook.*',
];

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    ${NETWORK_SECURITY_MARKER}
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const LEVELPLAY_MARKERS = [
  '// @levelplay-unityads-adapter (managed by withLevelPlayAndroid.js)',
  '// @levelplay-meta-adapter (managed by withLevelPlayAndroid.js)',
  '// @levelplay-play-services (managed by withLevelPlayAndroid.js)',
  '// LevelPlay Play Services dependencies',
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMarkedGradleBlocks(contents) {
  let next = contents;
  for (const marker of LEVELPLAY_MARKERS) {
    const markerLine = `    ${marker}`;
    const blockRegex = new RegExp(
      `${escapeRegex(markerLine)}\\n(?:    implementation '[^']+'\\n)+`,
    );
    next = next.replace(blockRegex, '');
  }
  return next;
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
  const dependenciesBlock = /\ndependencies\s*\{/;
  if (!dependenciesBlock.test(contents)) {
    throw new Error(
      "withAppodealAndroid: could not find a top-level 'dependencies {' block in app/build.gradle",
    );
  }
  return contents.replace(
    dependenciesBlock,
    (match) => `${match}\n\n${depBlock}\n`,
  );
}

function ensureAdMobExcludes(contents) {
  if (contents.includes(APPODEAL_EXCLUDE_MARKER)) {
    return contents;
  }
  const block = `
${APPODEAL_EXCLUDE_MARKER}
configurations.configureEach {
    exclude group: 'com.appodeal.ads.sdk.adapters', module: 'admob'
    exclude group: 'com.appodeal.ads.sdk.networks', module: 'admob'
    exclude group: 'com.google.android.gms', module: 'play-services-ads'
    exclude group: 'com.applovin.mediation', module: 'google-adapter'
    exclude group: 'com.applovin.mediation', module: 'google-ad-manager-adapter'
    exclude group: 'com.unity3d.ads-mediation', module: 'admob-adapter'
    resolutionStrategy {
        force 'org.jetbrains.kotlin:kotlin-stdlib:2.1.20'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.1.20'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.1.20'
        force 'org.jetbrains.kotlin:kotlin-stdlib-common:2.1.20'
    }
}
`;
  return `${contents.trimEnd()}\n${block}\n`;
}

function ensureAppodealRepo(contents) {
  if (contents.includes(APPODEAL_REPO_MARKER)) {
    return contents;
  }
  const repoLine = `    ${APPODEAL_REPO_MARKER}\n    maven { url 'https://artifactory.appodeal.com/appodeal' }`;
  if (/allprojects\s*\{\s*repositories\s*\{/.test(contents)) {
    return contents.replace(
      /(allprojects\s*\{\s*repositories\s*\{)/,
      `$1\n${repoLine}`,
    );
  }
  return `${contents.trimEnd()}

allprojects {
  repositories {
${repoLine}
  }
}
`;
}

function upsertProguardRules(contents) {
  let next = contents.replace(
    /# @levelplay-meta-proguard[\s\S]*?(?=\n# |\n*$)/,
    '',
  );
  if (next.includes(APPODEAL_PROGUARD_MARKER)) {
    return next;
  }
  const block = ['', APPODEAL_PROGUARD_MARKER, ...APPODEAL_PROGUARD_RULES].join(
    '\n',
  );
  return `${next.trimEnd()}\n${block}\n`;
}

function ensureAndroidManifest(manifest) {
  const mainApplication =
    AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  mainApplication.$['android:networkSecurityConfig'] =
    '@xml/network_security_config';
  AndroidConfig.Permissions.ensurePermissions(manifest, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'com.google.android.gms.permission.AD_ID',
  ]);
  // Do NOT add com.google.android.gms.ads.APPLICATION_ID (AdMob excluded).
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
  return manifest;
}

function withAppodealAndroid(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureAndroidManifest(cfg.modResults);
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = ensureAppodealRepo(cfg.modResults.contents);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withAppodealAndroid: expected groovy build.gradle, received ${cfg.modResults.language}`,
      );
    }
    let contents = removeMarkedGradleBlocks(cfg.modResults.contents);
    contents = syncGradleDeps(contents, APPODEAL_MARKER, APPODEAL_DEPENDENCIES);
    contents = ensureAdMobExcludes(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const proguardPath = path.join(root, 'app', 'proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        const proguard = fs.readFileSync(proguardPath, 'utf8');
        fs.writeFileSync(proguardPath, upsertProguardRules(proguard));
      }
      const xmlDir = path.join(root, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_XML,
      );
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAppodealAndroid;
