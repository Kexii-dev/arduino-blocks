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

/* ---------- Palette tap-to-add (option B) ---------- */
const PALETTE = {
  arduino_led: { label: '💡 LED intégrée' },
  arduino_digital_write: { label: '✍️ Écrire broche' },
  arduino_digital_read: { label: '👁️ Lire broche' },
  arduino_analog_read: { label: '∿ Lire analogique' },
  arduino_delay: { label: '⏱ Attendre (ms)' },
};
const LOGIC = {
  arduino_if: { label: '❓ Si / alors / sinon' },
  controls_repeat: { label: '🔁 Répéter N fois' },
  logic_compare: { label: '⚖ Compare' },
  logic_operation: { label: '🅰️ ET / OU' },
  math_number: { label: '＃ Nombre' },
};

function addBlock(type) {
  const block = ws.newBlock(type);
  block.initSvg();
  block.render();
  block.moveBy(Math.round(40 + Math.random() * 40), Math.round(40 + Math.random() * 40));
  ws.centerOnBlock(block);
}

function renderPalette(containerId, spec) {
  const el = document.getElementById(containerId);
  for (const type of Object.keys(spec)) {
    const btn = document.createElement('button');
    btn.className = 'pal-btn';
    btn.type = 'button';
    btn.textContent = spec[type].label;
    btn.addEventListener('click', () => addBlock(type));
    el.appendChild(btn);
  }
}
renderPalette('palette', PALETTE);
renderPalette('palette-logic', LOGIC);

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