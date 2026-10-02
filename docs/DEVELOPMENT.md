# Développer et vérifier l'admin

Référence source `47b955c`, relevée le 3 octobre 2026 ; paquet `0.1.0`. Le dépôt est un projet npm autonome, distinct des clients natifs et du backend.

## Configuration locale

```powershell
npm ci
Copy-Item .env.local.example .env.local
npm run dev
```

Le serveur local écoute `http://localhost:3210`. Pour une qualification locale, régler `BACKEND_API_URL` sur une API dédiée ou un backend local, en incluant `/api` (par exemple `http://localhost:8787/api`). Le défaut source pointe vers l'API hébergée : vérifier la cible avant d'utiliser les boutons de modification. Ne pas copier de credentials ni de cookies dans les documents ou logs partagés.

| Variable | Dépôt / usage |
| --- | --- |
| `BACKEND_API_URL` | Admin : base serveur de l'API, suffixe `/api`, sans exposition `NEXT_PUBLIC_`. |
| `NODE_ENV` | Runtime Next : les cookies sont Secure lorsque cette valeur vaut `production`. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `ADMIN_JWT_EXPIRES_IN` | Backend uniquement : login, signature et durée du JWT admin. |

`next.config.mjs`, `tsconfig.json`, `tailwind.config.ts` et `postcss.config.mjs` portent la configuration du projet ; `package-lock.json` fige les dépendances. La source utilise les API asynchrones Next pour `cookies()` et les paramètres de routes dynamiques : conserver les `await` lors des évolutions.

## Commandes présentes

| Commande | Résultat |
| --- | --- |
| `npm run dev` | Next en développement sur le port 3210. |
| `npm run build` | Build de production `next build`. |
| `npm start` | Sert le build existant sur le port 3210. |
| `npm run typecheck` | Vérification TypeScript sans émission. |
| `npm test` | Suite `scripts/test-admin-session.cjs` avec Node test runner. |

Il n'y a pas de script lint ni de suite navigateur versionnée dans `package.json`. Ne pas assimiler `npm test` à une couverture de toutes les actions de l'admin : cette suite cible la session, les redirections et le proxy, avec des frontières simulées.

## Vérification adaptée

Pour session, proxy ou runtime : lancer `npm test`, `npm run typecheck`, `npm run build`. Les tests couvrent notamment connexion accessible avec cookies absents/faux/expirés, chemins de retour locaux, erreur 401 retardée après une nouvelle connexion, cookies asynchrones, distinction 401/403/503 et suppression du credential exact. Ils ne valident pas une connexion réelle au backend.

Pour écrans/actions, utiliser une API locale avec comptes fictifs et réponses compatibles avec `src/lib/types.ts`. Qualifier chargement, état vide, erreur HTTP, délai, sauvegarde qui réussit avec réponse perdue, reconnexion et relecture. [QA-SIGNUP-OFFERS.md](../QA-SIGNUP-OFFERS.md) conserve un protocole et des résultats locaux datés pour les offres ; ce sont des preuves historiques à rerun après évolution.

Pour focus live, simuler un heartbeat puis vérifier l'extrapolation et les phases. Le polling UI 5 s ne modifie pas la cadence de heartbeat du client natif. Pour billing, inclure pending et deadLetter, puis vérifier le rapport de drain sans déduire de HTTP 200 que chaque annulation a réussi. Pour offres, vérifier que PATCH n'envoie qu'un champ et qu'une erreur après sauvegarde rend l'état inconnu jusqu'à Reload.

Les changements Markdown et commentaires seuls se vérifient par `git diff --check`, liens et comparaison des tokens exécutables. Une compilation locale ne démontre pas une mutation persistée en production, une facturation fournisseur ni une notification reçue sur appareil.

## Livraison et diagnostic

Déployer ce projet demande un runtime Next compatible et `BACKEND_API_URL` sur l'hôte. Aucune base n'est provisionnée par l'admin. Les scripts ne contiennent aucune publication native ou migration Mongo. Aucun workflow `.github` n'est versionné ; l'intégration Git/hébergeur externe peut construire/déployer un push.

Après un déploiement autorisé, vérifier la page de login, la reconnexion après expiration et une lecture admin contre le backend visé. Une 401 appelle la récupération de session ; une 403 conserve sa signification de refus ; une erreur réseau/5xx signale une indisponibilité. Vérifier le SHA hébergé et les contrats backend séparément du succès du build.
