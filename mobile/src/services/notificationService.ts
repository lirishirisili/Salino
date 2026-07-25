import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { auth } from '../remote/firebase';
import {
  firestoreAddFcmToken,
  firestoreRemoveFcmToken,
  firestoreSetUserLanguage,
} from '../remote/firestoreService';
import i18n from '../i18n';

/** Android channel id. Must match the channelId set by the Cloud Functions sender. */
export const NOTIFICATION_CHANNEL_ID = 'shopping_updates';

let currentToken: string | null = null;
let foregroundUnsub: (() => void) | null = null;
let tokenRefreshUnsub: (() => void) | null = null;
let openedAppUnsub: (() => void) | null = null;
let responseSub: Notifications.Subscription | null = null;
let infrastructureReady = false;

// Show notifications while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const isSupportedPlatform = (): boolean => Platform.OS === 'android' || Platform.OS === 'ios';

async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: i18n.t('notification_channel_shopping_updates'),
    description: i18n.t('notification_channel_shopping_updates_desc'),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Requests notification permission. Returns true if granted (or provisional on iOS).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isSupportedPlatform()) return false;
  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted && settings.canAskAgain) {
    const request = await Notifications.requestPermissionsAsync();
    granted =
      request.granted ||
      request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  return granted;
}

async function registerToken(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  if (Platform.OS === 'ios') {
    await messaging().registerDeviceForRemoteMessages().catch(() => undefined);
  }

  const token = await messaging().getToken();
  if (!token) return;
  currentToken = token;
  await firestoreAddFcmToken(uid, token);
  // Keep the user's language in sync so server-side notifications are localized.
  await firestoreSetUserLanguage(uid, i18n.language || 'en').catch(() => undefined);
}

function attachListeners(): void {
  if (!tokenRefreshUnsub) {
    tokenRefreshUnsub = messaging().onTokenRefresh(async (token) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !token) return;
      currentToken = token;
      await firestoreAddFcmToken(uid, token).catch(() => undefined);
    });
  }

  if (!foregroundUnsub) {
    foregroundUnsub = messaging().onMessage(async (remoteMessage) => {
      const notif = remoteMessage.notification;
      if (!notif) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title ?? '',
          body: notif.body ?? '',
          data: (remoteMessage.data ?? {}) as Record<string, unknown>,
        },
        trigger: null,
      });
    });
  }

  if (!openedAppUnsub) {
    openedAppUnsub = messaging().onNotificationOpenedApp(() => {
      navigateToList();
    });
  }

  if (!responseSub) {
    responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      navigateToList();
    });
  }
}

/**
 * Sets up the Android channel and push/tap listeners without requesting
 * notification permission. Safe to call early (e.g. main layout mount).
 */
export async function bootstrapNotificationInfrastructure(): Promise<void> {
  if (!isSupportedPlatform() || infrastructureReady) return;

  try {
    await setupNotificationChannel();
    attachListeners();
    infrastructureReady = true;
  } catch (e) {
    if (__DEV__) console.warn('[notifications] infrastructure bootstrap failed', e);
  }
}

/**
 * Requests permission and registers the FCM token. Call only after the
 * post-login tour has settled so the OS dialog does not interrupt onboarding.
 */
export async function requestPermissionAndRegister(): Promise<boolean> {
  if (!isSupportedPlatform()) return false;

  try {
    await bootstrapNotificationInfrastructure();

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    await registerToken();
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[notifications] permission/register failed', e);
    return false;
  }
}

/**
 * Full notification bootstrap: infrastructure + permission + token.
 * Prefer `bootstrapNotificationInfrastructure` + deferred
 * `requestPermissionAndRegister` for post-login flows.
 */
export async function initializeNotifications(): Promise<boolean> {
  await bootstrapNotificationInfrastructure();
  return requestPermissionAndRegister();
}

function navigateToList(): void {
  try {
    // navigate (not push) — avoid stacking another shopping-list copy.
    router.navigate('/(main)/shopping-list');
  } catch {
    // Navigation may not be ready yet; ignore.
  }
}

/**
 * Removes the current device token from the signed-in user's profile and tears
 * down listeners. Call before signing out.
 */
export async function unregisterNotifications(): Promise<void> {
  if (!isSupportedPlatform()) return;
  try {
    const uid = auth.currentUser?.uid;
    const token = currentToken ?? (await messaging().getToken().catch(() => null));
    if (uid && token) {
      await firestoreRemoveFcmToken(uid, token).catch(() => undefined);
    }
    await messaging().deleteToken().catch(() => undefined);
  } finally {
    currentToken = null;
    infrastructureReady = false;
    foregroundUnsub?.();
    foregroundUnsub = null;
    tokenRefreshUnsub?.();
    tokenRefreshUnsub = null;
    openedAppUnsub?.();
    openedAppUnsub = null;
    responseSub?.remove();
    responseSub = null;
  }
}
