import { pointsBreakdown, pointsSpent } from './gamify.js';
import { addMonths, monthKey } from './visibility.js';

/**
 * Le bilan d'une personne, et d'elle seule.
 *
 * Les points cumulés sont ceux GAGNÉS depuis le début, dépenses comprises : on
 * doit pouvoir mesurer tout ce qu'on a porté, même quand on l'a déjà échangé
 * contre des récompenses. Ils se calculent comme sur l'onglet Cerveau — mêmes
 * règles, mêmes combos — pour que les deux écrans disent toujours la même chose.
 *
 * Par mois :
 *   · une tâche réalisée compte dans le mois où on l'a cochée ;
 *   · une tâche créée compte dans le mois où on l'a ajoutée.
 * Une tâche supprimée ne compte nulle part, comme pour les points.
 */
export const MOIS_AFFICHES = 6;

const moisDe = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : monthKey(d);
};

export function bilan(tasks, claims, userId, moisCourant = monthKey(), n = MOIS_AFFICHES) {
  const points = pointsBreakdown(tasks, userId);
  const depenses = pointsSpent(claims, userId);

  const parMois = new Map();
  const compter = (mois, champ) => {
    if (!mois || mois > moisCourant) return;
    const m = parMois.get(mois) || { realisees: 0, creees: 0 };
    m[champ] += 1;
    parMois.set(mois, m);
  };
  let realisees = 0;
  let creees = 0;
  for (const t of tasks || []) {
    if (t.deleted) continue;
    if (t.createdBy === userId) {
      creees += 1;
      compter(moisDe(t.createdAt), 'creees');
    }
    if (t.done && t.doneBy === userId) {
      realisees += 1;
      compter(t.doneMonth || moisDe(t.doneAt), 'realisees');
    }
  }

  // Les n derniers mois, mais pas avant la première activité : un compte de
  // deux mois n'a pas à traîner quatre colonnes vides devant lui.
  const premier = [...parMois.keys()].sort()[0] || moisCourant;
  const debut = addMonths(moisCourant, -(n - 1));
  const mois = [];
  for (let m = premier > debut ? premier : debut; m <= moisCourant; m = addMonths(m, 1)) {
    mois.push({ mois: m, ...(parMois.get(m) || { realisees: 0, creees: 0 }) });
  }

  return {
    cumules: points.total,
    bonus: points.bonus,
    depenses,
    disponibles: Math.max(0, Math.round((points.total - depenses) * 2) / 2),
    realisees,
    creees,
    mois,
  };
}

/** Graduations « rondes » pour l'axe : 0, puis des pas de 1, 2 ou 5 × 10ⁿ. */
export function graduations(max, voulues = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / voulues;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= brut);
  const haut = Math.ceil(max / pas) * pas;
  const out = [];
  for (let v = 0; v <= haut + 1e-9; v += pas) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
