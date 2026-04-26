import type { NotificationPrefs } from '../types';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  mode: 'IMMEDIATE_IMPORTANT',
  importantEvents: ['ITEM_ADDED'],
  maxImmediatePerHour: 3,
};

export function normalizeNotificationPrefs(value: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const mode = value?.mode ?? DEFAULT_NOTIFICATION_PREFS.mode;
  const importantEvents = value?.importantEvents?.length ? value.importantEvents : DEFAULT_NOTIFICATION_PREFS.importantEvents;
  const maxImmediatePerHour = Math.max(1, Math.min(20, value?.maxImmediatePerHour ?? DEFAULT_NOTIFICATION_PREFS.maxImmediatePerHour));
  return {
    mode,
    importantEvents,
    maxImmediatePerHour,
  };
}
