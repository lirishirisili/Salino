const LOG = '[HaserliUnityAds]';

/**
 * DEPRECATED — Direct Unity Ads is disabled.
 * Active monetization path: Haserli → LevelPlay → mediated networks (banner only).
 * Kept as a no-op so legacy imports cannot initialize the direct SDK.
 */
export function initUnityAds(): Promise<boolean> {
  console.warn(`${LOG} direct Unity Ads init disabled (LevelPlay is the active path)`);
  return Promise.resolve(false);
}
