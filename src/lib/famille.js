// Le mode famille : dès 3 membres, le foyer n'est plus un couple — ou plus
// tôt, si le foyer l'a choisi (interrupteur dans Mon compte, households.famille).
// La base suit la même règle pour le catalogue (nas/db/catalogue.sql).
import { pointsAvailable } from './gamify.js';

export const SEUIL_FAMILLE = 3;

/** Famille d'office : le nombre de membres suffit, l'interrupteur n'y peut rien. */
export const familleDOffice = (members) => (members || []).length >= SEUIL_FAMILLE;

/** Le foyer est-il une famille ? */
export const estFamille = (members, activee = false) =>
  Boolean(activee) || familleDOffice(members);

// --- Les membres sans compte (proches.sql) -------------------------------
//
// Un enfant, par exemple : un prénom, sans e-mail ni code. Il agit sur le
// téléphone d'un parent ; la tâche qu'il coche porte son identifiant
// (doneProche) en plus du compte connecté (doneBy). Ses bons portent son
// identifiant (proche), celui qu'on désigne pour honorer un bon aussi
// (pourProche).

/**
 * Les tâches telles qu'elles comptent pour les points : une tâche ajoutée ou
 * cochée par un membre sans compte lui revient, pas au téléphone qui a servi.
 */
export const creditees = (tasks) =>
  (tasks || []).map((t) =>
    t.doneProche || t.createdProche
      ? {
          ...t,
          ...(t.doneProche ? { doneBy: t.doneProche } : {}),
          ...(t.createdProche ? { createdBy: t.createdProche } : {}),
        }
      : t,
  );

/** Les bons tels qu'ils comptent : celui d'un membre sans compte est à lui. */
export const bonsCredites = (claims) =>
  (claims || []).map((c) =>
    c.proche || c.pourProche
      ? { ...c, userId: c.proche || c.userId, pour: c.pourProche || c.pour }
      : c,
  );

/** Tout le monde au classement : les comptes, puis les membres sans compte actifs. */
export const tousLesMembres = (members, proches) => [
  ...(members || []),
  ...(proches || []).filter((p) => p.actif).map((p) => p.id),
];

/** Les prénoms de tous : comptes et membres sans compte. */
export const tousLesNoms = (names, proches) => ({
  ...(names || {}),
  ...Object.fromEntries((proches || []).map((p) => [p.id, p.nom])),
});

/**
 * Le classement des points disponibles, du plus riche au moins riche. Les
 * ex aequo partagent le même rang ; à égalité, l'ordre suit les prénoms pour
 * ne jamais bouger tout seul.
 */
export function classement(members, tasks, claims, names = {}) {
  const lignes = (members || []).map((id) => ({
    id,
    nom: names[id] || '',
    points: pointsAvailable(tasks, claims, id),
  }));
  lignes.sort(
    (a, b) => b.points - a.points || a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }) || String(a.id).localeCompare(String(b.id)),
  );
  let rang = 0;
  let precedent = null;
  return lignes.map((l, i) => {
    if (l.points !== precedent) rang = i + 1;
    precedent = l.points;
    return { ...l, rang };
  });
}
