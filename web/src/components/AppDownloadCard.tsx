import { APP_STORE_URL, PLAY_STORE_URL } from '../constants/storeLinks';
import { useI18n } from '../i18n/index';

type AppDownloadCardProps = {
  showContinueWeb?: boolean;
  onContinueWeb?: () => void;
  continueWebHref?: string;
  showIos?: boolean;
  showAndroid?: boolean;
};

export default function AppDownloadCard({
  showContinueWeb = false,
  onContinueWeb,
  continueWebHref = '/',
  showIos = true,
  showAndroid = true,
}: AppDownloadCardProps) {
  const { t } = useI18n();

  return (
    <div className="card app-download-card">
      <div className="app-download-brand">
        <div className="app-download-logo-wrap">
          <img src="/favicon.png" alt={t('app_name')} className="app-download-logo" />
        </div>
        <div>
          <div className="app-download-appname">{t('app_name')}</div>
          <p className="app-download-tagline">{t('brand_tagline')}</p>
        </div>
      </div>

      <h1 className="app-download-title">{t('android_download_title')}</h1>

      <div className="app-download-about">
        <p>{t('app_download_about_1')}</p>
        <p>{t('app_download_about_2')}</p>
        <p>{t('app_download_about_3')}</p>
      </div>

      <div className="app-download-store-actions">
        {showIos && (
          <a className="app-download-store-badge app-download-store-badge--apple" href={APP_STORE_URL} title={t('ios_download_cta')}>
            <img src="/badges/app-store-badge.svg" alt={t('ios_download_cta')} />
          </a>
        )}
        {showAndroid && (
          <a className="app-download-store-badge app-download-store-badge--google" href={PLAY_STORE_URL} title={t('android_download_cta')}>
            <img src="/badges/google-play-badge.png" alt={t('android_download_cta')} />
          </a>
        )}
      </div>

      {showContinueWeb &&
        (onContinueWeb ? (
          <button type="button" className="app-download-continue" onClick={onContinueWeb}>
            {t('android_download_continue_web')}
          </button>
        ) : (
          <a className="app-download-continue" href={continueWebHref}>
            {t('android_download_continue_web')}
          </a>
        ))}
    </div>
  );
}
