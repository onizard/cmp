// L'ordre choisi à la main : appui long sur une tâche, puis on la glisse.
//
// Chaque tâche déplacée reçoit un rang (un nombre) ; la liste se trie dessus.
// Pour écrire le moins possible, une tâche posée entre deux voisines déjà
// rangées prend le rang du milieu : une seule tâche change. Sinon (premier
// déplacement dans la section, ou plus de place entre deux rangs), toute la
// section est renumérotée de 1000 en 1000, dans l'ordre affiché.

export const PAS = 1000;

const rangDe = (t) => (t && typeof t.rang === 'number' && Number.isFinite(t.rang) ? t.rang : null);

/**
 * Les rangs à écrire quand `deplacee` est posée à l'index `index` de
 * `section` (la section cible telle qu'affichée, sans la tâche déplacée).
 * Renvoie [{ id, rang }], la tâche déplacée toujours comprise.
 */
export function rangsAuDepot(section, index, deplacee) {
  const autres = section.filter((t) => t.id !== deplacee.id);
  const i = Math.max(0, Math.min(index, autres.length));
  if (autres.every((t) => rangDe(t) !== null)) {
    const avant = rangDe(autres[i - 1]);
    const apres = rangDe(autres[i]);
    let rang;
    if (avant === null && apres === null) rang = PAS;
    else if (avant === null) rang = apres - PAS;
    else if (apres === null) rang = avant + PAS;
    else rang = (avant + apres) / 2;
    if (rang !== avant && rang !== apres) return [{ id: deplacee.id, rang }];
  }
  const ordre = [...autres.slice(0, i), deplacee, ...autres.slice(i)];
  return ordre
    .map((t, k) => ({ id: t.id, rang: (k + 1) * PAS, avant: rangDe(t) }))
    .filter((x) => x.id === deplacee.id || x.avant !== x.rang)
    .map(({ id, rang }) => ({ id, rang }));
}
