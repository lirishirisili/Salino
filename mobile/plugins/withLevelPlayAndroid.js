// Expo config plugin: Play Services IDs + Unity Ads adapter for LevelPlay.
 // Banner mediation path matches PoofCam / Tohav (no Direct Unity Ads).

const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLAY_SERVICES_MARKER =
  '// @levelplay-play-services (managed by withLevelPlayAndroid.js)';
const UNITY_ADAPTER_MARKER =
  '// @levelplay-unityads-adapter (managed by withLevelPlayAndroid.js)';
const LEGACY_MARKER = '// LevelPlay Play Services dependencies';
const IOS_POD_MARKER = '# @levelplay-unityads-adapter (managed by withLevelPlayAndroid.js)';
// Must match IronSourceSDK 9.x from unity-levelplay-mediation 9.2.0.
const IOS_POD = "pod 'IronSourceUnityAdsAdapter', '5.9.0.0'";

const PLAY_SERVICES_DEPENDENCIES = [
  "implementation 'com.google.android.gms:play-services-appset:16.0.2'",
  "implementation 'com.google.android.gms:play-services-ads-identifier:18.0.1'",
  "implementation 'com.google.android.gms:play-services-basement:18.3.0'",
];

const UNITY_ADS_ADAPTER_DEPENDENCIES = [
  "implementation 'com.unity3d.ads-mediation:unityads-adapter:5.5.0'",
  "implementation 'com.unity3d.ads:unity-ads:4.16.6'",
];

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

function withLevelPlayAndroid(config) {
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
    }
    contents = insertGradleDeps(
      contents,
      UNITY_ADAPTER_MARKER,
      UNITY_ADS_ADAPTER_DEPENDENCIES,
    );
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes(IOS_POD_MARKER)) {
        podfile = podfile.replace(/pod 'IronSourceUnityAdsAdapter',\s*'[^']+'/, IOS_POD);
        fs.writeFileSync(podfilePath, podfile);
        return cfg;
      }
      const targetMatch = podfile.match(/target ['"]Haserli['"] do/);
      if (!targetMatch || targetMatch.index == null) {
        // Podfile may not exist yet during early prebuild; skip quietly.
        return cfg;
      }
      const insertAt = targetMatch.index + targetMatch[0].length;
      const snippet = `\n  ${IOS_POD_MARKER}\n  ${IOS_POD}`;
      podfile = podfile.slice(0, insertAt) + snippet + podfile.slice(insertAt);
      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);

  return config;
}

module.exports = withLevelPlayAndroid;
