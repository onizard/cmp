/**
 * Le combo du jour.
 *
 * La première tâche cochée dans la journée vaut son prix normal. La deuxième
 * vaut double, la troisième triple, et ainsi de suite : le rang de la tâche
 * dans la journée EST son multiplicateur.
 *
 * Le rang n'est pas rangé en base, il se recalcule à chaque lecture. C'est ce
 * qui le garde honnête : décocher la deuxième tâche d'une journée doit faire
 * redescendre la troisième au rang deux, sinon les points resteraient acquis
 * pour un combo qui n'existe plus.
 *
 * La journée est celle du téléphone, pas celle du serveur : une tâche cochée
 * à 23 h compte pour le jour qu'on est en train de vivre.
 */

/** Jour local d'un instant ISO, au format AAAA-MM-JJ. */
export const jourLocal = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Les tâches cochées par quelqu'un, de la plus ancienne à la plus récente. */
const cochees = (tasks, userId) =>
  tasks
    .filter((t) => !t.deleted && t.done && t.doneBy === userId && t.doneAt)
    .slice()
    .sort(
      (a, b) =>
        String(a.doneAt).localeCompare(String(b.doneAt)) ||
        String(a.id).localeCompare(String(b.id)),
    );

/**
 * Multiplicateur de chaque tâche cochée par une personne : identifiant → rang
 * dans sa journée. Une tâche sans instant de coche — cochée avant que la
 * colonne n'existe — n'entre pas dans le compte et vaut son prix normal.
 */
export const comboParTache = (tasks, userId) => {
  const rangs = new Map();
  if (!userId) return rangs;
  const vus = new Map();
  for (const t of cochees(tasks, userId)) {
    const jour = jourLocal(t.doneAt);
    if (!jour) continue;
    const rang = (vus.get(jour) || 0) + 1;
    vus.set(jour, rang);
    rangs.set(t.id, rang);
  }
  return rangs;
};

/** Multiplicateur d'une tâche donnée (1 si elle n'en a pas). */
export const comboDe = (tasks, userId, taskId) =>
  comboParTache(tasks, userId).get(taskId) || 1;

/**
 * Ce que vaudrait la prochaine coche : le rang qu'elle prendrait dans la
 * journée. C'est ce qu'on annonce à l'écran au moment de cocher.
 */
export const comboProchain = (tasks, userId, quand = new Date()) => {
  if (!userId) return 1;
  const jour = jourLocal(
    quand instanceof Date ? quand.toISOString() : String(quand),
  );
  if (!jour) return 1;
  let deja = 0;
  for (const t of tasks) {
    if (t.deleted || !t.done || t.doneBy !== userId || !t.doneAt) continue;
    if (jourLocal(t.doneAt) === jour) deja += 1;
  }
  return deja + 1;
};
