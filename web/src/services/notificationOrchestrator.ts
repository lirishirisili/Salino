import { useEffect } from 'react';
import { subscribeToActivity } from './firestoreService';
import type { ActivityType, ImportantEvent, User } from '../types';
import type { StringKey } from '../i18n';
import { normalizeNotificationPrefs } from './notificationPrefs';

const DEFAULT_IMPORTANT_EVENTS: ActivityType[] = ['ITEM_ADDED'];
const IMPORTANT_EVENT_ACTIVITY: Record<ImportantEvent, ActivityType> = {
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_BOUGHT: 'ITEM_BOUGHT',
  ITEM_UPDATED: 'ITEM_UPDATED',
  ITEM_DELETED: 'ITEM_DELETED',
};

function getTimestamp(value: Date | null): number {
  return value ? value.getTime() : 0;
}

function getStorageKey(userId: string, householdId: string, suffix: string): string {
  return `salino_notifications_${suffix}_${userId}_${householdId}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useActivityNotifications(
  user: User | null,
  t: (key: StringKey, ...args: (string | number)[]) => string
) {
  useEffect(() => {
    if (!user?.activeHouseholdId) return;
    if (typeof Notification === 'undefined') return;

    const householdId = user.activeHouseholdId;
    const prefs = normalizeNotificationPrefs(user.notificationPrefs);
    if (!prefs || prefs.mode === 'SILENT') return;

    const importantEvents = (prefs.importantEvents?.length > 0 ? prefs.importantEvents : DEFAULT_IMPORTANT_EVENTS)
      .map((event) => IMPORTANT_EVENT_ACTIVITY[event as ImportantEvent] ?? 'ITEM_ADDED');
    const lastProcessedKey = getStorageKey(user.id, householdId, 'last_processed_at');
    const digestStateKey = getStorageKey(user.id, householdId, 'digest_state');
    const rateLimitKey = getStorageKey(user.id, householdId, 'rate_limit');

    let initialized = false;

    return subscribeToActivity(householdId, (logs) => {
      const sorted = [...logs].sort((a, b) => getTimestamp(a.createdAt) - getTimestamp(b.createdAt));
      if (sorted.length === 0) return;

      const newestTimestamp = getTimestamp(sorted[sorted.length - 1].createdAt);
      let lastProcessedAt = Number(localStorage.getItem(lastProcessedKey) || 0);
      if (!initialized && lastProcessedAt === 0) {
        // Avoid notifying historical events on first attach.
        localStorage.setItem(lastProcessedKey, String(newestTimestamp));
        initialized = true;
        return;
      }
      initialized = true;

      const freshLogs = sorted.filter((log) => {
        const createdAt = getTimestamp(log.createdAt);
        return createdAt > lastProcessedAt && log.actorUserId !== user.id;
      });
      if (freshLogs.length === 0) {
        return;
      }

      const digestState = safeParse<{ byType: Partial<Record<ActivityType, number>>; total: number }>(
        localStorage.getItem(digestStateKey),
        { byType: {}, total: 0 }
      );

      for (const log of freshLogs) {
        digestState.total += 1;
        digestState.byType[log.type] = (digestState.byType[log.type] ?? 0) + 1;
      }
      localStorage.setItem(digestStateKey, JSON.stringify(digestState));

      if (Notification.permission === 'granted' && prefs.mode === 'IMMEDIATE_IMPORTANT') {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const rateData = safeParse<{ sentAt: number[] }>(localStorage.getItem(rateLimitKey), { sentAt: [] });
        rateData.sentAt = rateData.sentAt.filter((ts) => ts > oneHourAgo);

        for (const log of freshLogs) {
          if (!importantEvents.includes(log.type)) continue;
          if (rateData.sentAt.length >= prefs.maxImmediatePerHour) break;
          const { titleKey, bodyKey } = getNotificationKeys(log.type);
          new Notification(t(titleKey), {
            body: t(bodyKey, log.itemName || t('shopping_list_active_section')),
            tag: `item-added-${log.id}`,
          });
          rateData.sentAt.push(Date.now());
        }

        localStorage.setItem(rateLimitKey, JSON.stringify(rateData));
      }

      if (Notification.permission === 'granted' && (prefs.mode === 'DAILY_DIGEST' || prefs.mode === 'WEEKLY_DIGEST')) {
        const digestLastSentKey = getStorageKey(user.id, householdId, 'digest_last_sent_at');
        const lastDigestSentAt = Number(localStorage.getItem(digestLastSentKey) || 0);
        const intervalMs = prefs.mode === 'DAILY_DIGEST' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        const canSendDigest = Date.now() - lastDigestSentAt >= intervalMs;

        if (canSendDigest && digestState.total > 0) {
          const itemAddedCount = digestState.byType.ITEM_ADDED ?? 0;
          const otherCount = Math.max(0, digestState.total - itemAddedCount);
          const bodyParts: string[] = [];
          if (itemAddedCount > 0) {
            bodyParts.push(t('notification_digest_line_items_added', itemAddedCount));
          }
          if (otherCount > 0) {
            bodyParts.push(t('notification_digest_line_other_changes', otherCount));
          }

          new Notification(t('notification_digest_title'), {
            body: bodyParts.join(' · ') || t('activity_feed_title'),
            tag: `digest-${householdId}`,
          });

          localStorage.setItem(digestLastSentKey, String(Date.now()));
          localStorage.setItem(digestStateKey, JSON.stringify({ byType: {}, total: 0 }));
        }
      }

      lastProcessedAt = Math.max(lastProcessedAt, newestTimestamp);
      localStorage.setItem(lastProcessedKey, String(lastProcessedAt));
    });
  }, [user, t]);
}

function getNotificationKeys(type: ActivityType): { titleKey: StringKey; bodyKey: StringKey } {
  switch (type) {
    case 'ITEM_BOUGHT':
      return { titleKey: 'notification_title_item_bought', bodyKey: 'notification_body_item_bought' };
    case 'ITEM_UPDATED':
      return { titleKey: 'notification_title_item_updated', bodyKey: 'notification_body_item_updated' };
    case 'ITEM_DELETED':
      return { titleKey: 'notification_title_item_deleted', bodyKey: 'notification_body_item_deleted' };
    case 'ITEM_ADDED':
    default:
      return { titleKey: 'notification_title_item_added', bodyKey: 'notification_body_item_added' };
  }
}
