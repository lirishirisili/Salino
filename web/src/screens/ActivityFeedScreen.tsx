import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToActivity } from '../services/firestoreService';
import type { ActivityLog } from '../types';
import { formatRelativeTime } from '../utils';
import { useI18n } from '../i18n/index';

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
                {ACTIVITY_ICONS[log.type] || '📝'} {log.message}
              </div>
              <div className="activity-time">{formatRelativeTime(log.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
