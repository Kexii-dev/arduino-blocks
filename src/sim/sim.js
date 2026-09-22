// Contrôleur du panneau simulation : assemble les 2 moteurs (virtuel + AVR8js),
// le modèle VirtualBoard et le rendu BoardUI. Un bouton "Simuler" + sélecteur de
// mode. L'utilisateur peut presser des boutons / bouger les potentiomètres pendant
// l'exécution.
import { VirtualBoard } from './board.js';
import { BoardUI } from './board-ui.js';
import { VirtualEngine } from './engine-virtual.js';
import { Avr8Engine } from './engine-avr8js.js';
import { jsGenerator } from './generator-js.js';
import { collectPinModes } from '../generator.js';

export function initSim(opts) {
  const { getWorkspace, getSource, getArduinoGenerator, compile, containerId, statusEl } = opts;

  // Modèle + UI
  const board = new VirtualBoard({ onLog: () => {} });
  const ui = new BoardUI(board, {
    setButton: (pin, pressed) => { engineHook('button', pin, pressed); },
    setAnalog: (ch, val) => { engineHook('analog', ch, val); },
  });

  let currentEngine = null;
  // Les boutons/sliders mettent déjà à jour le modèle VirtualBoard (lu par le moteur
  // virtuel). Seul le moteur réel (AVR8js) a besoin d'un relais vers les registres.
  function engineHook(kind, pinOrCh, val) {
    if (!currentEngine || runningEngine !== 'avr') return;
    if (kind === 'button' && currentEngine.setButton) currentEngine.setButton(pinOrCh, val);
    if (kind === 'analog' && currentEngine.setAnalog) currentEngine.setAnalog(pinOrCh, val);
  }

  let runningEngine = 'virtual'; // 'virtual' | 'avr'
  let running = false;

  // ----- DOM injection -----
  const host = document.createElement('div');
  host.id = 'simPanel';
  host.innerHTML =
    '<div class="sim-bar">' +
    '<span class="sim-title">🔌 Simulation</span>' +
    '<select id="simMode" class="sim-mode" title="Moteur de simulation">' +
    '<option value="virtual">⚡ Virtuelle (instantanée)</option>' +
    '<option value="avr">🔬 Réelle AVR8js (compile)</option>' +
    '</select>' +
    '<button id="simRun" class="compile-btn" type="button">▶ Simuler</button>' +
    '<button id="simStop" class="compile-btn" type="button" disabled>⏹ Arrêter</button>' +
    '<span id="simStatus" class="sim-status"></span>' +
    '</div>' +
    '<div id="simBoard" class="sim-board"></div>';
  const anchor = document.getElementById(containerId) || document.body;
  anchor.appendChild(host);

  const modeSel = document.getElementById('simMode');
  const runBtn = document.getElementById('simRun');
  const stopBtn = document.getElementById('simStop');
  const simStatus = document.getElementById('simStatus');
  ui.build(document.getElementById('simBoard'));

  function setStatus(txt, kind) {
    simStatus.textContent = txt;
    simStatus.className = 'sim-status' + (kind ? ' ' + kind : '');
  }
  function setRunning(on, engineName) {
    running = on;
    runBtn.disabled = on;
    stopBtn.disabled = !on;
  }

  function stopAll() {
    if (currentEngine) currentEngine.stop();
    currentEngine = null;
    setRunning(false);
  }

  async function run() {
      stopAll();
      const mode = modeSel.value;
      runningEngine = mode;
      setStatus('⏳ démarrage…');
      // Pins digitales dynamiques : bouton si entrée, LED si sortie (selon le programme)
      ui.setPinModes(collectPinModes(getWorkspace()));
      if (mode === 'virtual') {
      const ws = getWorkspace();
      const vEng = new VirtualEngine(ws, jsGenerator, board, {
        speed: 1,
        onStatus: (s) => setStatus(s),
        onError: (e) => { setStatus('❌ ' + (e && e.message ? e.message : e), 'err'); stopAll(); },
      });
      currentEngine = vEng;
      setRunning(true, 'virtual');
      vEng.start();
      setStatus('▶ Simulation virtuelle en cours — fais clignoter la LED, bouge les potentiomètres, presse les boutons.');
    } else if (mode === 'avr') {
      const src = getSource();
      const aEng = new Avr8Engine(getWorkspace(), getArduinoGenerator(), board, {
        onStatus: (s) => setStatus(s),
        onError: (e) => { setStatus('❌ ' + (e && e.message ? e.message : e), 'err'); stopAll(); },
      });
      currentEngine = aEng;
      setRunning(true, 'avr');
      await aEng.start(src, async (source) => {
        try { return await compile(source); }
        catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
      });
    }
  }

  runBtn.addEventListener('click', run);
  stopBtn.addEventListener('click', stopAll);

  return { board, ui, stop: stopAll, isRunning: () => running };
}