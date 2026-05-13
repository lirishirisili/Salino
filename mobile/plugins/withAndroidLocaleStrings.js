// Expo config plugin that writes localized strings.xml files under
// android/app/src/main/res/values-<locale>/ so that Android picks up the
// correct app_name for each system language. Mirrors the same setup used in
// the native Android project at /app/src/main/res/values-*/strings.xml.
//
// Usage in app.json:
//   "plugins": [
//     ...,
//     ["./plugins/withAndroidLocaleStrings", {
//       "default": "Haserli",
//       "translations": { "iw": "חסרלי", "ar": "حصرلي", ... }
//     }]
//   ]

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildStringsXml(appName) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<resources>\n' +
    `    <string name="app_name">${escapeXml(appName)}</string>\n` +
    '</resources>\n'
  );
}

// Android still expects "values-iw" (deprecated ISO code) instead of "values-he"
// for Hebrew. Same for Indonesian (in -> id) and Yiddish (ji -> yi). Map them.
function localeToValuesDir(locale) {
  const legacyMap = { he: 'iw', id: 'in', yi: 'ji' };
  const lowered = String(locale).toLowerCase();
  const mapped = legacyMap[lowered] ?? lowered;
  return `values-${mapped}`;
}

function withAndroidLocaleStrings(config, props = {}) {
  const translations = props.translations || {};

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );

      for (const [locale, appName] of Object.entries(translations)) {
        const dir = path.join(resPath, localeToValuesDir(locale));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'strings.xml'), buildStringsXml(appName), 'utf8');
      }

      return cfg;
    },
  ]);
}

module.exports = withAndroidLocaleStrings;
