import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks'; // si/else, boucles, maths, variables
import { defineArduinoBlocks } from './blocks.js';
import { arduinoGenerator, buildSketch } from './generator.js';
import { arduinoDarkTheme } from './theme.js';
import { setLocale, getLang, t, applyUI } from './i18n.js';
import { initCompile } from './compile.js';
import { initAccount } from './account.js';
import { VARS } from './vars.js';
import { FUNCTIONS } from './functions.js';
import './style.css';

defineArduinoBlocks();
setLocale(getLang()); // Doit être posé AVANT Blockly.inject : sinon les labels ARIA
                     // (updateAriaLabel -> Msg[...].replace) référencent des messages undefined
                     // et l'inject lève TypeError.

/* ---------- Workspace (Blockly inject) ---------- */
const ws = Blockly.inject('blocklyDiv', {
  toolbox: undefined,                    // pas de flyout : palette tap-to-add custom
  theme: arduinoDarkTheme,
  scrollbars: true,
  media: 'https://blockly-demo.appspot.com/static/media/',
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.4, pinch: true },
  move: { scrollbars: true, drag: true, wheel: true },
});
window.Code = { get workspace() { return ws; } };
window.Blockly = Blockly;

/* ---------- Code C++ ---------- */
function refreshCode() {
  const pre = document.getElementById('code');
  if (pre) pre.textContent = buildSketch(ws, arduinoGenerator);
}
/* Synchronise le registre VARS avec les blocs `arduino_var_create` du workspace,
   pour que les dropdowns dynamiques listent les variables déclarées. */
function syncVars() {
  VARS.clear();
  for (const b of ws.getAllBlocks()) {
    if (b.type === 'arduino_var_create') {
      const n = b.getFieldValue('NAME');
      if (n) VARS.set(n, b.getFieldValue('TYPE') === 'text' ? 'text' : 'number');
    }
  }
}
/* Synchronise le registre FUNCTIONS avec les blocs `arduino_function` du workspace,
   pour que le dropdown d'appel liste les fonctions réellement définies. */
function syncFunctions() {
  FUNCTIONS.clear();
  for (const b of ws.getAllBlocks()) {
    if (b.type === 'arduino_function') {
      const n = b.getFieldValue('NAME');
      if (n) FUNCTIONS.add(n);
    }
  }
}
function rerenderAll() {
  for (const b of ws.getAllBlocks()) { try { b.render(); } catch (_) { /* ignore */ } }
}
ws.addChangeListener((e) => {
  syncVars();
  syncFunctions();
  // un bloc variable/fonction créé/supprimé/renommé -> re-rendre pour rafraîchir
  // les dropdowns dynamiques (variables + appels de fonction)
  if (e && (e.type === 'create' || e.type === 'delete' || e.type === 'field')) {
    const b = e.blockId ? ws.getBlockById(e.blockId) : null;
    if (b && (b.type === 'arduino_var_create' || b.type === 'arduino_function')) rerenderAll();
  }
  refreshCode();
  scheduleSave();
});
function getSource() { return buildSketch(ws, arduinoGenerator); }

/* ---------- Sauvegarde auto du workspace (localStorage) ---------- */
const LS_KEY = 'arduino-blocks-workspace';
let saveTimer = null;
function saveWorkspace() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Blockly.serialization.workspaces.save(ws)));
  } catch (_) { /* stockage indisponible : on ignore */ }
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWorkspace, 500);
}
function loadSavedWorkspace() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.blocks) return false;
    Blockly.serialization.workspaces.load(data, ws);
    syncVars();
    syncFunctions();
    rerenderAll();
    return true;
  } catch (_) {
    return false;
  }
}

/* ---------- Extension du DOM du workspace pour drag/selection (option B) ---------- */

/* ---------- Palette par catégories (option B : tap-to-add) ---------- */
const CATEGORIES = [
  { id: 'action', label: '⚡ Sorties', blocks: [
    { t: 'arduino_led', l: '💡 LED intégrée' },
    { t: 'arduino_digital_write', l: '✍️ Écrire broche' },
    { t: 'arduino_analog_write', l: '🎚 Écrire PWM' },
    { t: 'arduino_delay', l: '⏱ Attendre (ms)' },
  ]},
  { id: 'lecture', label: '👀 Entrées', blocks: [
    { t: 'arduino_digital_read', l: '🔘 Lire broche' },
    { t: 'arduino_analog_read', l: '∿ Lire analogique' },
    { t: 'arduino_highlow', l: '🔤 Haut / Bas' },
  ]},
  { id: 'sons', label: '🔊 Sons & servo', blocks: [
    { t: 'arduino_tone', l: '🎵 Tonalité' },
    { t: 'arduino_notone', l: '🔇 Couper tonalité' },
    { t: 'arduino_servo', l: '🔄 Moteur servo' },
  ]},
  { id: 'controle', label: '🧭 Contrôle', blocks: [
    { t: 'arduino_if', l: '❓ Si / alors / sinon' },
    { t: 'controls_whileUntil', l: '🔁 Tant que' },
    { t: 'controls_repeat', l: '🚀 Répéter N fois' },
  ]},
  { id: 'logique', label: '⚖️ Logique', blocks: [
    { t: 'logic_compare', l: '⚖ Compare' },
    { t: 'logic_operation', l: '🅰️ ET / OU' },
    { t: 'logic_negate', l: '🚫 Pas' },
    { t: 'logic_boolean', l: '✅ Vrai / Faux' },
  ]},
  { id: 'calcul', label: '🔢 Calculs', blocks: [
    { t: 'math_number', l: '＃ Nombre' },
    { t: 'math_arithmetic', l: '➕ − × ÷' },
    { t: 'math_modulo', l: '➗ Reste (mod)' },
    { t: 'math_random_int', l: '🎲 Aléatoire' },
  ]},
  { id: 'donnees', label: '💾 Variables', blocks: [
    { t: 'arduino_var_create', l: '🆕 Créer variable' },
    { t: 'arduino_var_set', l: '📥 Mettre variable' },
    { t: 'arduino_var_change', l: '📈 Augmenter' },
    { t: 'arduino_var_get', l: '👁 Lire variable' },
  ]},
  { id: 'serie', label: '📡 Série', blocks: [
      { t: 'arduino_serial_init', l: '🚀 Démarrer série' },
      { t: 'arduino_serial_print', l: '💬 Envoyer ligne' },
      { t: 'arduino_serial_read', l: '👂 Lire caractère' },
      { t: 'arduino_serial_available', l: '📬 Données dispo ?' },
    ]},
    { id: 'texte', label: '🔤 Textes', blocks: [
      { t: 'arduino_text', l: '📝 Texte' },
      { t: 'arduino_text_append', l: '➕ Ajouter texte' },
      { t: 'arduino_text_length', l: '📏 Longueur' },
      { t: 'arduino_text_equals', l: '⚖ Texte égal' },
    ]},
    { id: 'fonction', label: '🧩 Fonctions', blocks: [
      { t: 'arduino_function', l: '📦 Définir fonction' },
      { t: 'arduino_function_call', l: '📞 Appeler fonction' },
    ]},
  ];

function addBlock(type) {
  const block = ws.newBlock(type);
  block.initSvg();
  block.render();
  block.moveBy(Math.round(40 + Math.random() * 40), Math.round(40 + Math.random() * 40));
  ws.centerOnBlock(block);
  // ws.newBlock ne déclenche PAS d'événement change -> resync manuel du registre
    syncVars();
    syncFunctions();
    if (type === 'arduino_var_create' || type === 'arduino_function') rerenderAll(); // rafraîchir les dropdowns dynamiques
}

let activeCat = 'action';
function renderCategories() {
  const nav = document.getElementById('catNav');
  nav.innerHTML = '';
  for (const cat of CATEGORIES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'cat-tab' + (cat.id === activeCat ? ' active' : '');
    tab.textContent = cat.label;
    tab.addEventListener('click', () => { activeCat = cat.id; renderCategories(); });
    nav.appendChild(tab);
  }
  const cat = CATEGORIES.find((c) => c.id === activeCat);
  const row = document.getElementById('blockRow');
  row.innerHTML = '';
  for (const b of cat.blocks) {
    const btn = document.createElement('button');
    btn.className = 'pal-btn';
    btn.type = 'button';
    btn.textContent = b.l;
    btn.addEventListener('click', () => addBlock(b.t));
    row.appendChild(btn);
  }
}
renderCategories();

/* ---------- Démo initiale : SI analogRead(A0) > 500 -> LED allumée, SINON éteinte ---------- */
function buildDemo() {
  try {
    const mk = (type) => ws.newBlock(type);
    const led = mk('arduino_led'); led.setFieldValue('HIGH', 'STAT');
    const del = mk('arduino_delay'); del.setFieldValue(1000, 'MS');
    led.nextConnection.connect(del.previousConnection);
    const ifb = mk('arduino_if');
    del.nextConnection.connect(ifb.previousConnection);

    const cmp = mk('logic_compare'); cmp.setFieldValue('GT', 'OP');
    ifb.getInput('IF0').connection.connect(cmp.outputConnection);
    const ar = mk('arduino_analog_read'); ar.setFieldValue('A0', 'PIN');
    cmp.getInput('A').connection.connect(ar.outputConnection);
    const num = mk('math_number'); num.setFieldValue(500, 'NUM');
    cmp.getInput('B').connection.connect(num.outputConnection);

    const hi = mk('arduino_led'); hi.setFieldValue('HIGH', 'STAT');
    ifb.getInput('DO0').connection.connect(hi.previousConnection);
    const lo = mk('arduino_led'); lo.setFieldValue('LOW', 'STAT');
    ifb.getInput('ELSE').connection.connect(lo.previousConnection);

    const all = ws.getAllBlocks(true);
    all.forEach((b) => { try { b.initSvg(); } catch (_) { /* ignore */ } });
    all.forEach((b) => { try { b.render(); } catch (_) { /* ignore */ } });
    try { ws.centerOnBlock(ifb); } catch (_) { /* non bloquant */ }
    setStatus('✅ Demo : ' + ws.getAllBlocks().length + ' blocs');
  } catch (e) {
    document.getElementById('code').textContent = 'ERREUR buildDemo: ' + (e && e.message ? e.message : String(e));
    setStatus('❌ ' + (e && e.message ? e.message : String(e)));
    console.error(e);
  }
}
function setStatus(txt) { const s = document.getElementById('status'); if (s) s.textContent = txt; }
window.addEventListener('error', (e) => { setStatus('⚠️ ' + (e && e.message ? e.message : 'erreur non capturée')); });

/* ---------- Démarrage : restaurer le dernier workspace, sinon accueil ---------- */
const welcome = document.getElementById('welcome');
function hideWelcome() { if (welcome) welcome.style.display = 'none'; }
function showWelcome() { if (welcome) welcome.style.display = 'flex'; }
function loadExample() {
  ws.clear();
  buildDemo();
  refreshCode();
  scheduleSave();
  hideWelcome();
}
function startNew() {
  ws.clear();
  refreshCode();
  scheduleSave();
  hideWelcome();
}
if (loadSavedWorkspace()) {
  refreshCode();
} else {
  showWelcome();
}

/* ---------- Accueil (premier lancement) ---------- */
const wNew = document.getElementById('welcomeNew');
const wEx = document.getElementById('welcomeExample');
const wProg = document.getElementById('welcomePrograms');
if (wNew) wNew.addEventListener('click', startNew);
if (wEx) wEx.addEventListener('click', loadExample);
if (wProg) wProg.addEventListener('click', () => {
  hideWelcome();
  const b = document.getElementById('acctTopBtn');
  if (b) b.click();
});

/* ---------- Bouton Exemple (header) ---------- */
const exBtn = document.getElementById('exBtn');
if (exBtn) exBtn.addEventListener('click', () => {
  if (!confirm(t('clearConfirm'))) return;
  loadExample();
});

/* ---------- Panneau C++ repliable ---------- */
const codePanel = document.getElementById('codePanel');
const codeBtn = document.getElementById('codeBtn');
// état explicite : fermé par défaut en tactile (le panneau masque les blocs sur tablette)
let codePanelOpen = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function setCodePanel(open) {
  codePanelOpen = open;
  if (!codePanel) return;
  codePanel.style.display = open ? 'block' : 'none';
  if (codeBtn) codeBtn.classList.toggle('hl', open);
}
if (codeBtn) codeBtn.addEventListener('click', () => setCodePanel(!codePanelOpen));
setCodePanel(codePanelOpen);

/* ---------- Langue (FR par défaut ; sélecteur FR/EN) ---------- */
const langSel = document.getElementById('langSel');
langSel.value = getLang();
langSel.addEventListener('change', () => setLocale(langSel.value));

/* ---------- Clear ---------- */
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm(t('clearConfirm'))) return;
  ws.clear();
  refreshCode();
  scheduleSave();
});

/* ---------- Compiler / Téléverser ---------- */
initCompile(getSource);

/* ---------- Comptes + programmes (sérialisation JSON) ---------- */
initAccount({
  getJson: () => JSON.stringify(Blockly.serialization.workspaces.save(ws)),
  loadJson: (s) => {
      const data = JSON.parse(s);
      ws.clear();
      Blockly.serialization.workspaces.load(data, ws);
      syncVars();
      syncFunctions();
      rerenderAll();
      refreshCode();
      scheduleSave();
    },
  getCode: getSource,
  clearWorkspace: () => { ws.clear(); refreshCode(); scheduleSave(); },
});

applyUI();