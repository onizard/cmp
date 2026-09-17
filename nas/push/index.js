// Service de notifications push pour « Charge mentale partagée ».
// Écoute les changements de tâches (via LISTEN/NOTIFY Postgres) et envoie
// une notification à l'autre personne du foyer. Rappelle aussi matin et soir
// la tâche qui attend depuis le plus longtemps.

const { Client } = require('pg');
const webpush = require('web-push');

// Accepte les deux conventions de nommage, pour pouvoir réutiliser
// directement le fichier .env de la pile (POSTGRES_*).
const cfg = {
  host: process.env.PGHOST || process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
  user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
  database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres',
};

// Deux rendez-vous par jour, à l'heure de Paris — le conteneur, lui, tourne
// en UTC, d'où le calcul explicite du fuseau plus bas.
const MORNING_HOUR = Number(process.env.MORNING_HOUR || 8);
const EVENING_HOUR = Number(process.env.EVENING_HOUR || process.env.REMINDER_HOUR || 20);
const TZ = process.env.REMINDER_TZ || 'Europe/Paris';
const APP_URL = process.env.PUBLIC_URL || '/';

/** Heure et date du jour dans le fuseau choisi, indépendamment de celui du conteneur. */
function localNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { hour: Number(get('hour')), day: `${get('year')}-${get('month')}-${get('day')}` };
}

const VERSION = 'v3.0';

const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
  console.error('VAPID_PUBLIC et VAPID_PRIVATE sont requis.');
  process.exit(1);
}
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE,
);

let client = null;

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Envoie à tous les abonnés d'un foyer, sauf éventuellement l'auteur. */
async function sendToHousehold(householdId, exceptUser, payload, eveningOnly = false) {
  const { rows } = await client.query(
    `select id, endpoint, p256dh, auth
       from push_subscriptions
      where household_id = $1
        and ($2::uuid is null or user_id <> $2)
        and ($3::boolean is false or evening is true)`,
    [householdId, exceptUser || null, eveningOnly],
  );
  for (const row of rows) {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      log('envoyé →', row.endpoint.slice(0, 40) + '…');
    } catch (e) {
      const code = e.statusCode;
      if (code === 404 || code === 410) {
        await client.query('delete from push_subscriptions where id = $1', [row.id]);
        log('abonnement expiré, supprimé');
      } else {
        log('échec envoi', code, e.message);
      }
    }
  }
}

/** Prénom de l'auteur, sinon un libellé neutre. */
async function actorName(householdId, userId) {
  if (!userId) return 'Quelqu’un';
  const { rows } = await client.query(
    'select display_name from members where household_id = $1 and user_id = $2',
    [householdId, userId],
  );
  return (rows[0] && rows[0].display_name) || 'Ton binôme';
}

async function handleEvent(ev) {
  const { kind, household, actor, text } = ev;
  if (!household) return;
  const who = await actorName(household, actor);
  const title =
    kind === 'add' ? `${who} a ajouté une tâche` : `${who} a coché une tâche`;
  await sendToHousehold(household, actor, {
    title,
    body: text || '',
    url: APP_URL,
    tag: 'cmp-tache',
  });
}

/** Depuis combien de temps elle attend, dit simplement. */
function waitingSince(days) {
  if (days < 1) return 'ajoutée aujourd’hui';
  if (days < 2) return 'elle attend depuis hier';
  if (days < 7) return `elle attend depuis ${Math.floor(days)} jours`;
  if (days < 14) return 'elle attend depuis une semaine';
  if (days < 61) return `elle attend depuis ${Math.floor(days / 7)} semaines`;
  return `elle attend depuis ${Math.floor(days / 30)} mois`;
}

/**
 * Rappel : la tâche qui attend depuis le plus longtemps, une par foyer.
 * `moment` vaut 'matin' ou 'soir' — seul le titre change.
 */
async function oldestReminder(moment) {
  const { rows } = await client.query(
    `select distinct on (household_id)
            household_id, text,
            extract(epoch from (now() - created_at)) / 86400 as jours
       from tasks
      where not deleted and not done and month <= $1
      order by household_id, created_at asc`,
    [monthKey()],
  );
  for (const r of rows) {
    await sendToHousehold(
      r.household_id,
      null,
      {
        title:
          moment === 'matin'
            ? 'La plus ancienne t’attend'
            : 'Toujours en attente',
        body: `${r.text} — ${waitingSince(Number(r.jours))}.`,
        url: APP_URL,
        tag: 'cmp-ancienne',
      },
      true,
    );
  }
}

const lastSent = { matin: '', soir: '' };
setInterval(async () => {
  if (!client) return;
  const { hour, day } = localNow();
  const moment =
    hour === MORNING_HOUR ? 'matin' : hour === EVENING_HOUR ? 'soir' : null;
  if (!moment || lastSent[moment] === day) return;
  lastSent[moment] = day;
  try {
    await oldestReminder(moment);
    log(`rappel du ${moment} envoyé`);
  } catch (e) {
    log(`rappel du ${moment} : échec`, e.message);
  }
}, 60_000);

// Une seule connexion à la fois. Sans ce garde-fou, chaque erreur programmait
// sa propre reprise : après une coupure, plusieurs clients écoutaient « cmp_push »
// en parallèle et chaque notification partait en double.
let retryTimer = null;

function scheduleRetry(why) {
  if (retryTimer) return;
  log(why, '— nouvel essai dans 5 s');
  retryTimer = setTimeout(() => {
    retryTimer = null;
    start();
  }, 5000);
}

function drop(c) {
  if (client === c) client = null;
  c.removeAllListeners();
  c.end().catch(() => {});
}

async function connect() {
  const c = new Client(cfg);
  c.on('error', (e) => {
    drop(c);
    scheduleRetry(`connexion perdue : ${e.message}`);
  });
  c.on('notification', (msg) => {
    if (msg.channel !== 'cmp_push') return;
    let ev;
    try {
      ev = JSON.parse(msg.payload);
    } catch {
      return;
    }
    handleEvent(ev).catch((err) => log('traitement événement :', err.message));
  });
  await c.connect();
  await c.query('LISTEN cmp_push');
  client = c;
  log('connecté à Postgres, en écoute sur « cmp_push »');
}

async function start() {
  if (client) return; // déjà en écoute
  try {
    await connect();
  } catch (e) {
    scheduleRetry(`connexion impossible : ${e.message}`);
  }
}

log(`service push ${VERSION} — rappels à ${MORNING_HOUR} h et ${EVENING_HOUR} h (${TZ})`);
start();
