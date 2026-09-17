// Échéances : à quel point c'est urgent, et comment le dire.
//
// Quatre niveaux, du plus calme au plus pressant. Ils pilotent à la fois la
// couleur de la pastille et le ton des notifications.
//   calme   : plus de 48 h devant soi
//   proche  : moins de 48 h
//   urgent  : moins de 6 h
//   depasse : l'heure est passée

const HOUR = 3600000;
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

const at = (dueAt) => {
  if (!dueAt) return null;
  const t = new Date(dueAt).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Niveau d'urgence, ou null s'il n'y a pas d'échéance. */
export function dueLevel(dueAt, now = Date.now()) {
  const t = at(dueAt);
  if (t === null) return null;
  const left = t - now;
  if (left < 0) return 'depasse';
  if (left <= 6 * HOUR) return 'urgent';
  if (left <= 48 * HOUR) return 'proche';
  return 'calme';
}

/** Temps restant dit court, pour la pastille : « dans 3 h », « en retard de 2 j ». */
export function dueLabel(dueAt, now = Date.now()) {
  const t = at(dueAt);
  if (t === null) return '';
  const diff = t - now;
  const late = diff < 0;
  const abs = Math.abs(diff);

  if (abs < 60000) return late ? 'à l’instant' : 'maintenant';
  if (abs < HOUR) {
    const m = Math.floor(abs / 60000);
    return late ? `en retard de ${m} min` : `dans ${m} min`;
  }
  if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    return late ? `en retard de ${h} h` : `dans ${h} h`;
  }
  const j = Math.floor(abs / DAY);
  if (j < 30) return late ? `en retard de ${j} j` : `dans ${j} j`;
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** L'échéance en toutes lettres, pour le panneau de la tâche. */
export function dueFull(dueAt, hasTime = true) {
  const t = at(dueAt);
  if (t === null) return '';
  const d = new Date(t);
  const jour = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return hasTime ? `${jour} à ${pad(d.getHours())} h ${pad(d.getMinutes())}` : jour;
}

/**
 * Compose une échéance à partir des champs du formulaire.
 * Sans heure, on vise la fin de la journée : une échéance « le 21 » n'est pas
 * en retard à 00 h 01.
 */
export function buildDue(date, time) {
  if (!date) return null;
  const hasTime = Boolean(time);
  const d = new Date(`${date}T${hasTime ? time : '23:59'}`);
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), hasTime };
}

/** Les valeurs à remettre dans les champs date et heure. */
export function splitDue(dueAt, hasTime = true) {
  const t = at(dueAt);
  if (t === null) return { date: '', time: '' };
  const d = new Date(t);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, time: hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '' };
}
