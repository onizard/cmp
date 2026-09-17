// Service de notifications push pour « Charge mentale partagée ».
// Écoute les changements de tâches (via LISTEN/NOTIFY Postgres) et envoie
// une notification à l'autre personne du foyer. Rappelle aussi matin et soir
// la tâche qui attend depuis le plus longtemps.

const { Client } = require('pg');
const webpush = require('web-push');
const { tr } = require('./i18n.cjs');

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

const VERSION = 'v4.8';

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

/**
 * Envoie à tous les abonnés d'un foyer, sauf éventuellement l'auteur.
 * `composer` reçoit la langue de l'appareil et rend la charge utile : chacun
 * lit donc la notification dans SA langue, pas dans celle du foyer.
 */
async function sendToHousehold(householdId, exceptUser, composer, eveningOnly = false) {
  const { rows } = await client.query(
    `select id, endpoint, p256dh, auth, langue
       from push_subscriptions
      where household_id = $1
        and ($2::uuid is null or user_id <> $2)
        and ($3::boolean is false or evening is true)`,
    [householdId, exceptUser || null, eveningOnly],
  );
  for (const row of rows) {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      const payload =
        typeof composer === 'function' ? composer(row.langue) : composer;
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

/** Prénom de l'auteur, s'il l'a renseigné. Sinon on laisse la langue décider. */
async function actorName(householdId, userId) {
  if (!userId) return null;
  const { rows } = await client.query(
    'select display_name from members where household_id = $1 and user_id = $2',
    [householdId, userId],
  );
  const nom = rows[0] && rows[0].display_name;
  return nom && nom.trim() ? nom.trim() : null;
}

async function handleEvent(ev) {
  const { kind, household, actor, text } = ev;
  if (!household) return;
  const nom = await actorName(household, actor);
  await sendToHousehold(household, actor, (lang) => ({
    title: tr(lang, kind === 'add' ? 'add' : 'done', {
      qui: nom || tr(lang, actor ? 'binome' : 'quelquun'),
    }),
    body: text || '',
    url: APP_URL,
    tag: 'cmp-tache',
  }));
}

/** Depuis combien de temps elle attend, dit simplement. */
function waitingSince(lang, days) {
  if (days < 1) return tr(lang, 'aujourdhui');
  if (days < 2) return tr(lang, 'hier');
  if (days < 7) return tr(lang, 'jours', { n: Math.floor(days) });
  if (days < 14) return tr(lang, 'semaine');
  if (days < 61) return tr(lang, 'semaines', { n: Math.floor(days / 7) });
  return tr(lang, 'mois', { n: Math.floor(days / 30) });
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
      (lang) => ({
        title: tr(lang, moment === 'matin' ? 'matin' : 'soir'),
        body: `${r.text} — ${waitingSince(lang, Number(r.jours))}.`,
        url: APP_URL,
        tag: 'cmp-ancienne',
      }),
      true,
    );
  }
}

// --- Échéances : des rappels qui se resserrent ---
//
// Paliers exprimés en heures restantes. Le palier atteint est mémorisé dans
// tasks.due_stage, ce qui évite de renvoyer deux fois le même rappel, et la
// colonne repart à 0 dès que l'échéance change.
const PALIERS = [48, 24, 6, 2, 1, 0];
const RETARD_H = 6; // puis un rappel toutes les 6 heures

function stagePour(heuresRestantes) {
  if (heuresRestantes > 0) {
    return PALIERS.filter((p) => heuresRestantes <= p).length;
  }
  return PALIERS.length + Math.floor(-heuresRestantes / RETARD_H);
}

function texteEcheance(lang, heuresRestantes) {
  if (heuresRestantes <= 0) {
    const h = -heuresRestantes;
    if (h < 1) return tr(lang, 'cestLheure');
    if (h < 24) return tr(lang, 'retardH', { n: Math.floor(h) });
    return tr(lang, 'retardJ', { n: Math.floor(h / 24) });
  }
  if (heuresRestantes < 1)
    return tr(lang, 'dansMin', { n: Math.round(heuresRestantes * 60) });
  if (heuresRestantes < 24)
    return tr(lang, 'dansH', { n: Math.floor(heuresRestantes) });
  return tr(lang, 'dansJ', { n: Math.floor(heuresRestantes / 24) });
}

function titreEcheance(lang, heuresRestantes) {
  if (heuresRestantes <= 0) return tr(lang, 'dueDepasse');
  if (heuresRestantes <= 2) return tr(lang, 'dueMaintenant');
  if (heuresRestantes <= 6) return tr(lang, 'dueApproche');
  return tr(lang, 'dueTitre');
}

async function dueReminders() {
  const { rows } = await client.query(
    `select id, household_id, text, due_stage,
            extract(epoch from (due_at - now())) / 3600 as heures
       from tasks
      where due_at is not null and not deleted and not done`,
  );
  for (const r of rows) {
    const h = Number(r.heures);
    const cible = stagePour(h);
    if (cible <= r.due_stage) continue;
    await client.query('update tasks set due_stage = $1 where id = $2', [cible, r.id]);
    const presse = h <= 2;
    await sendToHousehold(
      r.household_id,
      null,
      (lang) => ({
        title: titreEcheance(lang, h),
        body: `${r.text} — ${texteEcheance(lang, h)}`,
        url: APP_URL,
        tag: `cmp-due-${r.id}`,
        urgent: presse,
      }),
      false,
    );
    log(`échéance palier ${cible} →`, r.text.slice(0, 40));
  }
}

// --- Rappel « invite ta moitié » ---
//
// Seul dans son foyer, l'application perd tout son sens. On le rappelle, mais
// avec mesure : une fois par semaine, pas avant deux jours d'anciennete, et
// quatre fois au maximum. Passe ce plafond on se tait — quelqu'un qui n'a pas
// invite apres un mois a ses raisons, et l'appli s'utilise tres bien seul.
const BINOME_MAX = 4;
const BINOME_JOURS = 7;


async function binomeReminder() {
  // Un abonnement dont le foyer n'a qu'un seul membre, qui veut le rappel,
  // qui n'a pas atteint le plafond, et qu'on n'a pas sollicite cette semaine.
  const { rows } = await client.query(
    `select p.id, p.endpoint, p.p256dh, p.auth, p.langue
       from push_subscriptions p
      where p.invite_on
        and p.invite_envois < $1
        and (p.invite_dernier is null or p.invite_dernier < now() - ($2 || ' days')::interval)
        and p.created_at < now() - interval '2 days'
        and (select count(*) from members m where m.household_id = p.household_id) = 1`,
    [BINOME_MAX, BINOME_JOURS],
  );
  for (const r of rows) {
    const titre = tr(r.langue, 'binomeTitre');
    const corps = tr(r.langue, 'binomeCorps');
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } };
    try {
      await webpush.sendNotification(
        sub,
        JSON.stringify({ title: titre, body: corps, url: APP_URL, tag: 'cmp-binome' }),
      );
      await client.query(
        'update push_subscriptions set invite_envois = invite_envois + 1, invite_dernier = now() where id = $1',
        [r.id],
      );
      log('rappel binôme →', r.endpoint.slice(0, 40) + '…');
    } catch (e) {
      const code = e.statusCode;
      if (code === 404 || code === 410) {
        await client.query('delete from push_subscriptions where id = $1', [r.id]);
        log('abonnement expiré, supprimé');
      } else {
        log('rappel binôme : échec', code, e.message);
      }
    }
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
  // Le rappel « invite ta moitié » part le matin seulement, et s'espace
  // tout seul d'une semaine grâce à invite_dernier.
  if (moment === 'matin') {
    try {
      await binomeReminder();
    } catch (e) {
      log('rappel binôme : échec', e.message);
    }
  }
}, 60_000);

// Les échéances, elles, se vérifient chaque minute : un rappel « dans 1 h »
// n'a de valeur que s'il part à l'heure.
setInterval(() => {
  if (!client) return;
  dueReminders().catch((e) => log('échéances : échec', e.message));
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
