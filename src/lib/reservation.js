// Réserver une tâche : « je m'en occupe », pour une heure.
//
// On prévient l'autre qu'il est inutile de s'y mettre. N'importe quelle tâche
// en attente se réserve, qu'on l'ait ajoutée ou non. Une seule à la fois ; on
// peut annuler, mais on ne réserve pas deux fois la même tâche le même jour.
//
// La base applique les mêmes règles (nas/db/reservation.sql) et seule fait
// autorité : elle pose aussi les heures, celles du serveur. Le jour est celui
// de Paris, comme les rappels, pour que l'appli et la base comptent pareil.

export const RESERVATION_MS = 60 * 60 * 1000;
const FUSEAU = 'Europe/Paris';

const jourDe = (quand) => {
  const d = new Date(quand);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/** La réservation court-elle encore ? Une tâche faite n'est plus réservée. */
export const reservationActive = (task, maintenant = Date.now()) =>
  Boolean(task) &&
  Boolean(task.reservePar) &&
  !task.done &&
  !task.deleted &&
  Date.parse(task.reserveFin) > maintenant;

/** La tâche que je suis en train de faire, s'il y en a une. */
export const maReservation = (tasks, userId, maintenant = Date.now()) =>
  (tasks || []).find(
    (t) => t.reservePar === userId && reservationActive(t, maintenant),
  ) || null;

/**
 * Où en est la réservation d'une tâche, vue par moi :
 *   'moi'        je l'ai réservée, ça court ;
 *   'autre'      l'autre l'a réservée, ça court ;
 *   'libre'      je peux la réserver ;
 *   'aujourdhui' je l'ai déjà réservée aujourd'hui : demain seulement ;
 *   'uneAutre'   j'en ai déjà une autre en cours ;
 *   null         tâche faite ou supprimée : la question ne se pose pas.
 */
export function etatReservation(task, tasks, userId, maintenant = Date.now()) {
  if (!task || task.done || task.deleted) return null;
  if (reservationActive(task, maintenant)) {
    return task.reservePar === userId ? 'moi' : 'autre';
  }
  if (
    task.reservePar === userId &&
    task.reserveDebut &&
    jourDe(task.reserveDebut) === jourDe(maintenant)
  ) {
    return 'aujourdhui';
  }
  const mienne = maReservation(tasks, userId, maintenant);
  if (mienne && mienne.id !== task.id) return 'uneAutre';
  return 'libre';
}

/** Minutes restantes, arrondies au-dessus : « encore 1 min » jusqu'au bout. */
export const minutesRestantes = (task, maintenant = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(task.reserveFin) - maintenant) / 60000));
