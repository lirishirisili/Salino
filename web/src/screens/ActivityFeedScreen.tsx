import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToActivity } from '../services/firestoreService';
import type { ActivityLog } from '../types';
import { formatRelativeTime } from '../utils';
import { useI18n } from '../i18n/index';
import type { StringKey } from '../i18n/index';

const ACTIVITY_ICONS: Record<string, string> = {
  ITEM_ADDED: '➕',
  ITEM_UPDATED: '✏️',
  ITEM_BOUGHT: '✅',
  ITEM_RESTORED: '↩️',
  ITEM_DELETED: '🗑️',
  RECURRING_CREATED: '🔄',
  RECURRING_UPDATED: '🔄',
  RECURRING_SUGGESTION_SURFACED: '💡',
  SUGGESTION_ACCEPTED: '👍',
};

const ACTIVITY_TYPE_KEYS: Record<string, StringKey> = {
  ITEM_ADDED: 'activity_type_item_added',
  ITEM_UPDATED: 'activity_type_item_updated',
  ITEM_BOUGHT: 'activity_type_item_bought',
  ITEM_RESTORED: 'activity_type_item_restored',
  ITEM_DELETED: 'activity_type_item_deleted',
  RECURRING_CREATED: 'activity_type_recurring_created',
  RECURRING_UPDATED: 'activity_type_recurring_updated',
  SUGGESTION_ACCEPTED: 'activity_type_suggestion_accepted',
};

function formatActivityMessage(log: ActivityLog, t: (key: StringKey, ...args: (string | number)[]) => string): string {
  const typeLabel = ACTIVITY_TYPE_KEYS[log.type] ? t(ACTIVITY_TYPE_KEYS[log.type]) : log.type;
  const parts: string[] = [];
  if (log.actorDisplayName) parts.push(log.actorDisplayName);
  parts.push(typeLabel);
  if (log.itemName) parts.push(`"${log.itemName}"`);
  return parts.join(' · ');
}

export default function ActivityFeedScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const unsub = subscribeToActivity(householdId, setActivities);
    return unsub;
  }, [householdId]);

  return (
    <div className="screen">
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)}>←</button>
        <h1>{t('activity_feed_title')}</h1>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">{t('activity_feed_empty_title')}</div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>{t('activity_feed_empty_subtitle')}</div>
        </div>
      ) : (
        <div className="card">
          {activities.map((log) => (
            <div key={log.id} className="activity-item">
              <div className="activity-message">
                {ACTIVITY_ICONS[log.type] || '📝'} {formatActivityMessage(log, t)}
              </div>
              <div className="activity-time">{formatRelativeTime(log.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
