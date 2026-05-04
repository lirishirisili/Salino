import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToItems,
  subscribeToRecurringItems,
  markAsBought,
  markAsActive,
  deleteItem,
  logActivity,
  addItem,
} from '../services/firestoreService';
import { buildSuggestions } from '../services/suggestionEngine';
import type { ShoppingItem, SuggestionItem, RecurringItem, ItemCategory } from '../types';
import { ALL_CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../types';
import { formatQuantity, formatRelativeTime } from '../utils';
import { useI18n } from '../i18n/index';
import logoHeader from '../assets/logo_header.png';
import logoHeaderDark from '../assets/logo_header_dark.png';

const INSTALL_BANNER_DISMISSED_KEY = 'salino_pwa_install_banner_dismissed';

export default function ShoppingListScreen() {
  const { t, tCategory, tUnit, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const householdId = user!.activeHouseholdId!;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [showBought, setShowBought] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallHelpModal, setShowInstallHelpModal] = useState(false);

  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isIosSafari = isIos && /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);
  const isAndroidChrome = /android/.test(userAgent) && /chrome/.test(userAgent) && !/edg|opr|samsungbrowser/.test(userAgent);

  useEffect(() => {
    const unsub1 = subscribeToItems(householdId, setItems);
    const unsub2 = subscribeToRecurringItems(householdId, setRecurringItems);
    return () => { unsub1(); unsub2(); };
  }, [householdId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setIsDarkMode(event.matches);
    setIsDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === '1';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const supportedBrowser = isIosSafari || isAndroidChrome;

    if (!dismissed && !isStandalone && supportedBrowser) {
      setShowInstallBanner(true);
    }

    const onInstalled = () => {
      localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
      setShowInstallBanner(false);
      setShowInstallHelpModal(false);
    };

    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isAndroidChrome, isIosSafari]);

  const activeItems = useMemo(() => {
    let filtered = items.filter((i) => i.status === 'ACTIVE');
    if (selectedCategory) {
      filtered = filtered.filter((i) => i.category === selectedCategory);
    }
    return filtered.sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });
  }, [items, selectedCategory]);

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

  const dismissInstallBanner = () => {
    localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
    setShowInstallBanner(false);
    setShowInstallHelpModal(false);
  };

  const usedCategories = useMemo(() => {
    const cats = new Set(items.filter((i) => i.status === 'ACTIVE').map((i) => i.category));
    return ALL_CATEGORIES.filter((c) => cats.has(c));
  }, [items]);

  const headerLogo = isDarkMode ? logoHeaderDark : logoHeader;

  return (
    <div className="screen" style={{ paddingBottom: 80 }}>
      {/* App Bar - matches Android: BrandLogo + title + action icons */}
      <div className="app-bar">
        {lang === 'he' ? (
          <img src={headerLogo} alt={t('shopping_list_title')} className="app-bar-logo" />
        ) : (
          <h1>
            <span>
              <span className="brand-logo sm"><img src="/favicon.png" alt="" /></span>
              <span>{t('shopping_list_title')}</span>
            </span>
          </h1>
        )}
        <div className="app-bar-actions">
          <button className="icon-btn" onClick={() => navigate('/settings')} aria-label={t('settings_title')} title={t('settings_title')} style={{ color: '#67B656' }}>
            <span aria-hidden="true">⚙️</span>
          </button>
          <button className="icon-btn" onClick={() => navigate('/activity')} aria-label={t('activity_feed_title')} title={t('activity_feed_title')} style={{ color: '#F18E6A' }}>
            <span aria-hidden="true">📊</span>
          </button>
          <button className="icon-btn" onClick={() => navigate('/history')} aria-label={t('history_title')} title={t('history_title')} style={{ color: '#67B656' }}>
            <span aria-hidden="true">🕐</span>
          </button>
        </div>
      </div>

      {/* Live badge */}
      {lang !== 'he' && <div className="live-badge">{t('shopping_list_live_badge')}</div>}

      {showInstallBanner && (
        <div className="card install-banner" role="region" aria-label={t('pwa_install_banner_title')}>
          <div className="install-banner-header">{t('pwa_install_banner_title')}</div>
          <div className="install-banner-row">
            <div className="install-banner-text">
              {isIosSafari ? t('pwa_install_banner_subtitle_ios') : t('pwa_install_banner_subtitle_android')}
            </div>
            <div className="install-banner-buttons">
              <button className="install-btn install-btn-secondary" onClick={() => setShowInstallHelpModal(true)}>
                {t('pwa_install_banner_how')}
              </button>
              <button className="install-btn install-btn-primary" onClick={dismissInstallBanner}>
                {t('pwa_install_banner_got_it')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstallHelpModal && (
        <div className="install-help-overlay" role="dialog" aria-modal="true" aria-label={t('pwa_install_banner_how')}>
          <div className="card install-help-modal">
            <div className="install-banner-title">{t('pwa_install_banner_how')}</div>
            <div className="install-banner-help">
              {isIosSafari ? t('pwa_install_help_ios') : t('pwa_install_help_android')}
            </div>
            <div className="install-banner-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setShowInstallHelpModal(false)}>{t('ok')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Suggestions Card - matches Android HeroSuggestionsCard */}
      {suggestions.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: 12,
              background: 'rgba(255, 138, 92, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
            }}>✨</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--on-surface)' }}>{t('suggestions_title')}</div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: '16px', marginTop: 3 }}>{t('suggestions_subtitle_home')}</div>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '0 0 4px' }}>
            {suggestions.map((s) => (
              <button key={s.id} className="chip chip-outline" onClick={() => handleAddSuggestion(s)}
                style={{ background: 'rgba(204,251,241,0.5)', borderColor: 'var(--primary-container)', color: 'var(--primary)', fontWeight: 600 }}>
                <span style={{ fontSize: 14 }}>+</span> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filters */}
      {usedCategories.length > 0 && (
        <div className="horizontal-scroll">
          <button
            className={`chip ${!selectedCategory ? 'chip-filled' : 'chip-outline'}`}
            onClick={() => setSelectedCategory(null)}
            aria-pressed={!selectedCategory}
          >
            {t('category_all')}
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              className={`chip ${selectedCategory === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              aria-pressed={selectedCategory === cat}
            >
              {CATEGORY_EMOJIS[cat]} {tCategory(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Active Items */}
      <div className="section-header">
        <span className="section-title">{t('shopping_list_active_section')} ({activeItems.length})</span>
      </div>

      {activeItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <div className="empty-state-text">{t('shopping_list_empty_title')}</div>
          <div className="empty-state-text" style={{ fontSize: 13 }}>{t('shopping_list_empty_subtitle')}</div>
        </div>
      ) : (
        <div className="card">
          {activeItems.map((item) => (
            <div key={item.id} className="item-row">
              <button
                className="checkbox"
                role="checkbox"
                aria-checked={false}
                aria-label={`${t('shopping_list_mark_bought')}: ${item.name}`}
                onClick={() => handleMarkBought(item)}
              />
              <button
                className="item-info"
                onClick={() => navigate(`/edit/${item.id}`)}
                style={{ textAlign: 'start' }}
                aria-label={`${item.name} – ${t('edit_item_title')}`}
              >
                <div className="item-name">
                  {item.name}
                </div>
                <div className="item-meta">
                  {item.quantity > 1 && <span>{formatQuantity(item.quantity)}{item.unit ? ` ${tUnit(item.unit)}` : ''}</span>}
                  {item.quantity <= 1 && item.unit && <span>{tUnit(item.unit)}</span>}
                  <span
                    className="category-badge"
                    style={{ ['--cat-color' as string]: CATEGORY_COLORS[item.category as ItemCategory] || CATEGORY_COLORS.OTHER }}
                  >
                    {tCategory(item.category as ItemCategory)}
                  </span>
                  {item.isUrgent && <span className="urgent-badge">{t('urgent_toggle_title')}</span>}
                </div>
              </button>
              <div className="item-actions">
                <button className="icon-btn" onClick={() => handleDelete(item)} aria-label={`${t('shopping_list_delete')}: ${item.name}`}>
                  <span aria-hidden="true">🗑️</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bought Items */}
      {boughtItems.length > 0 && (
        <>
          <button
            className="section-header"
            style={{ cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}
            onClick={() => setShowBought(!showBought)}
            aria-expanded={showBought}
          >
            <span className="section-title">{t('shopping_list_bought_section')} ({boughtItems.length})</span>
            <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }} aria-hidden="true">{showBought ? '▲' : '▼'}</span>
          </button>
          {showBought && (
            <div className="card">
              {boughtItems.map((item) => (
                <div key={item.id} className="item-row">
                  <button
                    className="checkbox checked"
                    role="checkbox"
                    aria-checked={true}
                    aria-label={`${t('shopping_list_undo_bought')}: ${item.name}`}
                    onClick={() => handleRestore(item)}
                  ><span aria-hidden="true">✓</span></button>
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.9 8.89l-1.05-4.37c-.22-.9-1.0-1.52-1.91-1.52H5.05c-.9 0-1.69.63-1.9 1.52L2.1 8.89c-.24 1.02-.02 2.06.62 2.88.08.11.19.19.28.29V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.94c.09-.09.2-.18.28-.28.64-.82.87-1.87.62-2.89zM13.99 4.99H14l1.04 4.36c.13.55 0 1.09-.32 1.53-.17.23-.5.62-1.05.62-.66 0-1.24-.53-1.31-1.19l-.68-5.32zm-5.05 4.37L10 5h1.96l.69 5.42c.08.58-.1 1.12-.49 1.55-.33.37-.8.58-1.36.58-.92 0-1.69-.77-1.85-1.79-.02-.11-.02-.23 0-.34zM4.04 9.36L5 5h1.97l-.64 5.07c-.08.66-.66 1.19-1.33 1.19-.45 0-.85-.2-1.14-.54-.29-.35-.4-.8-.31-1.26zM19 19H5v-5.03c.21.03.42.05.63.05.87 0 1.71-.32 2.36-.89.63.57 1.46.89 2.36.89.87 0 1.71-.32 2.36-.89.63.57 1.46.89 2.36.89.89 0 1.72-.32 2.36-.89.64.56 1.49.89 2.36.89.21 0 .42-.02.63-.05V19zm-.34-7.74c-.66 0-1.25-.52-1.33-1.19L16.7 5h1.95l1.01 4.2c.13.55 0 1.09-.32 1.52-.28.36-.67.54-1.08.54z"/>
          </svg>
          {t('supermarket_mode_title')}
        </button>
        <button className="fab-extended fab-add" onClick={() => navigate('/add')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          {t('item_add')}
        </button>
      </div>

      {/* Toast — sr-only live region for screen readers, visual toast for sighted users */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{toast ?? ''}</div>
      {toast && <div className="toast" aria-hidden="true">{toast}</div>}
    </div>
  );
}
