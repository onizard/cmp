import { useT } from '../i18n/index.js';

// `onRetour` : la petite flèche en haut à gauche, pour changer de compte.
export default function Header({ accroche, online = true, pending = 0, onRetour }) {
  const t = useT();
  return (
    <header className="header">
      {onRetour && (
        <button
          type="button"
          className="header-retour"
          onClick={onRetour}
          aria-label={t('comptes.changer')}
          title={t('comptes.changer')}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="brand-title">{t('app.titre')}</h1>
      <div className="tag">{t('app.tagline')}</div>
      {accroche && <p className="accroche">{accroche}</p>}
      {(!online || pending > 0) && (
        <p className="sync" role="status">
          {!online ? t('app.horsLigne') : t('app.synchro')}
          {pending > 0 ? ` · ${t('app.enAttente', { n: pending })}` : ''}
        </p>
      )}
    </header>
  );
}
