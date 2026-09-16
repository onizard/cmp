// Service de notifications push pour « Charge mentale partagée ».
// Écoute les changements de tâches (via LISTEN/NOTIFY Postgres) et envoie
// une notification à l'autre personne du foyer. Envoie aussi un rappel du soir.

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

const REMINDER_HOUR = Number(process.env.REMINDER_HOUR || 20);
const APP_URL = process.env.PUBLIC_URL || '/';

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
    kind === 'add' ? `${who} a ajouté une chose` : `${who} a coché une chose`;
  await sendToHousehold(household, actor, {
    title,
    body: text || '',
    url: APP_URL,
    tag: 'cmp-tache',
  });
}

/** Rappel du soir : combien de choses restent à porter. */
async function eveningReminder() {
  const { rows } = await client.query(
    `select household_id, count(*)::int as n
       from tasks
      where not deleted and not done and month <= $1
      group by household_id`,
    [monthKey()],
  );
  for (const r of rows) {
    if (!r.n) continue;
    await sendToHousehold(
      r.household_id,
      null,
      {
        title: 'Le point du soir',
        body:
          r.n === 1
            ? 'Il reste 1 chose à porter.'
            : `Il reste ${r.n} choses à porter.`,
        url: APP_URL,
        tag: 'cmp-soir',
      },
      true,
    );
  }
}

let lastReminderDay = '';
setInterval(async () => {
  if (!client) return;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (now.getHours() !== REMINDER_HOUR || lastReminderDay === day) return;
  lastReminderDay = day;
  try {
    await eveningReminder();
    log('rappel du soir envoyé');
  } catch (e) {
    log('rappel du soir : échec', e.message);
  }
}, 60_000);

async function connect() {
  client = new Client(cfg);
  client.on('error', (e) => {
    log('connexion perdue :', e.message);
    client = null;
    setTimeout(start, 5000);
  });
  client.on('notification', (msg) => {
    if (msg.channel !== 'cmp_push') return;
    let ev;
    try {
      ev = JSON.parse(msg.payload);
    } catch {
      return;
    }
    handleEvent(ev).catch((e) => log('traitement événement :', e.message));
  });
  await client.connect();
  await client.query('LISTEN cmp_push');
  log('connecté à Postgres, en écoute sur « cmp_push »');
}

async function start() {
  try {
    await connect();
  } catch (e) {
    log('connexion impossible :', e.message, '— nouvel essai dans 5 s');
    client = null;
    setTimeout(start, 5000);
  }
}

start();
