// Plusieurs comptes sur un même appareil : le perso et le pro, par exemple.
//
// On ne garde JAMAIS de mot de passe. On garde la connexion déjà ouverte de
// chaque compte (ses jetons), exactement comme l'application le fait déjà
// pour le compte en cours. Passer de l'un à l'autre remplace simplement la
// connexion active ; l'autre reste valable, prête pour le retour.
//
// « Se déconnecter » ferme la connexion pour de bon côté serveur : le compte
// quitte alors la liste, il faudra retaper son mot de passe.
import { supabase, clientSansMemoire } from '../supabaseClient.js';

const CLE = 'cmp.comptes';

export function lireComptes() {
  try {
    const l = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(l) ? l.filter((c) => c && c.userId && c.refresh) : [];
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

/**
 * Range (ou met à jour) un compte. `type` vaut 'pro' pour un compte
 * entreprise, 'perso' sinon ; `nom`, celui de l'espace.
 */
export function memoriser({ session, nom, type }) {
  if (!session || !session.user || !session.refresh_token) return;
  const liste = lireComptes();
  const ancien = liste.find((c) => c.userId === session.user.id) || {};
  const entree = {
    userId: session.user.id,
    email: session.user.email || ancien.email || '',
    nom: nom ?? ancien.nom ?? '',
    type: type ?? ancien.type ?? 'perso',
    access: session.access_token,
    refresh: session.refresh_token,
  };
  ecrire([...liste.filter((c) => c.userId !== entree.userId), entree]);
}

/** Au moins deux comptes rangés : l'appli s'ouvre alors sur leur choix. */
export const plusieursComptes = () => lireComptes().length >= 2;

export function oublier(userId) {
  ecrire(lireComptes().filter((c) => c.userId !== userId));
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
export async function ajouter(email, motDePasse) {
  const c = clientSansMemoire();
  if (!c) return 'indisponible';
  const { data, error } = await c.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: motDePasse,
  });
  if (error || !data.session) return error ? error.message : 'indisponible';
  memoriser({ session: data.session, type: 'pro' });
  return basculer(data.session.user.id);
}

/**
 * Crée un compte pro depuis un compte perso, toujours sans fermer ce dernier.
 * Renvoie null (le nouveau compte est ouvert), 'dejaInscrit' ou
 * 'confirmation' (le serveur attend un clic dans le mail), ou un message.
 */
export async function creer(email, motDePasse) {
  const c = clientSansMemoire();
  if (!c) return 'indisponible';
  const { data, error } = await c.auth.signUp({
    email: String(email || '').trim(),
    password: motDePasse,
  });
  if (error) return /already registered/i.test(error.message) ? 'dejaInscrit' : error.message;
  if (!data.session) return 'confirmation';
  memoriser({ session: data.session, type: 'pro' });
  return basculer(data.session.user.id);
}
