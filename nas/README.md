# CMP sur ton NAS Synology

Tout tourne sur le NAS : la base de données, l'authentification, le temps réel
et l'application elle-même. L'extérieur y accède par un **tunnel Cloudflare**
(HTTPS, sans ouvrir de port sur la box).

```
Téléphones ──HTTPS──> Cloudflare ──tunnel──> [ NAS ]
                                              nginx (passerelle)
                                               ├── / .............. l'app CMP
                                               ├── /auth/v1  ....... GoTrue (lien magique)
                                               ├── /rest/v1  ....... PostgREST (données)
                                               └── /realtime/v1 .... Realtime (synchro)
                                              Postgres
```

## Contenu du dossier

| Élément | Rôle |
| --- | --- |
| `docker-compose.yml` | Les 6 conteneurs (db, auth, rest, realtime, gateway, tunnel). |
| `.env` | Tous les secrets et réglages. **Ne pas partager.** |
| `gen-keys.mjs` | Génère les secrets et écrit `.env` (déjà fait si `.env` est fourni). |
| `db/` | Scripts d'initialisation SQL (rôles, JWT, schéma CMP, publication temps réel). |
| `gateway/nginx.conf` | La passerelle : route l'API et sert l'app. |
| `app/` | L'application déjà compilée (fichiers statiques). |

## Mise en route (depuis le téléphone)

### 1. Déposer le dossier sur le NAS
Dans **DSM → File Station**, crée un dossier `docker/cmp` et **téléverse** le
contenu de ce dossier dedans (ou l'archive `.zip` puis « Extraire ici »).

### 2. Le tunnel Cloudflare
1. Va sur **one.dash.cloudflare.com** → **Networks → Tunnels → Create a tunnel**
   → type **Cloudflared** → nomme-le `cmp`.
2. Cloudflare affiche un **jeton** (une longue chaîne après `--token`). Copie-le.
3. Toujours dans le tunnel, onglet **Public Hostname → Add a public hostname** :
   - **Subdomain** : `cmp` — **Domain** : `break-pharma.fr` (ou ton domaine)
   - **Service** : `HTTP` → `cmp-gateway:80`
   - Enregistre.

### 3. Renseigner `.env`
Dans **File Station**, clic droit sur `.env` → **Ouvrir avec l'éditeur de texte**,
et remplis les 3 lignes marquées « À REMPLIR » :
- `PUBLIC_URL` = `https://cmp.break-pharma.fr` (le sous-domaine choisi à l'étape 2)
- `SMTP_PASS` = ta clé API **Resend** (pour l'envoi du lien magique)
- `CF_TUNNEL_TOKEN` = le jeton copié à l'étape 2

(Les autres valeurs — mots de passe, clés JWT — sont déjà générées, n'y touche pas.)

### 4. Démarrer les conteneurs
Dans **Container Manager → Projet → Créer** :
- **Nom** : `cmp`
- **Chemin** : le dossier `docker/cmp`
- **Source** : « docker-compose.yml existant »
- Termine l'assistant. Le NAS télécharge les images et démarre tout.

Puis, pour activer le tunnel, il faut inclure le profil `tunnel`. Le plus simple
dans Container Manager : **Action → Arrêter**, puis dans les réglages du projet
active le service `cloudflared`, ou relance depuis SSH avec :

```bash
cd /volume1/docker/cmp
docker compose --profile tunnel up -d
```

### 5. Vérifier
Ouvre `https://cmp.break-pharma.fr` sur le téléphone : l'écran de connexion CMP
doit s'afficher. Entre ton e-mail, tu reçois le lien magique, tu entres.

## Sauvegarde
Les données vivent dans le volume Docker `cmp_db-data`. Une sauvegarde propre :

```bash
docker exec cmp-db pg_dump -U postgres postgres > cmp-sauvegarde.sql
```

## Limiter à deux comptes
Une fois que toi et ta femme êtes connectés, tu peux fermer les inscriptions :
dans `.env`, il n'y a rien à changer côté schéma, mais tu peux passer
`GOTRUE_DISABLE_SIGNUP` à `true` dans `docker-compose.yml` (service `auth`) et
relancer le projet.
