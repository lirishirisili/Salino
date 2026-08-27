import fs from 'fs';
import path from 'path';

jest.mock('expo-splash-screen', () => ({
  hide: jest.fn(),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

describe('boot splash invariants', () => {
  it('BootSplashView stays free of i18n, Paper, and Skia', () => {
    const src = fs.readFileSync(path.join(__dirname, '../BootSplashView.tsx'), 'utf8');
    expect(src).not.toMatch(/react-i18next/);
    expect(src).not.toMatch(/react-native-paper/);
    expect(src).not.toMatch(/react-native-skia/);
    expect(src).not.toMatch(/useTranslation/);
  });

  it('hideNativeSplash calls the sync native hide', () => {
    const SplashScreen = require('expo-splash-screen');
    const { hideNativeSplash } = require('../hideNativeSplash');
    hideNativeSplash();
    expect(SplashScreen.hide).toHaveBeenCalled();
  });
});
