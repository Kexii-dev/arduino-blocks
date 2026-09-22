# CODE-TOUR — Arduino Blocks

> **Ce document** est une visite guidée du code source de l'application web **Arduino Blocks** (`/root/arduino-blocks`). Il est destiné à un développeur JavaScript qui veut comprendre comment l'application fonctionne, *même s'il ne connaît pas tous les concepts du premier coup*. Rien n'est supposé connaître : chaque terme technique est expliqué à la volée ou référencé dans le [Glossaire](#glossaire).

---

## 1. Vue d'ensemble

### Qu'est-ce qu'Arduino Blocks ?

Arduino Blocks est une application web qui permet de programmer une carte Arduino (Uno) **sans écrire de code** : on assemblé des **blocs visuels** (comme des puzzles) dans un navigateur, et l'application les traduit en code C++, le compile sur un serveur cloud, puis peut l'écrire directement dans la carte via un câble USB.

### Le flux global : de l'élève à la carte

```
┌─────────────────────────────────────────────────────────────────┐
│  Navigateur (l'élève)                                           │
│                                                                 │
│  1. Glisse des blocs dans le workspace (Zone de travail Blockly)│
│           │                                                      │
│           ▼                                                      │
│  2. L'app traduit les blocs en C++  ────►  src/generator.js     │
│           │                                                      │
│           ▼                                                      │
│  3. [Optionnel] Simulation visuelle de la carte                 │
│           │                                                      │
│           ▼                                                      │
│  4. "Compiler" → envoi du C++ au serveur cloud                  │
│     Le serveur renvoie un fichier .hex (code binaire)           │
│           │                                                      │
│           ▼                                                      │
│  5. [Optionnel] "Téléverser" → écriture dans la carte USB       │
│     (Web Serial + avrgirl-arduino)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Les deux moteurs de simulation

Une fois les blocs assemblés, on peut **simuler** le programme sans avoir besoin de la carte physique. L'application propose deux façons de le faire :

| Moteur | Comment il fonctionne | Quand l'utiliser |
|--------|----------------------|------------------|
| **Virtuel** (`engine-virtual.js`) | Traduit les blocs en **JavaScript** (pas de C++) et les exécute dans le navigateur. Instantané, ne nécessite aucun serveur. | Dès que tu veux tester rapidement, sans compilation. |
| **Réel / AVR8js** (`engine-avr8js.js`) | Passe par le **vrai pipeline** : blocs → C++ → compilation cloud → binaire `.hex` → émulation d'un processeur ATmega328p (le vrai cerveau d'un Arduino Uno) dans le navigateur via la librairie `avr8js`. | Pour tester le programme exact qui sera gravé sur la carte, avec les vrais timings et le vrai comportement du hardware. |

Les deux moteurs pilotent le **même modèle de carte virtuelle** (`VirtualBoard`) et le **même rendu SVG** (`BoardUI`). On peut switcher entre les deux sans rien changer à la carte affichée.

---

## 2. Arborescence commentée

Chaque fichier est présenté avec son rôle en 1-2 phrases.

### Fichiers racine du projet

| Fichier | Rôle |
|---------|------|
| `index.html` | La page unique. Contient le squelette HTML : zone Blockly, panneau C++, barre d'outils, fenêtre de simulation, écran d'accueil. |
| `src/style.css` | Toute la feuille de style : palette de catégories, panneau C++ repliable, fenêtre de simulation flottante et redimensionnable, écran d'accueil. |
| `package.json` | Dépendances : `blockly@^13.3.0` (la bibliothèque de blocs) et `avr8js@^0.21.1` (l'émulateur de processeur). Développement : `vite` (constructeur) et `playwright-core` (tests). |
| `vite.config.js` | Configuration de Vite : build relatif (`base: './'`), serveur de dev avec proxy vers le backend cloud (`arduino.rayroud.com`) pour éviter les problèmes CORS. |

### Fichiers source principaux (`src/`)

| Fichier | Rôle |
|---------|------|
| `main.js` | **Point d'entrée**. Injecte le workspace Blockly, construit la palette par catégories, charge la démo initiale, gère la sauvegarde auto (localStorage), les boutons Compiler/Simuler/Téléverser, la langue, les comptes. C'est le fichier qui "colle tout ensemble". |
| `blocks.js` | Définit tous les **blocs Arduino personnalisés** (LED, broches, PWM, sons, servo, variables, série, textes, fonctions) via `Blockly.defineBlocksWithJsonArray`. Les blocs standards (si/sinon, boucles, maths) viennent de `blockly/blocks`. |
| `generator.js` | Le **générateur C++ maison**. Chaque bloc a un handler qui retourne le code C++ correspondant. `buildSketch()` assemble le fichier complet : includes + variables globales + fonctions + `setup()` + `loop()`. |
| `compile.js` | La barre "Compiler / Téléverser". Envoie le C++ au serveur via `/api/compile`, affiche le résultat (taille flash/RAM), propose le téléchargement du `.hex` ou le flash via Web Serial (`avrgirl-arduino`). |
| `vars.js` | Registre des **variables typées** (nombre ou texte). `VARS` est un `Map` nom→type. Les dropdowns des blocs "mettre variable" / "lire variable" sont des générateurs dynamiques qui lisent ce registre. |
| `hack.js` | La **popup "hacker"** qui explique les erreurs de compilation en langage simple. Parse la sortie brute d'arduino-cli avec regex, applique des règles de traduction, affiche une animation de terminal vert sur noir. |
| `api.js` | Enveloppe réseau `fetch` vers le backend `/api/*`. Lève une exception si `ok: false` (y compris pour les erreurs de compilation, qui sont des réponses normales). |
| `account.js` | Comptes et programmes cloud : modale de connexion/inscription (zxcvbn pour la force du mot de passe, vérification HIBP des fuites), sauvegarde/chargement des programmes. |
| `theme.js` | Thème Blockly sombre avec accent teal (couleurs des catégories : IO, logique, temps, maths). |
| `i18n.js` | Internationalisation FR/EN : textes de l'interface + `Blockly.setLocale`. |
| `functions.js` | Registre des **fonctions définies par l'utilisateur** (similaire à `vars.js` mais pour les fonctions). |

### Fichiers de simulation (`src/sim/`)

| Fichier | Rôle |
|---------|------|
| `sim.js` | **Contrôleur du panneau de simulation**. Assemble les deux moteurs, le modèle (`VirtualBoard`) et le rendu (`BoardUI`). Gère le bouton "Simuler", le sélecteur de mode (virtuel / AVR8js), les hooks pour les boutons et sliders. |
| `board.js` | **`VirtualBoard`** : le modèle de la carte Arduino Uno virtuelle, indépendant de tout moteur. Contient les états des pins (sorties/entrées), les sliders analogiques A0-A5, les boutons D2/D3, la console série, le buzzer. C'est le cœur partagé. |
| `board-ui.js` | **`BoardUI`** : le rendu SVG de la carte Uno (`viewBox 0 0 560 320`). Affiche LED_BUILTIN (la "L" rouge), les témoins LEDs D2-D13, les boutons, les 6 potentiomètres A0-A5, le buzzer D11, et la console série. Écoute `board.onChange` pour se mettre à jour. |
| `generator-js.js` | Générateur **JavaScript** (miroir de `generator.js` mais pour le moteur virtuel). Traduit les blocs en JS utilisant une fausse API Arduino (`fake.digitalWrite(...)`, `fake.delay(...)`). Émet `async function setup()` et `async function loop()`. |
| `engine-virtual.js` | **Moteur virtuel**. Génère le programme JS, le fait exécuter par `new Function('fake', 'HIGH', 'LOW', body)`, et lance une boucle async qui n'exécute jamais le `loop()` de façon bloquante (yield avec `setTimeout(0)`). |
| `engine-avr8js.js` | **Moteur AVR8js**. Compile le C++ (via `/api/compile`), charge le `.hex` dans l'émulateur `AVRRunner` (ATmega328p), branche les ports GPIO sur `VirtualBoard`, synchronise les sliders analogiques. |
| `avr-runner.js` | **Bootstrap de l'émulateur ATmega328p**. Crée le CPU, les 3 timers (millis/delay/PWM), les ports B/C/D (GPIO), USART (Série), ADC (analogique). Vendu depuis la démo officielle wokwi/avr8js (MIT). |
| `intelhex.js` | Chargeur **Intel HEX** minimal. Parse le format texte du `.hex` et écrit les octets bruts dans un `Uint8Array` qui sert de flash au CPU émulé. |
| `task-scheduler.js` | **`MicroTaskScheduler`** : permet à l'émulateur AVR de rendre la main au navigateur entre deux morceaux de code, pour que l'interface ne freeze pas. Utilise `MessageChannel` pour poster des tâches asynchrones. |

---

## 3. Explication module par module

### 3.1 `main.js` — Le chef d'orchestre

**Ce qu'il fait** : C'est le fichier qui s'exécute en premier (chargé par `<script type="module" src="/src/main.js">` dans `index.html`). Il initialise tout : Blockly, la palette, les boutons, la simulation, les comptes.

#### Les grandes étapes de `main.js`

**a) Injection du workspace Blockly (lignes 21-31)**

```js
const ws = Blockly.inject('blocklyDiv', { ... });
```

Le **workspace** (espace de travail) est la surface où les blocs sont assemblés. C'est le concept central de Blockly : tous les blocs vivent dans un workspace. `Blockly.inject` prend un élément HTML (`#blocklyDiv` dans `index.html`) et y affiche la surface de travail avec :
- Pas de toolbox (palette standard), car l'app utilise sa propre palette par catégories (tap-to-add).
- Thème sombre teal (`arduinoDarkTheme`).
- Barres de défilement, modalité de déplacement, zoom avec la molette.

`window.Code = { get workspace() { return ws; } }` expose le workspace globalement — utilisé par le panneau C++ pour relire les blocs.

**b) La palette par catégories (lignes 108-202)**

L'app n'utilise **pas** le système standard de Blockly (la boîte à outils qui se trouve à gauche). À la place, il affiche une barre d'onglets thématiques (⚡ Sorties, 👀 Entrées, 🔊 Sons, etc.) et, quand on clique sur un onglet, une rangée de boutons qui correspondent aux blocs de cette catégorie.

Quand on clique sur un bouton de la palette, `addBlock(type)` est appelé : il crée le bloc avec `ws.newBlock(type)`, l'initialise SVG, le rend, le place aléatoirement au centre, et centre le workspace sur lui. Comme `newBlock` ne déclenche **pas** d'événement `change`, la fonction appelle aussi `syncVars()` et `syncFunctions()` manuellement.

**c) Le change listener (lignes 63-74)**

```js
ws.addChangeListener((e) => {
  syncVars();
  syncFunctions();
  refreshCode();
  scheduleSave();
});
```

Tout changement dans le workspace (création, suppression, modification d'un champ) déclenche cette fonction. Elle :
1. Synchronise le registre des variables (`VARS`) avec les blocs `arduino_var_create` présents.
2. Synchronise le registre des fonctions (`FUNCTIONS`) avec les blocs `arduino_function` présents.
3. Regénère le code C++ affiché dans le panneau (`refreshCode`).
4. Planifie une sauvegarde dans `localStorage` (500 ms après le dernier changement).

**d) La démo initiale (lignes 205-236)**

Quand l'élève arrive sur la page et qu'aucun workspace n'est sauvegardé, l'app affiche un écran d'accueil. Si l'élève clique sur "Exemple", `buildDemo()` construit un programme complet en plaçant et en connectant manuellement des blocs :

```
analogRead(A0) > 500  →  LED allumée
                     →  sinon LED éteinte
```

Cette fonction montre comment **connecter des blocs entre eux** via leurs connexions (`previousConnection`, `nextConnection`, `outputConnection`, `inputConnection`).

**e) Sauvegarde auto / restauration (lignes 78-103)**

Le workspace est sérialisé dans `localStorage` sous la clé `'arduino-blocks-workspace'` avec `Blockly.serialization.workspaces.save(ws)`. À l'ouverture, `loadSavedWorkspace()` essaie de restaurer. C'est la "mémoire" de l'app entre deux sessions.

**f) Gestion de la fenêtre de simulation (lignes 312-409)**

La fenêtre de simulation est un `<aside>` flottant (masqué par défaut). `main.js` gère :
- L'ouverture/fermeture (bouton 🔌).
- Le déplacement par la barre de titre (drag avec `pointerdown`/`pointermove`/`pointerup`).
- Le redimensionnement par la poignée bas-droite.
- Le maximasé (⛶/🗗) avec classe `.sim-max`.
- L'appel à `initSim()` qui crée le contrôleur `sim` et expose `sim.stop()`.

**g) Initialisation des modules (lignes 310, 323, 412)**

```js
initCompile(getSource);      // barre Compiler / Téléverser
const sim = initSim({ ... }); // panneau simulation
initAccount({ ... });         // comptes
```

Ces trois appels sont la "colonne vertébrale" de l'app.

---

### 3.2 `blocks.js` — La définition des blocs

**Ce qu'il fait** : Définit la forme, le contenu et les connexions de **tous les blocs Arduino personnalisés**. C'est le fichier qui dit à Blockly : "voici à quoi ressemble le bloc LED, voici ses champs, ses couleurs, ses connexions".

La fonction exportée `defineArduinoBlocks()` appelle `Blockly.defineBlocksWithJsonArray([ ... ])` avec un tableau de définitions de blocs.

#### Format d'un bloc (exemple simple : LED)

```js
{
  type: 'arduino_led',                        // identifiant unique
  message0: 'LED intégrée %1',                // texte affiché, %1 = premier champ
  args0: [{ type: 'field_dropdown', name: 'STAT',
            options: [['allumée', 'HIGH'], ['éteinte', 'LOW']] }],
  previousStatement: null, nextStatement: null,  // pas de connexions entrée/sortie (bloc "bout")
  colour: '#00979D',                           // couleur de la catégorie IO
  tooltip: 'Allume ou éteint la LED intégrée de la carte.',
}
```

#### Les types de connexions

- **`previousStatement` / `nextStatement`** : le bloc s'emboîte dans une chaîne verticale (comme des briques). Utilisé par les blocs d'action (LED, delay, digitalWrite...).
- **`output`** : le bloc a une sortie sur le côté droit, peut être branché dans une entrée. Utilisé par les blocs valeur (analogRead, digitalRead, nombre, variable...).
- **`input_value`** : une entrée qui attend un bloc valeur (ex. la condition du `si`).
- **`input_statement`** : une entrée qui attend une série d'action (ex. le corps du `si`, le corps de la boucle).

#### Les blocs personnalisés définis dans `blocks.js`

| Famille | Blocs | Description |
|---------|-------|-------------|
| **IO (teal)** | `arduino_led`, `arduino_digital_write`, `arduino_analog_write` | Sorties : LED, broches numériques, PWM |
| **Entrées (violet)** | `arduino_analog_read`, `arduino_digital_read`, `arduino_highlow` | Lectures de broches |
| **Temps/Sons (orange)** | `arduino_delay`, `arduino_tone`, `arduino_notone`, `arduino_servo` | Délai, tonalité, servo |
| **Contrôle (violet)** | `arduino_if` | Si/alors/sinon (remplace le si standard de Blockly) |
| **Variables (vert)** | `arduino_var_create`, `arduino_var_set`, `arduino_var_change`, `arduino_var_get` | Variables typées nombre/texte |
| **Série (teal)** | `arduino_serial_init`, `arduino_serial_print`, `arduino_serial_read`, `arduino_serial_available` | Port série |
| **Textes (marron)** | `arduino_text`, `arduino_text_append`, `arduino_text_length`, `arduino_text_equals` | Manipulation de texte |
| **Fonctions (violet foncé)** | `arduino_function`, `arduino_function_call` | Définition et appel de fonctions |

Les blocs standards (si/alors de base, boucles tant que, répéter, maths, logique) ne sont **pas** définis ici : ils viennent de `blockly/blocks` (importé dans `main.js` comme `libraryBlocks`, bien que l'import ne soit pas explicitement utilisé dans le code montré — les blocs standards sont disponibles globalement via Blockly).

#### Champs spéciaux

- **`field_dropdown`** : menu déroulant. Les options `'nombre'` vs `'text'` dans `arduino_var_create.TYPE` déterminent le type de la variable dans le registre `VARS`.
- **`field_number`** : champ numérique éditable (ex. `MS` pour le délai, `FREQ` pour la tonalité).
- **`field_input`** : champ texte libre (ex. `NAME` pour le nom d'une variable ou d'une fonction).

#### Registre dynamique des variables dans les dropdowns

Les blocs `arduino_var_set`, `arduino_var_get`, `arduino_text_append` utilisent `varOptions()` ou `varOptionsAll()` (importés depuis `vars.js`) comme `options`. Ces fonctions sont des **menuGenerators** : elles sont réévaluées à chaque rendu du bloc et lisent le registre `VARS` pour afficher les variables disponibles du bon type.

```
Exemple : arduino_var_set.VAR.options = varOptionsAll()
  → au rendu : [('compteur (nombre)', 'compteur'), ('message (texte)', 'message'), ...]
```

Voir `vars.js` plus bas pour le détail.

---

### 3.3 `generator.js` — Du bloc au code C++

**Ce qu'il fait** : C'est le cœur de la traduction. Chaque type de bloc a un handler dans `arduinoGenerator.forBlock[type]` qui retourne le code C++ correspondant.

Le nouveau Blockly (depuis la version 13) **n'inclut aucun générateur Arduino** : il faut tout écrire soi-même. C'est ce que fait ce fichier.

#### Architecture du générateur

```js
export const arduinoGenerator = new Blockly.Generator('Arduino');
Object.assign(arduinoGenerator, {
  ORDER_NONE: 99, ORDER_ATOMIC: 0, ORDER_UNARY: 10,
  ORDER_MULTIPLICATIVE: 20, ORDER_ADDITIVE: 30,
  ORDER_RELATIONAL: 40, ORDER_LOGICAL_NOT: 50,
  ORDER_LOGICAL_AND: 60, ORDER_LOGICAL_OR: 70,
  ORDER_ASSIGNMENT: 80,
});
```

Les niveaux `ORDER_*` sont le **système de précédence** de Blockly : ils indiquent quand entourer une valeur de parenthèses. Par exemple, `analogRead(A0)` a `ORDER_ATOMIC` (0) parce qu'il ne nécessite jamais de parenthèses ; `a + b` a `ORDER_ADDITIVE` (30) parce qu'il faut des parenthèses si c'est utilisé dans une multiplication.

#### Les types de retours d'un handler

Un handler peut retourner :

1. **Une chaîne** (code brut) :
   ```js
   arduinoGenerator.forBlock['arduino_led'] = function (block) {
     return 'digitalWrite(LED_BUILTIN, ' + block.getFieldValue('STAT') + ');\n';
   };
   ```
   → `digitalWrite(LED_BUILTIN, HIGH);\n`

2. **Un tableau `[code, order]`** (valeur avec précédence) :
   ```js
   arduinoGenerator.forBlock['arduino_analog_read'] = function (block) {
     return ['analogRead(' + block.getFieldValue('PIN') + ')', arduinoGenerator.ORDER_ATOMIC];
   };
   ```
   → `['analogRead(A0)', 0]`
   Le `blockToCode` de Blockly utilisera cet order pour décider si des parenthèses sont nécessaires autour de cette valeur dans un contexte englobant.

#### Les handlers principaux

| Bloc | Code généré | Note |
|------|------------|------|
| `arduino_led` | `digitalWrite(LED_BUILTIN, HIGH/LOW);` | LED_BUILTIN = pin 13 sur Uno |
| `arduino_digital_write` | `digitalWrite(5, HIGH);` | |
| `arduino_analog_read` | `analogRead(A0)` (valeur, ORDER_ATOMIC) | |
| `arduino_digital_read` | `digitalRead(2)` (valeur) | |
| `arduino_delay` | `delay(1000);` | |
| `arduino_if` | `if (cond) { ... } else { ... }` | Génère le `else` seulement si la branche n'est pas vide |
| `arduino_analog_write` | `analogWrite(9, 128);` | PWM broches 3/5/6/9/10/11 |
| `arduino_tone` | `tone(9, 440);` | |
| `arduino_servo` | `servo_9.write(90);` | Le préfixe `servo_` + numéro de pin est nécessaire parce que plusieurs servos peuvent coexister |
| `arduino_var_set` | `compteur = 5;` | `generator.valueToCode(block, 'V', ORDER_ASSIGNMENT)` récupère la valeur branchée |
| `arduino_serial_print` | `Serial.println("Bonjour");` | |
| `arduino_function` | `void maFonction() { ... }` | Émis comme fonction globale, pas dans loop() |
| `controls_whileUntil` | `while (cond) { ... }` ou `while (!cond) { ... }` | Le mode UNTIL inverse la condition |
| `controls_repeat` | `for (int _i = 0; _i < 5; _i++) { ... }` | |
| `math_arithmetic` | `a + b` ou `pow(a, b)` pour la puissance | La puissance utilise la fonction `pow()` d'arduino |
| `math_random_int` | `random(1, 101)` | `B + 1` parce que `random(a, b)` est exclusif sur b |

#### `scrub_` — Le chaînage obligatoire

```js
arduinoGenerator.scrub_ = function (block, code, opt_thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = opt_thisOnly ? '' : this.blockToCode(nextBlock);
  return code + nextCode;
};
```

C'est **crucial**. Le `scrub_` par défaut de Blockly est un no-op (il ne fait rien). Sans ce `scrub_` personnalisé, Blockly n'émet que le **premier bloc** de la chaîne et ignore tous les suivants. Le `scrub_` personnalisé récursivement demande à Blockly de convertir le bloc suivant en code et l'ajoute.

#### `collectPreamble(ws, gen)` — Le préambule automatique

C'est la fonction la plus intelligente du générateur. Elle **scanne tous les blocs** du workspace et déduit automatiquement ce qui doit aller dans le préambule (avant `setup()`) :

1. **`pinMode`** : si un bloc `arduino_digital_write` utilise la pin N → `pinMode(N, OUTPUT)`. Si un bloc `arduino_digital_read` utilise N → `pinMode(N, INPUT)`.
2. **Servos** : si un bloc `arduino_servo` utilise la pin N → `#include <Servo.h>`, `Servo servo_N;`, `servo_N.attach(N);`.
3. **Série** : si un bloc `arduino_serial_init` est présent → `Serial.begin(9600);` en première ligne de `setup()`.
4. **Variables** : pour chaque `arduino_var_create` → `int compteur = 0;` ou `String message = "";`. Si une variable est utilisée dans un `set` ou `get` sans avoir été déclarée → elle est déclarée comme `number` par défaut.

```js
for (const b of ws.getAllBlocks()) {
  if (b.type === 'arduino_digital_write') pins.set(b.getFieldValue('PIN'), 'OUTPUT');
  else if (b.type === 'arduino_servo') servos.add(b.getFieldValue('PIN'));
  else if (b.type === 'arduino_var_create') { ... varTypes.set(n, type); }
  else if (b.type === 'arduino_var_set' || b.type === 'arduino_var_get') {
    // déduction : si pas de type connu, nombre par défaut
    if (n && !varTypes.has(n)) varTypes.set(n, 'number');
  }
  ...
}
```

#### `splitFunctions(gen, ws)` — Séparation fonctions / loop

Un bloc `arduino_function` produit du code comme `void f() { ... }`. En C++, une définition de fonction **ne peut pas** être placée à l'intérieur de `loop()`. Donc `splitFunctions` sépare :

- Les blocs de type `arduino_function` → `funcs` (émitted avant `setup()`).
- Tous les autres blocs racine → `loop` (émitted dans `loop()`).

```js
export function buildSketch(ws, generator) {
  const { loop, funcs } = splitFunctions(gen, ws);
  ...
  return header + pre.globals + funcs + setup + '\n' + loopF;
}
```

#### Blocs-valeur orphelins

Un bloc comme `arduino_analog_read` a une connexion `output` (il produit une valeur). Si on le place seul dans le workspace sans le brancher nulle part, il est techniquement une "racine" du workspace. Dans `emitRoots()` (utilisé dans `splitFunctions`), ces blocs sont **ignorés** :

```js
if (b.outputConnection) continue; // bloc-valeur orphelin
```

Sinon, `analogRead(A0)` émis seul donnerait `analogRead(A0)` sans point-virgule, ce qui ferait échouer la compilation C++.

---

### 3.4 `compile.js` — Compiler et téléverser

**Ce qu'il fait** : Fournit la barre d'outils "Compiler / Téléverser / Télécharger le .hex" qui apparaît en bas à droite de l'écran.

#### Les trois boutons

1. **Compiler** (teal `#00878f`) : appelle `doCompile()`.
2. **Téléverser sur la carte** (orange `#e7662d`, visible seulement après un compilation réussie) : appelle `doFlash()`.
3. **Télécharger le .hex** (lien teal, visible seulement après un compilation réussie) : appelle `doDownload()`.

#### `doCompile()` — La compilation cloud

```js
async function doCompile() {
  const src = getSource();          // buildSketch(ws, arduinoGenerator)
  const res = await api('/compile', { method: 'POST', body: { source: src } });
  // res = { ok: true, hex_base64: "...", hex_bytes: 2615, size: { flash: 924, flash_pct: 2, ram: 9, ram_pct: 0 } }
  //   ou { ok: false, error: "..." }  (erreur de compilation)
}
```

L'endpoint `/api/compile` reçoit le code C++ et renvoie :
- En cas de succès : le fichier `.hex` encodé en base64, sa taille en octets, et l'utilisation mémoire (flash/ram en octets et pourcentage).
- En cas d'échec : `{ ok: false, error: "<sortie brute arduino-cli>" }`.

La barre affiche alors :
- Succès : "✅ Compilé pour Arduino Uno. Flash: 924 o (2%) · RAM: 9 o (0%)" + bouton téléverser + lien télécharger.
- Échec : "❌ Erreur de compilation : <message>" + la popup "hacker" (`showHackPopup`).

#### `doFlash()` — Le téléversement Web Serial

```js
async function doFlash() {
  const avr = new window.AvrgirlArduino({ board: 'uno', debug: true });
  avr.flash(hexToArrayBuffer(lastResult.hex_base64), (err) => { ... });
}
```

**Prérequis** : Chrome/Edge/Brave/Opera en HTTPS, carte Arduino branchée en USB. `navigator.serial.requestPort()` ouvre un sélecteur de port. `avrgirl-arduino` (librairie JavaScript) gère le protocole de flashage (bootloader optiboot).

La fonction `hexToArrayBuffer(b64)` decode la base64 en un `ArrayBuffer` que `avrgirl` peut écrire dans la flash de la carte.

#### `doDownload()` — Téléchargement du .hex

Crée un Blob à partir du `.hex` décodé et déclenche un téléchargement fichier nommé `sketch.ino.hex`. Utile si le navigateur ne supporte pas Web Serial.

---

### 3.5 `vars.js` — Les variables typées

**Ce qu'il fait** : Fournit un registre central `VARS` (un `Map` nom → `'number'` | `'text'`) et des fonctions pour remplir les dropdowns des blocs variables de manière dynamique.

#### Pourquoi "typées" ?

Dans Arduino, une variable peut être un `int` (nombre) ou un `String` (texte). Ces deux types ne sont pas interchangeables : on ne peut pas faire `int x = "bonjour";`. Le système de blocs d'Arduino Blocks fait la différence dès la création (`arduino_var_create` demande nombre ou texte).

#### `VARS` — Le registre

```js
export const VARS = new Map(); // nom -> 'number' | 'text'
```

Il est rempli par `syncVars()` dans `main.js` à chaque changement du workspace :

```js
function syncVars() {
  VARS.clear();
  for (const b of ws.getAllBlocks()) {
    if (b.type === 'arduino_var_create') {
      const n = b.getFieldValue('NAME');
      if (n) VARS.set(n, b.getFieldValue('TYPE') === 'text' ? 'text' : 'number');
    }
  }
}
```

#### `varOptions(type)` — Menu generator pour un type

```js
export function varOptions(type) {
  return function () {
    const opts = [];
    for (const [name, t] of VARS) {
      if (t === type) opts.push([name, name]);
    }
    if (!opts.length) opts.push(['(aucune variable nombre)', '']);
    return opts;
  };
}
```

C'est une **fonction qui retourne une fonction**. La fonction interne est appelée par Blockly à chaque rendu du bloc pour peupler le menu déroulant. Elle ne liste que les variables du bon type.

`arduino_var_change` utilise `varOptions('number')` (seulement les variables nombre).
`arduino_text_append` utilise `varOptions('text')` (seulement les variables texte).

#### `varOptionsAll()` — Toutes les variables

Pour les blocs `arduino_var_set` et `arduino_var_get` qui acceptent les deux types. Affiche le type entre parenthèses : `compteur (nombre)`, `message (texte)`.

#### Piège : `ws.newBlock()` ne déclenche pas d'événement change

Quand on ajoute un bloc via la palette (`addBlock`), `ws.newBlock()` ne déclenche **pas** le `addChangeListener`. Donc `syncVars()` doit être appelé explicitement dans `addBlock()`. De même, si on ajoute un `arduino_var_create` ou `arduino_function`, `rerenderAll()` est appelé pour forcer le re-rendu des dropdowns dynamiques des autres blocs qui les utilisent.

---

### 3.6 `hack.js` — La popup "hacker"

**Ce qu'il fait** : Quand une compilation échoue, au lieu d'afficher un message d'erreur brut et incompréhensible pour un débutant, cette popup affiche une animation de terminal vert sur noir avec :
1. Le décodage des erreurs (ligne, colonne, message).
2. Une explication en français simple de ce que l'erreur signifie.
3. Le message brut d'arduino-cli en dessous.

#### Trois fonctions

**`parseErrors(raw)`** (ligne 6) : Extrait les erreurs de la sortie d'arduino-cli avec une regex :

```js
const re = /\.ino:(\d+):(\d+):.*error:\s*(.+)$/gm;
```

Chaque erreur donnée en entrée : `{ line: 12, col: 5, message: "variable 'x' was not declared in this scope" }`.

**`explainError(err)`** (ligne 35) : Applique un ensemble de règles regex pour traduire l'erreur brute en explication :

```js
const RULES = [
  { re: /not declared in this scope/, explain: 'Un bloc utilise une variable ou une fonction qui n\'existe pas encore...' },
  { re: /expected ';'/, explain: 'Il manque un point-virgule ( ; )...' },
  { re: /cannot convert .*String.*int/, explain: 'Tu mélanges un TEXTE et un NOMBRE...' },
  ...
];
```

Ces règles couvrent les erreurs les plus courantes pour des débutants travaillant avec des blocs.

**`showHackPopup(raw)`** (ligne 73) : Crée l'overlay, injecte le CSS (défini en dur dans la variable `CSS`), construit le DOM de la popup, et lance une animation async qui "tapote" le texte caractère par caractère avec un effet de terminal. La popup a un bouton "⏩ passer" pour accélérer l'animation et un bouton "FERMER".

Le CSS définit le style "hacker" : fond noir avec gradient radial, scanline animée, texte vert `#00ff41` avec glow, barre de progression animée à l'arrivée.

---

### 3.7 `src/sim/` — Le simulateur

#### Architecture globale

```
┌──────────────────────────────────────────────────────────┐
│                    src/sim/sim.js (contrôleur)           │
│                                                          │
│   sim.initSim({ getWorkspace, getSource, compile })      │
│                                                          │
│   ┌─────────────┐    ┌─────────────┐                    │
│   │ VirtualBoard │◄───│  BoardUI    │  (SVG Uno)        │
│   │  (modèle)    │    │  (rendu)    │                    │
│   └──────┬──────┘    └─────────────┘                    │
│          │ onPinChange / onChange                         │
│          ▼                                               │
│   ┌──────────────────────┐  ┌──────────────────────┐    │
│   │ VirtualEngine        │  │ Avr8Engine           │    │
│   │ (blocs→JS→exec)      │  │ (compile→hex→CPU)    │    │
│   └──────────────────────┘  └──────────────────────┘    │
│                                                          │
│   Sélecteur de mode : virtuel / AVR8js                   │
│   Bouton "Simuler" / "Arrêter"                           │
└──────────────────────────────────────────────────────────┘
```

#### `board.js` — `VirtualBoard` : le modèle de la carte

C'est le cœur architectural du simulateur. `VirtualBoard` est une classe qui représente **l'état complet d'une Arduino Uno virtuelle**, indépendamment de la façon dont le programme est exécuté.

**État interne** :
- `pinOut` (Map) : pin → HIGH/LOW ou valeur PWM 0-255.
- `analogIn` (Array 6) : valeurs des 6 canaux analogiques A0-A5 (0-1023).
- `digitalIn` (Array 14) : état des boutons virtuels sur les pins 2 et 3 (boutons D2/D3).
- `serialRx` / `serialTx` : tampon série (ce qui est reçu / envoyé).
- `pwmValue` / `toneFreq` : état PWM et tonalité pour l'affichage.

**Méthodes appelées par les moteurs** (les "sorties") :
- `digitalWrite(pin, value)` : écrit HIGH/LOW sur une pin, notifie `onPinChange(pin, value)` et `onChange('digital', ...)`.
- `analogWrite(pin, value)` : écrit une valeur PWM 0-255, notifie l'UI.
- `tone(pin, freq)` / `noTone(pin)` : démarre/arrête une tonalité.
- `serialAppend(text)` : ajoute du texte à la console série virtuelle.
- `log(msg)` : message pédagogique (utilisé par le moteur virtuel pour expliquer ce qui se passe).

**Méthodes lues par les moteurs** (les "entrées") :
- `digitalRead(pin)` : retourne l'état d'un bouton virtuel (pins 2 et 3) ou LOW par défaut.
- `analogRead(channel)` : retourne la valeur du slider A0-A5.

**Méthodes appelées par l'UI** (les actions utilisateur) :
- `setAnalog(channel, value)` : déplace un slider.
- `setButton(pin, pressed)` : presse/relâche un bouton.
- `serialInput(ch)` : envoie un caractère dans la console série.

#### `board-ui.js` — `BoardUI` : le rendu SVG

Cette classe construit le SVG de la carte Uno dans le conteneur DOM donné. Le SVG a `viewBox="0 0 560 320"` et contient :

- Le PCB (rectangle avec coins arrondis).
- Le chip ATmega328P (rectangle avec le texte "ATmega328P").
- La LED_BUILTIN dédiée (cerulean `#00979D` quand allumée, gris foncé sinon) avec le texte "LED_BUILTIN (pin 13)".
- Une rangée de 12 LEDs témoins pour les pins D2-D13.
- 2 boutons rouges pour D2 et D3 (avec effet de pression au `pointerdown`).
- 6 sliders/potentiomètres pour A0-A5 (le curseur se déplace verticalement en fonction de la valeur 0-1023).
- Un buzzer pour D11 (affiche la fréquence en Hz quand une tonalité est active).
- Une console série (en dessous du SVG) avec affichage du texte et bouton "vider".

**Interaction avec le modèle** :

`BoardUI` s'abonne à `board.onChange` via `this.board.onChange = (kind, p) => this._onModel(kind, p)`. Quand le modèle change :
- `digital` / `pwm` → allume/éteint la LED témoin correspondante.
- `analog` → re-rendu des sliders.
- `tone` → affiche la fréquence du buzzer.
- `serial` → ajoute le texte à la console.

**Interaction avec l'utilisateur** :
- Les boutons appellent `board.setButton(pin, pressed)` (modèle) ET `hooks.setButton(pin, pressed)` (relais vers le moteur réel si actif).
- Les sliders appellent `board.setAnalog(ch, val)` (modèle) ET `hooks.setAnalog(ch, val)` (relais AVR8js).

#### `generator-js.js` — Le générateur JavaScript

C'est un **miroir** de `generator.js` mais qui produit du JavaScript au lieu du C++. Il utilise la même structure de `Blockly.Generator('ArduinoJS')` avec les mêmes ORDER_*, mais chaque handler retourne du JS utilisant une fausse API `fake` :

```js
arduinoGenerator.forBlock['arduino_led'] = function (block) {
  return 'await fake.digitalWrite(13, ' + block.getFieldValue('STAT') + ');\n';
};
arduinoGenerator.forBlock['arduino_delay'] = function (block) {
  return 'await fake.delay(' + block.getFieldValue('MS') + ');\n';
};
```

Parce que les fonctions `fake` utilisent des `Promise` (notamment `delay`), tout le programme est `async`. Le générateur produit :

```
let compteur = 0;
async function setup() { ... }
async function loop() { ... }
```

Contrairement au générateur C++, il n'y a pas de préambule avec `pinMode` ou `Serial.begin` (le moteur virtuel n'a pas besoin de ces notions — il simule directement le comportement).

#### `engine-virtual.js` — Le moteur virtuel

**Concept** : Traduire les blocs en JS, puis exécuter ce JS dans le navigateur. Pas de serveur, pas de compilation, résultat instantané.

**`createFakeApi(board, opts)`** :

Fabrique un objet `fake` qui implémente une "API Arduino" en JavaScript :

```js
const api = {
  digitalWrite: (pin, value) => { board.digitalWrite(pin, value); },
  digitalRead: (pin) => board.digitalRead(pin),
  analogRead: (ch) => board.analogRead(ch),
  analogWrite: (pin, value) => { board.analogWrite(pin, value); },
  tone: (pin, freq) => { board.tone(pin, freq); },
  noTone: (pin) => { board.noTone(pin); },
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms / speed)),
  serialPrint: async (text) => { board.serialAppend(String(text) + '\n'); },
  serialRead: () => board.serialReadByte(),
  serialAvailable: () => board.serialRxAvailable() ? 1 : 0,
  pinMode: () => {},
};
```

`fake.delay` est la pièce maîtresse : au lieu de bloquer le thread (comme le fait `delay()` en C++), il retourne une `Promise` qui se résout après `ms / speed` millisecondes. Ainsi, la boucle async peut yield et laisser l'UI respirer.

**`VirtualEngine.start()`** :

```js
async _runLoop(api, program) {
  const body = program + '\nreturn { setup: setup, loop: loop };';
  const factory = new Function('fake', 'HIGH', 'LOW', body);
  const { setup, loop } = factory(api, HIGH, LOW);
  if (setup) await setup();
  while (this._running && !this._stopFlag) {
    if (loop) await loop();
    await new Promise((r) => setTimeout(r, 0)); // yield UI
  }
}
```

`new Function('fake', 'HIGH', 'LOW', body)` est une façon d'exécuter du code JavaScript dynamiquement (équivalent de `eval` mais plus sûr car les variables d'entrée sont contrôlées). Le programme est exécuté dans une boucle qui rappelle `loop()` indéfiniment (comme `loop()` en Arduino), avec un `setTimeout(0)` entre chaque itération pour ne pas figer le navigateur.

**Limites du moteur virtuel** :
- C'est une **approximation** : le comportement n'est pas identique à la carte réelle (pas de timings exacts, pas de comportement des registres hardware).
- Pour les tests rapides et les démos, c'est parfait. Pour un test fidèle, utiliser le moteur AVR8js.

#### `engine-avr8js.js` — Le moteur "réel" AVR8js

**Concept** : Utiliser le pipeline complet (blocs → C++ → compilation cloud → hex → CPU émulé) pour exécuter le **vrai firmware** dans le navigateur.

**`Avr8Engine.start(source, compileFn)`** :

1. Compile le C++ via `compileFn(source)` (qui appelle `/api/compile`).
2. Décode le `.hex` base64 en texte Intel HEX avec `atob()`.
3. Crée un `AVRRunner(hex)` — l'émulateur ATmega328p.
4. Synchronise les sliders analogiques (`_syncAnalog`).
5. Branche les événements (`_wire`).
6. Démarre l'émulateur.

**`_wire()` — Brancher l'émulateur sur le VirtualBoard** :

C'est le point crucial d'intégration. L'émulateur AVR8js exécute le firmware comme un vrai ATmega328p : il a des registres, des ports, des interruptions. Pour que les actions du firmware soient visibles dans l'UI, il faut **traduire les événements de l'émulateur en appels VirtualBoard**.

```js
// Sorties : chaque port notifie quand un pin change
for (const [reg, port] of [['B', this.runner.portB], ['C', this.runner.portC], ['D', this.runner.portD]]) {
  port.addListener(() => {
    for (const pin of Object.keys(DIGITAL)) {
      if (DIGITAL[pin][0] !== reg) continue;
      const st = portObj.pinState(bitIdx);
      if (st === PinState.High || st === PinState.Low) {
        b.digitalWrite(pin, st === PinState.High ? 1 : 0);
      }
    }
  });
}
```

Les ports B, C, D de l'ATmega328p correspondent aux pins de l'Arduino Uno :
- Port D : pins 0-7 (D0=RX, D1=TX, D2-D7 broches numériques).
- Port B : pins 8-13 (D8-D13).
- Port C : pins A0-A5 (D14-D19).

L'AEM8js expose chaque port via `AVRIOPort` avec un `addListener` qui appelle la callback quand un bit du port change (ce qui arrive quand le firmware écrit dans un registre PORTx).

```js
// Série : Serial.print -> console virtuelle
this.runner.usart.onByteTransmit = (value) => {
  b.serialAppend(String.fromCharCode(value));
};
```

**`_syncAnalog()` — Synchroniser les sliders avec l'ADC** :

L'émulateur AVR8js a un ADC (convertisseur analogique-numérique) qui attend des tensions en volts (0-5V). Les sliders de l'UI fournissent des valeurs 0-1023. La conversion :

```js
volts[ch] = (this.board.analogIn[ch] / 1023) * 5;
this.runner.setAnalogChannels(volts);
```

**`setButton(pin, pressed)`** :

Quand l'utilisateur presse un bouton virtuel, l'UI appelle `engine.setButton(pin, pressed)`. Pour le moteur AVR8js, cela se traduit par `this.runner.setDigitalPin(pin, pressed)` qui modifie directement l'état du registre PIN du port concerné (simulant la lecture d'un bouton physique).

#### `avr-runner.js` — Le bootstrap de l'émulateur

Ce fichier est un "adapteur" qui crée et coordine tous les composants de l'émulateur AVR8js pour former un ATmega328p complet (Uno).

**Ce qu'il crée** :

```js
this.cpu = new CPU(this.program);           // le cœur du processeur
this.timer0 = new AVRTimer(this.cpu, timer0Config);   // millis() / delay()
this.timer1 = new AVRTimer(this.cpu, timer1Config);   // PWM
this.timer2 = new AVRTimer(this.cpu, timer2Config);   // PWM
this.portB = new AVRIOPort(this.cpu, portBConfig);    // pins 8-13
this.portC = new AVRIOPort(this.cpu, portCConfig);    // A0-A5
this.portD = new AVRIOPort(this.cpu, portDConfig);    // pins 0-7
this.usart = new AVRUSART(this.cpu, usart0Config, MHZ); // Serial
this.adc = new AVRADC(this.cpu, adcConfig);           // analogRead
this.taskScheduler = new MicroTaskScheduler();        // yield UI
```

Le CPU est alimenté par le contenu du flash : `loadHex(hex, new Uint8Array(this.program.buffer))` écrit le firmware dans les 32 KB de flash émulés.

**`start()` — La boucle d'exécution** :

```js
start(workUnitCycles, callback, onError) {
  const execute = () => {
    if (!this._running) return;
    const target = this.cpu.cycles + cyclesToRun;
    try {
      while (this.cpu.cycles < target) {
        avrInstruction(this.cpu);  // exécute une instruction AVR
        this.cpu.tick();            // avance l'horloge
      }
      if (callback) callback(this.cpu);
      if (this._running) this.taskScheduler.postTask(execute);
    } catch (e) { ... }
  };
  this.taskScheduler.postTask(execute);
}
```

L'émulateur ne s'exécute pas en une seule fois (ce qui freezerait le navigateur). Il décompose l'exécution en **unités de travail** (ici 500 000 cycles, soit ~31 ms à 16 MHz) et poste la prochaine unité via `taskScheduler.postTask(execute)`. `avrInstruction` exécute une instruction machine AVR (LDA, STA, ADD, etc.) et `cpu.tick()` avance le cycle d'horloge.

#### `intelhex.js` — Chargeur Intel HEX

Le format Intel HEX est le format texte standard pour distribuer du firmware. Chaque ligne commence par `:` et contient :
- Nombre d'octets (2 hex)
- Adresse de départ (4 hex)
- Type d'enregistrement (2 hex) : `00` = données, `01` = fin de fichier
- Les octets de données
- Byte de checksum

```js
export function loadHex(source, target) {
  for (const line of source.split('\n')) {
    if (line[0] === ':' && line.substr(7, 2) === '00') {
      const bytes = parseInt(line.substr(1, 2), 16);
      const addr = parseInt(line.substr(3, 4), 16);
      for (let i = 0; i < bytes; i++) {
        target[addr + i] = parseInt(line.substr(9 + i * 2, 2), 16);
      }
    }
  }
}
```

Ce loader est minimal : il ignore les enregistrements de type différent de `00` (données) et ne fait pas de vérification de checksum.

#### `task-scheduler.js` — `MicroTaskScheduler`

C'est ce qui permet à l'émulateur AVR de ne pas figer le navigateur. Il utilise un `MessageChannel` (deux ports communicants) pour poster des tâches de manière asynchrone :

```js
export class MicroTaskScheduler {
  constructor() {
    this.channel = new MessageChannel();
    this.executionQueue = [];
    this.stopped = true;
  }
  postTask(fn) {
    if (!this.stopped) {
      this.executionQueue.push(fn);
      this.channel.port1.postMessage(null);  // déclenche handleMessage
    }
  }
  handleMessage = () => {
    const executeJob = this.executionQueue.shift();
    if (executeJob !== undefined) executeJob();
  };
}
```

Quand `port1.postMessage(null)` est appelé, le navigateur déclenche `port2.onmessage` dans la prochaine micro-tâche (pas de blocage). `handleMessage` défile la prochaine unité de travail. C'est une technique standard pour "yield" entre deux morceaux de code CPU intensif.

---

## 4. Fichiers annexes essentiels

### `api.js` — Enveloppe réseau

```js
export function api(path, opts = {}) {
  return fetch(API_BASE + path, { ... })
    .then(r => r.json())
    .then(json => {
      if (!json.ok) throw Object.assign(new Error(json.error), { status: json.statusCode, json });
      return json;
    });
}
```

Toutes les réponses du backend ont `ok: boolean`. Si `ok` est `false`, `api()` lève une exception (avec le JSON d'erreur attaché). C'est crucial pour `compile.js` qui doit distinguer une **erreur réseau** d'une **erreur de compilation** (qui est une réponse `ok: false` normale).

### `account.js` — Comptes et programmes

Fournit une modale complète pour :
- S'enregistrer / se connecter (avec vérification de force du mot de passe via `zxcvbn` et vérification des fuites via HIBP API).
- Sauvegarder/charger/supprimer des programmes (le workspace sérialisé en JSON Blockly 13, stocké dans le champ `xml` de l'API).
- Générer un mot de passe fort aléatoire (5 mots diceware du fichier `passwords_words.js`).

### `theme.js` — Thème Blockly

Définit `arduinoDarkTheme` avec les composants workspace/toolbox et les couleurs par catégorie de blocs (IO teal, logique violet, temps orange, maths vert).

### `i18n.js` — Internationalisation

Les textes UI sont dans un objet `UI` avec les clés `fr` et `en`. `Blockly.setLocale(Fr | En)` change les messages intégrés de Blockly. `applyUI()` met à jour les éléments DOM avec les textes traduits.

### `functions.js` — Registre des fonctions utilisateur

Même pattern que `vars.js` mais avec un `Set` au lieu d'un `Map`. Le bloc `arduino_function_call` utilise `functionOptions()` comme menu generator pour afficher les fonctions définies.

---

## 5. Glossaire

| Terme | Explication |
|-------|-------------|
| **Blockly** | Une bibliothèque JavaScript de Google qui permet de créer des éditeurs de programmes par blocs visuels (comme Scratch). Elle gère le drag-and-drop, les connexions entre blocs, la génération de code et la sérialisation. |
| **Workspace (espace de travail)** | La surface dans laquelle les blocs sont assemblés. C'est le "dessin" du programme. Blockly gère tous les blocs, leurs connexions et leur position dans un workspace. |
| **Block (bloc)** | Une pièce visuelle qui représente une opération (allumer une LED, attendre, faire un si...). Les blocs s'emboîtent entre eux. |
| **Générateur (generator)** | Dans Blockly, un objet qui sait convertir chaque type de bloc en code texte (C++, JavaScript, Python...). Chaque type de bloc a un handler `forBlock[type]`. |
| **Scratch / blocs** | Un langage de programmation visuelle où l'on assemble des blocs colorés ressemblant à des puzzles. Arduino Blocks utilise Blockly pour offrir cette expérience. |
| **Code C++ / Sketch** | Le code texte qui est téléversé sur la carte Arduino. Un "sketch" Arduino est composé de deux fonctions obligatoires : `setup()` (exécutée une fois au démarrage) et `loop()` (exécutée en boucle indéfiniment). |
| **.hex (Intel HEX)** | Un format de fichier texte qui représente le code binaire à écrire dans la mémoire flash de la carte. Chaque ligne décrit des octets à une adresse donnée. C'est le format que l'outil de compilation produit. |
| **ATmega328p** | Le microcontrôleur (le "cerveau") d'un Arduino Uno. C'est un processeur 8 bits qui tourne à 16 MHz avec 32 KB de flash, 2 KB de RAM et 1 KB d'EEPROM. L'émulateur AVR8js réplique son comportement dans le navigateur. |
| **Web Serial** | Une API du navigateur (Chrome/Edge) qui permet de communiquer avec des périphériques série USB (comme une carte Arduino). C'est ce qui permet au browser de texte`](l. |
| **avrgirl-arduino** | Une librairie JavaScript qui parle au bootloader d'une carte Arduino (optiboot) via Web Serial pour lui écrire un fichier `.hex`. |
| **pinMode** | En C++ Arduino, `pinMode(pin, mode)` configure une broche comme entrée (`INPUT`) ou sortie (`OUTPUT`). Sans cet appel, la broche n'est pas prête à lire ou écrire. |
| **digitalWrite / digitalRead** | Écrire ou lire un état HIGH (5V/logique 1) ou LOW (0V/logique 0) sur une broche numérique. |
| **analogRead / analogWrite** | `analogRead(A0)` lit une tension (0-5V) et retourne une valeur 0-1023. `analogWrite(pin, 128)` produit un signal PWM (pulse-width modulation) qui simule une tension intermédiaire en allument/éteignant très vite la broche. |
| **PWM** | Pulse Width Modulation : une technique pour simuler une tension analogique en commutant très rapidement une broche numérique. La valeur 0-255 représente le rapport cyclique (0 = toujours éteint, 255 = toujours allumé). |
| **Série (Serial)** | Une communication texte entre la carte et l'ordinateur (via USB). `Serial.begin(9600)` initialise le port à 9600 bauds. `Serial.println("bonjour")` envoie le texte suivi d'un retour à la ligne. `Serial.read()` lit un octet reçu. |
| **Servo** | Un moteur qui peut tourner à un angle précis (0-180°). Il se branche sur 3 fils : 5V, GND, et signal (PWM). La librairie Servo de Arduino gère le signal. |
| **Tone** | Émet un signal carré à une fréquence donnée (en Hz) sur une broche, pour faire sonner un buzzer ou un piézo. |
| **Bootloader optiboot** | Un petit programme préinstallé sur la carte Arduino qui permet de lui écrire un nouveau programme via USB sans avoir besoin d'un programmateur matériel. C'est ce qui est utilisé par Web Serial. |
| **localStorage** | Une base de données clé/valeur du navigateur, persistante entre les sessions. Arduino Blocks l'utilise pour sauvegarder automatiquement le workspace. |
| **Intel HEX** | Un format texte standard pour décrire le contenu de la mémoire flash d'un microcontrôleur. Chaque ligne commence par `:` et contient des octets encodés en hexadécimal avec leur adresse. |
| **émulation / émulateur** | Reproduire le comportement d'un ordinateur ou d'un processeur dans un logiciel. AVR8js émule le ATmega328p : il exécute les mêmes instructions machine, gère les mêmes registres, timers, ports GPIO et conversions analogiques. |
| **PV / cosφ** | Le code C++ généré par le générateur inclut toujours `setup()` et `loop()`. Le préambule (variables, includes, pinMode) est automatiquement déduit des blocs présents. |

---

## 6. Parcours guidés

### Si tu veux comprendre X, lis d'abord Y, puis Z

| Pour comprendre... | Lis d'abord... | Puis... |
|--------------------|----------------|--------|
| **L'app dans son ensemble** | `index.html` (structure), `src/style.css` (layout), `docs/ARCHITECTURE.md` | `src/main.js` (tout 실무) |
| **Comment un bloc est défini** | `src/blocks.js` (ex. `arduino_led`) | `docs/BLOCKS.md` (catalogue complet) |
| **Comment un bloc devient du code C++** | `src/generator.js` — handler `forBlock[arduino_led]` (ligne 16-18) | `collectPreamble()` (ligne 183) pour comprendre le préambule auto |
| **Pourquoi le code C++ est complet (setup+loop)** | `buildSketch()` (ligne 252) dans `src/generator.js` | `splitFunctions()` (ligne 240) pour la séparation fonctions/loop |
| **Pourquoi le première bloc seul serait généré sans scrub_** | `scrub_()` (ligne 176) dans `src/generator.js` | Le commentaire lignes 174-180 qui l'explique |
| **Comment les variables typées fonctionnent** | `src/vars.js` — `VARS`, `varOptions()` | `syncVars()` dans `src/main.js` (ligne 40-48) pour voir comment le registre est peuplé |
| **Comment le dropdown de variable se remplit dynamiquement** | `varOptions(type)` dans `src/vars.js` (menuGenerator) | Comment `arduino_var_set` utilise `varOptionsAll()` dans `src/blocks.js` (ligne 147-149) |
| **Comment compiler et téléverser** | `src/compile.js` — `doCompile()` (ligne 44) + `doFlash()` (ligne 85) | `src/api.js` pour comprendre le contrat `ok: boolean` |
| **Comment les erreurs sont expliquées** | `src/hack.js` — `parseErrors()` + `explainError()` + `showHackPopup()` | Le CSS `hack-overlay` dans `hack.js` pour l'effet visuel |
| **Comment la simulation virtuelle fonctionne** | `src/sim/board.js` (VirtualBoard — le modèle) | `src/sim/board-ui.js` (BoardUI — le rendu SVG) | `src/sim/generator-js.js` (le générateur JS) | `src/sim/engine-virtual.js` (VirtualEngine — l'exécution) |
| **Comment la simulation AVR8js fonctionne** | `src/sim/engine-avr8js.js` — `start()` + `_wire()` + `_syncAnalog()` | `src/sim/avr-runner.js` (bootstrap ATmega328p) | `src/sim/intelhex.js` + `src/sim/task-scheduler.js` |
| **Pourquoi les deux moteurs partagent le même modèle** | `src/sim/board.js` — l'architecture `onPinChange(pin, value)` | `docs/ARCHITECTURE.md` — le schéma `blocs → moteur → VirtualBoard → BoardUI` |
| **La fenêtre de simulation (drag/resize)** | `src/main.js` — lignes 312-409 (gestion fenêtre) | `src/style.css` — règles `#simPanelWrap` et `.sim-max` (ligne 129-135) |
| **La palette par catégories (tap-to-add)** | `src/main.js` — `CATEGORIES` (ligne 108) + `renderCategories()` (ligne 179) + `addBlock()` (ligne 166) |
| **La sauvegarde/restauration du workspace** | `src/main.js` — `saveWorkspace()` + `loadSavedWorkspace()` (lignes 78-103) | Le format de sérialisation Blockly : `Blockly.serialization.workspaces.save(ws)` |
| **Comment les comptes et programmes fonctionnent** | `src/account.js` — `initAccount()` | `src/api.js` pour les appels vers `/api/auth/*` et `/api/programs/*` |

---

## 7. Pièges connus (à ne pas retomber dedans)

1. **Blockly.setLocale() avant Blockly.inject()** : Si la locale n'est pas configurée avant l'injection du workspace, `updateAriaLabel` lève une erreur car les messages Blockly sont undefined. (`main.js` ligne 16-18)
2. **`b.isRendered()` n'existe pas en Blockly 13** : Envelopper `initSvg()` et `render()` dans des `try/catch`. (`main.js` ligne 61, 227-228)
3. **Bloc-valeur orphelin = compile cassée** : Un bloc comme `analogRead(A0)` laissé seul sans connexion produit `analogRead(A0)` sans point-virgule. `emitRoots()` et `splitFunctions()` sautent les racines avec `outputConnection`. (`generator.js` ligne 231)
4. **`ws.newBlock()` ne déclenche pas de change event** : Quand on ajoute un bloc via la palette, `syncVars()` et `syncFunctions()` doivent être appelés manuellement. (`main.js` ligne 172-175)
5. **Le dropdown ne se met pas à jour si on ne re-rend pas** : Quand une variable ou fonction est créée/supprimée/renommée, `rerenderAll()` force le re-rendu de tous les blocs pour que les menuGenerators réévaluent. (`main.js` ligne 70)
6. **Le média Blockly (appspot) déclenche un CORS bénin sur `drop.mp3`** : C'est normal, sans impact sur la fonctionnalité.
7. **`#simPanelWrap` est un `<aside>`** : La règle générique `aside { max-width: 74vw }` du CSS limite la fenêtre. Le CSS de l'app ajoute `#simPanelWrap { max-width: none }` et `.sim-max { max-width: none !important }` pour corriger ce piège. (`style.css` ligne 129-135)
8. **`window.matchMedia('(pointer: coarse)')`** : Utilisé pour détecter les tablettes et fermer le panneau C++ par défaut (il masquerait les blocs sur une petite surface tactile). (`main.js` ligne 286)

---

*Docs généré le 22/09/2026. Dernière lecture des sources : 22/09/2026. Tous les fichiers listés ont été lus intégralement.*
