import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getHousehold,
  subscribeToMembers,
  leaveHousehold,
} from '../services/firestoreService';
import type { Household, HouseholdMember } from '../types';
import { useI18n } from '../i18n/index';

export default function SettingsScreen() {
  const { t } = useI18n();
  const { user, signOut, updateUser } = useAuth();
  const navigate = useNavigate();
  const householdId = user!.activeHouseholdId!;

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    getHousehold(householdId).then(setHousehold);
    const unsub = subscribeToMembers(householdId, setMembers);
    return unsub;
  }, [householdId]);

  const handleCopyCode = async () => {
    if (household?.inviteCode) {
      await navigator.clipboard.writeText(household.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (household?.inviteCode && navigator.share) {
      await navigator.share({
        title: t('app_name'),
        text: t('settings_share_invite_message', household.inviteCode),
      });
    }
  };

  const handleLeave = async () => {
    await leaveHousehold(householdId, user!.id);
    await updateUser({ activeHouseholdId: null });
    setShowLeaveDialog(false);
    navigate('/');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="screen">
      <div className="app-bar">
        <button className="app-bar-back" onClick={() => navigate(-1)}>←</button>
        <h1>
          <span>
            <span className="brand-logo sm"><img src="/favicon.png" alt="" /></span>
            <span>{t('settings_title')}</span>
          </span>
        </h1>
      </div>

      {/* Household Section */}
      {household && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ color: 'var(--primary)', padding: '16px 16px 0' }}>
            {t('settings_household_section')}
          </div>

          <div className="settings-item">
            <div>
              <div className="settings-label">🏠 {t('settings_household_name')}</div>
              <div className="settings-value">{household.name}</div>
            </div>
          </div>

          <div className="settings-item">
            <div>
              <div className="settings-label">{t('settings_invite_code')}</div>
              <div className="settings-value" style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
                {household.inviteCode}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn" onClick={handleCopyCode}>
                {codeCopied ? '✅' : '📋'}
              </button>
              {typeof navigator.share === 'function' && (
                <button className="icon-btn" onClick={handleShare}>
                  📤
                </button>
              )}
            </div>
          </div>

          <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="settings-label">👥 {t('settings_members')} ({members.length})</div>
            <div style={{ padding: '8px 0', width: '100%' }}>
              {members.map((m) => (
                <div key={m.userId} style={{
                  padding: '6px 0',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {m.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span>{m.displayName || m.userId}</span>
                  {m.role === 'OWNER' && (
                    <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{t('owner')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button className="btn-text" onClick={() => setShowLeaveDialog(true)}
            style={{ color: 'var(--error)', width: '100%', padding: '12px 16px' }}>
            🚪 {t('settings_leave_household')}
          </button>
        </div>
      )}

      {/* Account Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ color: 'var(--primary)', padding: '16px 16px 0' }}>
          {t('settings_account_section')}
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">{user!.displayName}</div>
            <div className="settings-value">{user!.email}</div>
          </div>
        </div>
        <button className="btn-text" onClick={() => setShowSignOutDialog(true)}
          style={{ color: 'var(--error)', width: '100%', padding: '12px 16px' }}>
          {t('settings_sign_out')}
        </button>
      </div>

      {/* Version */}
      <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: 12, marginTop: 16, opacity: 0.6 }}>
        {t('app_name')} PWA {t('settings_version', '1.0.0')}
      </div>

      {/* Sign Out Confirm */}
      {showSignOutDialog && (
        <div className="modal-overlay" onClick={() => setShowSignOutDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('settings_sign_out')}</h2>
            <p>{t('settings_sign_out_confirm')}</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSignOutDialog(false)}>{t('cancel')}</button>
              <button className="btn-danger" onClick={handleSignOut}>{t('settings_sign_out')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirm */}
      {showLeaveDialog && (
        <div className="modal-overlay" onClick={() => setShowLeaveDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('settings_leave_household')}</h2>
            <p>{t('settings_leave_household_confirm')}</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowLeaveDialog(false)}>{t('cancel')}</button>
              <button className="btn-danger" onClick={handleLeave}>{t('settings_leave_household')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
