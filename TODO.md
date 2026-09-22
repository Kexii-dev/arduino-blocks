# Arduino Blocks — État du projet & feuille de route

> Dernière mise à jour : 2026-09-22 · Prod : https://arduino.rayroud.com · Licence GPL-3.0

---

## ✅ FAIT

### Plateforme (en prod)
- [x] Réécriture complète sur **Blockly 13.3** (RPiF), tactile + souris, tablette + PC
- [x] Générateur Arduino C++ maison (préambule auto : `pinMode`, `#include <Servo.h>` + `attach`, `Serial.begin`, déclarations de variables)
- [x] ~35 blocs en 10 catégories (actions, entrées, sons & servo, contrôle, logique, calculs, variables, série, textes, fonctions)
- [x] **Compilation cloud** via backend `arduino-cli` (conteneur Docker) → `.hex` + tailles flash/RAM
- [x] **Téléversement Web Serial** depuis le navigateur (avrgirl, Chrome/Edge, HTTPS)
- [x] **Popup « hacker »** : erreurs de compilation traduites en explications débutant (FR)
- [x] **Comptes utilisateurs** : sessions cookie httpOnly, scrypt serveur, jauge zxcvbn, vérif fuites HIBP en k-anonymité, générateur diceware
- [x] **Programmes cloud** (SQLite) : sauvegarde / chargement / écrasement / suppression
- [x] Variables typées (nombre | texte) avec dropdowns dynamiques
- [x] FR / EN (FR par défaut), thème sombre teal
- [x] Sécurité : Vite 7.3.6 (fix vulns Snyk), libs vendues en local (pas de CDN)
- [x] Bibliothèques backend : Servo, LiquidCrystal, Stepper, Ethernet

### Documentation & repo (2026-09-22)
- [x] `README.md` complet (features, quickstart, roadmap)
- [x] `docs/ARCHITECTURE.md` (structure, contrat API, pièges connus)
- [x] `docs/BLOCKS.md` (catalogue des blocs → C++ généré)
- [x] `CONTRIBUTING.md` (checklist ajout de bloc, conventions)
- [x] `LICENSE` GPL-3.0
- [x] Nettoyage : 21 scripts de test rangés dans `tests/`
- [x] Suite de tests verte : gen 9/9 · gen2 14/14 · gen3 12/12 · hack 7/7

---

## 🔧 À FAIRE — Corrections / améliorations code

| # | Quoi | Priorité | Détail |
|---|---|---|---|
| 1 | Dropdown **fonctions dynamique** | 🔴 haute | `arduino_function_call` liste des noms fixes → renommer une fonction casse l'appel. Refaire en menuGenerator (pattern variables) |
| 2 | **Restaurer le dernier workspace** au chargement | 🔴 haute | La démo est réinjectée à chaque fois ; sauvegarder en `localStorage` + bouton « Exemple » explicite |
| 3 | Extraire le CSS inline de `index.html` | 🟡 moyenne | ~100 lignes → `src/style.css` (bundlé par Vite) |
| 4 | Sortir `swisstransfer.mjs` du repo public | 🟡 moyenne | Outil d'agent, hors sujet projet |
| 5 | Renommer les IDs `rd*` hérités du legacy | 🟢 basse | Cosmétique (`rdCompile` → `compileBar`…) |
| 6 | `package.json` : ajouter `description`, `license`, `repository` | 🟢 basse | Fiche propre |
| 7 | Fiabiliser les tests navigateur `diag*.mjs` | 🟢 basse | playwright-core en devDependency au lieu de `--no-save` |

## 🎨 À FAIRE — Design / UX

| # | Quoi | Priorité | Détail |
|---|---|---|---|
| 8 | **Panneau C++ repliable** | 🔴 haute | Il chevauche le workspace ; sur tablette (100% de large) il masque les blocs. Bouton `</>`, fermé par défaut en tactile |
| 9 | Mini-accueil au premier lancement | 🟡 moyenne | Workspace vide au démarrage → 3 cartes : Nouveau / Exemple blink / Mes programmes |
| 10 | Renommer « ⚡ Action » → « ⚡ Sorties » | 🟡 moyenne | Cohérent avec « Entrées » |
| 11 | Contraste onglets inactifs + barre sticky | 🟡 moyenne | `#b8b8b8` sur `#2d2d2d` trop faible |
| 12 | Statut compile plus lisible | 🟡 moyenne | Fond teal foncé, icône ✅/❌, auto-masquage au succès |
| 13 | Focus visible (`:focus-visible` outline teal) | 🟢 basse | Accessibilité clavier/tablette |

## 🚀 À FAIRE — Fonctionnalités (décisions produit)

| # | Quoi | Priorité | Détail |
|---|---|---|---|
| 14 | **Simulateur dans le navigateur** | 🔴 haute | Analyse faite : approche 2 (blocs → JS virtuel + carte SVG) d'abord, AVR8js en v2 « mode réel ». POC ≈ 1 journée. *En attente de Go* |
| 15 | **Validation flash sur vraie carte** | 🔴 haute | Jamais testé physiquement (clones CH340 / ATmega16U2) |
| 16 | Support autres cartes (Nano, Mega, ESP32) | 🟡 moyenne | FQBN fixe `arduino:avr:uno` pour l'instant |
| 17 | Mode hors-ligne PWA | 🟢 basse | Écoles à faible bande passante |
| 18 | Bibliothèque d'exercices intégrée | 🟡 moyenne | Exploiter les livres sources (Eskimon, Bartmann — OCR du scan à faire) |

---

### Règles du projet
- **Jamais de prod sans Go explicite de David.**
- Deploy : `npm run build` → copier `dist/` vers `/root/webstack/www/arduino` (nginx).
- Backup rollback BlocklyDuino : `/root/webstack/www/arduino.bak-20260922-154621`.
- Backend = repo séparé (`/root/arduinoweb`) ; volume DB : `arduinoweb_compile-data`.
