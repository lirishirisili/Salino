import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createHousehold, joinHousehold } from '../services/firestoreService';
import { useI18n } from '../i18n/index';

export default function HouseholdSetupScreen() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      const household = await createHousehold(name.trim(), user.id, user.displayName);
      await updateUser({ activeHouseholdId: household.id });
    } catch {
      setError(t('household_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      const household = await joinHousehold(inviteCode.trim(), user.id, user.displayName);
      if (!household) {
        setError(t('household_error_invalid_code'));
        return;
      }
      await updateUser({ activeHouseholdId: household.id });
    } catch {
      setError(t('household_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🏠</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{t('household_setup_title')}</h1>
        <p style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
          {t('household_setup_subtitle')}
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
          {t('household_create')}
        </button>
        <button className={`tab ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
          {t('household_join')}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 14, textAlign: 'center' }}>{error}</div>
      )}

      {tab === 'create' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">{t('household_name_label')}</label>
            <input
              className="input-field"
              placeholder={t('household_name_hint')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <button className="btn-primary" onClick={handleCreate} disabled={loading || !name.trim()} style={{ width: '100%' }}>
            {loading ? t('household_creating') : t('household_create_button')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">{t('household_invite_code_label')}</label>
            <input
              className="input-field"
              placeholder={t('household_invite_code_hint')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 4, fontWeight: 700 }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <button className="btn-primary" onClick={handleJoin} disabled={loading || inviteCode.length < 6} style={{ width: '100%' }}>
            {loading ? t('household_joining') : t('household_join_button')}
          </button>
        </div>
      )}
    </div>
  );
}
