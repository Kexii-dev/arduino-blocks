import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks'; // si/else, boucles, maths, variables
import { defineArduinoBlocks } from './blocks.js';
import { arduinoGenerator, buildSketch } from './generator.js';
import { arduinoDarkTheme } from './theme.js';
import { setLocale, getLang, t, applyUI } from './i18n.js';
import { initCompile } from './compile.js';
import { initAccount } from './account.js';

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
ws.addChangeListener(refreshCode);
function getSource() { return buildSketch(ws, arduinoGenerator); }

/* ---------- Extension du DOM du workspace pour drag/selection (option B) ---------- */

/* ---------- Palette par catégories (option B : tap-to-add) ---------- */
const CATEGORIES = [
  { id: 'action', label: '⚡ Action', blocks: [
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
];

function addBlock(type) {
  const block = ws.newBlock(type);
  block.initSvg();
  block.render();
  block.moveBy(Math.round(40 + Math.random() * 40), Math.round(40 + Math.random() * 40));
  ws.centerOnBlock(block);
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

buildDemo();
refreshCode();

/* ---------- Langue (FR par défaut ; sélecteur FR/EN) ---------- */
const langSel = document.getElementById('langSel');
langSel.value = getLang();
langSel.addEventListener('change', () => setLocale(langSel.value));

/* ---------- Clear ---------- */
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm(t('clearConfirm'))) return;
  ws.clear();
  refreshCode();
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
    refreshCode();
  },
  getCode: getSource,
  clearWorkspace: () => { ws.clear(); refreshCode(); },
});

applyUI();