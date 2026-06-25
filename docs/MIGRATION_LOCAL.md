# Migration vers une infrastructure locale (souveraineté des données)

Ce document prépare le déplacement du SIGEP depuis l'hébergement actuel
(Supabase / Vercel) vers une infrastructure **locale / nationale** au Burkina Faso.

## 1. Architecture portable (déjà en place)
- **Application** : Next.js, 100 % piloté par variables d'environnement → déployable sur n'importe quel serveur Node (ou conteneur Docker).
- **Base de données** : PostgreSQL standard (le schéma est dans `supabase/setup.sql`). Aucune dépendance propriétaire bloquante hormis l'authentification.
- **Stockage** : aucun fichier binaire critique stocké dans l'app (les pièces ordonnance sont des liens).

## 2. Cibles possibles
- **PostgreSQL auto-hébergé** (serveur national) + **Supabase self-hosted** (Auth/PostgREST) en conteneurs.
- Ou Postgres + une couche Auth dédiée (Keycloak, etc.) — nécessite d'adapter `lib/supabase/*` et `lib/auth/*`.

## 3. Procédure de migration des données
### a. Exporter depuis la base actuelle
```
PGHOST=aws-1-us-east-2.pooler.supabase.com PGPORT=5432 \
PGUSER=postgres.<ref> PGPASSWORD=<pwd> \
node --use-system-ca scripts/export-all.mjs
```
→ produit `backups/<horodatage>/<table>.json` + `_manifest.json`.

### b. Préparer la base cible
```
psql "<connexion-locale>" -f supabase/setup.sql
```
(crée toutes les tables, enums, RLS, policies).

### c. Réimporter les données
- Charger chaque `<table>.json` dans la table correspondante (script d'import à écrire selon l'outil cible, ordre : `users, individuals, cases, devices, geofences, positions, alerts, beacons, system_settings, ...`).
- Respecter l'ordre des clés étrangères.

### d. Comptes d'authentification (IMPORTANT)
- Les comptes **auth** (Supabase Auth) ne sont PAS dans l'export DB.
- Sur la cible : recréer les utilisateurs auth (même `auth_id`) ou réémettre des invitations, puis relier `users.auth_id`.

## 4. Variables d'environnement à repointer
| Variable | Vers |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase self-hosted / API locale |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique locale |
| `SUPABASE_SERVICE_ROLE_KEY` | clé secrète locale |
| `NEXT_PUBLIC_SITE_URL` | domaine national |
| `INGEST_API_KEY`, `CRON_SECRET` | regénérer |
| `TRAXBEAN_*` | inchangé (plateforme tracker externe) |
| `system_settings.timezone` | `Africa/Ouagadougou` |

## 5. Tracker / connectivité (Burkina Faso)
- Le suivi GPS passe par la plateforme **Traxbean** (externe). Pour une souveraineté complète, envisager un **serveur de réception TCP local** (les bracelets ThinkRace supportent `BP19` — config serveur IP/port) pointant vers l'infra nationale, avec parsing du protocole IW (cf. `IW-protocol`).
- APN opérateurs : Orange BF (`613-02`), Moov Africa (`613-03`).

## 6. Continuité
- Planifier l'export (`export-all.mjs`) en sauvegarde régulière AVANT et APRÈS migration.
- Conserver `supabase/setup.sql` à jour (source de vérité du schéma).

## 7. Checklist
- [ ] Export complet réalisé + vérifié (`_manifest.json`).
- [ ] Base cible créée via `setup.sql`.
- [ ] Données réimportées (ordre FK respecté).
- [ ] Comptes auth recréés / reliés.
- [ ] Variables d'env repointées.
- [ ] Tracker : serveur local (optionnel) ou Traxbean conservé.
- [ ] Test de bout en bout (login, dossier, position, alerte).
