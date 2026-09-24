import { t } from '../i18n/index.js';

/**
 * Le libellé d'une récompense, dans la langue de la personne qui regarde.
 *
 * Les récompenses du catalogue de départ portent une `cle` : on la traduit.
 * Celles qui n'en ont pas — ou dont la clé est inconnue d'une version plus
 * ancienne de l'application — gardent leur libellé tel qu'il est en base. Un
 * libellé en français vaut mieux qu'une clé technique affichée à l'écran.
 */
export const libelleRecompense = (recompense) => {
  if (!recompense) return '';
  const cle = recompense.cle;
  if (cle) {
    const chemin = `catalogue.${cle}`;
    const traduit = t(chemin);
    if (traduit && traduit !== chemin) return traduit;
  }
  return recompense.label || '';
};

/**
 * Le libellé d'un bon. Il a été figé en base au moment de l'achat, en
 * français ; s'il vient du catalogue, on retrouve sa récompense pour le
 * traduire. Un souhait sur mesure reste tel qu'on l'a écrit : ce sont les mots
 * de la personne, on n'y touche pas.
 */
export const libelleBon = (bon, recompenses) => {
  if (!bon) return '';
  if (bon.rewardId) {
    const r = (recompenses || []).find((x) => x.id === bon.rewardId);
    if (r && r.cle) return libelleRecompense(r);
  }
  return bon.label || '';
};
