# Contribuer

Merci de l'intérêt ! Le projet est un front statique (Blockly 13.3 + Vite), volontairement simple.

## Setup

```bash
npm install
npm run dev    # http://localhost:5173
npm test       # tests générateur (node headless)
```

## Conventions

- **Langue** : code et commentaires en français (projet éducatif francophone), identifiants techniques en anglais.
- **Pas de framework UI** : DOM natif. Pas de dépendance runtime autre que `blockly`.
- **Libs tierces** : vendues dans `public/lib/`, jamais de CDN.
- **Portabilité Node/navigateur** : tout import de `blockly/core` suit le pattern
  `const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);`
  (sous Node l'export complet est dans `.default`).

## Ajouter un bloc (checklist)

1. **Définition** dans `src/blocks.js` (`defineBlocksWithJsonArray`) — type `arduino_*`, couleur de catégorie, tooltip en français.
2. **Générateur** dans `src/generator.js` : `arduinoGenerator.forBlock['arduino_x'] = function (block, generator) { … }`.
   - Statement → retourner `'code;\n'` ; valeur → retourner `['code', generator.ORDER_*]`.
3. **Préambule** si besoin (pinMode, include, global…) : l'ajouter dans `collectPreamble()`.
4. **Palette** : l'ajouter à la bonne catégorie dans `src/main.js` (`CATEGORIES`).
5. **Doc** : ligne dans `docs/BLOCKS.md`.
6. **Test** : cas dans `tests/gen-test2.mjs` (ou nouveau `gen-testN.mjs`) — vérifier le C++ généré en headless.

## Ajouter une règle d'explication d'erreur (popup hacker)

Dans `src/hack.js`, tableau `RULES` : `{ re: /regex sur le message gcc/, explain: 'explication débutant en français' }` + test dans `tests/hack-test.mjs`.

## Pièges (déjà payés cher — cf. docs/ARCHITECTURE.md)

- `Blockly.setLocale` **avant** `Blockly.inject`.
- Pas de `b.isRendered()` en Blockly 13 → `try/catch` autour de `initSvg()`/`render()`.
- Ne jamais émettre les blocs-valeur orphelins dans le sketch (ils cassent la compile).
- `ws.newBlock()` ne déclenche pas d'événement change → appeler `syncVars()` explicitement.
- Après modification d'un fichier, `node --check` + relire le diff (les éditions automatisées peuvent introduire des doublons d'identifiants valides mais cassants).

## Tests avant PR

```bash
npm test && node tests/gen-test2.mjs && node tests/gen-test3.mjs && node tests/hack-test.mjs
```

Tout doit passer. Pour le rendu navigateur réel : `tests/diag*.mjs` (playwright-core, chromium local).
