import { useT } from '../i18n/index.js';
import { basculer } from '../lib/comptes.js';

/**
 * La réponse à une demande pour rejoindre un compte pro, au-dessus de tout :
 * acceptée (avec de quoi l'ouvrir tout de suite), refusée ou annulée.
 */
export default function AccesAnnonce({ annonce, onFini }) {
  const t = useT();
  if (!annonce) return null;
  const { statut, nom, proId } = annonce;
  const texte =
    statut === 'acceptee'
      ? t('comptes.accesAcceptee', { nom })
      : statut === 'refusee'
        ? t('comptes.accesRefusee', { nom })
        : statut === 'bloquee'
          ? t('comptes.accesBloquee', { nom })
          : t('comptes.accesExpiree', { nom });

  return (
    <div className="code-voile" role="dialog" aria-modal="true" aria-labelledby="acces-annonce">
      <div className="code-carte acces-annonce">
        <p id="acces-annonce" className="lede">
          {statut === 'acceptee' ? '✅ ' : ''}
          {texte}
        </p>
        {statut === 'acceptee' && proId && (
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={async () => {
              onFini();
              await basculer(proId);
            }}
          >
            {t('comptes.ouvrirPro')}
          </button>
        )}
        <button className="btn btn-block" type="button" onClick={onFini}>
          {statut === 'acceptee' ? t('comptes.plusTard') : t('nouvelles.ok')}
        </button>
      </div>
    </div>
  );
}
