import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToItems,
  subscribeToRecurringItems,
  markAsBought,
  markAsActive,
  deleteItem,
  toggleFavorite,
  logActivity,
  addItem,
} from '../services/firestoreService';
import { buildSuggestions } from '../services/suggestionEngine';
import type { ShoppingItem, SuggestionItem, RecurringItem, ItemCategory } from '../types';
import { ALL_CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../types';
import { formatQuantity, formatRelativeTime } from '../utils';
import { useI18n } from '../i18n/index';

export default function ShoppingListScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [showBought, setShowBought] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeToItems(householdId, setItems);
    const unsub2 = subscribeToRecurringItems(householdId, setRecurringItems);
    return () => { unsub1(); unsub2(); };
  }, [householdId]);

  const activeItems = useMemo(() => {
    let filtered = items.filter((i) => i.status === 'ACTIVE');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      filtered = filtered.filter((i) => i.category === selectedCategory);
    }
    return filtered.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });
  }, [items, searchQuery, selectedCategory]);

  const boughtItems = useMemo(
    () => items.filter((i) => i.status === 'BOUGHT')
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .slice(0, 5),
    [items]
  );

  const suggestions = useMemo(
    () => buildSuggestions(
      items.filter((i) => i.status === 'ACTIVE'),
      items.filter((i) => i.status === 'BOUGHT'),
      recurringItems,
      Date.now()
    ),
    [items, recurringItems]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleMarkBought = async (item: ShoppingItem) => {
    await markAsBought(householdId, item.id, user!.id, user!.displayName);
    await logActivity(householdId, 'ITEM_BOUGHT', item.name, user!.id, user!.displayName, item.id);
    showToast(`${item.name} ${t('supermarket_mode_item_bought')}`);
  };

  const handleRestore = async (item: ShoppingItem) => {
    await markAsActive(householdId, item.id);
    await logActivity(householdId, 'ITEM_RESTORED', item.name, user!.id, user!.displayName, item.id);
  };

  const handleDelete = async (item: ShoppingItem) => {
    await deleteItem(householdId, item.id);
    await logActivity(householdId, 'ITEM_DELETED', item.name, user!.id, user!.displayName, item.id);
    showToast(`${item.name} ${t('shopping_list_delete')}`);
  };

  const handleToggleFav = async (item: ShoppingItem) => {
    await toggleFavorite(householdId, item.id, !item.isFavorite);
  };

  const handleAddSuggestion = async (s: SuggestionItem) => {
    await addItem(householdId, {
      name: s.name,
      normalizedName: s.normalizedName,
      quantity: s.quantity,
      unit: s.unit,
      category: s.category,
      note: s.note,
      status: 'ACTIVE',
      addedBy: user!.id,
      addedByName: user!.displayName,
      boughtBy: null,
      boughtByName: null,
      isFavorite: false,
      isUrgent: false,
    });
    await logActivity(householdId, 'SUGGESTION_ACCEPTED', s.name, user!.id, user!.displayName);
    showToast(`${s.name} ${t('activity_type_suggestion_accepted')}`);
  };

  const usedCategories = useMemo(() => {
    const cats = new Set(items.filter((i) => i.status === 'ACTIVE').map((i) => i.category));
    return ALL_CATEGORIES.filter((c) => cats.has(c));
  }, [items]);

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      {/* App Bar - matches Android: BrandLogo + title + action icons */}
      <div className="app-bar">
        <h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{t('shopping_list_title')}</span>
          </span>
        </h1>
        <div className="app-bar-actions">
          <button className="icon-btn" onClick={() => navigate('/settings')} title={t('settings_title')} style={{ color: '#67B656' }}>
            ⚙️
          </button>
          <button className="icon-btn" onClick={() => navigate('/activity')} title={t('activity_feed_title')} style={{ color: '#F18E6A' }}>
            📊
          </button>
          <button className="icon-btn" onClick={() => navigate('/history')} title={t('history_title')} style={{ color: '#67B656' }}>
            🕐
          </button>
        </div>
      </div>

      {/* Live badge */}
      <div className="live-badge" style={{ textAlign: 'center', marginBottom: 8 }}>{t('shopping_list_live_badge')}</div>

      {/* Search */}
      <div className="search-bar">
        <span>🔍</span>
        <input
          placeholder={t('shopping_list_search_hint')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ color: 'var(--on-surface-variant)' }}>✕</button>
        )}
      </div>

      {/* Category Filters */}
      {usedCategories.length > 0 && (
        <div className="horizontal-scroll">
          <button
            className={`chip ${!selectedCategory ? 'chip-filled' : 'chip-outline'}`}
            onClick={() => setSelectedCategory(null)}
          >
            {t('category_all')}
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              className={`chip ${selectedCategory === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {CATEGORY_EMOJIS[cat]} {tCategory(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !searchQuery && (
        <>
          <div className="section-header">
            <span className="section-title">{t('suggestions_title')}</span>
          </div>
          <div className="horizontal-scroll">
            {suggestions.map((s) => (
              <button key={s.id} className="suggestion-card" onClick={() => handleAddSuggestion(s)}>
                <div className="suggestion-card-name">{CATEGORY_EMOJIS[s.category as ItemCategory] || '📦'} {s.name}</div>
                <div className="suggestion-card-reason">
                  {s.reason === 'due' ? '🔄' : s.reason === 'frequent' ? '📊' : '🕐'}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Active Items */}
      <div className="section-header">
        <span className="section-title">{t('shopping_list_active_section')} ({activeItems.length})</span>
      </div>

      {activeItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <div className="empty-state-text">
            {searchQuery ? t('shopping_list_search_hint') : t('shopping_list_empty_title')}
          </div>
          {!searchQuery && <div className="empty-state-text" style={{ fontSize: 13 }}>{t('shopping_list_empty_subtitle')}</div>}
        </div>
      ) : (
        <div className="card">
          {activeItems.map((item) => (
            <div key={item.id} className="item-row">
              <div className="checkbox" onClick={() => handleMarkBought(item)} />
              <div className="item-info" onClick={() => navigate(`/edit/${item.id}`)} style={{ cursor: 'pointer' }}>
                <div className="item-name">
                  {item.isFavorite && '⭐ '}{item.name}
                </div>
                <div className="item-meta">
                  {item.quantity > 1 && <span>{formatQuantity(item.quantity)}{item.unit ? ` ${tUnit(item.unit)}` : ''}</span>}
                  {item.quantity <= 1 && item.unit && <span>{tUnit(item.unit)}</span>}
                  <span
                    className="category-badge"
                    style={{ background: CATEGORY_COLORS[item.category as ItemCategory] || CATEGORY_COLORS.OTHER }}
                  >
                    {CATEGORY_EMOJIS[item.category as ItemCategory] || '📦'} {tCategory(item.category as ItemCategory)}
                  </span>
                  {item.isUrgent && <span className="urgent-badge">{t('urgent_toggle_title')}</span>}
                </div>
              </div>
              <div className="item-actions">
                <button className="icon-btn" onClick={() => handleToggleFav(item)}>
                  {item.isFavorite ? '⭐' : '☆'}
                </button>
                <button className="icon-btn" onClick={() => handleDelete(item)}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bought Items */}
      {boughtItems.length > 0 && (
        <>
          <div className="section-header" style={{ cursor: 'pointer' }} onClick={() => setShowBought(!showBought)}>
            <span className="section-title">{t('shopping_list_bought_section')} ({boughtItems.length})</span>
            <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>{showBought ? '▲' : '▼'}</span>
          </div>
          {showBought && (
            <div className="card">
              {boughtItems.map((item) => (
                <div key={item.id} className="item-row">
                  <div className="checkbox checked" onClick={() => handleRestore(item)}>✓</div>
                  <div className="item-info">
                    <div className="item-name bought">{item.name}</div>
                    <div className="item-meta">
                      {item.boughtByName && <span>{t('shopping_list_bought_by', item.boughtByName)}</span>}
                      <span>{formatRelativeTime(item.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Dual FABs - matches Android: Supermarket (green) + Add (orange) */}
      <div className="dual-fabs">
        <button className="fab-extended fab-supermarket" onClick={() => navigate('/supermarket')}>
          🏪 {t('supermarket_mode_short')}
        </button>
        <button className="fab-extended fab-add" onClick={() => navigate('/add')}>
          ➕ {t('item_add')}
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
