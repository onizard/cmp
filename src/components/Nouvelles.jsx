import { useEffect, useMemo, useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { lireVus, nouvellesCoches, marquerVue } from '../lib/nouvelles.js';

// Les confettis aux couleurs de l'application, avec du vert menthe comme la
// pastille de la coche, et un peu d'or pour la fête.
const COULEURS = ['#f0919c', '#b486cc', '#8b9de6', '#5fd3b3', '#ffd166', '#f0919c', '#b486cc', '#5fd3b3'];
const NB_CONFETTIS = 42;

/** Un tirage de confettis : direction, distance, rotation, forme, couleur. */
function tirerConfettis() {
  return Array.from({ length: NB_CONFETTIS }, (_, i) => {
    const angle = (i / NB_CONFETTIS) * Math.PI * 2 + Math.random() * 0.5;
    const portee = 90 + Math.random() * 110;
    return {
      x: Math.cos(angle) * portee,
      y: Math.sin(angle) * portee * 0.8 - 40,
      tour: Math.round(Math.random() * 720 - 360),
      delai: Math.round(Math.random() * 120),
      couleur: COULEURS[i % COULEURS.length],
      rond: i % 3 === 0,
    };
  });
}

function quand(t, iso) {
  const d = new Date(iso);
  const lang = langue();
  const h = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const jour = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(new Date()) - jour(d)) / 86_400_000);
  if (ecart <= 0) return t('nouvelles.aujourdhui', { h });
  if (ecart === 1) return t('nouvelles.hier', { h });
  return t('nouvelles.le', { d: d.toLocaleDateString(lang, { day: 'numeric', month: 'long' }), h });
}

/**
 * Ce que l'autre a coché depuis la dernière fois, une tâche à la fois.
 *
 * Elle s'affiche à l'ouverture, au retour sur l'application, et dès qu'une
 * coche arrive pendant qu'elle est ouverte. Chaque fenêtre éclate en
 * confettis ; « OK » la range et laisse place à la suivante.
 */
export default function Nouvelles({ tasks, names, userId }) {
  const t = useT();
  const [etat, setEtat] = useState(() => lireVus(userId));
  const file = useMemo(() => nouvellesCoches(tasks, userId, etat), [tasks, userId, etat]);
  const tache = file[0];
  const confettis = useMemo(() => (tache ? tirerConfettis() : []), [tache && tache.id]);

  // Un autre appareil ou un autre onglet a pu en voir entre-temps.
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') setEtat(lireVus(userId));
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [userId]);

  if (!tache) return null;

  // Cochée par un membre sans compte (un enfant) : c'est son prénom.
  const qui = names[tache.doneProche] || names[tache.doneBy] || t('cerveau.binome');

  return (
    <div className="nouvelle-voile" role="dialog" aria-modal="true" aria-labelledby="nouvelle-titre">
      <div className="nouvelle" key={tache.id}>
        <div className="confettis" aria-hidden="true">
          {confettis.map((c, i) => (
            <i
              key={i}
              className={c.rond ? 'rond' : ''}
              style={{
                '--x': `${c.x}px`,
                '--y': `${c.y}px`,
                '--r': `${c.tour}deg`,
                '--d': `${c.delai}ms`,
                background: c.couleur,
              }}
            />
          ))}
        </div>
        <span className="nouvelle-coche" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p id="nouvelle-titre" className="nouvelle-qui">{t('nouvelles.titre', { qui })}</p>
        <p className="nouvelle-tache">{tache.text}</p>
        <p className="nouvelle-quand">{quand(t, tache.doneAt)}</p>
        {file.length > 1 && (
          <p className="nouvelle-compte">{t('nouvelles.encore', { n: file.length - 1 })}</p>
        )}
        <button
          className="btn btn-accent btn-block nouvelle-ok"
          type="button"
          autoFocus
          onClick={() => setEtat((e) => marquerVue(userId, e, tache))}
        >
          {t('nouvelles.ok')}
        </button>
      </div>
    </div>
  );
}
