// Expo config plugin that overrides android/gradle.properties values after prebuild.
//
// Why this exists:
//  - `expo prebuild` regenerates `android/gradle.properties` from a template, wiping
//    any manual tweaks. We need a few non-default values to survive:
//      1. Larger JVM heap & Metaspace, otherwise Kotlin/KSP/Lint workers crash with
//         OutOfMemoryError on this codebase (expo-modules-core lint, expo-updates KSP).
//      2. Build for arm64-v8a (modern physical devices) plus x86_64 (x86_64
//         emulators/players such as LDPlayer). x86_64 is required so the native
//         libreactnative.so is present; otherwise the app crashes at
//         MainApplication.onCreate with SoLoaderDSONotFoundError. We still skip
//         x86 and armeabi-v7a to keep the artifact small.
//
// Usage in app.json:
//   "plugins": [..., "./plugins/withGradlePropsTweaks"]
//
// All overrides are idempotent: each line is added if missing or replaced if present.

const { withGradleProperties } = require('@expo/config-plugins');

const OVERRIDES = [
  {
    type: 'property',
    key: 'org.gradle.jvmargs',
    value: '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  },
  {
    type: 'property',
    key: 'kotlin.daemon.jvmargs',
    value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
  },
  {
    type: 'property',
    key: 'reactNativeArchitectures',
    value: 'arm64-v8a,x86_64',
  },
  // Google Play (from Aug 31, 2026): updates must target API 36 (Android 16).
  {
    type: 'property',
    key: 'android.compileSdkVersion',
    value: '36',
  },
  {
    type: 'property',
    key: 'android.targetSdkVersion',
    value: '36',
  },
  {
    type: 'property',
    key: 'android.buildToolsVersion',
    value: '36.0.0',
  },
];

function withGradlePropsTweaks(config) {
  return withGradleProperties(config, (cfg) => {
    const items = cfg.modResults;

    for (const override of OVERRIDES) {
      const idx = items.findIndex(
        (item) => item.type === 'property' && item.key === override.key
      );
      if (idx >= 0) {
        items[idx] = { ...items[idx], value: override.value };
      } else {
        items.push(override);
      }
    }

    return cfg;
  });
}

module.exports = withGradlePropsTweaks;
