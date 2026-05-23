// Patches ios/Podfile after `expo prebuild` so Firebase Swift pods work with static linking.
//
// CocoaPods error without this:
//   FirebaseCoreInternal depends upon GoogleUtilities, which does not define modules.
//
// Fix: https://github.com/invertase/react-native-firebase/issues/6332
//      https://github.com/expo/expo/issues/39607

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULAR_HEADERS = 'use_modular_headers!';
const ANCHOR = 'prepare_react_native_project!';

function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(MODULAR_HEADERS)) {
        if (contents.includes(ANCHOR)) {
          contents = contents.replace(ANCHOR, `${ANCHOR}\n\n${MODULAR_HEADERS}`);
        } else {
          contents = contents.replace(
            /(platform :ios[^\n]*\n)/,
            `$1\n${MODULAR_HEADERS}\n`
          );
        }
        fs.writeFileSync(podfilePath, contents);
      }

      return cfg;
    },
  ]);
}

module.exports = withIosModularHeaders;
