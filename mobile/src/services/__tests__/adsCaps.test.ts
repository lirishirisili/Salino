jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('../../remote/firebase', () => ({ db: {} }));
jest.mock('unity-levelplay-mediation', () => ({ LevelPlayInterstitialAd: class {} }));
jest.mock('../initLevelPlay', () => ({ isLevelPlayReady: () => false }));
jest.mock('../initMobileAnalytics', () => ({ logAdEvent: jest.fn() }));
jest.mock('../premium', () => ({ isPremiumNow: () => false }));

import { DEFAULT_ADS_CONFIG, mergeAdsConfig } from '../adsConfig';
import { userCapBlock, type InterstitialStats } from '../interstitialAd';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;
const cfg = DEFAULT_ADS_CONFIG.interstitial;

const stats = (over: Partial<InterstitialStats> = {}): InterstitialStats => ({
  firstSeenAt: NOW - 10 * DAY,
  tripsCompleted: 5,
  lastShownAt: 0,
  recentShows: [],
  ...over,
});

describe('userCapBlock', () => {
  it('passes a settled user', () => {
    expect(userCapBlock(stats(), NOW, cfg)).toBeNull();
  });
  it('blocks during the grace period and before enough trips', () => {
    expect(userCapBlock(stats({ firstSeenAt: NOW - DAY }), NOW, cfg)).toBe('grace');
    expect(userCapBlock(stats({ tripsCompleted: 1 }), NOW, cfg)).toBe('trips');
  });
  it('keeps 6h between shows and at most 2 per 24h', () => {
    expect(userCapBlock(stats({ lastShownAt: NOW - 5 * HOUR }), NOW, cfg)).toBe('interval');
    expect(
      userCapBlock(stats({ lastShownAt: NOW - 7 * HOUR, recentShows: [NOW - 20 * HOUR, NOW - 7 * HOUR] }), NOW, cfg),
    ).toBe('daily');
    expect(
      userCapBlock(stats({ lastShownAt: NOW - 7 * HOUR, recentShows: [NOW - 30 * HOUR, NOW - 7 * HOUR] }), NOW, cfg),
    ).toBeNull();
  });
});

describe('mergeAdsConfig', () => {
  it('keeps defaults for missing or bad fields', () => {
    expect(mergeAdsConfig(null)).toEqual(DEFAULT_ADS_CONFIG);
    const merged = mergeAdsConfig({ interstitial: { maxPerDay: 'lots', placements: { paste_done: false } } });
    expect(merged.interstitial.maxPerDay).toBe(cfg.maxPerDay);
    expect(merged.interstitial.placements).toEqual({ ...cfg.placements, paste_done: false });
  });
  it('clamps dangerous values', () => {
    const merged = mergeAdsConfig({ interstitial: { minIntervalMs: 1000, maxPerDay: 99 } });
    expect(merged.interstitial.minIntervalMs).toBe(30 * 60 * 1000);
    expect(merged.interstitial.maxPerDay).toBe(10);
  });
  it('reads remote free quotas and switches', () => {
    const merged = mergeAdsConfig({ adsEnabled: false, rewarded: { freePerDay: { photo_list: 3 } }, nativeListEnd: false });
    expect(merged.adsEnabled).toBe(false);
    expect(merged.rewarded.freePerDay.photo_list).toBe(3);
    expect(merged.rewarded.freePerDay.smart_list).toBe(1);
    expect(merged.nativeListEnd).toBe(false);
  });
});
