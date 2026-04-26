import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToItems, markAsBought, markAsActive, logActivity } from '../services/firestoreService';
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
  const [boughtInSession, setBoughtInSession] = useState<ShoppingItem[]>([]);
  const [showBoughtSection, setShowBoughtSection] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [sessionStartCount, setSessionStartCount] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, setItems);
    return unsub;
  }, [householdId]);

  useEffect(() => {
    if (sessionStartCount !== null) return;
    const activeNowCount = items.filter((i) => i.status === 'ACTIVE').length;
    if (activeNowCount > 0) {
      setSessionStartCount(activeNowCount);
    }
  }, [items, sessionStartCount]);

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
      setBoughtInSession((prev) =>
        prev.some((boughtItem) => boughtItem.id === item.id) ? prev : [item, ...prev]
      );
      await markAsBought(householdId, item.id, user!.id, user!.displayName);
      await logActivity(householdId, 'ITEM_BOUGHT', item.name, user!.id, user!.displayName, item.id);
    }
  };

  const handleRestore = async (item: ShoppingItem) => {
    setBoughtInSession((prev) => prev.filter((boughtItem) => boughtItem.id !== item.id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    await markAsActive(householdId, item.id);
    await logActivity(householdId, 'ITEM_RESTORED', item.name, user!.id, user!.displayName, item.id);
  };

  const checkedCount = boughtInSession.length;
  const totalItems = sessionStartCount ?? (items.filter((i) => i.status === 'ACTIVE').length + checkedCount);

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)} aria-label={t('cancel')}>←</button>
        <h1>
          <span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.9 8.89l-1.05-4.37c-.22-.9-1-.52-1.91-1.52H5.05c-.9 0-1.69.63-1.9 1.52L2.1 8.89c-.24 1.02-.02 2.06.62 2.88.08.11.19.19.28.29V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.94c.09-.09.2-.18.28-.28.64-.82.87-1.87.62-2.89zM13.99 4.99H14l1.04 4.36c.13.55 0 1.09-.32 1.53-.17.23-.5.62-1.05.62-.66 0-1.24-.53-1.31-1.19l-.68-5.32zm-5.05 4.37L10 5h1.96l.69 5.42c.08.58-.1 1.12-.49 1.55-.33.37-.8.58-1.36.58-.92 0-1.69-.77-1.85-1.79-.02-.11-.02-.23 0-.34zM4.04 9.36L5 5h1.97l-.64 5.07c-.08.66-.66 1.19-1.33 1.19-.45 0-.85-.2-1.14-.54-.29-.35-.4-.8-.31-1.26zM19 19H5v-5.03c.21.03.42.05.63.05.87 0 1.71-.32 2.36-.89.63.57 1.46.89 2.36.89.87 0 1.71-.32 2.36-.89.63.57 1.46.89 2.36.89.89 0 1.72-.32 2.36-.89.64.56 1.49.89 2.36.89.21 0 .42-.02.63-.05V19zm-.34-7.74c-.66 0-1.25-.52-1.33-1.19L16.7 5h1.95l1.01 4.2c.13.55 0 1.09-.32 1.52-.28.36-.67.54-1.08.54z"/>
            </svg>
            <span>{t('supermarket_mode_title')}</span>
          </span>
        </h1>
      </div>

      {/* Progress */}
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>
          {checkedCount}/{totalItems}
        </div>
        <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{t('supermarket_mode_progress', String(checkedCount), String(totalItems))}</div>
        <div
          role="progressbar"
          aria-valuenow={checkedCount}
          aria-valuemin={0}
          aria-valuemax={totalItems}
          aria-label={t('supermarket_mode_progress', String(checkedCount), String(totalItems))}
          style={{
            height: 6,
            background: 'var(--surface-variant)',
            borderRadius: 3,
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
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
            aria-pressed={!selectedCategory}
          >{t('category_all')}</button>
          {usedCategories.map((cat) => (
            <button key={cat}
              className={`chip ${selectedCategory === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              aria-pressed={selectedCategory === cat}
            >{CATEGORY_EMOJIS[cat]} {tCategory(cat)}</button>
          ))}
        </div>
      )}

      {/* Items */}
      {activeItems.map((item) => {
        const isChecked = checkedIds.has(item.id);
        return (
          <div key={item.id} className={`supermarket-item ${isChecked ? 'done' : ''}`}>
            <button
              className={`supermarket-check ${isChecked ? 'checked' : ''}`}
              role="checkbox"
              aria-checked={isChecked}
              aria-label={`${item.name}: ${isChecked ? t('shopping_list_undo_bought') : t('shopping_list_mark_bought')}`}
              onClick={() => handleCheck(item)}
            >
              {isChecked && <span aria-hidden="true">✓</span>}
            </button>
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

      {activeItems.length === 0 && boughtInSession.length === 0 && (
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

      {boughtInSession.length > 0 && (
        <>
          <button
            className="section-header"
            style={{ cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}
            onClick={() => setShowBoughtSection(!showBoughtSection)}
            aria-expanded={showBoughtSection}
          >
            <span className="section-title">{t('shopping_list_bought_section')} ({boughtInSession.length})</span>
            <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }} aria-hidden="true">
              {showBoughtSection ? '▲' : '▼'}
            </span>
          </button>
          {showBoughtSection && (
            <div className="card">
              {boughtInSession.map((item) => (
                <div key={item.id} className="item-row" style={{ paddingTop: 2, paddingBottom: 2 }}>
                  <button
                    className="checkbox checked"
                    role="checkbox"
                    aria-checked={true}
                    aria-label={`${t('shopping_list_undo_bought')}: ${item.name}`}
                    onClick={() => handleRestore(item)}
                    style={{ width: 30, height: 30 }}
                  >
                    <span aria-hidden="true">✓</span>
                  </button>
                  <div className="item-info">
                    <div className="item-name bought" style={{ fontSize: 17 }}>{item.name}</div>
                  </div>
                  <button className="btn-text" onClick={() => handleRestore(item)}>{t('shopping_list_undo_bought')}</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button className="fab" onClick={() => navigate('/add')} aria-label={t('item_add')}><span aria-hidden="true">+</span></button>
    </div>
  );
}
