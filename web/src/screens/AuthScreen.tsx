import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/index';
import { mapAuthErrorToStringKey } from '../services/authErrorMapper';

const ANDROID_WEB_CONTINUE_KEY = 'salino_android_web_continue';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.salino.sali&hl=he';

export default function AuthScreen() {
  const { t } = useI18n();
  const { signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [showAndroidDownloadPrompt, setShowAndroidDownloadPrompt] = useState(false);
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(userAgent);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const continueOnWeb = localStorage.getItem(ANDROID_WEB_CONTINUE_KEY) === '1';
    if (isAndroid && !isStandalone && !continueOnWeb) {
      setShowAndroidDownloadPrompt(true);
    }
  }, [isAndroid]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setError(t(mapAuthErrorToStringKey(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (registerMode) {
        await registerWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: unknown) {
      setError(t(mapAuthErrorToStringKey(error)));
    } finally {
      setLoading(false);
    }
  };

  const continueToWeb = () => {
    localStorage.setItem(ANDROID_WEB_CONTINUE_KEY, '1');
    setShowAndroidDownloadPrompt(false);
  };

  if (showAndroidDownloadPrompt) {
    return (
      <div className="screen android-download-screen">
        <div className="card android-download-card">
          <div className="android-download-brand">
            <div className="android-download-logo-wrap">
              <img src="/favicon.png" alt={t('app_name')} className="android-download-logo" />
            </div>
            <div>
              <div className="android-download-appname">{t('app_name')}</div>
              <div className="android-download-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#00D1FF" d="M3 2l10.5 10L3 22z" />
                  <path fill="#00E676" d="M3 2l13 7-2.5 2.5z" />
                  <path fill="#FFEA00" d="M16 9l3.5 2-3.5 2-2.5-2.5z" />
                  <path fill="#FF3D00" d="M3 22l13-7-2.5-2.5z" />
                </svg>
                <span>{t('android_download_play_label')}</span>
              </div>
            </div>
          </div>
          <h2 className="android-download-title">{t('android_download_title')}</h2>
          <p className="android-download-subtitle">{t('android_download_subtitle')}</p>
          <ul className="android-download-list">
            <li>{t('android_download_bullet_1')}</li>
            <li>{t('android_download_bullet_2')}</li>
            <li>{t('android_download_bullet_3')}</li>
          </ul>
          <a className="btn-primary android-download-btn" href={PLAY_STORE_URL}>
            {t('android_download_cta')}
          </a>
          <button className="android-download-continue" onClick={continueToWeb}>
            {t('android_download_continue_web')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-logo">
          <img src="/favicon.png" alt={t('app_name')} />
        </div>
        <h1 className="auth-title">{t('app_name')}</h1>
        <p className="auth-subtitle">{t('auth_welcome_subtitle')}</p>
      </div>

      {error && (
        <div role="alert" style={{ color: 'var(--error)', fontSize: 14 }}>{error}</div>
      )}

      <button className="google-btn" onClick={handleSignIn} disabled={loading}>
        {loading ? (
          <>
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            {t('auth_signing_in')}
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            {t('auth_sign_in_google')}
          </>
        )}
      </button>

      <div style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>{t('auth_or')}</div>

      <div style={{ width: '100%', maxWidth: 360 }}>
        <label className="input-label" htmlFor="auth-email">{t('auth_email_label')}</label>
        <input
          id="auth-email"
          className="input-field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email_hint')}
          autoComplete="email"
          dir="ltr"
        />

        <div style={{ height: 12 }} />

        <label className="input-label" htmlFor="auth-password">{t('auth_password_label')}</label>
        <input
          id="auth-password"
          className="input-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth_password_hint')}
          autoComplete={registerMode ? 'new-password' : 'current-password'}
        />
      </div>

      <button
        className="btn-primary"
        onClick={handleEmailAuth}
        disabled={loading || !email || password.length < 6}
        style={{ width: '100%', maxWidth: 360 }}
      >
        {loading ? t('auth_signing_in') : registerMode ? t('auth_register_email') : t('auth_sign_in_email')}
      </button>

      <button
        className="btn-text"
        onClick={() => setRegisterMode((prev) => !prev)}
        disabled={loading}
        style={{ width: '100%', maxWidth: 360 }}
      >
        {registerMode ? t('auth_has_account_sign_in') : t('auth_no_account_register')}
      </button>
    </div>
  );
}
