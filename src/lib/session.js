// Les sessions : sur un téléphone partagé, chacun ouvre la sienne.
//
// En famille, dès qu'il y a un membre sans compte (un enfant), le téléphone
// sert à plusieurs. Les tâches se voient dès l'ouverture ; au moment d'agir à
// son nom (cocher, ajouter, prendre un bon…), on touche son prénom et on tape
// son code s'il en a un. Tout ce qu'on fait ensuite est à son nom — tâches,
// points, bons, bilan — jusqu'à refermer (son prénom, en haut) ou cinq
// minutes sans toucher l'écran. En entreprise, pareil avec l'équipe, et une
// minute suffit à refermer.
//
// La base vérifie (nas/db/sessions.sql) : on n'agit pour un autre compte
// qu'avec le ticket que son code a ouvert ici.
import { useEffect, useRef } from 'react';
import { LANGUES } from '../i18n/index.js';
import { cleCategorie } from './categories.js';

export const DELAI_FAMILLE = 5 * 60 * 1000;
export const DELAI_PRO = 60 * 1000;
// Le ticket dure un quart d'heure : on le prolonge bien avant.
export const PROLONGER_MS = 4 * 60 * 1000;

/**
 * Le téléphone sert-il à plusieurs ? Seul, on va droit à ses tâches. En
 * entreprise, il faut une équipe : sans membre, on va droit à Mon compte
 * pour en ajouter.
 */
export const avecSessions = ({ entreprise = false, equipe = [], proches = [] } = {}) =>
  entreprise
    ? (equipe || []).some((m) => m.actif)
    : (proches || []).some((p) => p.actif);

/**
 * Qui peut ouvrir une session, dans l'ordre de l'écran : le compte du
 * téléphone, les autres adultes, puis les membres sans compte actifs.
 * Chacun : { id, nom, compte, proche, enfant }.
 */
export function personnes({ userId, members = [], names = {}, proches = [] }) {
  const comptes = [userId, ...(members || []).filter((id) => id !== userId)].map((id) => ({
    id,
    nom: names[id] || '',
    compte: id,
    proche: null,
    enfant: false,
  }));
  const enfants = (proches || [])
    .filter((p) => p.actif)
    .map((p) => ({ id: p.id, nom: p.nom, compte: userId, proche: p.id, enfant: true }));
  return [...comptes, ...enfants];
}

/**
 * Ouvrir la session de quelqu'un : 'code' s'il faut son code, 'direct'
 * sinon, 'sansCode' pour un autre adulte qui n'en a pas encore choisi (sans
 * code, personne ne peut agir pour lui depuis ce téléphone).
 */
export function entree(personne, userId, avecCode = []) {
  if ((avecCode || []).includes(personne.id)) return 'code';
  if (!personne.enfant && personne.id !== userId) return 'sansCode';
  return 'direct';
}

// --- Les tâches des enfants ----------------------------------------------
//
// Un enfant ne voit que les tâches rangées dans « enfants » (dans n'importe
// laquelle des langues de l'appli), et ce qu'il ajoute y va tout seul.

// Singulier ou pluriel, et les mots qu'on tape le plus souvent : « #enfant »
// vaut « #enfants », quel que soit qui a ajouté la tâche.
const VARIANTES = [
  'enfant', 'enfants', 'enfance', 'kid', 'kids', 'child', 'children',
  'niño', 'niños', 'niña', 'niñas', 'hijos', 'criança', 'crianças', 'filhos',
  'Kind', 'Kinder', 'bambino', 'bambini', 'bimbi', 'figli',
  'ребенок', 'ребёнок', 'дети', '孩子', '儿童', '子ども', '子供', 'こども',
  '아이', '아이들', '어린이', 'طفل', 'أطفال', 'الأطفال', 'بچه', 'بچه‌ها', 'کودکان',
  'ילד', 'ילדים', 'بچہ', 'بچے',
];
const NOMS_ENFANTS = new Set(
  [...LANGUES.map((l) => l.dict.session && l.dict.session.categorieEnfants), ...VARIANTES]
    .filter(Boolean)
    .map(cleCategorie),
);

export const estTacheEnfants = (task) =>
  Boolean(task && task.categorie) && NOMS_ENFANTS.has(cleCategorie(task.categorie));

/**
 * Le nom à donner à la catégorie des enfants : celui que le foyer emploie
 * déjà (`stats`, categories.js), dans n'importe quelle langue, sinon `defaut`
 * (celui de la langue du téléphone).
 */
export function nomEnfants(stats, defaut) {
  let mieux = null;
  for (const [cle, s] of stats || []) {
    if (NOMS_ENFANTS.has(cle) && (!mieux || s.n > mieux.n)) mieux = s;
  }
  return mieux ? mieux.nom : defaut;
}

/**
 * Inactivité : `onFin` part après `delai` sans toucher l'écran ni le clavier
 * (et au retour sur l'appli, si le délai est passé pendant ce temps).
 * `onActivite(dernier)` suit chaque geste, pour prolonger ce qui doit l'être.
 */
export function useInactivite(actif, delai, onFin, onActivite) {
  const dernier = useRef(Date.now());
  const fin = useRef(onFin);
  const activite = useRef(onActivite);
  fin.current = onFin;
  activite.current = onActivite;

  useEffect(() => {
    if (!actif) return undefined;
    dernier.current = Date.now();
    const verifier = () => {
      if (Date.now() - dernier.current >= delai) fin.current?.();
    };
    const geste = () => {
      if (Date.now() - dernier.current >= delai) {
        fin.current?.();
        return;
      }
      dernier.current = Date.now();
      activite.current?.();
    };
    const auRetour = () => {
      if (document.visibilityState === 'visible') verifier();
    };
    const evenements = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evenements.forEach((e) => window.addEventListener(e, geste, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', auRetour);
    const h = setInterval(verifier, Math.min(5000, delai / 4));
    return () => {
      evenements.forEach((e) => window.removeEventListener(e, geste, { capture: true }));
      document.removeEventListener('visibilitychange', auRetour);
      clearInterval(h);
    };
  }, [actif, delai]);
}
