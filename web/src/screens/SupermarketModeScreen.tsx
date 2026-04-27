import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logActivity, markAsActive, markAsBought, subscribeToItems } from '../services/firestoreService';
import { ALL_CATEGORIES, CATEGORY_EMOJIS } from '../types';
import type { ItemCategory, ShoppingItem } from '../types';
import { formatQuantity } from '../utils';
import { useI18n } from '../i18n/index';

type SupermarketFilter = 'ALL' | 'URGENT' | 'MINE' | 'PHARMACY' | 'NOT_FOUND';

/** Matches Android SupermarketModeItemRow: Icons.Default.SearchOff */
function SearchOffGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm11.71 7.29l1.41-1.41-16-16-1.41 1.41 16 16z" />
    </svg>
  );
}

export default function SupermarketModeScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [filter, setFilter] = useState<SupermarketFilter>('ALL');
  const [notFoundIds, setNotFoundIds] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ItemCategory>>(new Set());
  const [boughtInSession, setBoughtInSession] = useState<ShoppingItem[]>([]);
  const [showBoughtSection, setShowBoughtSection] = useState(true);
  const [sessionStartCount, setSessionStartCount] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, setItems);
    return unsub;
  }, [householdId]);

  useEffect(() => {
    if (sessionStartCount !== null) return;
    const activeNow = items.filter((i) => i.status === 'ACTIVE').length;
    if (activeNow > 0) setSessionStartCount(activeNow);
  }, [items, sessionStartCount]);

  const activeItems = useMemo(() => items.filter((i) => i.status === 'ACTIVE'), [items]);
  const activeNonNotFound = useMemo(() => activeItems.filter((i) => !notFoundIds.has(i.id)), [activeItems, notFoundIds]);
  const notFoundItems = useMemo(() => activeItems.filter((i) => notFoundIds.has(i.id)), [activeItems, notFoundIds]);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'URGENT':
        return activeNonNotFound.filter((i) => i.isUrgent);
      case 'MINE':
        return activeNonNotFound.filter((i) => i.addedBy === user!.id);
      case 'PHARMACY':
        return activeNonNotFound.filter((i) => i.category === 'PHARMACY');
      case 'NOT_FOUND':
        return notFoundItems;
      default:
        return activeNonNotFound;
    }
  }, [activeNonNotFound, filter, notFoundItems, user]);

  const groupedItems = useMemo(() => {
    const map = new Map<ItemCategory, ShoppingItem[]>();
    const sorted = [...filteredItems].sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent));
    for (const category of ALL_CATEGORIES) map.set(category, []);
    for (const item of sorted) {
      const cat = (item.category as ItemCategory) || 'OTHER';
      map.get(cat)?.push(item);
    }
    return ALL_CATEGORIES
      .map((cat) => ({ category: cat, items: map.get(cat) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [filteredItems]);

  const checkedCount = boughtInSession.length;
  const totalCount = sessionStartCount ?? (activeItems.length + checkedCount);
  const remainingCount = activeNonNotFound.length;
  const allDone = totalCount > 0 && remainingCount === 0;

  const markItemBought = async (item: ShoppingItem) => {
    setNotFoundIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    setBoughtInSession((prev) => (prev.some((b) => b.id === item.id) ? prev : [item, ...prev]));
    await markAsBought(householdId, item.id, user!.id, user!.displayName);
    await logActivity(householdId, 'ITEM_BOUGHT', item.name, user!.id, user!.displayName, item.id);
  };

  const restoreBoughtItem = async (item: ShoppingItem) => {
    setBoughtInSession((prev) => prev.filter((b) => b.id !== item.id));
    await markAsActive(householdId, item.id);
    await logActivity(householdId, 'ITEM_RESTORED', item.name, user!.id, user!.displayName, item.id);
  };

  const markNotFound = (item: ShoppingItem) => {
    setNotFoundIds((prev) => new Set(prev).add(item.id));
  };

  const undoNotFound = (item: ShoppingItem) => {
    setNotFoundIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const toggleCategory = (category: ItemCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const finishShopping = () => {
    if (remainingCount > 0) {
      const confirmed = window.confirm(t('supermarket_mode_finish_message', String(remainingCount)));
      if (!confirmed) return;
    }
    navigate(-1);
  };

  return (
    <div className="screen" style={{ paddingBottom: 92 }}>
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)} aria-label={t('cancel')}>←</button>
        <h1>{t('supermarket_mode_title')}</h1>
      </div>

      <div className="supermarket-header-box">
        <div className="supermarket-progress-top">
          <div className="supermarket-progress-count">{checkedCount}/{totalCount}</div>
          <div className="supermarket-progress-text">{t('supermarket_mode_progress', String(checkedCount), String(totalCount))}</div>
        </div>
        <div className="supermarket-progress-track" role="progressbar" aria-valuenow={checkedCount} aria-valuemin={0} aria-valuemax={totalCount}>
          <div className="supermarket-progress-bar" style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="horizontal-scroll" style={{ marginBottom: 8 }}>
        <button className={`chip ${filter === 'ALL' ? 'chip-filled' : 'chip-outline'}`} onClick={() => setFilter('ALL')}>{t('supermarket_mode_filter_all_label')}</button>
        <button className={`chip ${filter === 'URGENT' ? 'chip-filled' : 'chip-outline'}`} onClick={() => setFilter('URGENT')}>❗ {t('supermarket_mode_filter_urgent')}</button>
        <button className={`chip ${filter === 'MINE' ? 'chip-filled' : 'chip-outline'}`} onClick={() => setFilter('MINE')}>{t('supermarket_mode_filter_mine')}</button>
        <button className={`chip ${filter === 'PHARMACY' ? 'chip-filled' : 'chip-outline'}`} onClick={() => setFilter('PHARMACY')}>💊 {t('supermarket_mode_filter_pharmacy_label')}</button>
        <button className={`chip ${filter === 'NOT_FOUND' ? 'chip-filled' : 'chip-outline'}`} onClick={() => setFilter('NOT_FOUND')}>🔎 {t('supermarket_mode_filter_not_found')} ({notFoundIds.size})</button>
      </div>

      {allDone ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-text">{t('supermarket_mode_all_done')}</div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>{t('supermarket_mode_all_done_subtitle')}</div>
        </div>
      ) : groupedItems.length === 0 && boughtInSession.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛍️</div>
          <div className="empty-state-text">{t('supermarket_mode_empty_title')}</div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>{t('supermarket_mode_empty_subtitle')}</div>
        </div>
      ) : (
        <>
          {groupedItems.map((group) => {
            const isCollapsed = collapsedCategories.has(group.category);
            return (
              <div key={group.category}>
                <button className="section-header" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => toggleCategory(group.category)}>
                  <span className="section-title">{CATEGORY_EMOJIS[group.category]} {tCategory(group.category)} ({group.items.length})</span>
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{isCollapsed ? '▼' : '▲'}</span>
                </button>
                {!isCollapsed && group.items.map((item) => {
                  const isNotFound = notFoundIds.has(item.id);
                  if (isNotFound) {
                    return (
                      <div key={item.id} className="supermarket-item done">
                        <div style={{ flex: 1 }}>
                          <div className="item-name" style={{ fontSize: 17 }}>{item.name}</div>
                        </div>
                        <button className="btn-text" onClick={() => undoNotFound(item)}>{t('supermarket_mode_undo')}</button>
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} className="supermarket-item">
                      <button className="supermarket-check" onClick={() => markItemBought(item)} aria-label={`${t('shopping_list_mark_bought')}: ${item.name}`} />
                      <div style={{ flex: 1 }}>
                        <div className="item-name" style={{ fontSize: 18, fontWeight: 600 }}>
                          {item.isUrgent ? `${item.name} ❗` : item.name}
                        </div>
                        {(item.quantity !== 1 || item.unit || item.note) && (
                          <div className="item-qty">
                            {formatQuantity(item.quantity)}{item.unit ? ` ${tUnit(item.unit)}` : ''}{item.note ? ` · ${item.note}` : ''}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="icon-btn supermarket-not-found-btn"
                        onClick={() => markNotFound(item)}
                        aria-label={t('supermarket_mode_not_found')}
                        title={t('supermarket_mode_not_found')}
                      >
                        <SearchOffGlyph />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {boughtInSession.length > 0 && (
            <>
              <button
                className="section-header"
                style={{ cursor: 'pointer', width: '100%', justifyContent: 'space-between', marginTop: 8 }}
                onClick={() => setShowBoughtSection(!showBoughtSection)}
                aria-expanded={showBoughtSection}
              >
                <span className="section-title">{t('shopping_list_bought_section')} ({boughtInSession.length})</span>
                <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }} aria-hidden="true">{showBoughtSection ? '▲' : '▼'}</span>
              </button>
              {showBoughtSection && (
                <div className="card">
                  {boughtInSession.map((item) => (
                    <div key={item.id} className="item-row" style={{ paddingTop: 6, paddingBottom: 6 }}>
                      <button className="checkbox checked" role="checkbox" aria-checked={true} aria-label={`${t('shopping_list_undo_bought')}: ${item.name}`} onClick={() => restoreBoughtItem(item)}>
                        <span aria-hidden="true">✓</span>
                      </button>
                      <div className="item-info">
                        <div className="item-name bought">{item.name}</div>
                      </div>
                      <button className="btn-text" onClick={() => restoreBoughtItem(item)}>{t('shopping_list_undo_bought')}</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="dual-fabs">
        <button className="fab-extended fab-add" onClick={() => navigate('/add')}>{t('supermarket_mode_add_item')}</button>
        <button className="fab-extended fab-supermarket" onClick={finishShopping}>{t('supermarket_mode_finish')}</button>
      </div>
    </div>
  );
}
