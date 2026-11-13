jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map<string, string>();
  return {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore.set(k, v);
    }),
  };
});
jest.mock('../adsConfig', () => ({
  loadAdsConfig: jest.fn(async () => undefined),
  getAdsConfig: () => ({ rewarded: { freePerDay: { photo_list: 1, smart_list: 1, forgotten_items: 1, insights: 1 } } }),
}));
jest.mock('../initMobileAnalytics', () => ({ logAdEvent: jest.fn() }));
jest.mock('../premium', () => ({ isPremiumNow: jest.fn(() => false) }));
jest.mock('../initLevelPlay', () => ({ subscribeLevelPlayReady: jest.fn(() => () => undefined) }));
jest.mock('../interstitialAd', () => ({
  isInterstitialLoaded: jest.fn(() => false),
  preloadGateInterstitial: jest.fn(),
  showGateInterstitial: jest.fn(async () => true),
}));

import { requestFeatureUse } from '../featureUnlock';
import * as interstitial from '../interstitialAd';
import * as premium from '../premium';

const mocked = (fn: unknown) => fn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mocked(interstitial.isInterstitialLoaded).mockReturnValue(false);
  mocked(premium.isPremiumNow).mockReturnValue(false);
});

it('first use of the day is free and preloads the gate ad', async () => {
  mocked(interstitial.isInterstitialLoaded).mockReturnValue(true);
  expect(await requestFeatureUse('photo_list')).toBe(true);
  expect(interstitial.showGateInterstitial).not.toHaveBeenCalled();
  expect(interstitial.preloadGateInterstitial).toHaveBeenCalled();
});

it('past the free use, the ad plays right away (no dialog) and the feature runs', async () => {
  mocked(interstitial.isInterstitialLoaded).mockReturnValue(true);
  expect(await requestFeatureUse('photo_list')).toBe(true);
  expect(interstitial.showGateInterstitial).toHaveBeenCalledTimes(1);
  expect(interstitial.preloadGateInterstitial).toHaveBeenCalled();
});

it('with no ad loaded the user goes through and an ad is preloaded', async () => {
  expect(await requestFeatureUse('photo_list')).toBe(true);
  expect(interstitial.showGateInterstitial).not.toHaveBeenCalled();
  expect(interstitial.preloadGateInterstitial).toHaveBeenCalled();
});

it('premium users never see the gate ad', async () => {
  mocked(premium.isPremiumNow).mockReturnValue(true);
  mocked(interstitial.isInterstitialLoaded).mockReturnValue(true);
  expect(await requestFeatureUse('smart_list')).toBe(true);
  expect(await requestFeatureUse('smart_list')).toBe(true);
  expect(interstitial.showGateInterstitial).not.toHaveBeenCalled();
});
