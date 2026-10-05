import { useEffect, useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { bonsAHonorer, etatBon } from '../lib/gamify.js';
import { libelleBon } from '../lib/libelle.js';
import Bon from './Bon.jsx';

// Tant qu'un bon attend, il revient au milieu de l'écran toutes les cinq
// minutes si l'application reste ouverte.
const RAPPEL_ECRAN_MS = 5 * 60 * 1000;

/**
 * Le bon que l'autre vient d'utiliser, au milieu de l'écran.
 *
 * Il s'affiche à l'ouverture, au retour sur l'application, dès qu'un nouveau
 * bon est utilisé, et revient régulièrement si on l'a écarté. On peut l'écarter
 * — « J'y vais » — mais pas le faire disparaître : seul le détenteur du bon,
 * en validant que c'est fait, y met fin.
 */
export default function BonsAHonorer({ claims, rewards, names, userId, proches = [] }) {
  const t = useT();
  // Les miens, puis ceux d'un membre sans compte (un enfant) : il n'a pas de
  // téléphone, son bon s'affiche donc sur ceux du foyer — sauf chez qui l'a
  // utilisé. `claims` : les bons crédités (famille.js).
  const actifs = new Set(proches.filter((p) => p.actif).map((p) => p.id));
  const pourUnProche = (claims || []).filter(
    (c) => !c.deleted && actifs.has(c.pour) && c.userId !== userId && etatBon(c) === 'enAttente',
  );
  const enAttente = [...bonsAHonorer(claims, userId), ...pourUnProche];
  // Quand on l'a écarté, et quels bons étaient alors affichés.
  const [ecarte, setEcarte] = useState(null);
  const [, setTic] = useState(0);

  // Retour sur l'application : on remontre.
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') setEcarte(null);
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, []);

  // Une horloge lente, seulement pendant qu'on a écarté un bon, pour le faire
  // revenir au bout du délai.
  useEffect(() => {
    if (!ecarte) return undefined;
    const h = setInterval(() => setTic((n) => n + 1), 15_000);
    return () => clearInterval(h);
  }, [ecarte]);

  if (enAttente.length === 0) return null;

  const nouveau = ecarte && enAttente.some((b) => !ecarte.ids.includes(b.id));
  const delaiEcoule = ecarte && Date.now() - ecarte.at >= RAPPEL_ECRAN_MS;
  if (ecarte && !nouveau && !delaiEcoule) return null;

  const qui = names[enAttente[0].userId] || t('cerveau.binome');
  const visuel = (b) => {
    const r = b.rewardId && rewards.find((x) => x.id === b.rewardId);
    return (r && r.visuel) || null;
  };

  return (
    <div className="honorer-voile" role="dialog" aria-modal="true" aria-labelledby="honorer-titre">
      <div className="honorer">
        <h2 id="honorer-titre" className="honorer-titre">
          {t('honorer.titre', { qui, n: enAttente.length })}
        </h2>
        <div className="honorer-bons">
          {enAttente.map((b) => (
            <Bon
              key={b.id}
              bon={b}
              libelle={libelleBon(b, rewards)}
              visuel={visuel(b)}
              lang={langue()}
              lecture
            />
          ))}
        </div>
        <p className="honorer-texte">
          {actifs.has(enAttente[0].pour)
            ? t('honorer.pourProche', { qui, nom: names[enAttente[0].pour] || '' })
            : t('honorer.texte', { qui })}
        </p>
        <button
          className="btn btn-accent btn-block"
          type="button"
          autoFocus
          onClick={() => setEcarte({ at: Date.now(), ids: enAttente.map((b) => b.id) })}
        >
          {t('honorer.ok')}
        </button>
      </div>
    </div>
  );
}
