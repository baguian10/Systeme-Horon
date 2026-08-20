# SIGEP · Système Horon

Plateforme de surveillance électronique judiciaire pour le Ministère de la Justice du Burkina Faso, avec le bracelet de cheville **HORON X** (matériel ThinkRace TR40). Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, Supabase (Postgres + RLS), déployée sur Vercel.

Porté par Bewi's Execution and Tech. Le dépôt est **public** et adossé à un dossier gouvernemental : la trace datée de chaque validation compte.

## Une base de code, deux déploiements

| Projet Vercel | Adresse | Variables Supabase | Rôle |
|---|---|---|---|
| `systeme-horon` | systeme-horon.vercel.app | présentes | site public + plateforme réelle |
| `sigep-presentation` | sigep-presentation.vercel.app | aucune | démonstration, données fictives |

`lib/demo-mode.ts` lit cette différence et active le bandeau ambre, le bloc d'accueil et les titres « Démonstration ». Il n'y a rien à basculer à la main et aucun fork à synchroniser.

**Piège :** ne jamais importer `IS_DEMO_MODE` depuis `lib/supabase/client.ts` dans un composant serveur — ce fichier est marqué `'use client'` et la valeur ne traverse pas la frontière. Passer par `lib/demo-mode.ts`, qui n'a pas de directive client.

Chaque fonction de `lib/mock/helpers.ts` commence par `if (IS_DEMO_MODE)` et retombe sinon sur Supabase. C'est le point de bascule entre les deux mondes.

## Commandes

```bash
npm run dev                 # serveur de développement (lit .env.local)
npm run build               # build de production
npx tsc --noEmit            # vérification de types — à passer avant toute PR
npm run lint                # eslint (la CI le fait échouer sur les apostrophes non échappées en JSX)

bash scripts/deploy-demo.sh # déploie la DÉMONSTRATION (substitue vercel.demo.json, sans crons)
```

Déploiement de la **production**, à la main :

```bash
VERCEL_ORG_ID="team_Iuawym7NBAt0rmt8aw7nuBf8" \
VERCEL_PROJECT_ID="prj_iUqbRK4wu0T0fDbJwdRiTgi5MDGz" \
vercel --prod --yes
```

Le workflow `.github/workflows/deploy.yml` reste volontairement sans secrets : il déploierait `main` avec le `vercel.json` racine (celui qui porte les crons de production) et écraserait le découpage démo/production que fait `deploy-demo.sh`.

## Rôles et périmètres

`SUPER_ADMIN` · `ADMIN` · `STRATEGIC` · `JUDGE` · `OPERATIONAL` (`lib/auth/permissions.ts`).

`canConfigureHardware` = `SUPER_ADMIN` seul — c'est lui qui gouverne tous les panneaux matériel de la fiche bracelet. `STRATEGIC` ne voit que des agrégats, jamais un individu. Les rôles d'administration n'ont pas de politique RLS de lecture sur plusieurs tables : les helpers passent alors par `createAdminClient()`, les autres rôles restent cadrés par RLS.

Statuts de dossier : `PENDING` (ordonnance reçue, bracelet non posé) → `ACTIVE` → `VIOLATION` / `SUSPENDED` / `TERMINATED`.

## Le module TIG, cœur du dossier

Enregistrement du condamné sur un site agréé, pointage signé des séances, **cumul des heures recalculé depuis les séances** (jamais incrémenté), et **notification automatique au juge au franchissement des heures ordonnées**. C'est l'argument central : les peines alternatives deviennent prouvables. Ne pas remplacer le recalcul par un compteur.

## Chaîne de suivi temps réel

Le bracelet ne parle pas à SIGEP : il remonte à la plateforme **Traxbean** (`napi.5gcity.com`), que `lib/traxbean/client.ts` interroge avec le compte du tableau de bord.

```
bracelet → Traxbean → /api/cron/poll-traxbean → /api/ingest/position → positions + géofences + alertes
```

Le collecteur est **le seul chemin** par lequel les positions entrent en base. Il faut donc que quelque chose l'appelle :

- cron Vercel : une fois par jour seulement sur l'offre Hobby ;
- `lib/traxbean/trigger.ts`, appelé par la carte, la fiche bracelet et la console de supervision (via `after()`, donc sans retarder l'affichage) ;
- pour du continu, un pinger externe sur `/api/cron/poll-traxbean?secret=$CRON_SECRET`.

Un passage complet dure ~13 s. Sans déclencheur, la plateforme affiche l'état figé du dernier passage — c'est ce qui a laissé les positions bloquées un mois entier.

**TLS :** `napi.5gcity.com` sert une chaîne de certificats incomplète. Un dispatcher undici avec vérification relâchée est utilisé, cantonné à ces requêtes.

## Protocole ThinkRace IW — ce que le terrain a appris

Document de référence : `IW-protocol_Thinkrace_V3.02` (hors dépôt, dans les téléchargements). Bracelet de test `355932600157247`, firmware `l005-EU-V3.81.20251114`, protocole V1067.

**Statut de port : c'est la sangle.** Le TR40 n'a pas de capteur optique (`PPG[C0m]` dans sa fiche d'état). `>*wearconfig@1*<` est acquitté mais aucune trame `APWR` ne suit, et le champ `wear` de la plateforme reste à `-1`. Le vrai signal est la trame d'alarme `AP10` : `16` = sangle verrouillée, `05` = ouverte ou arrachée, `03` = terminal retiré, `02` = batterie faible, `19` = extinction. `getStrapState()` la lit et alimente `devices.worn`, donc l'alerte de sabotage et l'armement à la pose.

**Deux formes de commande, deux comportements.** Un raccourci nu (`>*ble@120*<`) part en `--queue--` sans accusé ; une trame IW complète (`IWBP40,<imei>,<série>,>*…*<#`) part en `--now--` et revient acquittée (`IWAP40,<série>,1#`). Préférer la trame complète quand la confirmation compte.

**La plateforme ne relaie qu'une commande à la fois.** Six envois d'affilée n'en font passer qu'un seul. Toute campagne de commandes doit être sérialisée, avec une attente entre chaque.

**Journal : 6 h maximum.** Au-delà, `fetchDeviceLog` renvoie un journal *vide* au lieu d'un journal plus long.

**Pas de réglage de volume.** 21 orthographes essayées (`@volume@`, `@vol@`, `@setvolume@`, `@callvolume@`, `@speaker@`, `@setvol@`, `@voice@`, `@audio@`, `@spkvol@`, `@ringvolume@`, `@handsfree@`, `@callvol@`, `@micgain@`, `@spkgain@`, `@sound@`, `@volumelevel@`, `@speakermode@`…), toutes relayées, aucune réponse — alors que le témoin `@deviceinfo@` répond en détail. Le firmware n'en a pas. Ne pas réessayer sans changer de firmware ; la piste restante est le fournisseur, ou une commande SMS envoyée à la SIM (certaines commandes sont marquées « No GPRS command »).

**Appels entrants.** `BP14` accepte dix contacts. `BP84` arme le filtre — sans lui la liste blanche ne filtre rien, n'importe quel numéro peut appeler. Toujours envoyer les numéros **avant** l'interrupteur, sans quoi le bracelet est coupé de tout appel entre les deux commandes.

## Pose et retrait

- `devices.arm_on_wear` — fermer la sangle fait passer un dossier `PENDING` en `ACTIVE`, date de début prise sur l'heure de la trame.
- `devices.removal_allowed_until` / `removal_reason` / `removal_by` — fenêtre de retrait motivée et bornée : pendant celle-ci, ouvrir la sangle est consigné sans alerte. La fenêtre porte sa péremption, il n'y a pas de garde à relever à la main.
- Hors fenêtre, l'ouverture lève `TAMPER_DETECTED` et bascule le dossier en `VIOLATION`.

## Migrations

Les fichiers vivent dans `supabase/migrations/`. Deux façons de les appliquer :

1. **SQL Editor de Supabase** — le plus simple, aucun mot de passe à retrouver ;
2. `PGPASSWORD='…' node scripts/apply-migration.mjs supabase/migrations/<fichier>.sql` — demande le mot de passe **Postgres** du projet (Settings → Database), qui n'est pas la clé service role.

**Écrire le code pour survivre à une migration non encore appliquée.** Une colonne absente ne doit jamais arrêter la collecte : le collecteur retombe sur son jeu de colonnes historique, et les routes qui écrivent la nouvelle colonne répondent explicitement plutôt que d'échouer en silence. `scripts/check-column.mjs` vérifie qu'une colonne est bien là.

## Scripts de diagnostic

Tous lisent `.env.local` et tournent hors Next.js.

| Script | Usage |
|---|---|
| `traxbean-diag.mjs` | authentification, position, inventaire, journal — le premier à lancer |
| `traxbean-log.mjs` | journal brut du bracelet, filtré par motif |
| `traxbean-send.mjs` | envoie une commande brute et montre ce qui revient |
| `traxbean-volume-test.mjs` | sondage sérialisé de commandes, avec témoin de contrôle |
| `strap-diag.mjs` | états de sangle horodatés |
| `wear-diag.mjs` | détection de port : plateforme, journal, base |
| `sigep-diag.mjs`, `sigep-positions*.mjs` | chaîne d'ingestion côté SIGEP |
| `check-column.mjs`, `set-device-flag.mjs` | état et bascule des réglages en base |

Règle apprise en sondant le matériel : **toujours un témoin de contrôle**. Sans une commande dont on sait qu'elle répond, « aucune réponse » ne distingue pas un firmware muet d'une méthode fausse.

## Git

Tout changement passe par une **branche + pull request**, jamais de push direct sur `main`.

Le PAT GitHub peut créer une PR et pousser, mais **ne peut ni fusionner ni lire les secrets** (403 sur `mergePullRequest`). Contournement en place :

```bash
git checkout main && git pull --ff-only origin main
git merge --no-ff origin/<branche> -m "Merge pull request #N from baguian10/<branche>"
git push origin main
```

GitHub marque alors la PR comme fusionnée.

**CI :** `Next.js CI` et `CodeQL` doivent rester verts. Node ≥ 22.19 est exigé (`undici@8` casse sur Node 20 avec `util.markAsUncloneable is not a function`).

## Écriture

Le produit s'adresse à des magistrats et des agents burkinabè : **toute l'interface est en français**, sans anglicismes techniques. Les commentaires de code expliquent *pourquoi*, en particulier quand le comportement du matériel contredit la documentation — c'est là que se perd le temps de la prochaine session.

Aucun signal de confiance inventé : pas de certification, de logo ni de témoignage qui n'existe pas. Les chiffres de comparaison internationale sont sourcés, les projections économiques marquées comme hypothèses de travail.
