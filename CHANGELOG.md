# Notes de version de la console admin

Sélection non exhaustive du journal atteignable depuis `origin/main` au 3 octobre 2026 (`47b955c`). Dates de commits, pas dates de publication. Le paquet privé reste `0.1.0` ; la présence d'une fonctionnalité dans Git ne prouve pas son déploiement ou les données de production.

## 2026-10-03 — documentation

- Ajout des guides architecture/développement, navigation et historique sourcé ; commentaires sur invariants de session, proxy et affichage live. Aucun comportement exécutable, version de paquet ni configuration modifiés.

## 2026-09-26

- `47b955c` : runtime Next 15.5.26 / React 19.3.0 et maintien des lectures de cookies/paramètres asynchrones.
- `9e492db` : récupération des sessions admin expirées ; cookies credentials par génération, avec protection d'une nouvelle connexion contre les anciens 401.

## 2026-09-23

- `b7e109c` : snapshot ensuite intégré des offres lifetime : page `/signup-offers`, switches iOS/desktop et historique des grants dans les profils ; [QA-SIGNUP-OFFERS.md](QA-SIGNUP-OFFERS.md) conserve la qualification locale par fixtures.
- `daa2808` : snapshot des changements de console notifications retenus pour l'intégration. Le commit est un ensemble de fichiers, pas une release indépendante.
- `0fbc1fe` : exclusion des logs de release et sorties de déploiement locales ; `9eed6ec` normalise les fichiers texte intégrés.

## 2026-09-13 et 2026-09-07

- 13 septembre, `1596d1e` : vue funnel de l'onboarding iOS.
- 7 septembre, `c019b37` : création de compte depuis la console ; `ce6dd42` : email sur la carte de parcours et filtre des runs avec adresse.

## 2026-08-28 à 2026-08-08

- 28 août, `af924ec` : page funnel, une carte par machine et parcours étape par étape.
- 23 août, `6df73b5` : compteur des arrivées issues des QR codes sur le dashboard.
- 16 août, `2fbc3ef` : carte de reset d'utilisateur de test, rapport par étape et limite liée à Apple.
- 15 août, `3a42a41` : page outbox des annulations avec dead letters/replay ; `db85166` aligne Set plan sur le contrat réel du backend.
- 13 août, `8ff2705` : actions billing décidées à partir des champs structurés plutôt que du texte.
- 9 août, `afc3195` : transitions et simulation temporelle des abonnements ; `9282265` : laboratoire d'abonnements de test et auto-renouvellement.
- 8 août, `c297776` : panneau paiements/entitlement sur les profils.

Lire `git log --date=short --oneline` puis `git show <sha>` pour le détail complet. Les résultats de tests et le déploiement doivent être qualifiés séparément pour la version réellement livrée.
