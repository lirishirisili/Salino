import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToItems } from '../services/firestoreService';
import type { ShoppingItem, ItemCategory } from '../types';
import { CATEGORY_COLORS, CATEGORY_EMOJIS } from '../types';
import { formatQuantity } from '../utils';
import { useI18n } from '../i18n/index';

export default function HistoryScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;
  const [items, setItems] = useState<ShoppingItem[]>([]);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, setItems);
    return unsub;
  }, [householdId]);

  const boughtItems = useMemo(
    () => items
      .filter((i) => i.status === 'BOUGHT')
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)),
    [items]
  );

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of boughtItems) {
      const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Unknown';
      const list = groups.get(date) || [];
      list.push(item);
      groups.set(date, list);
    }
    return groups;
  }, [boughtItems]);

  return (
    <div className="screen">
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)}>←</button>
        <h1>{t('history_title')}</h1>
      </div>

      {boughtItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">{t('history_empty_title')}</div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>{t('history_empty_subtitle')}</div>
        </div>
      ) : (
        [...groupedByDate.entries()].map(([date, items]) => (
          <div key={date}>
            <div className="section-header">
              <span className="section-title">{date}</span>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              {items.map((item) => (
                <div key={item.id} className="item-row">
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">
                      <span>{formatQuantity(item.quantity)}{item.unit ? ` ${tUnit(item.unit)}` : ''}</span>
                      <span
                        className="category-badge"
                        style={{ background: CATEGORY_COLORS[item.category as ItemCategory] || CATEGORY_COLORS.OTHER }}
                      >
                        {CATEGORY_EMOJIS[item.category as ItemCategory] || '📦'} {tCategory(item.category as ItemCategory)}
                      </span>
                      {item.boughtByName && <span>{t('shopping_list_bought_by', item.boughtByName)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
