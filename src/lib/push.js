// Abonnement aux notifications push (côté navigateur).
import { supabase } from '../supabaseClient.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC || '';

/** Le navigateur sait-il faire des notifications push ? */
export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const toUint8 = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
};

/** L'abonnement actuel de ce navigateur, s'il existe. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Demande l'autorisation, s'abonne, et enregistre côté serveur. */
export async function enablePush(userId, householdId) {
  if (!pushSupported()) {
    throw new Error("Ce navigateur ne gère pas les notifications.");
  }
  if (!VAPID) {
    throw new Error('Cette version de l’application n’a pas la clé de notification.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Notifications refusées. Autorise-les dans les réglages du téléphone.');
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8(VAPID),
    });
  }
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      household_id: householdId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
  return true;
}

/** Se désabonne et retire l'enregistrement serveur. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Active ou coupe le rappel du soir pour cet appareil. */
export async function setEvening(on) {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase
    .from('push_subscriptions')
    .update({ evening: on })
    .eq('endpoint', sub.endpoint);
}

/** Le rappel du soir est-il actif pour cet appareil ? */
export async function eveningEnabled() {
  const sub = await currentSubscription();
  if (!sub) return false;
  const { data } = await supabase
    .from('push_subscriptions')
    .select('evening')
    .eq('endpoint', sub.endpoint)
    .maybeSingle();
  return Boolean(data && data.evening);
}
