// Génère les secrets du stack auto-hébergé et écrit nas/.env.
// À lancer une seule fois : node nas/gen-keys.mjs
// Réutilise un .env existant (ne régénère pas les clés déjà présentes).
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '.env');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const signJwt = (payload, secret) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
};

// Lit le .env existant s'il y en a un, pour ne pas casser une install en place.
const existing = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) existing[m[1]] = m[2];
  }
}

const jwtSecret =
  existing.JWT_SECRET || crypto.randomBytes(32).toString('hex'); // 64 caractères
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 ans

const anonKey =
  existing.ANON_KEY || signJwt({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret);
const serviceKey =
  existing.SERVICE_ROLE_KEY ||
  signJwt({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret);

const val = (k, fallback) => existing[k] ?? fallback;

const env = {
  // Réseau / Postgres
  POSTGRES_HOST: 'db',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'postgres',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD:
    val('POSTGRES_PASSWORD', crypto.randomBytes(16).toString('hex')),

  // JWT partagé par gotrue / postgrest / realtime
  JWT_SECRET: jwtSecret,
  JWT_EXPIRY: '3600',
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceKey,

  // Realtime
  SECRET_KEY_BASE: val('SECRET_KEY_BASE', crypto.randomBytes(32).toString('hex')),
  REALTIME_DB_ENC_KEY: val('REALTIME_DB_ENC_KEY', 'supabaserealtimekey'),

  // URL publique servie par le tunnel Cloudflare (à personnaliser)
  PUBLIC_URL: val('PUBLIC_URL', 'https://cmp.exemple.fr'),

  // E-mail (lien magique) — via Resend par défaut
  SMTP_HOST: val('SMTP_HOST', 'smtp.resend.com'),
  SMTP_PORT: val('SMTP_PORT', '465'),
  SMTP_USER: val('SMTP_USER', 'resend'),
  SMTP_PASS: val('SMTP_PASS', 'VOTRE_CLE_API_RESEND'),
  SMTP_ADMIN_EMAIL: val('SMTP_ADMIN_EMAIL', 'noreply@exemple.fr'),
  SMTP_SENDER_NAME: val('SMTP_SENDER_NAME', 'CMP'),

  // Jeton du tunnel Cloudflare
  CF_TUNNEL_TOKEN: val('CF_TUNNEL_TOKEN', 'VOTRE_JETON_CLOUDFLARE'),
};

const out = Object.entries(env)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');
writeFileSync(envPath, `${out}\n`, 'utf8');

console.log(`Écrit ${envPath}`);
console.log('');
console.log('À reporter dans le build de l\'app (VITE_) :');
console.log(`  VITE_SUPABASE_URL=${env.PUBLIC_URL}`);
console.log(`  VITE_SUPABASE_ANON_KEY=${anonKey}`);
