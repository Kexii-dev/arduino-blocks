# Changelog

Toutes les modifications notables du projet. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté
- **Fenêtre Exemples** (bouton 💡) : remplace le `confirm` par un panneau de choix — 6 thèmes × 10 exemples pré-construits (LED, Capteurs, Contrôle, Sons & servo, Série, Fonctions), chacun avec une fiche explicative (description, matériel, explication) et un bouton « Charger cet exemple ».
- **Couleur des LEDs du simulateur** : clic droit sur une LED de sortie → menu de 8 couleurs (Jaune, Rouge, Vert, Bleu, Orange, Rose, Blanc, Cyan). Le choix est mémorisé par pin et appliqué quand la LED s'allume.

## [0.3.0] - 2026-09-22

### Ajouté
- **Simulateur intégré** à deux moteurs : un moteur **virtuel** (blocs → JS exécuté en navigateur, sans compile) et un moteur **réel** (émulation AVR8js de l'ATmega328p, compile cloud → `.hex`). Carte Arduino Uno SVG partagée (`VirtualBoard` / `onPinChange`).
- **Fenêtre de simulation flottante**, déplaçable, redimensionnable et agrandissable plein écran (accessible via le bouton 🔌).
- **LED_BUILTIN dédiée** (LED « L ») sur la carte virtuelle, reliée à la pin 13.
- **Documentation pédagogique** du code (`docs/CODE-TOUR.md`).
- **Page open source** : SECURITY.md, CODE_OF_CONDUCT.md, templates issues/PR, workflow CI (GitHub Actions), Dependabot, bannière README.
- **Système de versioning** : CHANGELOG + affichage de la version dans l'application.

### Corrigé
- Le plein écran de la fenêtre de simulation était plafonné à 74 % de l'écran (règle `aside { max-width }`) — `max-width: none` forcé.

## [0.2.0] - 2026-09-22

### Ajouté
- Panneau C++ repliable (bouton `</>`).
- Dropdown de fonctions dynamique (l'appel suit les fonctions réellement définies).
- Workspace auto-sauvegardé en `localStorage`.
- Écran d'accueil (Nouveau programme / Exemple / Mes programmes).
- Comptes utilisateurs matériellement : sessions httpOnly, mots de passe scrypt, zxcvbn, HIBP k-anonymat, diceware.
- FR / EN.

## [0.1.0] - 2026-09-13

### Ajouté
- Éditeur de blocs Blockly (tactile + souris).
- ~35 blocs en 10 catégories.
- Générateur Arduino C++ (setup/loop + préambule automatique).
- Compilation cloud (backend `arduino-cli` en conteneur Docker).
- Téléversement Web Serial (`avrgirl-arduino`).
- Popup « hacker » pédagogique d'explication des erreurs C++.