// Langues de l'application.
//
// Un dictionnaire par langue, des clés pointées, et une fonction t() qui
// retombe sur le français quand une traduction manque — jamais sur une clé
// nue affichée à l'écran.
//
// Les langues qui s'écrivent de droite à gauche (hébreu, arabe) demandent plus
// qu'une traduction : la mise en page entière se retourne. C'est `dir` qui le
// pilote, posé sur <html>, et la feuille de style s'appuie sur des propriétés
// logiques (inline-start / inline-end) plutôt que sur gauche et droite.

import { useEffect, useState } from 'react';

import fr from './fr.js';
import en from './en.js';
import es from './es.js';
import pt from './pt.js';
import de from './de.js';
import it from './it.js';
import ru from './ru.js';
import zh from './zh.js';
import ar from './ar.js';
import fa from './fa.js';
import he from './he.js';

export const LANGUES = [
  { code: 'fr', nom: 'Français', dir: 'ltr', dict: fr },
  { code: 'en', nom: 'English', dir: 'ltr', dict: en },
  { code: 'es', nom: 'Español', dir: 'ltr', dict: es },
  { code: 'pt', nom: 'Português', dir: 'ltr', dict: pt },
  { code: 'de', nom: 'Deutsch', dir: 'ltr', dict: de },
  { code: 'it', nom: 'Italiano', dir: 'ltr', dict: it },
  { code: 'ru', nom: 'Русский', dir: 'ltr', dict: ru },
  { code: 'zh', nom: '中文', dir: 'ltr', dict: zh },
  { code: 'ar', nom: 'العربية', dir: 'rtl', dict: ar },
  { code: 'fa', nom: 'فارسی', dir: 'rtl', dict: fa },
  { code: 'he', nom: 'עברית', dir: 'rtl', dict: he },
];

// Le dictionnaire de référence est le français, mais quelqu'un dont la langue
// n'est pas gérée a bien plus de chances de lire l'anglais : c'est lui le
// repli. Le français n'apparaît que si le téléphone le réclame.
const REFERENCE = 'fr';
const REPLI = 'en';
const CLE = 'cmp.langue';

const parCode = (code) => LANGUES.find((l) => l.code === code) || null;

/**
 * La langue du téléphone, si on la gère. On parcourt toute la liste des
 * préférences : quelqu'un qui a « ja, en » recevra l'anglais, sa deuxième
 * langue, plutôt qu'un repli imposé.
 */
function langueDuNavigateur() {
  if (typeof navigator === 'undefined') return REFERENCE;
  const liste = navigator.languages || [navigator.language || ''];
  for (const brut of liste) {
    const court = String(brut).toLowerCase().split('-')[0];
    // L'hébreu s'est appelé « iw » avant de s'appeler « he ».
    const code = court === 'iw' ? 'he' : court;
    if (parCode(code)) return code;
  }
  return REPLI;
}

function lue() {
  try {
    const v = localStorage.getItem(CLE);
    if (v && parCode(v)) return v;
  } catch {
    /* ignore */
  }
  return langueDuNavigateur();
}

let courante = typeof window === 'undefined' ? REFERENCE : lue();
const abonnes = new Set();

export const langue = () => courante;
export const direction = () => (parCode(courante) || LANGUES[0]).dir;
export const estRTL = () => direction() === 'rtl';

/** Applique la langue au document : c'est ce qui retourne la mise en page. */
export function appliquerAuDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = courante;
  document.documentElement.dir = direction();
}

export function definirLangue(code) {
  if (!parCode(code)) return;
  courante = code;
  try {
    localStorage.setItem(CLE, code);
  } catch {
    /* ignore */
  }
  appliquerAuDocument();
  abonnes.forEach((fn) => fn(code));
}

export function sAbonner(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

const creuser = (dict, cle) =>
  cle.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);

const remplir = (texte, vars) =>
  String(texte).replace(/\{(\w+)\}/g, (_, k) =>
    vars && k in vars ? String(vars[k]) : `{${k}}`,
  );

/**
 * Traduit une clé. `vars` remplit les {trous}.
 * Une valeur objet { un, autre } se décline sur `vars.n`.
 */
export function t(cle, vars) {
  const dict = (parCode(courante) || LANGUES[0]).dict;
  let valeur = creuser(dict, cle);
  if (valeur === undefined) valeur = creuser(fr, cle);
  if (valeur === undefined) return cle;

  if (valeur && typeof valeur === 'object') {
    const n = Number(vars && vars.n);
    valeur = n === 1 ? valeur.un : valeur.autre;
    if (valeur === undefined) return cle;
  }
  return remplir(valeur, vars);
}

/** Les noms de mois et les dates viennent du système, pas du dictionnaire. */
export const nomDuMois = (annee, mois) => {
  try {
    const d = new Date(Number(annee), Number(mois) - 1, 1);
    // Calendrier grégorien imposé : l'application range ses tâches par mois
    // grégorien, et `fa` bascule sinon sur le calendrier jalali, dont les mois
    // chevauchent deux mois grégoriens — l'étiquette mentirait sur le contenu.
    return new Intl.DateTimeFormat(`${courante}-u-ca-gregory`, {
      month: 'long',
    }).format(d);
  } catch {
    return String(mois);
  }
};

// --- Intégration React ---

/**
 * Renvoie t() et redessine l'écran quand la langue change.
 * Les modules hors React importent t() directement : il lit la même variable.
 */
export function useT() {
  const [, forcer] = useState(langue());
  useEffect(() => sAbonner(forcer), []);
  return t;
}
