// Plusieurs comptes sur un même appareil : le perso et le pro, par exemple.
//
// On ne garde JAMAIS de mot de passe. On garde la connexion déjà ouverte de
// chaque compte (ses jetons), exactement comme l'application le fait déjà
// pour le compte en cours. Passer de l'un à l'autre remplace simplement la
// connexion active ; l'autre reste valable, prête pour le retour.
//
// « Se déconnecter » ferme la connexion pour de bon côté serveur : le compte
// quitte alors la liste, il faudra retaper son mot de passe.
//
// « Ordinateur partagé » (un poste du bureau) : l'appareil est réservé au
// compte pro qui l'a activé. Les autres comptes et leurs données en sont
// effacés, et aucun autre ne peut plus s'y ranger ni s'y ouvrir. Le
// désactiver demande le code responsable (Mon compte).
import { supabase, clientSansMemoire } from '../supabaseClient.js';

const CLE = 'cmp.comptes';
const POSTE = 'cmp.postePartage';

/** L'appareil est-il réservé à un compte pro ? { userId, email } ou null. */
export function postePartage() {
  try {
    const p = JSON.parse(localStorage.getItem(POSTE) || 'null');
    return p && p.userId ? p : null;
  } catch {
    return null;
  }
}

export function lireComptes() {
  try {
    const l = JSON.parse(localStorage.getItem(CLE) || '[]');
    const poste = postePartage();
    return Array.isArray(l)
      ? l.filter((c) => c && c.userId && c.refresh && (!poste || c.userId === poste.userId))
      : [];
  } catch {
    return [];
  }
}

function ecrire(liste) {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* navigation privée : on fait sans */
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Le dernier espace ouvert : son identifiant est la VALEUR de la clé.
const DERNIER_ESPACE = 'cmp.household';

/**
 * Les identifiants (compte, espace) que porte une donnée gardée par l'appli :
 * dans le nom de la clé (« cmp:tasks:<espace> »…), ou dans sa valeur pour le
 * dernier espace ouvert.
 */
function idsDe(cle) {
  const ids = cle.match(UUID) || [];
  if (cle === DERNIER_ESPACE) ids.push(...(String(localStorage.getItem(cle) || '').match(UUID) || []));
  return ids.map((x) => x.toLowerCase());
}

/** Efface les données gardées sur l'appareil qui portent l'un de ces identifiants. */
function effacerDonnees(ids) {
  const cibles = new Set(ids.filter(Boolean).map((x) => x.toLowerCase()));
  if (cibles.size === 0) return;
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('cmp') || k === CLE || k === POSTE) continue;
      if (idsDe(k).some((id) => cibles.has(id))) localStorage.removeItem(k);
    }
  } catch {
    /* stockage indisponible */
  }
}

/** Efface toutes les données gardées qui portent un autre identifiant que ceux-ci. */
function effacerSauf(gardes) {
  const garder = new Set(gardes.filter(Boolean).map((x) => x.toLowerCase()));
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('cmp') || k === CLE || k === POSTE) continue;
      if (idsDe(k).some((id) => !garder.has(id))) localStorage.removeItem(k);
    }
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Range (ou met à jour) un compte. `type` vaut 'pro' pour un compte
 * entreprise, 'perso' sinon ; `nom`, celui de l'espace.
 */
export function memoriser({ session, nom, type, hid }) {
  if (!session || !session.user || !session.refresh_token) return;
  // Ordinateur partagé : rien d'autre que son compte pro ne s'y range.
  const poste = postePartage();
  if (poste && session.user.id !== poste.userId) return;
  const liste = lireComptes();
  const ancien = liste.find((c) => c.userId === session.user.id) || {};
  const entree = {
    userId: session.user.id,
    email: session.user.email || ancien.email || '',
    nom: nom ?? ancien.nom ?? '',
    type: type ?? ancien.type ?? 'perso',
    // Son espace : pour effacer ses données de l'appareil quand il en part.
    hid: hid ?? ancien.hid ?? null,
    access: session.access_token,
    refresh: session.refresh_token,
  };
  ecrire([...liste.filter((c) => c.userId !== entree.userId), entree]);
}

/** Au moins deux comptes rangés : l'appli s'ouvre alors sur leur choix. */
export const plusieursComptes = () => lireComptes().length >= 2;

/** Retire un compte de l'appareil, avec ses données. */
export function oublier(userId) {
  const parti = lireComptes().find((c) => c.userId === userId);
  ecrire(lireComptes().filter((c) => c.userId !== userId));
  effacerDonnees([userId, parti && parti.hid]);
}

/**
 * Réserve l'appareil à ce compte pro : les autres comptes partent, avec
 * tout ce que l'appli gardait d'eux.
 */
export function activerPostePartage({ userId, email, hid }) {
  try {
    localStorage.setItem(POSTE, JSON.stringify({ userId, email: email || '' }));
  } catch {
    return false;
  }
  ecrire(lireComptes());
  effacerSauf([userId, hid]);
  return true;
}

/** Le code responsable a été vérifié : l'appareil redevient libre. */
export function desactiverPostePartage() {
  try {
    localStorage.removeItem(POSTE);
  } catch {
    /* stockage indisponible */
  }
}

/** Passe sur un compte rangé. Renvoie null, ou 'expire' s'il faut se reconnecter. */
export async function basculer(userId) {
  const c = lireComptes().find((x) => x.userId === userId);
  if (!c || !supabase) return 'expire';
  const { error } = await supabase.auth.setSession({
    access_token: c.access,
    refresh_token: c.refresh,
  });
  if (error) {
    oublier(userId);
    return 'expire';
  }
  return null;
}

/**
 * Ouvre un compte pro avec son mot de passe (celui de l'administrateur),
 * sans fermer le compte en cours : client jetable, on range la connexion,
 * puis on bascule dessus. Renvoie null, ou le message d'erreur.
 */
export async function ajouter(email, motDePasse, type = 'pro') {
  const c = clientSansMemoire();
  if (!c) return 'indisponible';
  const { data, error } = await c.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: motDePasse,
  });
  if (error || !data.session) return error ? error.message : 'indisponible';
  memoriser({ session: data.session, type });
  return basculer(data.session.user.id);
}

/**
 * Crée un compte (pro par défaut) sans fermer celui en cours, toujours sans fermer ce dernier.
 * Renvoie null (le nouveau compte est ouvert), 'dejaInscrit' ou
 * 'confirmation' (le serveur attend un clic dans le mail), ou un message.
 */
export async function creer(email, motDePasse, type = 'pro') {
  const c = clientSansMemoire();
  if (!c) return 'indisponible';
  const { data, error } = await c.auth.signUp({
    email: String(email || '').trim(),
    password: motDePasse,
  });
  if (error) return /already registered/i.test(error.message) ? 'dejaInscrit' : error.message;
  if (!data.session) return 'confirmation';
  memoriser({ session: data.session, type });
  return basculer(data.session.user.id);
}
