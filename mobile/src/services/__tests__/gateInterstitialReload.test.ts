jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('../adsConfig', () => ({
  getAdsConfig: () => ({ adsEnabled: true, interstitial: { placements: {} } }),
}));
jest.mock('../initLevelPlay', () => ({ isLevelPlayReady: () => true }));
jest.mock('../initMobileAnalytics', () => ({ logAdEvent: jest.fn() }));
jest.mock('../premium', () => ({ isPremiumNow: () => false }));
jest.mock('../../config/levelPlay', () => ({
  LEVELPLAY_INTERSTITIAL_AD_UNIT_ID: 'unit',
  LEVELPLAY_PLACEMENTS: {
    tripEndInterstitial: 'trip_end',
    pasteDoneInterstitial: 'paste_done',
    tripHomeCreatedInterstitial: 'trip_home_created',
    aiGateInterstitial: 'ai_gate',
  },
}));
jest.mock('unity-levelplay-mediation', () => {
  const mockState = {
    listener: null as any,
    loadAd: jest.fn(async () => undefined),
    showAd: jest.fn(async (_placement: string) => undefined),
  };
  class LevelPlayInterstitialAd {
    static mockState = mockState;
    static isPlacementCapped = jest.fn(async () => false);
    setListener(l: unknown) {
      mockState.listener = l;
    }
    loadAd() {
      return mockState.loadAd();
    }
    showAd(p: string) {
      return mockState.showAd(p);
    }
    isAdReady() {
      return Promise.resolve(true);
    }
  }
  return { LevelPlayInterstitialAd };
});

import { LevelPlayInterstitialAd } from 'unity-levelplay-mediation';
import { isInterstitialLoaded, preloadGateInterstitial, showGateInterstitial } from '../interstitialAd';

const sdk = (LevelPlayInterstitialAd as unknown as { mockState: any }).mockState;
const info = { adNetwork: 'test' };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('reloads after every show and retries a failed load', async () => {
  preloadGateInterstitial();
  expect(sdk.loadAd).toHaveBeenCalledTimes(1);

  // No fill → retried after 30s instead of waiting for the next tap.
  sdk.listener.onAdLoadFailed({ errorCode: 509, errorMessage: 'no fill' });
  jest.advanceTimersByTime(30_000);
  expect(sdk.loadAd).toHaveBeenCalledTimes(2);

  sdk.listener.onAdLoaded(info);
  expect(isInterstitialLoaded()).toBe(true);

  const shown = showGateInterstitial();
  await jest.advanceTimersByTimeAsync(0);
  sdk.listener.onAdDisplayed(info);
  sdk.listener.onAdClosed(info);
  expect(await shown).toBe(true);

  // Next ad is requested right after the close.
  jest.advanceTimersByTime(1_000);
  expect(sdk.loadAd).toHaveBeenCalledTimes(3);
  sdk.listener.onAdLoaded(info);
  expect(isInterstitialLoaded()).toBe(true);
});

it('a load the SDK never answers stops blocking new loads', () => {
  const before = sdk.loadAd.mock.calls.length;
  // Simulate the slot being free, then a hung load.
  sdk.listener.onAdClosed?.(info);
  jest.advanceTimersByTime(1_000);
  const afterReload = sdk.loadAd.mock.calls.length;
  expect(afterReload).toBeGreaterThan(before);
  preloadGateInterstitial(); // still "loading" → ignored
  expect(sdk.loadAd.mock.calls.length).toBe(afterReload);
  jest.advanceTimersByTime(46_000);
  preloadGateInterstitial(); // stale → a new load goes out
  expect(sdk.loadAd.mock.calls.length).toBe(afterReload + 1);
});
