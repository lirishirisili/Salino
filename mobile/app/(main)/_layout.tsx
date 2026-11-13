import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { usePastePreviewStore } from '../../src/hooks/usePastePreviewStore';
import { MainAdBannerHost } from '../../src/components/ads';
import { initLevelPlay, isLevelPlayReady } from '../../src/services/initLevelPlay';
import { logScreenView } from '../../src/services/initMobileAnalytics';
import { registerInterstitialUser } from '../../src/services/interstitialAd';
import { getAdsConfig, loadAdsConfig } from '../../src/services/adsConfig';
import { hydratePremium, isPremiumNow } from '../../src/services/premium';
import { initPremiumPurchases } from '../../src/services/premiumPurchases';
import { requestFeatureUse } from '../../src/services/featureUnlock';

/** Ads start only for non-premium users and while the remote kill switch is on. */
async function startAds(): Promise<void> {
  await Promise.all([loadAdsConfig(), hydratePremium()]);
  if (isPremiumNow() || !getAdsConfig().adsEnabled) return;
  await initLevelPlay();
}
import { TourController } from '../../src/components/tour/TourProvider';
import { useTourStore } from '../../src/features/tour';
import {
  useHouseholdStore,
  useShoppingStore,
  useNotificationStore,
} from '../../src/hooks';
import {
  bootstrapNotificationInfrastructure,
  getNotificationPermissionGranted,
  requestPermissionAndRegister,
} from '../../src/services/notificationService';
import { flush as flushSyncQueue } from '../../src/services/syncQueueProcessor';
import { rememberSessionHousehold, rememberSessionUser } from '../../src/session/sessionRestore';
import { auth } from '../../src/remote/firebase';

export const unstable_settings = {
  initialRouteName: 'shopping-list',
};

/** Never let a stuck notification prompt / FCM call block ads init. */
const NOTIFICATION_PROMPT_TIMEOUT_MS = 20_000;

export default function MainLayout() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const subscribeHousehold = useHouseholdStore((s) => s.subscribe);
  const subscribeShopping = useShoppingStore((s) => s.subscribe);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);
  const setPermissionGranted = useNotificationStore((s) => s.setPermissionGranted);
  const tourBootstrapStatus = useTourStore((s) => s.bootstrapStatus);
  const permissionRequestedRef = useRef(false);
  const adsInitAllowedRef = useRef(false);

  // Incremented when the app returns to foreground so the subscription effect
  // tears down stale Firestore listeners and re-registers fresh ones — mirrors
  // native ProcessLifecycleOwner ON_START → forceRefreshSync().
  const [foregroundKey, setForegroundKey] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        next === 'active' &&
        appStateRef.current.match(/inactive|background/)
      ) {
        setForegroundKey((k) => k + 1);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  // A list shared into the app (WhatsApp → Share → Haserli) opens the preview
  // once the user is in a home — even if the share arrived before sign-in.
  const pendingShare = usePastePreviewStore((s) => s.pendingShare);
  useEffect(() => {
    if (!pendingShare || !activeHouseholdId) return;
    // Let the stack finish mounting on a cold start before pushing over it.
    const timer = setTimeout(() => {
      if (!usePastePreviewStore.getState().consumePendingShare()) return;
      // A shared photo counts as a "photo to list" use (free first, then an ad).
      const gate = usePastePreviewStore.getState().image
        ? requestFeatureUse('photo_list')
        : Promise.resolve(true);
      void gate.then(() => router.push('/(main)/paste-preview'));
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingShare, activeHouseholdId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !activeHouseholdId) return;
    void rememberSessionUser(uid).then(() => rememberSessionHousehold(activeHouseholdId));
  }, [activeHouseholdId]);

  useEffect(() => {
    if (!activeHouseholdId) return;
    // The activity feed listener is intentionally NOT started here; it is
    // subscribed only while the activity screen is mounted to keep it off the
    // cold-start critical path.
    // Flush any pending offline ops on foreground / re-subscribe.
    flushSyncQueue(activeHouseholdId).catch(() => {});

    const unsubs = [
      subscribeHousehold(activeHouseholdId),
      subscribeShopping(activeHouseholdId),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activeHouseholdId, foregroundKey]);

  // Channel + listeners only — never show the OS permission dialog here.
  useEffect(() => {
    void bootstrapNotificationInfrastructure();
    void loadPreferences();
    // Reflect current OS permission immediately (before any prompt).
    void getNotificationPermissionGranted().then(setPermissionGranted);
  }, [loadPreferences, setPermissionGranted]);

  // Ask for notification permission only after the post-login tour has settled
  // (completed previously, finished/skipped, or disabled).
  useEffect(() => {
    if (tourBootstrapStatus !== 'done' || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    let cancelled = false;
    (async () => {
      // OS permission only — FCM register failures must not clear the UI flag.
      const granted = await Promise.race([
        requestPermissionAndRegister(),
        new Promise<boolean>((r) => setTimeout(() => r(false), NOTIFICATION_PROMPT_TIMEOUT_MS)),
      ]);
      if (!cancelled) setPermissionGranted(granted);
      // Ads consent (UMP → ATT) only after the notification prompt so system
      // dialogs never stack on top of each other.
      adsInitAllowedRef.current = true;
      void startAds();
    })();
    return () => {
      cancelled = true;
    };
  }, [tourBootstrapStatus, setPermissionGranted]);

  // Retry a failed / consent-blocked ads init when the app returns to foreground.
  useEffect(() => {
    if (foregroundKey === 0 || !adsInitAllowedRef.current || isLevelPlayReady()) return;
    void startAds();
  }, [foregroundKey]);

  // Starts the interstitial grace-period clock on first reach of the main stack.
  useEffect(() => {
    void registerInterstitialUser();
    void loadAdsConfig();
    void hydratePremium();
    void initPremiumPurchases();
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    logScreenView(pathname.replace(/^\//, '') || 'shopping-list');
  }, [pathname]);

  return (
    <MainAdBannerHost>
      <TourController />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          // Match Kotlin NavHost defaults (fade), not horizontal slide.
          animation: 'fade',
        }}
      >
        <Stack.Screen name="shopping-list" />
        <Stack.Screen name="add-item" options={{ animation: 'fade' }} />
        <Stack.Screen name="edit-item" />
        <Stack.Screen name="history" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="supermarket-mode" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="create-temporary-home" />
        <Stack.Screen name="recurring-items" />
        <Stack.Screen name="paste-preview" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="smart-list" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="insights" />
      </Stack>
    </MainAdBannerHost>
  );
}
