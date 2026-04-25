import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToItems, updateItem, deleteItem, logActivity } from '../services/firestoreService';
import type { ShoppingItem, ItemCategory, ItemUnit } from '../types';
import { ALL_CATEGORIES, ALL_UNITS, CATEGORY_EMOJIS } from '../types';
import { parseQuantity } from '../utils';
import { useI18n } from '../i18n/index';

export default function EditItemScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const householdId = user!.activeHouseholdId!;

  const [item, setItem] = useState<ShoppingItem | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<ItemUnit | ''>('');
  const [category, setCategory] = useState<ItemCategory>('OTHER');
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, (items) => {
      const found = items.find((i) => i.id === itemId);
      if (found && !item) {
        setItem(found);
        setName(found.name);
        setQuantity(String(found.quantity));
        setUnit(found.unit || '');
        setCategory(found.category as ItemCategory);
        setNote(found.note);
        setIsUrgent(found.isUrgent);
      }
    });
    return unsub;
  }, [householdId, itemId, item]);

  const handleSave = async () => {
    if (!name.trim() || !itemId) return;
    setSaving(true);
    try {
      await updateItem(householdId, itemId, {
        name: name.trim(),
        quantity: parseQuantity(quantity) ?? 1,
        unit: unit || null,
        category,
        note,
        isUrgent,
      });
      await logActivity(householdId, 'ITEM_UPDATED', name.trim(), user!.id, user!.displayName, itemId);
      navigate(-1);
    } catch (e) {
      console.error('Failed to update:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemId) return;
    await deleteItem(householdId, itemId);
    await logActivity(householdId, 'ITEM_DELETED', name, user!.id, user!.displayName, itemId);
    navigate(-1);
  };

  if (!item) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)} aria-label={t('cancel')}>←</button>
        <h1>{t('edit_item_title')}</h1>
        <button className="icon-btn" onClick={() => setShowDeleteConfirm(true)} style={{ color: 'var(--error)' }} aria-label={t('shopping_list_delete')}>
          <span aria-hidden="true">🗑️</span>
        </button>
      </div>

      <div className="form-group">
        <label className="input-label" htmlFor="edit-item-name">{t('item_name_label')}</label>
        <input id="edit-item-name" className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="input-label" htmlFor="edit-item-qty">{t('item_quantity_label')}</label>
          <input id="edit-item-qty" className="input-field" type="text" inputMode="decimal" value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))} />
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="edit-item-unit">{t('item_unit_label')}</label>
          <select id="edit-item-unit" className="select-field" value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit | '')}>
            <option value="">{t('unit_none')}</option>
            {ALL_UNITS.map((u) => <option key={u} value={u}>{tUnit(u)}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="input-label">{t('item_category_label')}</label>
        <div className="horizontal-scroll">
          {ALL_CATEGORIES.map((cat) => (
            <button key={cat} className={`chip ${category === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}>
              {CATEGORY_EMOJIS[cat]} {tCategory(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="input-label" htmlFor="edit-item-note">{t('item_note_label')}</label>
        <input id="edit-item-note" className="input-field" placeholder={t('item_note_hint')} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <span style={{ fontWeight: 500 }}><span aria-hidden="true">🔴</span> {t('urgent_toggle_title')}</span>
        <button
          className={`toggle ${isUrgent ? 'active' : ''}`}
          role="switch"
          aria-checked={isUrgent}
          aria-label={t('urgent_toggle_title')}
          onClick={() => setIsUrgent(!isUrgent)}
        />
      </div>

      <div style={{ padding: '16px 0 32px', display: 'flex', gap: 12 }}>
        <button className="btn-secondary" onClick={() => navigate(-1)} style={{ flex: 1 }}>{t('cancel')}</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving || !name.trim()} style={{ flex: 2 }}>
          {saving ? t('item_saving') : t('item_save')}
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <h2 id="delete-dialog-title">{t('shopping_list_delete_confirm')}</h2>
            <p style={{ color: 'var(--on-surface-variant)' }}>
              {item.name}
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</button>
              <button className="btn-danger" onClick={handleDelete}>{t('shopping_list_delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
