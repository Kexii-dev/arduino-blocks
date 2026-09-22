<div align="center">

# 🧩 Arduino Blocks

**Programmez un Arduino par blocs, dans le navigateur — sans rien installer.**

Assemblez des blocs, voyez le **C++ généré en direct**, compilez dans le cloud, **simulez** sur une carte virtuelle et téléversez sur une vraie **Arduino Uno**. Pensé pour les enfant, ados et débutants.

<!-- badges -->
![Version](https://img.shields.io/github/v/release/Kexii-dev/arduino-blocks?color=00979D)
![Licence](https://img.shields.io/github/license/Kexii-dev/arduino-blocks?color=teal)
![CI](https://img.shields.io/github/actions/workflow/status/Kexii-dev/arduino-blocks/ci.yml?branch=main&label=CI)
![Blockly](https://img.shields.io/badge/Blockly-13.3-00979D)
![Board](https://img.shields.io/badge/board-Arduino%20Uno-teal)
![Lang](https://img.shields.io/badge/lang-FR%20%2F%20EN-blue)

[🌐 Démo en ligne](https://arduino.rayroud.com) · [📚 Documentation](docs/) · [🛠 Contribuer](CONTRIBUTING.md) · [📋 Roadmap](TODO.md)

---

## Fonctionnalités

- 🧱 **Éditeur de blocs** basé sur [Blockly](https://github.com/RaspberryPiFoundation/blockly) **13.3** (Raspberry Pi Foundation), tactile + souris (tablette et PC).
- 📂 **~35 blocs en 10 catégories** : actions (LED, écriture digitale/PWM), entrées (lecture digitale/analogique), sons & servo, contrôle (si/alors/sinon, tant que, répéter), logique, calculs, variables typées (nombre | texte), série, textes, fonctions.
- ⚙️ **Générateur Arduino C++ maison** : produit `setup()` + `loop()` avec préambule automatique (`pinMode`, `#include <Servo.h>` + `attach`, `Serial.begin`, déclarations de variables).
- ☁️ **Compilation cloud** : le sketch est envoyé à un backend `arduino-cli` (conteneur Docker) qui renvoie le `.hex` + les tailles flash/RAM.
- 🔌 **Téléversement depuis le navigateur** via Web Serial (`avrgirl-arduino`) — aucune installation, fonctionne avec les clones CH340.
- 🕹️ **Simulateur** intégré (bouton 🔌) dans une **fenêtre flottante** déplaçable, redimensionnable et agrandissable plein écran — **deux moteurs** : un **virtuel** instantané (blocs → JS, 100 % navigateur, sans compile) et un **vrai émulateur AVR8js** (compile cloud → `.hex` → ATmega328p, timers/ADC/USART réels). Carte Uno SVG partagée : LED_BUILTIN dédiée, témoins D2-D13, boutons, 6 potentiomètres analogiques, buzzer, console série.
- 🖥️ **Popup « hacker » pédagogique** : en cas d'erreur de compilation, chaque erreur C++ est traduite en explication claire pour débutants (en français).
- 👤 **Comptes utilisateurs** (ados) : sessions cookie httpOnly, mots de passe scrypt côté serveur, jauge **zxcvbn**, vérification de fuites **Have I Been Pwned en k-anonymité** (le mot de passe ne quitte jamais le navigateur), générateur de phrases diceware.
- 💾 **Programmes sauvegardés** dans le cloud (SQLite côté backend), liés au compte.
- 💾 **Workspace auto-sauvegardé** en `localStorage` : ton programme est restauré au rechargement (bouton 💡 Exemple pour repartir de la démo).
- 🏠 **Écran d'accueil** au premier lancement : Nouveau programme / Exemple / Mes programmes.
- 📄 **Panneau C++ repliable** (bouton `</>`) — fermé par défaut sur tablette pour ne pas masquer les blocs.
- 🧩 **Dropdown fonctions dynamique** : l'appel liste les fonctions réellement définies (renommer une fonction met à jour l'appel).
- 🌍 **FR / EN** (français par défaut).

---

## Architecture

```
Navigateur (front statique, ce repo)
├── Blockly 13.3 (workspace, thème sombre teal)
├── Générateur Arduino C++ maison (src/generator.js)
├── Palette tap-to-add par catégories
├── Compile + flash Web Serial (src/compile.js)
└── Comptes / programmes (src/account.js)
          │  POST /api/compile {source} → {ok, hex_base64, size:{flash,ram}}
          │  /api/auth/* (register/login/logout/me, cookie httpOnly)
          │  /api/programs/* (CRUD)
          ▼
nginx (vhost arduino.rayroud.com, rate-limit /api/)
          ▼
Conteneur Docker arduino-compile (Node 22 + arduino-cli, core AVR)
└── SQLite (users / sessions / programs) — volume persisté
```

Le backend vit dans un dépôt séparé (`arduinoweb`, privé pour l'instant) ; son **contrat d'API** est documenté dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour qui veut le réimplémenter.

---

## Démarrage rapide (dev)

```bash
npm install
npm run dev        # Vite → http://localhost:5173
```

Ouvrir le port dans le pare-feu si accès distant (Tailscale) : `ufw allow from 100.64.0.0/10 to any port 5173 proto tcp`.

### Build & déploiement

```bash
npm run build      # → dist/
# déployer dist/ derrière un serveur statique (nginx) avec proxy /api/ → backend compile
```

### Tests

```bash
npm test                       # test générateur principal (9/9)
node tests/gen-test2.mjs       # catalogue ~30 blocs (14/14)
node tests/gen-test3.mjs       # textes + fonctions (12/12)
node tests/hack-test.mjs       # parse + explication erreurs C++ (7/7)
```

Les tests tournent en Node headless (`new Blockly.Workspace()`, pas de jsdom). Les `tests/diag*.mjs` sont des harnais navigateur (playwright-core) pour valider le rendu réel.

---

## Documentation

- 📋 [TODO.md](TODO.md) — état du projet & feuille de route
- 📐 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure du code, contrat API, pièges connus
- 🧱 [docs/BLOCKS.md](docs/BLOCKS.md) — catalogue des blocs et le code C++ généré par chacun
- 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) — comment ajouter un bloc, conventions, tests

## Roadmap

- [x] **Simulateur** : moteur virtuel + émulateur AVR8js réel, fenêtre flottante agrandissable — **déployé en prod**
- [ ] Brancher des composants additionnels sur le VirtualBoard (capteurs, afficheur)
- [ ] Validation physique du flash sur vraies cartes (CH340 / ATmega16U2)
- [ ] Support d'autres cartes (Nano, Mega, ESP32)
- [ ] Mode hors-ligne PWA

## Licence

GPL-3.0 — voir [LICENSE](LICENSE). Projet dérivé de l'expérience BlocklyDuino v2 (GPL-3.0), réécrit sur [Blockly 13.3](https://github.com/RaspberryPiFoundation/blockly) (Apache-2.0).

### Licences tierces

| Composant | Licence | Usage |
|---|---|---|
| [Blockly 13.3](https://github.com/RaspberryPiFoundation/blockly) | Apache-2.0 | éditeur de blocs |
| [avr8js](https://github.com/wokwi/avr8js) (core npm) | MIT | émulation ATmega328p |
| Bootstrap avr8js (démo wokwi : `intelhex.js`, `task-scheduler.js`, config ports/timers) | MIT | démarrage du simulateur réel |
| [avrgirl-arduino](https://github.com/noopkat/avrgirl-arduino) | MIT | téléversement Web Serial |
| [zxcvbn](https://github.com/dropbox/zxcvbn) | MIT | jauge de force des mots de passe |

> Les fichiers vendored (`src/sim/intelhex.js`, `src/sim/task-scheduler.js`) proviennent de la démo officielle [wokwi/avr8js](https://github.com/wokwi/avr8js) (MIT) et conservent leur en-tête de licence d'origine.

---

<div align="center">

**🛡️ Sécurité** : [`SECURITY.md`](SECURITY.md) — signalez toute vulnérabilité en privé.
**⚖️ Conduite** : [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

**Développé avec ❤️ pour l'apprentissage du code — [Contribuez !](CONTRIBUTING.md)**

</div>
