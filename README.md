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
- **Supabase** : Postgres, Realtime et Auth par lien magique.
- **PWA** via `vite-plugin-pwa` (installable Android / iOS).
- **GitHub Pages** pour l'hébergement, déployé par GitHub Actions.

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
[`supabase/schema.sql`](supabase/schema.sql). À coller dans l'éditeur SQL de
Supabase.

## Configuration

Deux variables d'environnement, injectées à la compilation :

| Variable                 | Où la trouver dans Supabase              |
| ------------------------ | ---------------------------------------- |
| `VITE_SUPABASE_URL`      | Project Settings → Data API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → `anon` `public` |

En production, la clé `anon` (publique par nature — la sécurité repose sur les
policies RLS) est lue depuis `.env.production`, versionné dans le dépôt.

## Déploiement

Chaque `push` sur `main` déclenche le workflow GitHub Actions : tests,
compilation, puis publication sur GitHub Pages. Le workflow active Pages
lui-même (`enablement`), il n'y a aucun réglage à faire à la main.
