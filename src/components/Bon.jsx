import { useT } from '../i18n/index.js';
import { formatPoints } from '../lib/gamify.js';

// Date courte, dans la langue en cours, calendrier grégorien impose.
const jour = (iso, lang) => {
  try {
    return new Intl.DateTimeFormat(`${lang}-u-ca-gregory`, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

/**
 * Un bon de récompense, façon carte à collectionner.
 *
 * Le dessin viendra plus tard : `visuel` porte alors un nom de fichier posé
 * dans /bons/. Sans visuel, la carte se dessine toute seule — même mise en
 * page, pour que le remplacement ne bouge rien d'autre que l'image.
 */
export default function Bon({ bon, libelle, visuel, lang, onUtiliser }) {
  const t = useT();
  const utilise = Boolean(bon.usedAt);

  return (
    <article className={`bon ${utilise ? 'bon-utilise' : ''}`}>
      <div
        className="bon-carte"
        style={visuel ? { backgroundImage: `url(/bons/${visuel})` } : undefined}
      >
        {!visuel && <div className="bon-fond" aria-hidden="true" />}

        <div className="bon-corps">
          <p className="bon-cout">{formatPoints(bon.cost)}</p>
          <p className="bon-texte">{libelle || bon.label}</p>
          <p className="bon-date">
            {utilise
              ? t('inventaire.utiliseLe', { quand: jour(bon.usedAt, lang) })
              : t('inventaire.obtenuLe', { quand: jour(bon.createdAt, lang) })}
          </p>
        </div>

        {utilise && (
          <div className="bon-poincon" aria-hidden="true">
            <span>{t('inventaire.poinconne')}</span>
          </div>
        )}
      </div>

      {/* Un bon ne se rend pas : il a été payé, il est acquis. La seule chose
          qu'on en fasse, c'est s'en servir. */}
      {!utilise && (
        <div className="bon-actions">
          <button className="btn btn-small btn-accent" type="button" onClick={onUtiliser}>
            {t('inventaire.utiliser')}
          </button>
        </div>
      )}
    </article>
  );
}
