// Service de notifications push pour « Charge mentale partagée ».
// Écoute les changements de tâches (via LISTEN/NOTIFY Postgres) et envoie
// une notification à l'autre personne du foyer. Rappelle aussi matin et soir
// la tâche qui attend depuis le plus longtemps, et chaque matin toutes les
// échéances en cours.

const { Client } = require('pg');
const webpush = require('web-push');
const { tr, libelle } = require('./i18n.cjs');

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

const VERSION = 'v4.14';

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

/**
 * Envoie à une seule personne du foyer : celle qu'un bon désigne. Mêmes
 * règles que sendToHousehold, abonnements périmés compris.
 */
async function sendToUser(householdId, userId, composer) {
  const { rows } = await client.query(
    `select id, endpoint, p256dh, auth, langue
       from push_subscriptions
      where household_id = $1 and user_id = $2`,
    [householdId, userId],
  );
  for (const row of rows) {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify(composer(row.langue)));
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
  if (kind === 'bon') return handleBon(ev);
  const nom = await actorName(household, actor);
  // Réservation : « Untel s'en occupe », ou « Untel a libéré… » s'il annule
  // avant l'heure. Même étiquette : la libération remplace l'annonce.
  if (kind === 'reserve' || kind === 'libere') {
    await sendToHousehold(household, actor, (lang) => ({
      title: tr(lang, kind, { qui: nom || tr(lang, 'binome') }),
      body: tr(lang, kind === 'reserve' ? 'reserveCorps' : 'libereCorps', { text: text || '' }),
      url: APP_URL,
      tag: `cmp-reserve-${actor}`,
    }));
    return;
  }
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

// --- Récap du matin : toutes les échéances d'un coup ---
//
// Les rappels ci-dessus ne parlent d'une échéance qu'à l'approche du jour J :
// une tâche importante à une semaine restait muette, cachée derrière la plus
// pressante. Chaque matin, une seule notification les liste toutes, de la
// plus proche à la plus lointaine. Même étiquette d'un jour à l'autre : le
// récap du jour remplace celui de la veille au lieu de s'empiler.
const RECAP_MAX = 6;

function quandCourt(lang, jours) {
  if (jours < 0) return tr(lang, 'recapRetard');
  if (jours === 0) return tr(lang, 'recapAujourdhui');
  if (jours === 1) return tr(lang, 'recapDemain');
  return tr(lang, 'recapDans', { n: jours });
}

function recapEcheances(lang, taches) {
  const lignes = taches
    .slice(0, RECAP_MAX)
    .map((t) => `• ${t.text} — ${quandCourt(lang, t.jours)}`);
  if (taches.length > RECAP_MAX) {
    const reste = taches.length - RECAP_MAX;
    lignes.push(reste === 1 ? tr(lang, 'recapAutre1') : tr(lang, 'recapAutres', { n: reste }));
  }
  return {
    title:
      taches.length === 1
        ? tr(lang, 'recapTitre1')
        : tr(lang, 'recapTitre', { n: taches.length }),
    body: lignes.join('\n'),
    url: APP_URL,
    tag: 'cmp-echeances',
  };
}

async function dueRecap() {
  // Jours comptés en dates du calendrier local : « demain » veut dire demain,
  // même pour une échéance à 8 h qu'on lit la veille à 8 h 05.
  const { rows } = await client.query(
    `select household_id, text,
            (due_at at time zone $1)::date - (now() at time zone $1)::date as jours
       from tasks
      where due_at is not null and not deleted and not done
      order by household_id, due_at`,
    [TZ],
  );
  const parFoyer = new Map();
  for (const r of rows) {
    if (!parFoyer.has(r.household_id)) parFoyer.set(r.household_id, []);
    parFoyer.get(r.household_id).push({ text: r.text, jours: Number(r.jours) });
  }
  for (const [foyer, taches] of parFoyer) {
    await sendToHousehold(foyer, null, (lang) => recapEcheances(lang, taches), false);
  }
  return parFoyer.size;
}

// --- Bons utilisés : l'autre est prévenu, puis relancé jusqu'à validation ---
//
// Utiliser un bon engage l'autre personne du foyer. Elle est prévenue tout de
// suite, quelle que soit l'heure — c'est la conséquence immédiate d'un geste.
// Les relances, elles, ne partent qu'en journée, et s'arrêtent dès que le
// détenteur du bon valide que c'est fait (claims.realise_at).
//
// Même étiquette pour l'alerte et ses relances : chaque relance remplace la
// précédente à l'écran (renotify la fait tout de même sonner), au lieu d'en
// empiler une par heure.
const BON_RAPPEL_MIN = Number(process.env.BON_RAPPEL_MIN || 60);
const BON_JOUR_DEBUT = Number(process.env.BON_JOUR_DEBUT || 8);
const BON_JOUR_FIN = Number(process.env.BON_JOUR_FIN || 22);

/** « 25 min », « 3 h », « 2 jours » : depuis quand le bon attend. */
function depuis(lang, minutes) {
  if (minutes < 60) return tr(lang, 'dureeMin', { n: Math.max(1, Math.floor(minutes)) });
  if (minutes < 60 * 24) return tr(lang, 'dureeH', { n: Math.floor(minutes / 60) });
  return tr(lang, 'dureeJ', { n: Math.floor(minutes / 1440) });
}

const BON_SQL = `
  select c.id, c.household_id, c.user_id, c.label, c.pour,
         r.cle,
         extract(epoch from (now() - c.used_at)) / 60 as minutes
    from claims c
    left join rewards r on r.id = c.reward_id
   where c.used_at is not null and c.realise_at is null and not c.deleted`;

// En famille, le bon désigne qui l'honore : lui seul est prévenu et relancé.
// Sans destinataire (un couple, ou une appli pas encore à jour), tout le foyer
// sauf le détenteur, comme avant.
async function envoyerBon(b, relance) {
  const nom = await actorName(b.household_id, b.user_id);
  const envoyer = (composer) =>
    b.pour
      ? sendToUser(b.household_id, b.pour, composer)
      : sendToHousehold(b.household_id, b.user_id, composer);
  await envoyer((lang) => {
    const qui = nom || tr(lang, 'binome');
    const label = libelle(lang, b.cle, b.label);
    return relance
      ? {
          title: tr(lang, 'bonRappelTitre'),
          body: tr(lang, 'bonRappelCorps', { qui, label, depuis: depuis(lang, Number(b.minutes)) }),
          url: APP_URL,
          tag: `cmp-bon-${b.id}`,
          urgent: true,
        }
      : {
          title: tr(lang, 'bonTitre', { qui }),
          body: tr(lang, 'bonCorps', { label }),
          url: APP_URL,
          tag: `cmp-bon-${b.id}`,
          urgent: true,
        };
  });
  await client.query('update claims set rappel_at = now() where id = $1', [b.id]);
}

async function handleBon(ev) {
  if (!ev.claim) return;
  const { rows } = await client.query(`${BON_SQL} and c.id = $1`, [ev.claim]);
  if (!rows[0]) return; // déjà validé, annulé, ou jamais utilisé
  await envoyerBon(rows[0], false);
  log('bon utilisé →', String(rows[0].label).slice(0, 40));
}

async function bonReminders() {
  const { hour } = localNow();
  if (hour < BON_JOUR_DEBUT || hour >= BON_JOUR_FIN) return;
  const { rows } = await client.query(
    `${BON_SQL}
       and (c.rappel_at is null or c.rappel_at < now() - ($1 || ' minutes')::interval)`,
    [BON_RAPPEL_MIN],
  );
  for (const b of rows) {
    await envoyerBon(b, true);
    log('relance bon →', String(b.label).slice(0, 40));
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
  // Le récap des échéances part à tout le monde, comme les rappels
  // d'échéance : ne pas en louper une ne dépend pas du rappel matin et soir.
  if (moment === 'matin') {
    try {
      const n = await dueRecap();
      log(`récap des échéances envoyé à ${n} foyer(s)`);
    } catch (e) {
      log('récap des échéances : échec', e.message);
    }
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
// n'a de valeur que s'il part à l'heure. Les bons en attente aussi.
setInterval(() => {
  if (!client) return;
  dueReminders().catch((e) => log('échéances : échec', e.message));
  bonReminders().catch((e) => log('bons : échec', e.message));
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

log(`service push ${VERSION} — rappels à ${MORNING_HOUR} h et ${EVENING_HOUR} h (${TZ}), bons toutes les ${BON_RAPPEL_MIN} min de ${BON_JOUR_DEBUT} h à ${BON_JOUR_FIN} h`);
start();
