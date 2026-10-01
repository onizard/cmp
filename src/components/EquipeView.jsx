import { useMemo } from 'react';
import { useT } from '../i18n/index.js';
import { formatPoints } from '../lib/gamify.js';
import { classement } from '../lib/famille.js';
import { tachesParOperateur } from '../lib/equipe.js';

const MEDAILLES = ['🥇', '🥈', '🥉'];

/**
 * Mode entreprise : l'onglet de l'équipe. Le classement des membres actifs,
 * avec les mêmes points que partout (ajouter, cocher, combo), mais comptés
 * par opérateur. Pas de récompenses ni de bons : au travail, ce n'est pas le
 * sujet.
 */
export default function EquipeView({ tasks, equipe }) {
  const t = useT();
  const actifs = equipe.membres.filter((m) => m.actif);

  const lignes = useMemo(() => {
    const parOp = tachesParOperateur(tasks);
    const rangs = classement(actifs.map((m) => m.id), parOp, [], equipe.noms);
    return rangs.map((l) => ({
      ...l,
      faites: parOp.filter((x) => !x.deleted && x.done && x.doneBy === l.id).length,
      ajoutees: parOp.filter((x) => !x.deleted && x.createdBy === l.id).length,
    }));
  }, [tasks, actifs, equipe.noms]);

  return (
    <main className="brain-view">
      <section className="classement classement-equipe" aria-label={t('entreprise.classement')}>
        <h2 className="setlabel">{t('entreprise.classement')}</h2>
        {lignes.length === 0 ? (
          <p className="setnote">{t('entreprise.equipeVide')}</p>
        ) : (
          <ol>
            {lignes.map((l) => (
              <li key={l.id}>
                <span className="classement-rang" aria-label={`#${l.rang}`}>
                  {MEDAILLES[l.rang - 1] || l.rang}
                </span>
                <span className="classement-nom">
                  {l.nom}
                  <span className="classement-detail">
                    {t('entreprise.detail', { faites: l.faites, ajoutees: l.ajoutees })}
                  </span>
                </span>
                <span className="pts">
                  <b>{formatPoints(l.points)}</b> {t('cerveau.pts')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
