import { useT } from '../i18n/index.js';

export default function Header({ accroche, online = true, pending = 0 }) {
  const t = useT();
  return (
    <header className="header">
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
