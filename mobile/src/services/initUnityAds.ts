const LOG = '[HaserliUnityAds]';

/**
 * DEPRECATED — Direct Unity Ads is disabled.
 * Active monetization path: Haserli → Appodeal → mediated networks (banner only).
 * Kept as a no-op so legacy imports cannot initialize the direct SDK.
 */
export function initUnityAds(): Promise<boolean> {
  console.warn(`${LOG} direct Unity Ads init disabled (Appodeal is the active path)`);
  return Promise.resolve(false);
}
