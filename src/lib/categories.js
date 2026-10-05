// Catégories de tâches : un nom, posé sur la tâche, pour ranger la liste.
//
// Elles naissent de deux façons : « #nom » à la fin d'une tâche qu'on ajoute,
// ou le bouton « Ajouter une catégorie » au bas du mois. Pour aller vite, on
// propose les noms déjà employés : le plus fréquent d'abord et, à fréquence
// égale, le plus récent.

export const CATEGORIE_MAX = 40;

/** Clé de comparaison : sans casse, sans accents, sans espaces autour. */
export const cleCategorie = (nom) =>
  String(nom || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Un nom propre : espaces resserrés, « # » de tête ôtés, 40 caractères. */
export const nomPropre = (nom) =>
  String(nom || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CATEGORIE_MAX);

/**
 * « acheter du pain #dépense » → { texte: 'acheter du pain', categorie: 'dépense' }.
 * Seul un hashtag en fin de texte compte : « #1 de la liste » reste un texte.
 */
export function extraireCategorie(saisie) {
  const brut = String(saisie || '');
  const m = /(^|\s)#([^\s#]+)\s*$/u.exec(brut);
  if (!m) return { texte: brut.trim(), categorie: null };
  const categorie = nomPropre(m[2]);
  return {
    texte: brut.slice(0, m.index).trim(),
    categorie: categorie || null,
  };
}

/**
 * Le « #déb » en cours de frappe, à la fin du texte : ce qu'on cherche
 * (« déb »), ou null s'il n'y a pas de hashtag entamé.
 */
export function hashtagEnCours(saisie) {
  const m = /(^|\s)#([^\s#]*)$/u.exec(String(saisie || ''));
  return m ? m[2] : null;
}

/** Remplace le hashtag entamé par la catégorie choisie. */
export function completerHashtag(saisie, nom) {
  return String(saisie || '').replace(/(^|\s)#([^\s#]*)$/u, `$1#${nom} `);
}

const horodatage = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Ce qu'on sait de chaque catégorie déjà employée dans le foyer, tous mois
 * confondus : son nom (tel qu'écrit la dernière fois), combien de fois elle a
 * servi et quand pour la dernière fois. `lignes` : les catégories créées au
 * bouton, qui comptent elles aussi.
 */
export function statsCategories(tasks = [], lignes = []) {
  const stats = new Map();
  const noter = (nom, quand) => {
    const cle = cleCategorie(nom);
    if (!cle) return;
    const s = stats.get(cle) || { nom, n: 0, recent: -1 };
    s.n += 1;
    const t = horodatage(quand);
    if (t >= s.recent) {
      s.recent = t;
      s.nom = nom;
    }
    stats.set(cle, s);
  };
  for (const t of tasks) if (!t.deleted && t.categorie) noter(t.categorie, t.createdAt);
  for (const l of lignes) noter(l.nom, l.createdAt);
  return stats;
}

/**
 * Les catégories qui commencent par `saisie` (toutes si elle est vide : « # »
 * seul les propose toutes), la plus fréquente en tête et, à égalité, la plus
 * récente. `exclure` : les clés à ne pas proposer.
 */
export function suggerer(stats, saisie, { exclure = [], max = 12 } = {}) {
  const debut = cleCategorie(saisie);
  const sauf = new Set(exclure.map(cleCategorie));
  return [...stats.entries()]
    .filter(([cle]) => cle.startsWith(debut) && !sauf.has(cle))
    .sort(([, a], [, b]) => b.n - a.n || b.recent - a.recent)
    .slice(0, max)
    .map(([, s]) => s.nom);
}

/** Le nom déjà employé pour cette catégorie, sinon celui qu'on vient de taper. */
export const nomConnu = (stats, nom) => {
  const s = stats.get(cleCategorie(nom));
  return s ? s.nom : nomPropre(nom);
};

/**
 * « #urgent » : toutes les tâches à faire qui ont une échéance, de la plus
 * proche à la plus lointaine. C'est une vue, pas un rangement : la tâche
 * garde sa catégorie (rappelée sur sa ligne), mais ne s'affiche qu'ici.
 */
export const urgentes = (aFaire = []) =>
  aFaire
    .filter((t) => t.dueAt && !Number.isNaN(Date.parse(t.dueAt)))
    .slice()
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

/**
 * Les sections du mois : les catégories des tâches à faire, plus celles
 * créées au bouton pour ce mois (même vides), par ordre alphabétique.
 * Chacune : { cle, nom, taches, ligne } — `ligne` si elle vient du bouton.
 */
export function sectionsDuMois(aFaire = [], lignes = [], mois) {
  const sections = new Map();
  const section = (nom) => {
    const cle = cleCategorie(nom);
    if (!sections.has(cle)) sections.set(cle, { cle, nom, taches: [], ligne: null });
    return sections.get(cle);
  };
  for (const l of lignes) if (l.mois === mois && cleCategorie(l.nom)) section(l.nom).ligne = l;
  const sans = [];
  for (const t of aFaire) {
    if (t.categorie && cleCategorie(t.categorie)) section(t.categorie).taches.push(t);
    else sans.push(t);
  }
  const liste = [...sections.values()].sort((a, b) =>
    a.nom.localeCompare(b.nom, undefined, { sensitivity: 'base' }),
  );
  return { sans, sections: liste };
}
