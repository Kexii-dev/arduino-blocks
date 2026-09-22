# Architecture

## Simulateur (2 moteurs, carte SVG partagée)

La simulation vit dans `src/sim/` et repose sur une architecture `onPinChange(pin, value)` : un **modèle partagé** (`VirtualBoard`) est piloté par n'importe quel moteur, et un seul rendu SVG (`BoardUI`) écoute les changements. Changer de moteur = brancher une autre couche de code, pas toucher à la carte.

```
blocs ──► moteur ──► VirtualBoard ──(onPinChange)──► BoardUI (SVG Uno)
              │          │
              └──────────┘  relais boutons/sliders → registres
```

- **`board.js`** — `VirtualBoard` : modèle engine-agnostic (pins, LEDs, sliders A0-A5, boutons, buzzer, console série). API : `digitalWrite`, `analogRead`, `setDigitalPin`, `isOutputHigh`, `onPinChange`.
- **`board-ui.js`** — rendu SVG Arduino Uno (`viewBox 0 0 560 320`) : LED_BUILTIN dédiée (la LED « L », reliée à la pin 13) + témoins D2-D13, boutons D2/D3, 6 sliders, buzzer D11.
- **`engine-virtual.js`** + **`generator-js.js`** — moteur **virtuel** : les blocs sont traduits en JS (fausse API Arduino `fake`), exécutés en boucle async via `new Function('fake','HIGH','LOW', body)`. Instantané, zéro compile, 100 % client.
- **`engine-avr8js.js`** + **`avr-runner.js`** + **`intelhex.js`** + **`task-scheduler.js`** — moteur **réel** : POST `/api/compile` → `.hex` → CPU ATmega328p émulé (ports B/C/D, 3 timers, USART, ADC) via `avr8js` + bootstrap vendored depuis la démo officielle wokwi/avr8js (MIT). Timings réels.
- **`sim.js`** — contrôleur du panneau : assemble les deux moteurs + `VirtualBoard` + `BoardUI`, bouton « Simuler », sélecteur de mode, hook du moteur réel uniquement.

**Fenêtre flottante** : `#simPanelWrap` (un `<aside>`) est déplaçable par la barre de titre, redimensionnable par la poignée bas-droite, agrandissable plein écran (⛶/🗗) et fermable (✕). La logique de fenêtre (drag/resize/clamp/maximiser) vit dans `src/main.js`.

**⚠️ Piège CSS** : un `<aside>` reçoit la règle générique `aside { max-width: 74vw }` qui plafonne la fenêtre à 74 % de l'écran même en plein écran → `#simPanelWrap` ET `.sim-max` doivent forcer `max-width: none` + `max-height: none`.

---

## Vue d'ensemble

Front **statique** (Vite → build `dist/`), servi par nginx. Aucun framework UI : DOM natif + Blockly. Le backend (compile + comptes) est un service séparé derrière `/api/`.

## Structure du code (`src/`)

| Fichier | Rôle |
|---|---|
| `main.js` | Assemblage : inject Blockly, palette par catégories, démo, i18n, listeners |
| `blocks.js` | Définitions des blocs Arduino (`defineBlocksWithJsonArray`) |
| `generator.js` | Générateur Arduino C++ maison + `buildSketch()` (préambule auto) |
| `vars.js` | Registre des variables typées (nombre \| texte) + dropdowns dynamiques |
| `theme.js` | Thème Blockly sombre teal (`Theme.defineTheme`) |
| `i18n.js` | FR/EN : textes UI + `Blockly.setLocale` |
| `api.js` | Enveloppe `fetch` vers `/api/*` |
| `compile.js` | Boutons Compiler / Téléverser, flash Web Serial (avrgirl) |
| `hack.js` | Popup « hacker » : parse + explique les erreurs de compilation |
| `account.js` | Comptes : modale login/register (zxcvbn + HIBP), CRUD programmes |

`public/lib/` : libs vendues en local (pas de CDN) : `zxcvbn.js`, `passwords_words.js` (diceware EFF), `avrgirl-arduino.global.js`.

## Générateur C++ (`generator.js`)

Le nouveau Blockly **n'inclut aucun générateur Arduino** — il est écrit from scratch :

- `new Blockly.Generator('Arduino')` + handlers `forBlock[type]`.
- **`scrub_` custom obligatoire** : le `scrub_` de base est un no-op → sans lui, seul le premier bloc serait émis. Il chaîne via `nextConnection.targetBlock()`.
- **Handlers appelés `(block, generator)`** : utiliser le paramètre `generator`, pas `this`.
- `collectPreamble(ws)` : scanne tous les blocs et déduit automatiquement :
  - `pinMode(pin, OUTPUT|INPUT)` pour les broches utilisées,
  - `#include <Servo.h>` + `Servo servo_N;` + `servo_N.attach(N)` si bloc servo,
  - `Serial.begin(baud)` si bloc série,
  - déclarations de variables (`int x = 0;` / `String x = "";`) depuis les blocs `arduino_var_create` (déduction de type sinon).
- `splitFunctions()` : les blocs `arduino_function` sont émis comme fonctions globales **avant** `setup()` (un `void f(){}` ne peut pas vivre dans `loop()`).
- **Blocs-valeur orphelins** : un bloc à sortie (`math_number`, `analog_read`…) laissé déconnecté est une racine du workspace et générerait une ligne nue (`42;`) qui casse la compile → `emitRoots`/`splitFunctions` **sautent toute racine qui a un `outputConnection`**.

## Contrat API (backend `arduino-compile`)

Base : `/api` (nginx → conteneur). Toutes les réponses sont JSON avec `ok: boolean`. **Le front `api()` lève une exception quand `ok:false`** — y compris pour une erreur de compilation normale (détecter `e.json.ok === false` côté compile).

### `POST /api/compile`
```json
→ { "source": "void setup() {...}" }
← { "ok": true, "hex_base64": "…", "hex_bytes": 2615,
    "size": { "flash": 924, "flash_pct": 2, "ram": 9, "ram_pct": 0 } }
← { "ok": false, "error": "<sortie brute arduino-cli>" }   // erreur de compile
```
FQBN fixe : `arduino:avr:uno`.

### Auth (`/api/auth/*`)
- `POST /auth/register` `{username, password}` → cookie session (httpOnly, 30 j, sameSite=lax). Mots de passe **scrypt**.
- `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`.

### Programmes (`/api/programs/*`)
- `GET /programs` → liste ; `POST /programs` `{name, xml, code}` ; `GET /programs/:id` ; `PUT /programs/:id` ; `DELETE /programs/:id`.
- Le champ `xml` stocke en réalité la **sérialisation JSON Blockly 13** (chaîne opaque — aucune migration backend requise).

## Flash Web Serial (`compile.js`)

`navigator.serial.requestPort()` → `new AvrgirlArduino({board:'uno'})` → `avr.flash(arrayBufferDuHex, cb)`. Nécessite Chrome/Edge/Brave/Opera **en HTTPS**. Non disponible → fallback téléchargement du `.hex`.

## Variables typées (`vars.js`)

- Bloc `arduino_var_create` déclare nom + type → registre `VARS` (Map nom → `number`|`text`).
- Les dropdowns des blocs set/get/change/append sont des **menuGenerator dynamiques** (ré-évalués au rendu).
- ⚠️ `ws.newBlock()` ne déclenche **pas** d'événement change → `addBlock()` appelle `syncVars()` explicitement (+ `rerenderAll()` pour rafraîchir les dropdowns).

## Popup hacker (`hack.js`)

`parseErrors(raw)` : regex `.ino:LIGNE:COL: error: …` sur la sortie arduino-cli. `explainError()` : règles regex → explication FR débutant. Voir [CONTRIBUTING](CONTRIBUTING.md) pour ajouter une règle.

## Pièges connus (ne pas retomber dedans)

1. **`Blockly.setLocale(FR)` AVANT `Blockly.inject`** — sinon `updateAriaLabel` lève (`Msg[...].replace` undefined).
2. **`b.isRendered()` n'existe pas en Blockly 13** — envelopper `initSvg()`/`render()` dans des `try`.
3. **`ws.centerOnBlock(objet)`** attend un objet bloc, pas un id string.
4. **Bloc-valeur orphelin = compile cassée** (cf. générateur ci-dessus).
5. Le média Blockly (appspot) déclenche un `Failed to fetch` CORS bénin sur `drop.mp3`.
6. i18n : le sélecteur de langue recharge la locale Blockly entière (`setLocale` → `applyUI`).
7. La CSP stricte est à éviter : l'app contient du inline + libs legacy.

## Tests (`tests/`)

| Script | Couvre |
|---|---|
| `gen-test.mjs` (9) | blocs de base, sketch complet, préambule |
| `gen-test2.mjs` (14) | catalogue ~30 blocs : PWM, tone, servo, while, maths, variables, série |
| `gen-test3.mjs` (12) | textes + fonctions (split hors de `loop()`) |
| `gen-test4.mjs` | cas additionnels |
| `hack-test.mjs` (7) | parse + explication des erreurs C++ |
| `account-flow-test.mjs` | flux compte complet (backend mock) |
| `diag*.mjs` | harnais navigateur playwright-core (rendu réel, console, screenshots) |

Pattern portable Node : `const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);` (sous Node, `blockly/core` résout en CJS via `.default`). Workspace headless : `new Blockly.Workspace()` — **pas jsdom**.
