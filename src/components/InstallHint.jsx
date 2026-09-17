import { useInstall } from '../lib/install.js';
import { useT } from '../i18n/index.js';

/**
 * Explique comment poser l'application sur l'écran d'accueil.
 * Ne s'affiche jamais quand c'est déjà fait.
 */
export default function InstallHint() {
  const t = useT();
  const { mode, install, navigateur, hote } = useInstall();

  if (mode === 'installed' || mode === 'aucun') return null;

  if (mode === 'bouton') {
    return (
      <div className="install">
        <p className="install-title">{t('installation.titre')}</p>
        <p className="install-text">{t('installation.texte')}</p>
        <button className="btn btn-accent btn-block" type="button" onClick={install}>
          {t('installation.bouton')}
        </button>
      </div>
    );
  }

  // Coincé dans le navigateur d'une messagerie : il n'y a rien à faire ici,
  // l'entrée « Sur l'écran d'accueil » n'existe pas. On explique d'abord
  // comment en sortir, le reste n'a aucun sens tant qu'on y est.
  if (navigateur === 'integre') {
    return (
      <div className="install install-blocked">
        <p className="install-title">{t('installation.bloqueTitre')}</p>
        <p className="install-text">
          {t('installation.bloqueTexte', {
            hote: hote ? t('installation.bloqueA', { hote }) : t('installation.bloqueSansNom'),
          })}
        </p>
        <ol className="install-steps">
          <li>{t('installation.bloque1')}</li>
          <li>{t('installation.bloque2')}</li>
          <li>{t('installation.bloque3')}</li>
        </ol>
      </div>
    );
  }

  // iOS : aucun bouton n'est possible, Apple ne l'autorise pas.
  return (
    <div className="install">
      <p className="install-title">{t('installation.iosTitre')}</p>
      {navigateur === 'safari' ? (
        <ol className="install-steps">
          <li>{t('installation.iosPartager')}</li>
          <li>{t('installation.iosEcran')}</li>
          <li>{t('installation.iosAjouter')}</li>
        </ol>
      ) : (
        <>
          <p className="install-text">{t('installation.iosAutre')}</p>
          <ol className="install-steps">
            <li>{t('installation.iosPartager')}</li>
            <li>{t('installation.iosEcran')}</li>
          </ol>
        </>
      )}
      <p className="install-text">{t('installation.iosRien')}</p>
    </div>
  );
}
