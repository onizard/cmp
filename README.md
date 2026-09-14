# CMP — charge mentale partagée

Une petite application web installable (PWA) pour tenir, à deux, la liste des
choses à faire de la maison. Un carnet de cuisine partagé entre deux téléphones.

## L'idée

Chaque tâche appartient à un mois. Tant qu'elle n'est pas cochée, elle est
reportée automatiquement au mois suivant, indéfiniment. Une fois cochée, elle
reste barrée jusqu'à la fin du mois puis s'efface — mais reste consultable en
rouvrant ce mois. On peut préparer un mois à venir, réordonner par priorité,
modifier ou supprimer. Tout se synchronise en temps réel entre les deux
téléphones, et l'application reste lisible hors ligne.

## Stack

- **React + Vite** (JavaScript), build statique.
- **Supabase auto-hébergé** sur le NAS : Postgres, PostgREST, Realtime et Auth
  (GoTrue) par lien magique.
- **PWA** via `vite-plugin-pwa` (installable Android / iOS).
- **Tout sur le NAS Synology** (Container Manager), exposé par un tunnel Cloudflare.

## Développement local

```bash
npm install
cp .env.example .env   # puis renseigner les deux clés Supabase
npm run dev
```

- `npm test` — lance les tests de la logique de visibilité mensuelle (Vitest).
- `npm run build` — compile le site statique dans `dist/`.
- `npm run icons` — régénère les icônes depuis le monogramme.

## Base de données

Le schéma complet (tables, RLS, trigger, temps réel) est dans
[`supabase/schema.sql`](supabase/schema.sql). Sur le NAS il est appliqué
automatiquement au premier démarrage (`nas/db/cmp.sql`).

## Hébergement sur le NAS

Tout le back-end **et** l'app tournent sur le NAS Synology via Docker
(Container Manager), derrière un tunnel Cloudflare. Le mode d'emploi complet,
pensé pour être suivi depuis un téléphone, est dans
[`nas/README.md`](nas/README.md).

En bref :

```bash
cd nas
node gen-keys.mjs          # génère les secrets dans .env
# renseigner PUBLIC_URL, SMTP_PASS, CF_TUNNEL_TOKEN dans .env
npm run build              # (à la racine) compile l'app
docker compose --profile tunnel up -d
```

L'app parle à sa propre origine (même domaine que l'API servie par la
passerelle), donc aucune URL n'est codée en dur à la compilation ; seule la clé
`anon` (publique) est intégrée.
