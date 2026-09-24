import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks'; // si/else, boucles, maths, variables
import { defineArduinoBlocks } from './blocks.js';
import { arduinoGenerator, buildSketchMapped } from './generator.js';
import { arduinoDarkTheme } from './theme.js';
import { setLocale, getLang, t, applyUI } from './i18n.js';
import { initCompile } from './compile.js';
import { initAccount } from './account.js';
import { VARS } from './vars.js';
import { FUNCTIONS } from './functions.js';
import { initSim } from './sim/sim.js';
import { api } from './api.js';
import { APP_VERSION } from './version.js';
import { EXAMPLES } from './examples.js';
import { createEditor } from './editor.js';
import './style.css';

// Affiche la version de l'application dans le header (injectée au build par Vite).
const appVersionEl = document.getElementById('appVersion');
if (appVersionEl) appVersionEl.textContent = 'v' + APP_VERSION;

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

/* ---------- Code C++ : éditeur direct (B) + lien bloc ↔ lignes (A) ----------
   Le panneau `</>` est un éditeur CodeMirror prérempli du C++ généré. Modèle UN
   SENS : les blocs restent la source de vérité. Si l'utilisateur édite à la main,
   bannière « programme modifié à la main » ; le lien bloc↔lignes reste actif tant
   que le code n'est pas modifié. */
let codeLines = [];            // lignes du C++ généré (texte brut)
const lineBlock = [];          // [indexLigne] -> id bloc (ou null), inverse de blockLines
let blockLinesMap = new Map(); // blocId -> [start,end]
let selectedBlockId = null;
let editor = null;             // instance CodeMirror
let manual = false;            // code édité à la main
let lastCode = null;

function showManualBanner(show) {
  const b = document.getElementById('manualBanner');
  if (b) b.style.display = show ? 'flex' : 'none';
}
function refreshCode() {
  if (manual) { showManualBanner(true); return; } // ne pas écraser l'édition manuelle
  const { code, blockLines } = buildSketchMapped(ws, arduinoGenerator, getLang());
  codeLines = code.split('\n');
  blockLinesMap = blockLines;
  lineBlock.length = 0;
  for (const [bid, [s, e]] of blockLines) { for (let i = s; i <= e; i++) lineBlock[i] = bid; }
  if (editor && code !== lastCode) { editor.setValue(code); lastCode = code; }
  showManualBanner(false);
}
function highlightBlockLines(bid) {
  if (!editor) return;
  if (!bid) { editor.clearHighlight(); return; }
  const r = blockLinesMap.get(bid);
  if (r) editor.highlight(r[0], r[1]);
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
  // sélection d'un bloc (clic) -> surligne les lignes de code correspondantes
    if (e && (e.type === 'selected' || e.type === 'SELECTED')) {
      selectedBlockId = e.newElementId || null;
      if (!manual) highlightBlockLines(selectedBlockId);
    }
    // un bloc supprimé -> la sélection n'existe plus
    if (e && e.type === 'delete') { selectedBlockId = null; if (!manual) highlightBlockLines(null); }
    // un bloc variable/fonction créé/supprimé/renommé -> re-rendre pour rafraîchir
    // les dropdowns dynamiques (variables + appels de fonction)
    if (e && (e.type === 'create' || e.type === 'delete' || e.type === 'field')) {
      const b = e.blockId ? ws.getBlockById(e.blockId) : null;
      if (b && (b.type === 'arduino_var_create' || b.type === 'arduino_function')) rerenderAll();
    }
    refreshCode();
    scheduleSave();
  });
  function getSource() {
    if (manual && editor) return editor.getValue(); // code édité à la main
    return buildSketchMapped(ws, arduinoGenerator, getLang()).code;
  }

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

/* ---------- Fenêtre Exemples (choix par thème + fiche explicative) ---------- */
const exPanel = document.getElementById('exPanel');
const exThemes = document.getElementById('exThemes');
const exList = document.getElementById('exList');
const exDetail = document.getElementById('exDetail');
let exTheme = EXAMPLES[0] ? EXAMPLES[0].theme : null;
let exSelected = null;

function openExPanel() {
  if (!exPanel) return;
  exPanel.style.display = 'flex';
  renderExThemes();
  renderExList();
}
function closeExPanel() {
  if (exPanel) exPanel.style.display = 'none';
}
function renderExThemes() {
  if (!exThemes) return;
  exThemes.innerHTML = EXAMPLES.map((g) =>
    `<button class="ex-theme${g.theme === exTheme ? ' on' : ''}" data-theme="${g.theme}">${g.theme}</button>`
  ).join('');
  exThemes.querySelectorAll('.ex-theme').forEach((btn) => {
    btn.addEventListener('click', () => { exTheme = btn.dataset.theme; exSelected = null; renderExThemes(); renderExList(); renderExDetail(); });
  });
}
function renderExList() {
  if (!exList) return;
  const group = EXAMPLES.find((g) => g.theme === exTheme);
  if (!group) { exList.innerHTML = '<div class="ex-empty">Aucun exemple.</div>'; return; }
  exList.innerHTML = group.items.map((it) =>
    `<button class="ex-item" data-id="${it.id}">${it.title}</button>`
  ).join('');
  exList.querySelectorAll('.ex-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      exSelected = group.items.find((i) => i.id === btn.dataset.id);
      renderExDetail();
    });
  });
}
function renderExDetail() {
  if (!exDetail) return;
  if (!exSelected) { exDetail.innerHTML = ''; return; }
  exDetail.innerHTML = `
    <h3>${exSelected.title}</h3>
    <p>${exSelected.desc}</p>
    <div class="ex-desc">🧰 Matériel : ${exSelected.matos}</div>
    <p>${exSelected.expl}</p>
    <button class="ex-load" id="exLoadBtn" type="button">Charger cet exemple</button>`;
  const loadBtn = document.getElementById('exLoadBtn');
  if (loadBtn) loadBtn.addEventListener('click', () => {
    ws.clear();
    exSelected.build(ws);
    refreshCode();
    scheduleSave();
    closeExPanel();
    hideWelcome();
    setStatus('✅ Exemple chargé : ' + exSelected.title);
  });
}

/* ---------- Bouton Exemple (header) : ouvre la fenêtre au lieu du confirm ---------- */
const exBtn = document.getElementById('exBtn');
if (exBtn) exBtn.addEventListener('click', openExPanel);
const exCloseBtn = document.getElementById('exCloseBtn');
if (exCloseBtn) exCloseBtn.addEventListener('click', closeExPanel);

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

/* Éditeur C++ direct (B) : CodeMirror prérempli du C++ généré. Le lien bloc↔lignes
   (A) reste actif tant que le code n'est pas modifié à la main. */
const codeEditorEl = document.getElementById('codeEditor');
if (codeEditorEl) {
  const initial = buildSketchMapped(ws, arduinoGenerator, getLang()).code;
  editor = createEditor(codeEditorEl, initial, {
    onManualEdit: () => { manual = true; showManualBanner(true); },
    onSelectionChange: (line) => {
      if (manual) return;
      const bid = lineBlock[line];
      if (bid) {
        selectedBlockId = bid;
        const blk = ws.getBlockById(bid);
        if (blk) {
          try { if (typeof blk.select === 'function') blk.select(); } catch (_) {}
          try { ws.centerOnBlock(blk); } catch (_) {}
        }
      }
    },
  });
  lastCode = initial;
  // hooks de test (navigateur) : accès à l'éditeur et à la source compilée
  window.__arduinoEditor = editor;
  window.__getSource = getSource;
}
/* Bouton « Revenir aux blocs » : abandonne l'édition manuelle et régénère depuis les blocs. */
const manualRevert = document.getElementById('manualRevert');
if (manualRevert) manualRevert.addEventListener('click', () => {
  manual = false;
  if (editor) editor.setManual(false);
  refreshCode();
  showManualBanner(false);
});
const codeHint = document.getElementById('hint');
if (codeHint) codeHint.textContent = t('codeHint');

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

/* ---------- Simulation (virtuelle + AVR8js réelle) : fenêtre flottante ---------- */
const simPanelWrap = document.getElementById('simPanelWrap');
const simBtn = document.getElementById('simBtn');
const simWinBar = document.getElementById('simWinBar');
const simMaxBtn = document.getElementById('simMaxBtn');
const simCloseBtn = document.getElementById('simCloseBtn');
const simResize = document.getElementById('simResize');
let simOpen = false;
let simMaximized = false;
let simDrag = null;

const sim = initSim({
  containerId: 'simPanel',
  getWorkspace: () => ws,
  getSource,
  getArduinoGenerator: () => arduinoGenerator,
  compile: async (source) => {
    try { return await api('/compile', { method: 'POST', body: { source } }); }
    catch (e) { return e.json || { ok: false, error: (e && e.message) || String(e) }; }
  },
});

function openSim() {
  simOpen = true;
  simPanelWrap.style.display = 'block';
  simBtn.classList.add('hl');
  // position par défaut : à droite, pas plein écran
  if (!simPanelWrap.dataset.placed) {
    simPanelWrap.dataset.placed = '1';
    simPanelWrap.style.left = 'calc(100vw - 576px)';
    simPanelWrap.style.top = '150px';
    simPanelWrap.style.right = 'auto';
    simPanelWrap.style.bottom = 'auto';
    simPanelWrap.style.width = 'min(560px, 92vw)';
    simPanelWrap.style.height = 'min(560px, 80vh)';
  }
}
function closeSim() {
  simOpen = false;
  simPanelWrap.style.display = 'none';
  simBtn.classList.remove('hl');
  sim.stop();
}
function toggleSim() { simOpen ? closeSim() : openSim(); }

function setMaximized(on) {
  simMaximized = on;
  simPanelWrap.classList.toggle('sim-max', on);
  simMaxBtn.textContent = on ? '🗗' : '⛶';
  simMaxBtn.title = on ? 'Réduire' : 'Agrandir';
}

if (simBtn) simBtn.addEventListener('click', toggleSim);
if (simCloseBtn) simCloseBtn.addEventListener('click', closeSim);
if (simMaxBtn) simMaxBtn.addEventListener('click', () => setMaximized(!simMaximized));

// Déplacement par la barre de titre (souris + tactile)
if (simWinBar) {
  simWinBar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.sim-win-btn')) return; // ne pas déplacer quand on clique un bouton
    if (simMaximized) return;
    simDrag = { x: e.clientX - simPanelWrap.offsetLeft, y: e.clientY - simPanelWrap.offsetTop };
    simWinBar.setPointerCapture(e.pointerId);
  });
  simWinBar.addEventListener('pointermove', (e) => {
    if (!simDrag) return;
    let x = e.clientX - simDrag.x;
    let y = e.clientY - simDrag.y;
    // garder la fenêtre dans le viewport
    x = Math.max(0, Math.min(x, window.innerWidth - 60));
    y = Math.max(0, Math.min(y, window.innerHeight - 40));
    simPanelWrap.style.left = x + 'px';
    simPanelWrap.style.top = y + 'px';
    simPanelWrap.style.right = 'auto';
    simPanelWrap.style.bottom = 'auto';
  });
  simWinBar.addEventListener('pointerup', () => { simDrag = null; });
  simWinBar.addEventListener('pointercancel', () => { simDrag = null; });
}

// Redimensionnement par la poignée bas-droite
if (simResize) {
  simResize.addEventListener('pointerdown', (e) => {
    if (simMaximized) return;
    e.preventDefault();
    simDrag = { x: e.clientX, y: e.clientY, w: simPanelWrap.offsetWidth, h: simPanelWrap.offsetHeight, resize: true };
    simResize.setPointerCapture(e.pointerId);
  });
  simResize.addEventListener('pointermove', (e) => {
    if (!simDrag || !simDrag.resize) return;
    simPanelWrap.style.width = Math.max(320, simDrag.w + (e.clientX - simDrag.x)) + 'px';
    simPanelWrap.style.height = Math.max(240, simDrag.h + (e.clientY - simDrag.y)) + 'px';
    simPanelWrap.style.right = 'auto';
    simPanelWrap.style.bottom = 'auto';
  });
  simResize.addEventListener('pointerup', () => { simDrag = null; });
  simResize.addEventListener('pointercancel', () => { simDrag = null; });
}

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