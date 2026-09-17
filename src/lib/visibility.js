// Logique de visibilité mensuelle — le cœur du produit.
// Les clés de mois sont au format "YYYY-MM" et se comparent directement
// comme des chaînes (l'ordre lexicographique coïncide avec l'ordre chronologique).

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Clé "YYYY-MM" pour une date donnée (mois en cours par défaut). */
export const monthKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** Décale une clé de mois de `delta` mois (peut être négatif). */
export const addMonths = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

/** Tous les mois entre `start` et `end` inclus, ordre chronologique. */
export const monthRange = (start, end) => {
  const out = [];
  let cur = start;
  // garde-fou : au plus 1200 mois (un siècle) pour éviter toute boucle infinie
  for (let i = 0; cur <= end && i < 1200; i += 1) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
};

/** Nom du mois en minuscules, ex. "septembre". */
export const monthName = (key) => MONTHS_FR[Number(key.split('-')[1]) - 1];

/** Année d'une clé de mois, ex. "2026". */
export const yearOf = (key) => key.split('-')[0];

// --- Règle de visibilité (spécification, à respecter à la lettre) ---

/**
 * Dernier mois où la tâche reste visible.
 * - cochée : jusqu'à la fin du mois où elle a été cochée (doneMonth) ;
 * - non cochée : reportée jusqu'au mois en cours (ou son mois d'origine s'il est futur).
 */
export const lastVisibleMonth = (t, currentMonth) => {
  if (t.done && t.doneMonth) return t.doneMonth;
  return t.month > currentMonth ? t.month : currentMonth;
};

/** Une tâche est-elle visible dans le mois `m`, sachant le mois en cours ? */
export const visibleIn = (t, m, currentMonth) =>
  !t.deleted && t.month <= m && m <= lastVisibleMonth(t, currentMonth);

/** Tâches visibles dans un mois donné. */
export const tasksVisibleIn = (tasks, m, currentMonth) =>
  tasks.filter((t) => visibleIn(t, m, currentMonth));

/**
 * Tri d'affichage dans un mois, sans réglage ni manipulation :
 *   1. les cochées descendent en bas ;
 *   2. ce qui a une échéance passe devant, de la plus proche à la plus lointaine ;
 *   3. puis l'ordre chronologique d'ajout ;
 *   4. l'alphabétique départage, pour que l'ordre ne bouge jamais tout seul.
 */
const quand = (v) => {
  const t = new Date(v || '').getTime();
  return Number.isNaN(t) ? null : t;
};

export const sortForMonth = (tasks) =>
  [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;

    const da = a.done ? null : quand(a.dueAt);
    const db = b.done ? null : quand(b.dueAt);
    if (da !== null && db !== null && da !== db) return da - db;
    if (da !== null && db === null) return -1;
    if (da === null && db !== null) return 1;

    const ca = quand(a.createdAt);
    const cb = quand(b.createdAt);
    if (ca !== null && cb !== null && ca !== cb) return ca - cb;
    if (ca !== null && cb === null) return -1;
    if (ca === null && cb !== null) return 1;

    return String(a.text || '').localeCompare(String(b.text || ''), 'fr', {
      sensitivity: 'base',
    });
  });

/**
 * Mois à afficher : tout mois contenant au moins une tâche visible,
 * plus le mois en cours et le mois suivant. Ordre antichronologique.
 */
export const displayedMonths = (tasks, currentMonth) => {
  const live = tasks.filter((t) => !t.deleted);
  const next = addMonths(currentMonth, 1);
  const anchors = new Set([currentMonth, next]);
  for (const t of live) {
    anchors.add(t.month);
    anchors.add(lastVisibleMonth(t, currentMonth));
  }
  const sorted = [...anchors].sort();
  const span = monthRange(sorted[0], sorted[sorted.length - 1]);
  return span
    .filter(
      (m) =>
        m === currentMonth ||
        m === next ||
        live.some((t) => visibleIn(t, m, currentMonth)),
    )
    .sort()
    .reverse();
};

/** Groupe des clés de mois (déjà triées antichrono) par année. */
export const groupByYear = (months) => {
  const groups = [];
  for (const m of months) {
    const y = yearOf(m);
    const last = groups[groups.length - 1];
    if (last && last.year === y) last.months.push(m);
    else groups.push({ year: y, months: [m] });
  }
  return groups;
};

// --- Textes calculés ---

/** Phrase d'accroche selon le nombre de choses à faire ce mois-ci. */
export const headline = (count) => {
  if (count <= 0) return 'Rien en tête ce mois-ci.';
  if (count === 1) return '1 chose en tête ce mois-ci.';
  return `${count} choses en tête ce mois-ci.`;
};

/** Compteur d'un mois : « 3 à faire », « terminé » ou « rien ». */
export const monthSummary = (tasksInMonth) => {
  const todo = tasksInMonth.filter((t) => !t.done).length;
  if (todo > 0) return `${todo} à faire`;
  if (tasksInMonth.length > 0) return 'terminé';
  return 'rien';
};

/** Mention discrète « depuis mars » pour une tâche non cochée reportée. */
export const carriedFromLabel = (t, m) => {
  if (t.done) return null;
  if (m > t.month) return `depuis ${monthName(t.month)}`;
  return null;
};
