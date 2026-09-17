// Abonnement aux notifications push (côté navigateur).
//
// Règle de fond : le choix de l'utilisateur vit en local et fait autorité.
// L'abonnement du navigateur, lui, peut disparaître (mise à jour, cache vidé,
// réinstallation, rotation d'endpoint par le navigateur). On le recrée alors
// en silence au lieu de repasser l'option sur « off ».
import { supabase } from '../supabaseClient.js';
import { t, langue } from '../i18n/index.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC || '';

const WANT = 'cmp.push.want';
const SOIR = 'cmp.push.soir';
const LAST = 'cmp.push.endpoint';

const read = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v ? '1' : '0');
  } catch {
    /* navigation privée : on continue sans mémoire locale */
  }
};

// Le dernier endpoint connu de CET appareil, pour effacer sa ligne périmée
// quand le navigateur en change — sans toucher aux autres appareils.
const readEndpoint = () => {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
};
const writeEndpoint = (v) => {
  try {
    if (v) localStorage.setItem(LAST, v);
    else localStorage.removeItem(LAST);
  } catch {
    /* ignore */
  }
};

/** Le navigateur sait-il faire des notifications push ? */
export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const stored = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** Ce que l'utilisateur a demandé la dernière fois, connu tout de suite. */
export const wantsPush = () => read(WANT, false);
export const wantsEvening = () => read(SOIR, true);

const toUint8 = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
};

// `navigator.serviceWorker.ready` peut rester en attente juste après une mise
// à jour ; on lui laisse un délai puis on se rabat sur l'enregistrement connu.
async function registration() {
  if (!pushSupported()) return null;
  try {
    const timeout = new Promise((r) => setTimeout(() => r(null), 4000));
    const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
    return reg || (await navigator.serviceWorker.getRegistration()) || null;
  } catch {
    return null;
  }
}

/** L'abonnement actuel de ce navigateur, s'il existe. */
export async function currentSubscription() {
  const reg = await registration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Enregistre l'abonnement côté serveur et nettoie l'ancien endpoint si le
// navigateur en a changé (sinon le service d'envoi parle dans le vide).
async function store(sub, userId, householdId, evening, previous) {
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      household_id: householdId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      evening,
      // Le service d'envoi lit cette colonne pour choisir la langue du texte.
      langue: langue(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
  const stale = previous || readEndpoint();
  if (stale && stale !== sub.endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', stale);
  }
  writeEndpoint(sub.endpoint);
}

async function subscribe(reg) {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toUint8(VAPID),
  });
}

/** Demande l'autorisation, s'abonne, et enregistre côté serveur. */
export async function enablePush(userId, householdId) {
  if (!pushSupported()) {
    throw new Error(t('notifications.nonGere'));
  }
  if (!VAPID) {
    throw new Error(t('notifications.sansCle'));
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(t('notifications.refusees'));
  }
  const reg = await registration();
  if (!reg) throw new Error(t('notifications.pasPrete'));
  const sub = await subscribe(reg);
  await store(sub, userId, householdId, wantsEvening());
  write(WANT, true);
  return true;
}

/** Se désabonne et retire l'enregistrement serveur. */
export async function disablePush() {
  write(WANT, false);
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  writeEndpoint(null);
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/**
 * Remet l'abonnement d'aplomb sans rien demander à l'utilisateur.
 * Appelée au démarrage et à chaque retour sur l'application : c'est elle qui
 * empêche l'option de retomber sur « off » après une mise à jour.
 * Renvoie l'état réel { on, evening }.
 */
// Première ouverture d'une version qui mémorise le choix : si le navigateur
// est déjà abonné, c'est que l'utilisateur avait dit oui. On le reprend.
async function adopt() {
  if (stored(WANT) !== null) return;
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) {
    write(WANT, true);
    writeEndpoint(sub.endpoint);
  }
}

export async function syncPush(userId, householdId) {
  await adopt();
  const evening = wantsEvening();
  if (!pushSupported() || !wantsPush() || !VAPID || !userId || !householdId) {
    return { on: false, evening };
  }
  // Autorisation retirée depuis les réglages du téléphone : là, c'est un vrai
  // « non », on oublie le choix précédent.
  if (Notification.permission !== 'granted') {
    write(WANT, false);
    return { on: false, evening };
  }
  const reg = await registration();
  if (!reg) return { on: true, evening }; // pas prêt : on garde l'affichage
  try {
    const before = await reg.pushManager.getSubscription();
    const sub = await subscribe(reg);
    await store(sub, userId, householdId, evening, before ? before.endpoint : null);
    return { on: true, evening };
  } catch {
    // Réseau ou abonnement momentanément indisponible : on n'efface pas le
    // choix de l'utilisateur pour autant.
    return { on: true, evening };
  }
}

/** Active ou coupe le rappel du soir pour cet appareil. */
export async function setEvening(on) {
  write(SOIR, on);
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase
    .from('push_subscriptions')
    .update({ evening: on })
    .eq('endpoint', sub.endpoint);
}

const CLE_BINOME = 'cmp.push.binome';

/** Le rappel « invite ta moitié » est-il voulu sur cet appareil ? */
export const wantsBinome = () => read(CLE_BINOME, true);

export async function setBinome(on) {
  write(CLE_BINOME, on);
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase
    .from('push_subscriptions')
    .update({ invite_on: on })
    .eq('endpoint', sub.endpoint);
}

/** L'état enregistré côté serveur, qui fait foi. */
export async function binomeEnabled() {
  const sub = await currentSubscription();
  if (!sub) return wantsBinome();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('invite_on')
    .eq('endpoint', sub.endpoint)
    .maybeSingle();
  if (error || !data) return wantsBinome();
  write(CLE_BINOME, data.invite_on);
  return Boolean(data.invite_on);
}

/** Le rappel du soir est-il actif pour cet appareil ? */
export async function eveningEnabled() {
  const sub = await currentSubscription();
  if (!sub) return wantsEvening();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('evening')
    .eq('endpoint', sub.endpoint)
    .maybeSingle();
  if (error || !data) return wantsEvening();
  write(SOIR, data.evening);
  return Boolean(data.evening);
}
