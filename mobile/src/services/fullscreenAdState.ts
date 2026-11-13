/**
 * Shared "a full-screen ad (interstitial or rewarded) covers the app" flag, so
 * the bottom banner pauses refresh and two full-screen ads never overlap.
 */

let showing = false;
const subscribers = new Set<(showing: boolean) => void>();

export function isFullscreenAdShowing(): boolean {
  return showing;
}

export function setFullscreenAdShowing(next: boolean): void {
  if (showing === next) return;
  showing = next;
  subscribers.forEach((cb) => {
    try {
      cb(next);
    } catch {
      // Ignore subscriber errors.
    }
  });
}

/** Notified while a full-screen ad covers the app (the banner pauses refresh). */
export function subscribeFullscreenAd(cb: (showing: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
