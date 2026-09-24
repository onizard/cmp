import { t } from '../i18n/index.js';
// Invitation par lien : le code du foyer voyage dans l'adresse.
//
// Le lien mène à /?foyer=<code>. À l'ouverture, on met le code de côté et on
// nettoie l'adresse ; il sera consommé dès que la personne aura un compte.
//
// Attention iPhone : l'application posée sur l'écran d'accueil a un stockage
// distinct de Safari. Le code mémorisé dans le navigateur ne la suit donc pas.
// Ce n'est pas gênant, parce que l'appartenance au foyer est enregistrée en
// base au moment de l'inscription — elle suit le compte, pas l'appareil.

const CLE = 'cmp.invitation';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le code d'invitation contenu dans une adresse, s'il est valide. */
export function codeDeLUrl(href) {
  try {
    const url = new URL(href);
    const brut = (url.searchParams.get('foyer') || '').trim();
    return UUID_RE.test(brut) ? brut.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** L'adresse à partager pour rejoindre ce foyer. */
export function lienDInvitation(origine, code) {
  if (!UUID_RE.test(String(code || ''))) return null;
  const base = String(origine || '').replace(/\/+$/, '');
  return `${base}/?foyer=${code}`;
}

/** Le message qui accompagne le lien. */
export function messageDInvitation(prenom) {
  const qui = String(prenom || '').trim();
  return qui
    ? t('partage.messageInvitation', { prenom: qui })
    : t('partage.messageInvitationNeutre');
}

/**
 * Le message qui porte le code seul, pour qui a déjà l'application et doit le
 * saisir à la main. Le lien reste préférable ; ceci est le filet.
 */
export function messageDuCode(code) {
  return t('partage.messageCode', { code: String(code || '') });
}

/** Le message quand on fait simplement découvrir l'application. */
export function messageDecouverte() {
  return t('partage.messageDecouverte');
}

const lire = () => {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
};

/** Le code mis de côté, en attente d'un compte. */
export const invitationEnAttente = () => {
  const v = lire();
  return v && UUID_RE.test(v) ? v : null;
};

export const retenirInvitation = (code) => {
  if (!UUID_RE.test(String(code || ''))) return;
  try {
    localStorage.setItem(CLE, code);
  } catch {
    /* navigation privée : le code restera à coller à la main */
  }
};

export const oublierInvitation = () => {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* ignore */
  }
};

/**
 * À l'ouverture : récupère le code de l'adresse, le met de côté, et retire le
 * paramètre pour qu'il ne traîne pas dans la barre d'adresse ni dans l'historique.
 */
export function capturerInvitation() {
  if (typeof window === 'undefined') return null;
  const code = codeDeLUrl(window.location.href);
  if (!code) return invitationEnAttente();
  retenirInvitation(code);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('foyer');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
  return code;
}
