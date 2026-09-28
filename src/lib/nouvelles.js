// Les nouvelles : ce que l'autre a coché depuis la dernière fois.
//
// Chaque appareil retient, dans son propre stockage, les coches déjà vues.
// On garde les identifiants plutôt qu'une simple date : une coche faite hors
// ligne arrive parfois après une plus récente, et elle ne doit pas passer à
// la trappe pour autant.
//
// Au tout premier passage, on remonte d'un jour seulement : l'autre voit ce
// qui s'est fait depuis la veille, sans une avalanche de vieilles nouvelles.

const RECUL_INITIAL_MS = 24 * 60 * 60 * 1000;
const MAX_VUS = 300;

const cle = (userId) => `cmp.nouvelles.${userId}`;

/** L'état mémorisé : depuis quand on regarde, et ce qu'on a déjà vu. */
export function lireVus(userId, maintenant = Date.now()) {
  try {
    const brut = JSON.parse(localStorage.getItem(cle(userId)) || 'null');
    if (brut && typeof brut.depuis === 'string' && Array.isArray(brut.vus)) {
      return brut;
    }
  } catch {
    /* stockage absent ou illisible : on repart de zéro */
  }
  const etat = { depuis: new Date(maintenant - RECUL_INITIAL_MS).toISOString(), vus: [] };
  ecrire(userId, etat);
  return etat;
}

function ecrire(userId, etat) {
  try {
    localStorage.setItem(cle(userId), JSON.stringify(etat));
  } catch {
    /* ignore */
  }
}

/**
 * Les tâches que l'autre a cochées et qu'on n'a pas encore vues, de la plus
 * ancienne à la plus récente. Une tâche décochée depuis n'est plus une
 * nouvelle.
 */
export function nouvellesCoches(tasks, userId, etat) {
  const depuis = Date.parse(etat.depuis) || 0;
  const vus = new Set(etat.vus.map((v) => v.id));
  return (tasks || [])
    .filter(
      (t) =>
        t.done &&
        !t.deleted &&
        t.doneBy &&
        t.doneBy !== userId &&
        t.doneAt &&
        Date.parse(t.doneAt) > depuis &&
        !vus.has(t.id),
    )
    .sort((a, b) => Date.parse(a.doneAt) - Date.parse(b.doneAt));
}

/**
 * On en a pris connaissance : elle ne reviendra plus sur cet appareil.
 * Quand la liste devient longue, on oublie les plus anciennes et on avance
 * d'autant la date de départ, pour qu'elles ne reviennent pas non plus.
 */
export function marquerVue(userId, etat, tache) {
  let vus = [...etat.vus.filter((v) => v.id !== tache.id), { id: tache.id, at: tache.doneAt }];
  let depuis = etat.depuis;
  if (vus.length > MAX_VUS) {
    vus.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const oubliees = vus.slice(0, vus.length - MAX_VUS);
    vus = vus.slice(-MAX_VUS);
    const derniere = oubliees[oubliees.length - 1].at;
    if (Date.parse(derniere) > Date.parse(depuis)) depuis = derniere;
  }
  const suivant = { depuis, vus };
  ecrire(userId, suivant);
  return suivant;
}
