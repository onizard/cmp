import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { formatPoints, secondesPourAnnuler, etatBon } from '../lib/gamify.js';

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
export default function Bon({
  bon,
  libelle,
  visuel,
  lang,
  autre,
  choix = null,
  lecture = false,
  onUtiliser,
  onAnnuler,
  onValider,
}) {
  const t = useT();
  // Poinçonné seulement quand son détenteur a validé que c'est fait. Entre
  // « Utiliser » et cette validation, le bon est en attente : l'autre est
  // prévenu, relancé, et le voit au milieu de son écran.
  const etat = etatBon(bon);
  // En famille, « Utiliser » demande d'abord à qui : `choix` liste les autres
  // membres. À deux, `choix` est vide et le bon part directement chez l'autre.
  const [choisir, setChoisir] = useState(false);
  const utilise = etat === 'honore';
  const enAttente = etat === 'enAttente';

  // Le compte à rebours de l'annulation. L'horloge ne tourne que pendant la
  // minute qui compte ; ensuite plus rien ne se redessine pour rien.
  const [reste, setReste] = useState(() => secondesPourAnnuler(bon));
  useEffect(() => {
    if (!onAnnuler) return undefined;
    setReste(secondesPourAnnuler(bon));
    if (secondesPourAnnuler(bon) <= 0) return undefined;
    const tic = setInterval(() => {
      const r = secondesPourAnnuler(bon);
      setReste(r);
      if (r <= 0) clearInterval(tic);
    }, 1000);
    return () => clearInterval(tic);
  }, [bon, onAnnuler]);

  return (
    <article
      id={lecture ? undefined : `bon-${bon.id}`}
      className={`bon ${utilise ? 'bon-utilise' : ''} ${enAttente ? 'bon-attente' : ''}`}
    >
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
              : enAttente
                ? t('inventaire.demandeLe', { quand: jour(bon.usedAt, lang) })
                : t('inventaire.obtenuLe', { quand: jour(bon.createdAt, lang) })}
          </p>
        </div>

        {enAttente && <span className="bon-ruban">{t('inventaire.enAttente')}</span>}

        {utilise && (
          <div className="bon-poincon" aria-hidden="true">
            <span>{t('inventaire.poinconne')}</span>
          </div>
        )}
      </div>

      {/* Un bon ne se rend pas : il a été payé, il est acquis. La seule
          exception, c'est l'erreur de doigt, rattrapable dans la minute. */}
      {!lecture && enAttente && (
        <div className="bon-actions">
          <p className="bon-prevenu">{t('inventaire.prevenu', { qui: autre })}</p>
          <button className="btn btn-small btn-accent" type="button" onClick={onValider}>
            {t('inventaire.cestFait')}
          </button>
        </div>
      )}

      {!lecture && etat === 'neuf' && choisir && (
        <div className="bon-actions bon-choix">
          <p className="bon-prevenu">{t('famille.quiHonore')}</p>
          <div className="bon-choix-noms">
            {choix.map((m) => (
              <button
                key={m.id}
                className="btn btn-small btn-accent"
                type="button"
                onClick={() => {
                  setChoisir(false);
                  onUtiliser(m.id);
                }}
              >
                {m.nom}
              </button>
            ))}
          </div>
          <button className="btn btn-small" type="button" onClick={() => setChoisir(false)}>
            {t('app.annuler')}
          </button>
        </div>
      )}

      {!lecture && etat === 'neuf' && !choisir && (
        <div className="bon-actions">
          <button
            className="btn btn-small btn-accent"
            type="button"
            onClick={() => (choix && choix.length > 1 ? setChoisir(true) : onUtiliser(choix?.[0]?.id))}
          >
            {t('inventaire.utiliser')}
          </button>
          {onAnnuler && reste > 0 && (
            <button className="btn btn-small bon-annuler" type="button" onClick={onAnnuler}>
              {t('inventaire.annuler', { n: reste })}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
