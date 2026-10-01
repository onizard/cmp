// Le mode famille : dès 3 membres, le foyer n'est plus un couple.
//
// Rien à activer : l'appli s'adapte au nombre de personnes. La base fait de
// même pour le catalogue de récompenses (nas/db/catalogue.sql).
import { pointsAvailable } from './gamify.js';

export const SEUIL_FAMILLE = 3;

/** Le foyer est-il une famille ? */
export const estFamille = (members) => (members || []).length >= SEUIL_FAMILLE;

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
