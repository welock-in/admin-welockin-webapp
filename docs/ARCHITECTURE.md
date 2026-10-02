# Architecture de la console admin

Référence : `origin/main`, commit `47b955c20e664cc4d924cf4200d5fd9574a84ce4`, récupéré le 3 octobre 2026. Le paquet privé est `0.1.0`, avec Next.js 15.5.26 et React 19.3.0. Ces versions source ne prouvent pas le runtime déployé.

## Rôle et organisation

La console présente les données et pilote les actions du backend WeLockIn sous `/api/admin/*`. Elle n'a pas de base propre : les comptes, transactions, settings, statistiques et journaux sont persistés par le dépôt backend. Certaines actions modifient réellement accès, abonnements, protection et comptes ; les confirmations UI ne remplacent pas les contrôles backend.

| Emplacement | Responsabilité |
| --- | --- |
| `src/app/(dashboard)/` | Pages protégées et shell : dashboard, users, billing, protection, notifications, funnel, signup-offers. |
| `src/app/login/` | Connexion et retour à une page locale validée. |
| `src/app/api/` | Login/logout, expiration de session et proxy admin côté serveur Next. |
| `src/middleware.ts` | Redirection des navigations sans credential ; API et login restent accessibles à leurs propres handlers. |
| `src/lib/backend.ts` | Client serveur `backendGet`, URL backend et erreurs avec statut/génération de session. |
| `src/lib/client.ts` | Appels navigateur via proxy et retour à la connexion sur 401 de la génération actuelle. |
| `src/lib/admin-session.ts` | Noms/options de cookies, sélection de génération, validation des chemins de retour. |
| `src/lib/types.ts` | DTO locaux décrivant les réponses attendues du backend ; aucun package de types partagé entre dépôts. |
| `src/components/` | Écrans/actions réutilisables : PaymentPanel, BillingTasks, SignupLifetimeSettings, LiveSessions, etc. |
| `scripts/test-admin-session.cjs` | Tests ciblés des contrats de session avec transpilation TS et frontières simulées. |

## Deux chemins de lecture

Un Server Component appelle `backendGet('/admin/...')` : le serveur lit le cookie, ajoute le bearer admin et utilise `cache: 'no-store'`. Le navigateur reçoit le résultat rendu sans accéder au JWT.

Un Client Component appelle `apiGet('admin/...')` ou `apiSend(...)`, donc `/api/proxy/admin/...` sur la même origine. Le Route Handler lit le cookie et transmet au backend. GET, POST, PATCH et DELETE sont supportés. Le proxy résout une URL puis vérifie **son origine et son chemin normalisés** sous `/api/admin/` avant de joindre le token : vérifier les segments bruts serait insuffisant contre traversées/encodages. Le statut et le corps du backend sont conservés.

`BACKEND_API_URL` inclut `/api` ; il reste serveur, sans préfixe `NEXT_PUBLIC_`. Les credentials de connexion sont transmis à `/admin/login`. `ADMIN_USERNAME`, `ADMIN_PASSWORD` et la clé JWT sont configurés dans le backend, pas dans la console.

## Session et courses entre requêtes

Chaque login installe un cookie credential httpOnly `wl_admin_<uuid>` et un marqueur lisible `wl_admin_session`. Le marqueur est une génération de login, pas un secret d'authentification. Les anciennes sessions `wl_admin` sont encore reconnues lorsque le marqueur est absent/invalide. Cookies : chemin `/`, SameSite lax, 12 heures ; Secure en production.

Un appel mémorise la génération utilisée avant le fetch. Si une nouvelle connexion se termine pendant l'appel, le 401 de l'ancien appel ne doit pas supprimer le nouveau credential. Le proxy expire seulement le nom du cookie de sa requête ; le navigateur ne redirige que si le marqueur courant correspond toujours. Le handler `/api/session/expired` contrôle également cette correspondance avant de supprimer le cookie.

Les Server Components ne modifient pas les cookies lors d'une erreur. Ils utilisent `BackendError.status` et `sessionVersion`, puis une redirection vers le handler d'expiration lorsque le statut est 401. Un 403 ou un échec de disponibilité ne doit pas être traité comme une session expirée. `safeReturnPath` refuse les destinations externes, encodages dangereux et boucles login/API.

Le middleware constate la présence d'un credential ; il ne valide pas la signature ni les droits métier. Le backend reste l'autorité. La page `/login` reste accessible même avec un cookie invalide, pour éviter une boucle qui empêcherait la reconnexion.

## Pages et contrats backend

| Page / composants | Contrats et sens |
| --- | --- |
| `/` et `LiveSessions` | `admin/overview`, `admin/live-sessions`, force-end. Polling live toutes les 5 s ; compteur visuel extrapolé chaque seconde depuis le heartbeat. |
| `/users`, `/users/[id]` | Liste/recherche, profil, événements, appareils, création et modération ; droits, achats, abonnements, reset et tests selon flags backend. |
| `PaymentPanel`, `DurationQuality` | Affichage des décisions de droits et qualité des durées renvoyées ; actions facturation avec raison/confirmations. Ne pas réinterpréter une durée brute comme créditée. |
| `/billing`, `BillingTasks` | Outbox d'annulation : tâches pending/deadLetter, drain, replay. Polling 30 s. Un rapport de drain peut contenir des échecs malgré HTTP 200. |
| `/protection` | CRUD/import du catalogue, locks actifs et désactivation administrative. |
| `/notifications` | Envoi manuel, templates/règles, livraisons et diagnostics de reçus. Une confirmation fournisseur ne prouve pas un bandeau sur téléphone. |
| `/funnel` | Runs onboarding Windows/macOS/iOS, filtres 7/14/30 jours et étapes ; dates/horaires rendus de façon déterministe. |
| `/signup-offers` | `admin/signup-lifetime` GET/PATCH : switches indépendants iOS et desktop pour futurs comptes. |

`SignupLifetimeSettings` n'affiche un état que si la réponse contient les deux booléens attendus. Un PATCH envoie uniquement le champ changé. Si la réponse est perdue, la sauvegarde peut néanmoins avoir réussi : l'état devient inconnu et Reload relit le backend. Éviter un retry qui inverserait aveuglément l'ancienne valeur. Les offres réservées/grants historiques restent distincts de factures et abonnements ; couper le switch ne résilie pas une facturation existante.

## Limites et évolutions

La fraîcheur des pages dépend des fetchs et heartbeats : une vue vide peut refléter absence de sessions, staleness ou un défaut de reporting ; un message d'erreur n'est pas une preuve d'absence de données. Le countdown d'écran n'effectue pas le blocage ni la fin native d'une session.

Les DTO sont maintenus manuellement. Pour ajouter un champ/action, qualifier d'abord la réponse backend, mettre à jour `types.ts` et les consommateurs serveur/client, puis vérifier erreurs, expiration concurrente et comportement si le backend n'a pas encore le champ. Les diagnostics locaux conservés dans [QA-SIGNUP-OFFERS.md](../QA-SIGNUP-OFFERS.md) utilisent des fixtures ; ils ne prouvent pas les settings actuels de production.

Aucun workflow `.github` ni `vercel.json` n'est versionné dans ce dépôt. Un push peut toutefois déclencher l'intégration d'hébergement configurée hors Git. Un build Next réussi ne prouve pas le déploiement ni la compatibilité avec l'API effectivement visée.
