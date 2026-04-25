import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  addItem,
  addRecurringItem,
  logActivity,
  subscribeToItems,
} from '../services/firestoreService';
import { detectCategory } from '../services/categoryDetector';
import { findDuplicate } from '../services/duplicateDetector';
import { parseVoiceInput } from '../services/voiceInputParser';
import type { ShoppingItem, ItemCategory, ItemUnit, DuplicateMatch } from '../types';
import { ALL_CATEGORIES, ALL_UNITS, CATEGORY_EMOJIS } from '../types';
import { normalizeItemName, parseQuantity } from '../utils';
import { useI18n } from '../i18n/index';

export default function AddItemScreen() {
  const { t, tCategory, tUnit } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<ItemUnit | ''>('');
  const [category, setCategory] = useState<ItemCategory>('OTHER');
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState('7');
  const [isCategoryAutoDetected, setIsCategoryAutoDetected] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [existingItems, setExistingItems] = useState<ShoppingItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const unsub = subscribeToItems(householdId, (items) => {
      setExistingItems(items.filter((i) => i.status === 'ACTIVE'));
    });
    return unsub;
  }, [householdId]);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (value.trim().length >= 2) {
      const detected = detectCategory(value);
      if (detected) {
        setCategory(detected);
        setIsCategoryAutoDetected(true);
      }
      const dup = findDuplicate(value, existingItems);
      setDuplicateMatch(dup);
    } else {
      setDuplicateMatch(null);
    }
  }, [existingItems]);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t('voice_input_unavailable'));
      return;
    }
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseVoiceInput(transcript);
      setName(parsed.name);
      if (parsed.quantity !== 1) setQuantity(String(parsed.quantity));
      if (parsed.unit) setUnit(parsed.unit);

      const detected = detectCategory(parsed.name);
      if (detected) {
        setCategory(detected);
        setIsCategoryAutoDetected(true);
      }
    };
    recognition.start();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const qty = parseQuantity(quantity) ?? 1;
      const itemId = await addItem(householdId, {
        name: name.trim(),
        normalizedName: normalizeItemName(name),
        quantity: qty,
        unit: unit || null,
        category,
        note,
        status: 'ACTIVE',
        addedBy: user!.id,
        addedByName: user!.displayName,
        boughtBy: null,
        boughtByName: null,
        isFavorite: false,
        isUrgent,
      });
      await logActivity(householdId, 'ITEM_ADDED', name.trim(), user!.id, user!.displayName, itemId);

      if (isRecurring) {
        const days = parseInt(recurrenceDays) || 7;
        await addRecurringItem(householdId, {
          householdId,
          name: name.trim(),
          normalizedName: normalizeItemName(name),
          quantity: qty,
          unit: unit || null,
          category,
          note,
          intervalDays: days,
          enabled: true,
          nextDueAt: new Date(Date.now() + days * 86400000),
          lastCompletedAt: null,
        });
        await logActivity(householdId, 'RECURRING_CREATED', name.trim(), user!.id, user!.displayName);
      }

      navigate(-1);
    } catch (e) {
      console.error('Failed to add item:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)} aria-label={t('cancel')}>←</button>
        <h1>{t('add_item_title')}</h1>
      </div>

      {/* Name */}
      <div className="form-group">
        <label className="input-label" htmlFor="add-item-name">{t('item_name_label')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="add-item-name"
            className="input-field"
            placeholder={t('item_name_hint')}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus
          />
          <button
            className="icon-btn"
            onClick={handleVoiceInput}
            aria-label={isListening ? t('voice_input_prompt') : t('voice_input_action')}
            aria-pressed={isListening}
            style={{
              background: isListening ? 'var(--error)' : 'var(--surface-variant)',
              color: isListening ? 'white' : 'var(--on-surface-variant)',
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        </div>
      </div>

      {/* Duplicate Warning */}
      {duplicateMatch && (
        <div className="duplicate-warning" style={{ marginBottom: 16 }} role="alert">
          ⚠️ <span>
            {duplicateMatch.reason === 'EXACT_DUPLICATE' ? `${t('duplicate_warning_title')}: ` :
             duplicateMatch.reason === 'POSSIBLE_DUPLICATE' ? `${t('duplicate_warning_fuzzy')}: ` : `${t('duplicate_warning_similar')}: `}
            <strong>{duplicateMatch.item.name}</strong>
            {duplicateMatch.item.quantity > 0 && ` (${duplicateMatch.item.quantity})`}
          </span>
        </div>
      )}

      {/* Category auto-detection indicator */}
      {isCategoryAutoDetected && (
        <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 8 }}>
          ✨ {t('category_auto_detected', tCategory(category))}
        </div>
      )}

      {/* Quantity & Unit */}
      <div className="form-row">
        <div className="form-group">
          <label className="input-label" htmlFor="add-item-qty">{t('item_quantity_label')}</label>
          <input
            id="add-item-qty"
            className="input-field"
            type="text"
            inputMode="decimal"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))}
          />
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="add-item-unit">{t('item_unit_label')}</label>
          <select
            id="add-item-unit"
            className="select-field"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ItemUnit | '')}
          >
            <option value="">{t('unit_none')}</option>
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>{tUnit(u)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
      <div className="form-group">
        <label className="input-label">{t('item_category_label')}</label>
        <div className="horizontal-scroll">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`chip ${category === cat ? 'chip-filled' : 'chip-outline'}`}
              onClick={() => { setCategory(cat); setIsCategoryAutoDetected(false); }}
              aria-pressed={category === cat}
            >
              {CATEGORY_EMOJIS[cat]} {tCategory(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="form-group">
        <label className="input-label" htmlFor="add-item-note">{t('item_note_label')}</label>
        <input
          id="add-item-note"
          className="input-field"
          placeholder={t('item_note_hint')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Urgent toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <span style={{ fontWeight: 500, fontSize: 15 }}><span aria-hidden="true">🔴</span> {t('urgent_toggle_title')}</span>
        <button
          className={`toggle ${isUrgent ? 'active' : ''}`}
          role="switch"
          aria-checked={isUrgent}
          aria-label={t('urgent_toggle_title')}
          onClick={() => setIsUrgent(!isUrgent)}
        />
      </div>

      {/* Recurring toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <span style={{ fontWeight: 500, fontSize: 15 }}><span aria-hidden="true">🔄</span> {t('recurring_toggle_title')}</span>
        <button
          className={`toggle ${isRecurring ? 'active' : ''}`}
          role="switch"
          aria-checked={isRecurring}
          aria-label={t('recurring_toggle_title')}
          onClick={() => setIsRecurring(!isRecurring)}
        />
      </div>

      {isRecurring && (
        <div className="form-group">
          <label className="input-label" htmlFor="add-item-recur-days">{t('recurring_every_days_label')}</label>
          <input
            id="add-item-recur-days"
            className="input-field"
            type="text"
            inputMode="numeric"
            placeholder="7"
            value={recurrenceDays}
            onChange={(e) => setRecurrenceDays(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      )}

      {/* Save */}
      <div style={{ padding: '16px 0 32px', display: 'flex', gap: 12 }}>
        <button className="btn-secondary" onClick={() => navigate(-1)} style={{ flex: 1 }}>
          {t('cancel')}
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving || !name.trim()} style={{ flex: 2 }}>
          {saving ? t('item_saving') : t('item_add')}
        </button>
      </div>
    </div>
  );
}
