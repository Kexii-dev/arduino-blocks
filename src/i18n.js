import * as Blockly from 'blockly/core';
import * as Fr from 'blockly/msg/fr';
import * as En from 'blockly/msg/en';
import { getBoard, boardLabel } from './board.js';

/* Textes de l'app par langue (les blocs suivent Blockly.setLocale).
   Le titre du panneau C++ et le message de compile sont DYNAMIQUES (dépendent
   de la carte sélectionnée) : codeTitlePre + boardLabel(getBoard()) + codeTitlePost. */
export const UI = {
  fr: {
    tag: 'Blockly 13.3 · tactile + souris',
    codeTitlePre: 'Code C++ généré (',
    codeTitlePost: ')',
    codeHint: '💡 Clique sur un bloc ou sur une ligne de code : l\u0027un surligne l\u0027autre.',
    hint: 'Choisis un bloc dans la barre ci-dessus (tap / clic), puis connecte les pièces.',
    clearConfirm: 'Effacer tous les blocs ?',
    boardSelect: 'Carte',
    compileRun: 'Compilation en cours…',
    compile429: 'Trop de requêtes — attends quelques secondes.',
    compileOkFor: '✅ Compilé pour',
    compileErr: '❌ Erreur de compilation :\n',
    compileNet: '❌ Réseau : ',
    noSource: 'Aucun code généré — assemble d\u0027abord des blocs.',
    hexDl: 'Télécharger le .hex',
    flashBtn: 'Téléverser sur la carte',
    flashUnavail: '⚠️ Web Serial non disponible.\nUtilise Chrome ou Edge, en HTTPS, carte branchée en USB.\nTu peux télécharger le .hex à la place.',
    flashPick: '🎯 Choisis ton port série (la carte branchée).',
    flashFail: '❌ Flashage échoué : ',
    flashFailHint: '\nAstuce : branche la carte AVANT de téléverser, et réessaie.',
    flashOk: '✅ Programme téléversé avec succès !',
    account: 'Compte et programmes',
    clearBtn: 'Effacer',
  },
  en: {
    tag: 'Blockly 13.3 · touch + mouse',
    codeTitlePre: 'Generated C++ (',
    codeTitlePost: ')',
    codeHint: '💡 Click a block or a code line: one highlights the other.',
    hint: 'Pick a block in the bar above (tap / click), then connect the pieces.',
    clearConfirm: 'Clear all blocks?',
    boardSelect: 'Board',
    compileRun: 'Compiling…',
    compile429: 'Too many requests — wait a few seconds.',
    compileOkFor: '✅ Compiled for',
    compileErr: '❌ Compilation error:\n',
    compileNet: '❌ Network: ',
    noSource: 'No code generated — assemble blocks first.',
    hexDl: 'Download the .hex',
    flashBtn: 'Upload to the board',
    flashUnavail: '⚠️ Web Serial not available.\nUse Chrome or Edge, over HTTPS, board plugged via USB.\nYou can download the .hex instead.',
    flashPick: '🎯 Pick your serial port (the connected board).',
    flashFail: '❌ Flash failed: ',
    flashFailHint: '\nTip: plug the board BEFORE uploading, and retry.',
    flashOk: '✅ Program uploaded successfully!',
    account: 'Account & programs',
    clearBtn: 'Clear',
  },
};

let current = navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'fr';

export function setLocale(lang) {
  current = lang === 'en' ? 'en' : 'fr';
  Blockly.setLocale(current === 'fr' ? Fr : En);
  applyUI();
}

export function getLang() { return current; }

export function t(key) {
  const v = UI[current]?.[key];
  return v != null ? v : UI.fr[key];
}

export function applyUI() {
  const tag = document.querySelector('header .tag');
  if (tag) tag.textContent = t('tag');
  const title = document.getElementById('codeTitle');
  if (title) title.textContent = t('codeTitlePre') + boardLabel(getBoard(), current) + t('codeTitlePost');
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = t('codeHint');
  const btn = document.getElementById('acctTopBtn');
  if (btn) btn.title = t('account');
  const clr = document.getElementById('clearBtn');
  if (clr) clr.title = t('clearBtn');
}