// Gamification : « cerveau » qui se remplit et points/gages par personne.

/** Nombre de tâches au-delà duquel le cerveau est plein. */
export const BRAIN_CAP = 15;

/** Coût d'un gage, en points. */
export const GAGE_COST = 10;

/** Nombre de tâches en attente (charge mentale du foyer). */
export const pendingCount = (tasks) =>
  tasks.filter((t) => !t.deleted && !t.done).length;

/** Taux de remplissage du cerveau, entre 0 et 1. */
export const brainFill = (tasks, cap = BRAIN_CAP) => {
  const n = pendingCount(tasks);
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(1, n / cap));
};

/** Points gagnés par une personne : ses tâches actuellement cochées. */
export const pointsEarned = (tasks, userId) =>
  tasks.filter((t) => !t.deleted && t.done && t.doneBy === userId).length;

/** Points dépensés par une personne : 10 par gage offert. */
export const pointsSpent = (gages, userId) =>
  gages.filter((g) => !g.deleted && g.fromUser === userId).length * GAGE_COST;

/** Points disponibles (jamais négatif). */
export const pointsAvailable = (tasks, gages, userId) =>
  Math.max(0, pointsEarned(tasks, userId) - pointsSpent(gages, userId));

/** Peut-on offrir un gage ? */
export const canGift = (tasks, gages, userId) =>
  pointsAvailable(tasks, gages, userId) >= GAGE_COST;

/** Progression vers le prochain gage : { done, total, remaining }. */
export const gageProgress = (tasks, gages, userId) => {
  const available = pointsAvailable(tasks, gages, userId);
  const done = available % GAGE_COST;
  return { done, total: GAGE_COST, remaining: GAGE_COST - done };
};

/** Gages reçus non honorés par une personne. */
export const gagesToHonour = (gages, userId) =>
  gages.filter((g) => !g.deleted && g.toUser === userId && !g.done);
