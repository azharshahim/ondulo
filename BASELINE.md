# Baseline technique — vérifiée le 2026-10-23

Dépôt : https://github.com/azharshahim/serpent-puzzle
Clone local : `/home/user/serpent-puzzle`
Branche de travail : `chore/setup-baseline` (créée depuis `main`, aucun commit pour l'instant)

## Commits de référence (main)

```
cc91f85 Merge pull request #1 from azharshahim/phase1
dbc6a31 Corrections : userInterfaceStyle automatic, meta description, PIN PBKDF2-like + verrouillage progressif
0ee2e91 Accessibilité : zoom autorisé hors plateau, police dyslexie, libellés lecteur d’écran
```
Branches distantes : `main` (cc91f85), `gh-pages` (4a8230d), `phase1` (dbc6a31)
→ `phase1` est déjà entièrement mergée dans `main`.

## Résultats vérifiés

| Étape | Commande | Résultat |
|---|---|---|
| Install | `npm ci` | OK — 578 paquets en 26 s, arbre propre (`git status` vide) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`, TS 6.0.3) | OK — 0 erreur, exit 0 |
| Tests moteur | `npm run test:engine` | OK — 20 vérifications, 10 000 mouvements aléatoires, 0 superposition |
| Tests niveaux | `npm run test:levels` | OK — 60 niveaux + défi quotidien valides et solvables |

## Points de vigilance

1. **Node 20.20.2 dans le sandbox vs Node ≥ 22.13 requis** par plusieurs paquets
   RN 0.88 / Expo 58 (`@react-native/*`, `@expo/code-signing-certificates`).
   `npm ci`, le typecheck et les deux suites de tests passent malgré les warnings
   `EBADENGINE`, mais **`npx expo export --platform web` (nécessaire pour
   déployer sur `gh-pages`) n'a pas été testé** — c'est le risque n°1 à
   vérifier à la première tâche qui touche au déploiement.
2. `npm audit` : 23 vulnérabilités (21 high). Non bloquant pour le build, mais à
   traiter séparément si demandé.
3. Aucun lint script ni framework de test unitaire dans `package.json` : la
   vérification repose sur `typecheck` + les deux scripts `tsx` dans `tools/`.
   Toute modification du moteur doit passer par `tools/test-engine.ts`, toute
   modification de niveau (ou de l'optimal) par `tools/validate-levels.ts`.
4. `src/` ≈ 4 770 lignes de TS/TSX — 37 fichiers.

## Carte du code

- `src/game/` : `types.ts`, `engine.ts` (règles, collisions, trous),
  `generator.ts` (génération à solvabilité garantie), `solver.ts` (BFS optimal),
  `colors.ts`
- `src/levels/` : `handcrafted.ts` (N1–N10), `levels.ts` (N11–N60)
- `src/screens/` : `Home`, `LevelMap`, `Game`, `Settings`, `Profile`,
  `ParentalDashboard`, `Privacy`, `Sleep`, `Tutorial`
- `src/state/` : `storage.ts` (AsyncStorage), `pin.ts` (hachage + verrouillage progressif)
- `src/ui/` : `Board`, `Background`, `Confetti`, `icons`, `theme`
- `src/i18n/` : 13 locales ; `src/audio/sound.ts`

## Règles de travail appliquées

- une tâche à la fois ; commandes séparées avec `timeout`
- 2 tentatives max par problème, puis blocage noté et arrêt
- jamais de résultat non vérifié ; jamais de token dans une commande ou un fichier
- pas de `push --force` sans accord ; jamais de travail directement sur `main`
