import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToItems, markAsBought, logActivity } from '../services/firestoreService';
import type { ShoppingItem, ItemCategory } from '../types';
import { ALL_CATEGORIES, CATEGORY_EMOJIS } from '../types';
import { formatQuantity } from '../utils';
import { useI18n } from '../i18n/index';

export default function SupermarketModeScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, setItems);
    return unsub;
  }, [householdId]);

  const activeItems = useMemo(() => {
    let filtered = items.filter((i) => i.status === 'ACTIVE');
    if (selectedCategory) {
      filtered = filtered.filter((i) => i.category === selectedCategory);
    }
    return filtered.sort((a, b) => {
      const aChecked = checkedIds.has(a.id);
      const bChecked = checkedIds.has(b.id);
      if (aChecked !== bChecked) return aChecked ? 1 : -1;
      return (a.category || '').localeCompare(b.category || '');
    });
  }, [items, selectedCategory, checkedIds]);

  const usedCategories = useMemo(() => {
    const cats = new Set(items.filter((i) => i.status === 'ACTIVE').map((i) => i.category));
    return ALL_CATEGORIES.filter((c) => cats.has(c));
  }, [items]);

  const handleCheck = async (item: ShoppingItem) => {
    if (checkedIds.has(item.id)) {
      const next = new Set(checkedIds);
      next.delete(item.id);
      setCheckedIds(next);
    } else {
      setCheckedIds(new Set([...checkedIds, item.id]));
      await markAsBought(householdId, item.id, user!.id, user!.displayName);
      await logActivity(householdId, 'ITEM_BOUGHT', item.name, user!.id, user!.displayName, item.id);
    }
  };

  const totalItems = items.filter((i) => i.status === 'ACTIVE').length;
  const checkedCount = checkedIds.size;

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)}>←</button>
        <h1>🏪 {t('supermarket_mode_title')}</h1>
      </div>

      {/* Progress */}
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>
          {checkedCount}/{totalItems}
        </div>
        <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{t('supermarket_mode_progress', String(checkedCount), String(totalItems))}</div>
        <div style={{
          height: 6,
          background: 'var(--surface-variant)',
          borderRadius: 3,
          marginTop: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'var(--primary)',
            borderRadius: 3,
            width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Category filter */}
      {usedCategories.length > 1 && (
        <div className="horizontal-scroll" style={{ marginBottom: 8 }}>
          <button
            className={`chip ${!selectedCategory ? 'chip-filled' : 'chip-outline'}`}
            onClick={() => setSelectedCategory(null)}
          >{t('category_all')}</button>
          {usedCategories.map((cat) => (
            <button key={cat}
              className={`chip ${selectedCategory === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >{CATEGORY_EMOJIS[cat]} {tCategory(cat)}</button>
          ))}
        </div>
      )}

      {/* Items */}
      {activeItems.map((item) => {
        const isChecked = checkedIds.has(item.id);
        return (
          <div key={item.id} className={`supermarket-item ${isChecked ? 'done' : ''}`}>
            <div
              className={`supermarket-check ${isChecked ? 'checked' : ''}`}
              onClick={() => handleCheck(item)}
            >
              {isChecked && '✓'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="item-name" style={{ fontSize: 18, fontWeight: 600 }}>
                {item.name}
              </div>
            </div>
            <div className="item-qty" style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}>
              {formatQuantity(item.quantity)}{item.unit ? ` ${tUnit(item.unit)}` : ''}
            </div>
          </div>
        );
      })}

      {activeItems.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-text">
            {checkedCount > 0 ? t('supermarket_mode_all_done') : t('supermarket_mode_empty_title')}
          </div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>
            {checkedCount > 0 ? t('supermarket_mode_all_done_subtitle') : t('supermarket_mode_empty_subtitle')}
          </div>
        </div>
      )}

      <button className="fab" onClick={() => navigate('/add')}>+</button>
    </div>
  );
}
