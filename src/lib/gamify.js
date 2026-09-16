// Barème des points et catalogue de récompenses.
//
//   • ajouter une tâche .................... 1 point
//   • cocher une tâche qu'on a ajoutée ..... 1 point
//   • cocher une tâche ajoutée par l'autre . 1,5 point
//
// Les points se cumulent sans limite : on dépense quand on veut, ou on
// épargne pour une récompense plus forte.

export const POINT_ADD = 1;
export const POINT_OWN = 1;
export const POINT_OTHER = 1.5;

/** Nombre de tâches au-delà duquel le cerveau du foyer est « plein ». */
export const BRAIN_CAP = 15;

// Prix plancher d'une récompense : en dessous, ça ne vaut pas la peine
// d'être mis au catalogue.
export const REWARD_MIN = 10;

/** Arrondi au demi-point (évite les 1.4999999 du calcul flottant). */
const half = (n) => Math.round(n * 2) / 2;

/** Nombre de tâches en attente (charge mentale du foyer). */
export const pendingCount = (tasks) =>
  tasks.filter((t) => !t.deleted && !t.done).length;

/** Taux de remplissage du cerveau du foyer, entre 0 et 1. */
export const brainFill = (tasks, cap = BRAIN_CAP) => {
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(1, pendingCount(tasks) / cap));
};

/** Détail des points d'une personne : ce qu'elle a ajouté et coché. */
export const pointsBreakdown = (tasks, userId) => {
  let added = 0;
  let own = 0;
  let other = 0;
  for (const t of tasks) {
    if (t.deleted) continue;
    if (t.createdBy && t.createdBy === userId) added += 1;
    if (t.done && t.doneBy === userId) {
      if (t.createdBy && t.createdBy !== userId) other += 1;
      else own += 1;
    }
  }
  return {
    added,
    own,
    other,
    total: half(added * POINT_ADD + own * POINT_OWN + other * POINT_OTHER),
  };
};

/** Points gagnés par une personne. */
export const pointsEarned = (tasks, userId) =>
  pointsBreakdown(tasks, userId).total;

/** Points dépensés : somme du coût des récompenses prises. */
export const pointsSpent = (claims, userId) =>
  half(
    claims
      .filter((c) => !c.deleted && c.userId === userId)
      .reduce((s, c) => s + (Number(c.cost) || 0), 0),
  );

/** Points disponibles (jamais négatif). */
export const pointsAvailable = (tasks, claims, userId) =>
  Math.max(0, half(pointsEarned(tasks, userId) - pointsSpent(claims, userId)));

/** Récompenses vivantes, de la moins chère à la plus chère. */
export const sortRewards = (rewards) =>
  rewards
    .filter((r) => !r.deleted)
    .slice()
    .sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label, 'fr'));

/** Celles qu'on peut s'offrir tout de suite. */
export const affordable = (rewards, points) =>
  sortRewards(rewards).filter((r) => r.cost <= points);

/** La prochaine récompense hors de portée, et ce qu'il manque pour l'avoir. */
export const nextReward = (rewards, points) => {
  const next = sortRewards(rewards).find((r) => r.cost > points);
  return next ? { reward: next, missing: half(next.cost - points) } : null;
};

/**
 * Remplissage du dessin, entre 0 et 1.
 *
 * On mesure la progression vers la prochaine récompense **depuis zéro**, et
 * non depuis le palier précédent : sinon le cœur se viderait d'un coup chaque
 * fois qu'un palier est franchi, ce qui donne l'impression d'avoir tout perdu
 * alors que les points, eux, ne bougent pas.
 *
 * Sans catalogue, on vise le prix plancher d'une récompense, pour que le
 * dessin réagisse quand même aux premiers points.
 */
export const rewardFill = (rewards, points) => {
  const pts = Math.max(0, Number(points) || 0);
  const next = nextReward(rewards, pts);
  if (next) return Math.min(1, pts / next.reward.cost);
  // Plus rien au-dessus : soit tout est à portée, soit le catalogue est vide.
  const catalogue = sortRewards(rewards);
  if (catalogue.length > 0) return 1;
  return Math.min(1, pts / REWARD_MIN);
};

/** Écriture française des points : 12,5 */
export const formatPoints = (n) => String(half(n)).replace('.', ',');
