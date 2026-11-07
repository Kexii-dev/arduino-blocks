# Plan — améliorations du simulateur

> Préparé le 2026-11-07, sur la base de la refonte de la fenêtre de simulation (PR #11, branche `feat/simulateur-ui`).
> Rien n'est implémenté : ce document décrit **quoi**, **où** et **combien** pour chacun des 14 points.

Effort : **S** ≤ ½ jour · **M** ≈ 1 jour · **L** plusieurs jours.
Moteurs : **V** = virtuel (blocs → JS), **R** = réel (AVR8js). Tout ce qui passe par `VirtualBoard` profite aux deux moteurs sans code en plus.

## Vue d'ensemble

| # | Idée | Effort | V | R | Dépend de |
|---|---|---|---|---|---|
| 1 | Servo visible | S (V) · M (R) | ✅ | ✅ | — |
| 2 | Réglage de vitesse | S | ✅ | ❌ | — |
| 3 | Bloc en cours surligné | S | ✅ | ❌ | — |
| 4 | Mode pas à pas | M | ✅ | ❌ | 3 |
| 5 | Panneau des variables | M | ✅ | ❌ | — |
| 6 | Chronogramme des broches | M | ✅ | ✅ | — |
| 7 | Traceur série | M | ✅ | ✅ | — |
| 8 | Alerte « boucle sans attendre » | S | ✅ | ❌ | — |
| 9 | Composants sur breadboard | L | ✅ | ✅ | 1, 11 |
| 10 | LCD 16×2, LED RGB, capteurs | L | ✅ | ⚠️ | 9 (RGB, capteurs) |
| 11 | Bouton-poussoir (momentané) | S | ✅ | ✅ | — |
| 12 | Raccourcis clavier | S | ✅ | ✅ | — |
| 13 | Exemple → « Simuler » | S | ✅ | ✅ | — |
| 14 | Relance automatique | S | ✅ | ⚠️ | — |

## Ordre de livraison proposé

1. **Lot 1 — rapide et visible** (≈ 1,5 j) : 1 (V), 2, 3, 11, 12, 13. ✅ fait (branche `feat/simulateur-lot1`).
2. **Lot 2 — comprendre son programme** (≈ 2 j) : 5, 8, 14, puis 4.
3. **Lot 3 — observer dans le temps** (≈ 2 j) : 6, 7, 1 (R).
4. **Lot 4 — matériel virtuel** (≈ 4-6 j) : 9, puis 10.

Chaque lot = une PR. Les lots 1-3 ne changent pas le C++ généré ; le lot 4 ajoute des blocs (LCD) donc touche aussi `blocks.js`, `generator.js` et `docs/BLOCKS.md`.

---

## Lot 1

### 1. Servo visible — S (V) · M (R)
**Constat** : le moteur virtuel émet déjà `board.onChange('servo', { pin, deg })` (`engine-virtual.js`), mais `BoardUI._onModel` ignore ce type : le bloc « Moteur servo » ne montre rien.
**Comportement** : une carte « Servo D9 » avec un palonnier SVG qui tourne de 0 à 180° (transition ~300 ms, vitesse d'un vrai SG90) et l'angle affiché. Une carte par broche servo, visible seulement si le programme en utilise.
**Implémentation**
- `generator.js` : `collectPinModes` renvoie aussi `SERVO` pour `arduino_servo` (aujourd'hui seul `collectPreamble` les voit).
- `board.js` : `servoWrite(pin, deg)` qui stocke l'angle et émet `onChange('servo')` ; `fake.servo` l'appelle au lieu d'émettre directement.
- `board-ui.js` : `_renderServos()` + branche `servo` dans `_onModel`.
- **R** : AVR8js ne connaît pas la lib Servo. Mesurer la largeur d'impulsion sur la broche (écouteur de port + `cpu.cycles` : 1000-2000 µs → 0-180°) dans `engine-avr8js.js`.
**Tests** : headless (moteur V : angle reçu par `board`) ; navigateur (rotation visible).

### 2. Réglage de vitesse — S
**Constat** : `createFakeApi` gère déjà `speed` (`delay(ms / speed)`), figé à 1 dans `sim.js`.
**Comportement** : sélecteur `×0,25 · ×0,5 · ×1 · ×2 · ×4` dans la barre d'outils, modifiable pendant la simulation, mémorisé en `localStorage`.
**Implémentation**
- `engine-virtual.js` : lire la vitesse à chaque `delay` (getter) plutôt qu'à la création.
- `sim.js` : sélecteur + `setSpeed()` sur le moteur courant.
- **R** : non applicable en l'état — `avr-runner.js` exécute ses tranches de 500 000 cycles sans régulation du temps (aussi vite que la machine le permet). Il faudrait d'abord caler l'émulation sur le temps réel ; le sélecteur est désactivé en mode réel.
**Tests** : headless (`delay(1000)` à ×4 ≈ 250 ms).

### 3. Bloc en cours surligné — S (V seulement)
**Comportement** : pendant la simulation virtuelle, le bloc exécuté est surligné dans l'éditeur (`ws.highlightBlock`). Option « Suivre le programme » (activée par défaut) ; désactivée automatiquement au-delà de ×1 car illisible.
**Implémentation**
- `generator-js.js` : `jsGenerator.STATEMENT_PREFIX = 'await fake.hl(%1);\n'` (Blockly remplace `%1` par l'id du bloc).
- `engine-virtual.js` : `fake.hl(id)` mémorise l'id ; un `requestAnimationFrame` applique `ws.highlightBlock(id)` au plus une fois par frame (sinon une boucle rapide sature le rendu).
- À l'arrêt : `ws.highlightBlock(null)`.
- **R** : hors périmètre (il faudrait relier le compteur programme AVR aux lignes C++ via les infos de debug du `.elf`).
**Tests** : headless (la séquence d'ids `hl` suit l'ordre des blocs).

### 11. Bouton-poussoir — S
**Comportement** : chaque entrée numérique a deux modes, choisis par un petit sélecteur sur la carte : **interrupteur** (bascule, actuel) ou **poussoir** (HIGH tant qu'on appuie, souris et tactile). Par défaut : poussoir, plus fidèle au matériel des kits.
**Implémentation** : `board-ui.js` — `pointerdown` / `pointerup` / `pointercancel` + `setPointerCapture` ; garder le clavier (Espace) pour l'accessibilité.
**Tests** : navigateur (HIGH pendant l'appui, LOW au relâché).

### 12. Raccourcis clavier — S
**Comportement** : quand la fenêtre est ouverte et que le focus n'est pas dans un champ ni dans l'éditeur C++ : `Espace` lancer/arrêter, `R` relancer, `Échap` fermer la fenêtre. Affichés dans le `title` des boutons.
**Implémentation** : `main.js` — un `keydown` global qui ignore `input`, `textarea`, `select`, `[contenteditable]` et `.cm-editor`.

### 13. Exemple → « Simuler » — S
**Comportement** : dans la fiche d'un exemple, un second bouton « ▶ Charger et simuler » à côté de « Charger cet exemple ».
**Implémentation** : `main.js` (`renderExDetail`) — charger, fermer le panneau Exemples, `openSim()`, puis lancer en mode virtuel. `initSim` expose `run()`.

---

## Lot 2

### 5. Panneau des variables — M (V seulement)
**Comportement** : une carte « Variables » qui affiche en direct `compteur = 12`, `message = "Bonjour"`, rafraîchie ~10 fois par seconde ; la valeur clignote quand elle change.
**Implémentation**
- `generator-js.js` (`buildJsProgram`) : ajouter au programme `function __vars() { return { compteur, message }; }` (noms déjà assainis par `toIdent`) et le renvoyer avec `setup` / `loop`.
- `engine-virtual.js` : exposer `getVars()` ; `board-ui.js` : carte qui l'interroge par `setInterval` pendant le run.
- **R** : hors périmètre (il faudrait les adresses RAM des variables, lisibles dans le `.elf` que le backend ne renvoie pas).
**Tests** : headless (`getVars()` reflète `var_set` / `var_change`).

### 8. Alerte « boucle sans attendre » — S (V)
**Comportement** : si `loop()` fait plus de ~200 tours par seconde sans aucun `attendre`, un bandeau : « Ta boucle tourne très vite sans pause : une LED qui clignote paraîtra toujours allumée. Ajoute un bloc « Attendre ». » Une seule fois par run, fermable.
**Implémentation** : `engine-virtual.js` — compter les tours de `loop()` et les appels `delay` par fenêtre d'une seconde ; callback `onWarn` vers `sim.js`.
**Tests** : headless (loop sans delay → avertissement ; avec delay → rien).

### 14. Relance automatique — S
**Comportement** : case « Relancer quand je modifie » (activée par défaut en virtuel). Une modification du programme pendant la simulation la relance après 600 ms sans nouvelle modification. Potentiomètres et interrupteurs sont conservés (déjà le cas depuis la refonte).
**Implémentation** : `main.js` — dans le change listener (hors événements UI), un `debounce` vers `sim.restartIfRunning()`.
**R** : désactivé par défaut (chaque relance recompile sur le backend, qui est limité en débit côté nginx).

### 4. Mode pas à pas — M (V seulement)
**Comportement** : bouton ⏯ « Pas à pas ». En mode pas à pas, la simulation s'arrête avant chaque bloc (surligné, cf. 3) ; « Étape » (ou `N`) exécute le bloc suivant ; « Continuer » repasse en temps réel. Les `attendre` sont sautés en pas à pas.
**Implémentation** : `fake.hl(id)` devient bloquant en mode pas à pas : il attend une promesse résolue par le bouton « Étape ». Combiné avec 5, l'élève voit les variables évoluer bloc par bloc.
**Tests** : headless (N étapes → N blocs exécutés).

---

## Lot 3

### 6. Chronogramme des broches — M
**Comportement** : une carte repliable « Chronogramme » : une ligne par broche utilisée (sorties et entrées), créneaux HIGH/LOW sur les 10 dernières secondes, défilement continu. Les broches PWM affichent leur valeur 0-255. Pause au survol.
**Implémentation**
- `board.js` : horodater chaque changement (`performance.now()` ; temps simulé si la vitesse ≠ ×1) dans un tampon circulaire par broche.
- Nouveau `src/sim/timeline.js` : rendu `<canvas>` à chaque frame tant que la carte est ouverte.
**Tests** : headless (contenu du tampon) ; navigateur (rendu).

### 7. Traceur série — M
**Comportement** : onglets « Texte / Courbe » dans la console. En mode Courbe, chaque ligne contenant des nombres devient un point (`512` → une série ; `temp:21,lum:300` → deux séries nommées), sur les 200 derniers points, axe Y automatique, légende.
**Implémentation** : `src/sim/plotter.js` (`<canvas>`) branché sur `onChange('serial')` ; découpage par ligne complète.

### 1 (R). Servo en moteur réel
Voir le point 1. Placé ici car il demande la mesure d'impulsions dans `engine-avr8js.js`, qui servira aussi au chronogramme pour le PWM réel.

---

## Lot 4

### 9. Composants sur breadboard — L
**Comportement** : un onglet « Montage » à côté de la carte : la carte Uno, une breadboard, et les composants déduits du programme, reliés par des fils colorés à leur broche :
- sortie numérique → LED + résistance 220 Ω vers GND ;
- entrée numérique → bouton-poussoir + résistance de tirage ;
- `analogRead(Ax)` → potentiomètre ;
- `tone` → buzzer ; servo → servo à trois fils.
Les composants sont interactifs (la LED du montage s'allume, le bouton se presse) : c'est la même source que les cartes de contrôle. Objectif : montrer le câblage à reproduire avec le vrai kit.
**Implémentation**
- `collectPinModes` → `collectComponents(ws)` : liste `{ type, pins }`.
- Nouveau `src/sim/wiring.js` : placement automatique sur une grille de breadboard + tracé des fils (routage orthogonal simple) ; composants en SVG dans `src/sim/assets/`.
- Export PNG du montage (fiche à imprimer pour la classe) : en option.
**Risques** : l'essentiel de l'effort est graphique (dessins des composants, lisibilité avec 8+ composants). Commencer avec LED, bouton, potentiomètre, puis étendre.

### 10. Nouveaux composants — L
- **Capteurs simulés** (S, une fois 9 fait) : nommer un curseur analogique (« Lumière », « Température ») depuis le montage ; seule l'étiquette change, la valeur reste 0-1023.
- **LED RGB** (M) : nécessite la notion de composant multi-broches du point 9 (3 broches PWM → une couleur).
- **LCD 16×2** (L) :
  - nouveaux blocs `lcd_init(rs, en, d4-d7)`, `lcd_print(texte, ligne)`, `lcd_clear` dans `blocks.js` ;
  - C++ : `#include <LiquidCrystal.h>` + objet global dans `collectPreamble` (la lib est déjà installée côté backend) ;
  - **V** : `fake.lcd*` → `board.lcd` (tampon 2 × 16) → rendu écran vert pixelisé ;
  - **R** : décoder le protocole HD44780 (4 bits) à partir des broches RS/EN/D4-D7 — faisable mais long ; à livrer d'abord en V seulement, avec un message « LCD non simulé en mode réel ».
  - documenter les blocs dans `docs/BLOCKS.md`, ajouter un exemple dans `examples.js`.

---

## À faire en parallèle

- Mettre à jour les tests navigateur `tests/sim-*.mjs` pour les nouveaux sélecteurs HTML, et rendre le chemin de Chrome configurable (`CHROME=…`), aujourd'hui figé sur `/root/.cache/ms-playwright/...`.
- Ajouter un test headless par lot dans `npm test` et la CI.
- Mettre à jour `docs/ARCHITECTURE.md` (section Simulateur) à chaque lot.
