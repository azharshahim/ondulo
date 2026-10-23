# 🐍 Ondulo — jeu de réflexion familial (Android + iOS)

Jeu **sans minuteur** : sur une grille aux formes irrégulières, fais glisser
chaque serpent coloré (par la tête ou par la queue) pour qu'il entre dans un
trou **de sa couleur**. Les serpents se bloquent entre eux : tout l'art est
dans l'ordre des mouvements. Quand tous les serpents sont rentrés, le niveau
est gagné, avec 1 à 3 étoiles selon le nombre de coups (comparé à l'optimal
calculé par le solveur).

🎮 **Démo web jouable (GitHub Pages)** : https://azharshahim.github.io/ondulo/
📱 **Mobile** : voir « Tester immédiatement » ci-dessous (Expo Go) ; publication
EAS Update décrite en fin de document.

## Tester immédiatement (Expo Go, sans compilation native)

Prérequis : Node.js ≥ 20 et l'application **Expo Go** sur le téléphone
([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
[iOS](https://apps.apple.com/app/expo-go/id982107779)).

```bash
cd ondulo
npm install
npx expo start
```

Un **QR code** s'affiche dans le terminal :

- **Android** : ouvre Expo Go → « Scan QR code » → scanne.
- **iOS** : scanne avec l'appareil photo, puis ouvre le lien dans Expo Go.

Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi.
Sinon, utilise le mode tunnel : `npx expo start --tunnel`.

> Le jeu démarre sans erreur dès le premier lancement : tous les modules
> natifs utilisés (Skia, Reanimated, Gesture Handler, Haptics, Audio,
> AsyncStorage) font partie d'Expo Go.

## Règles du jeu

1. Chaque serpent occupe 2 à 6 cases, parfois coudé (L, U, Z).
2. Saisis la **tête** (yeux) ou la **queue** (petite flèche) et glisse : le
   corps suit comme un vrai serpent, case par case.
3. Déplacement uniquement vers une case libre : pas de sortie de grille,
   pas de passage sur un autre serpent ni sur une zone noire du décor.
4. Un serpent ne peut entrer que dans un trou **de sa couleur**, par la tête
   ou par la queue ; il s'y engloutit entièrement (animation d'aspiration).
   Chaque trou accepte un seul serpent.
5. Plusieurs serpents/trous peuvent partager une couleur.
6. Victoire quand tous les serpents sont rentrés. Boutons : **Annuler**
   (illimité), **Recommencer**, **Indice** (prochain bon coup, après une
   courte « pub » simulée), **Pause/Menu**. Compteur de coups, jamais de
   minuteur.

## Contenu

- **60 niveaux** : 10 écrits à la main (`src/levels/handcrafted.ts`), 50
  générés de façon déterministe (2 serpents sur 5×5 → 10 serpents, grilles
  irrégulières en T, H, escalier, croix, anneau…, jusqu'à 8 couleurs).
- **Générateur à solvabilité garantie** (`src/game/generator.ts`) : chaque
  serpent est d'abord placé à une case de son trou (état « pré-résolu »),
  puis la position est « déroulée » par mouvements aléatoires réversibles —
  le niveau obtenu est donc toujours solvable par construction.
- **Solveur BFS/A\*** (`src/game/solver.ts`) : valide chaque niveau et
  calcule le nombre de coups optimal (base des étoiles et des indices).
  Vérification complète hors-ligne : `npm run test:levels`.
- **Défi quotidien** : un niveau généré par la graine de la date, identique
  pour tous les joueurs, nouveau chaque jour.
- **Skins de serpents** déblocables avec les étoiles (classique, rayures,
  pois, dégradé, arc-en-ciel) et **mode daltonien** : chaque couleur a un
  symbole (● ▲ ■ ◆ ★ ♥ ✚ ⬢) affiché sur les trous et les serpents.
- **Sauvegarde automatique** (AsyncStorage) : progression, étoiles, réglages.

## Design & effets

- Cases en verre dépoli, ombres douces et reflets ; serpents en dégradés
  avec yeux qui clignent et suivent le doigt, respiration au repos.
- Fond sombre dégradé animé avec particules flottantes (rendu
  **@shopify/react-native-skia** sur mobile).
- Anneau des trous qui pulse quand le bon serpent approche, traînée
  lumineuse pendant le glisser, secousse douce si mouvement impossible,
  confettis et étoiles animées à la victoire.
- Haptique à chaque case franchie / entrée dans un trou / victoire
  (`expo-haptics`), sons de glissement, « pop », jingle et musique douce
  avec boutons de coupure (`assets/sounds/`, générés sur mesure).
- Écrans : Accueil (logo animé), Carte des niveaux (étoiles, verrous),
  Jeu, Victoire, Réglages (son, musique, vibrations, langue FR/EN, thèmes
  clair / sombre / néon, skins, mode daltonien).

## Stack technique

- **Expo (React Native + TypeScript)**, testable via Expo Go.
- `react-native-reanimated` + `react-native-gesture-handler` : animations
  60 fps et glisser aimanté sur la grille.
- `@shopify/react-native-skia` : particules et effets du fond animé.
- `expo-haptics` : vibrations. `@react-native-async-storage/async-storage` :
  sauvegarde.
- Sons : le paquet historique `expo-av` est **déprécié et retiré d'Expo Go**
  depuis le SDK 54 ; le projet utilise son successeur officiel **`expo-audio`**
  (même rôle, mêmes fichiers WAV). `expo-av` reste présent dans les
  dépendances pour référence.

## Organisation du code

```
src/
  game/       moteur pur TypeScript : types, engine (règles), solver (A*),
              generator (génération déterministe garantie solvable), colors
  levels/     10 niveaux manuscrits + assemblage des 60 niveaux + quotidien
  ui/         plateau (Board), fond animé (Background), confettis, thèmes
  screens/    Accueil, Carte des niveaux, Jeu, Réglages
  state/      sauvegarde AsyncStorage, traductions FR/EN
  audio/      gestionnaire de sons et musique (expo-audio)
tools/        validation hors-ligne des 60 niveaux (npm run test:levels)
assets/sounds bruitages et musique générés sur mesure (WAV)
```

## Déployer la version web (GitHub Pages)

Le site est servi depuis la branche `gh-pages`, sous le préfixe `/ondulo/`
(`experiments.baseUrl` dans `app.json`). Le nom du dépôt GitHub est `ondulo`,
le site est donc à l'adresse https://azharshahim.github.io/ondulo/.

```bash
npm ci
npm run build:web      # expo export --platform web + titre/meta description
npm run test:web       # vérifie dist/index.html (titre, description, préfixe)
```

Publier `dist/` sur `gh-pages` (jamais de `--force` sans sauvegarde) :

```bash
git worktree add /tmp/gh-pages gh-pages
rsync -a --delete dist/ /tmp/gh-pages/
cd /tmp/gh-pages && git add -A && git commit -m "Web : export /ondulo" && git push
```

> Le préfixe `/ondulo/` ne fonctionne qu'une fois le dépôt renommé en
> `ondulo` sur GitHub : tant que le renommage n'est pas fait, le site continue
> de répondre sur l'ancien préfixe `/serpent-puzzle/`.

## Publier une mise à jour mobile avec EAS Update

Le projet est déjà préparé (`expo-updates` installé, `runtimeVersion` aligné
sur le SDK). Il faut un compte Expo gratuit (impossible à créer pour vous) :

```bash
git clone https://github.com/azharshahim/ondulo.git
cd ondulo
npm install
npx eas-cli@latest login              # ou créer un compte sur https://expo.dev
npx eas-cli@latest init               # associe le projet à votre compte
npx eas-cli@latest update:configure   # active les mises à jour OTA
npx eas-cli@latest update --branch preview --message "Premier test"
```

La dernière commande affiche un **QR code et un lien** (page du projet sur
expo.dev) : scannez-le avec **Expo Go** pour ouvrir le jeu sur le téléphone,
sans passer par un serveur local.

## Construire l'APK / l'IPA avec EAS Build

```bash
npm install -g eas-cli
eas login
eas build:configure        # déjà prêt : voir eas.json

# APK Android (test interne, installable directement)
eas build -p android --profile preview

# Build production (AAB pour Google Play / IPA pour l'App Store)
eas build -p android --profile production
eas build -p ios --profile production

# Publication sur les stores
eas submit -p android
eas submit -p ios
```

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm install` | installer les dépendances |
| `npx expo start` | serveur de dev + QR code Expo Go |
| `npm run test:levels` | valider les 60 niveaux + défi (solveur) |
| `npm run typecheck` | vérification TypeScript |
| `npx expo start -c` | relancer en vidant le cache Metro |

## Dépannage

- **Le QR code ne se scanne pas** : même Wi-Fi que l'ordinateur, ou
  `npx expo start --tunnel`.
- **Écran figé au premier chargement d'un gros niveau** : les niveaux
  50-60 sont générés à la volée (~1 s), un indicateur s'affiche.
- **Pas de son** : vérifier Réglages → Sons / Musique, et le mode silencieux
  du téléphone.
