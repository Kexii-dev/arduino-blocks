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
  host.id = 'simHost'; // ≠ #simPanel (conteneur défilant de la fenêtre, index.html)
  host.innerHTML =
    '<div class="sim-bar">' +
    '<select id="simMode" class="sim-mode" title="Moteur de simulation" aria-label="Moteur de simulation">' +
    '<option value="virtual">⚡ Virtuelle (instantanée)</option>' +
    '<option value="avr">🔬 Réelle AVR8js (compile)</option>' +
    '</select>' +
    '<button id="simRun" class="sim-run" type="button">▶ Lancer</button>' +
    '<span id="simStatus" class="sim-status" role="status"></span>' +
    '</div>' +
    '<div id="simBoard" class="sim-board"></div>';
  const anchor = document.getElementById(containerId) || document.body;
  anchor.appendChild(host);

  const modeSel = document.getElementById('simMode');
  const runBtn = document.getElementById('simRun');
  const simStatus = document.getElementById('simStatus');
  ui.build(document.getElementById('simBoard'));

  // Pastille d'état : idle (gris) | run (vert pulsé) | err (rouge)
  function setStatus(txt, kind) {
    simStatus.textContent = txt;
    simStatus.className = 'sim-status' + (kind ? ' ' + kind : '');
  }
  function setRunning(on) {
    running = on;
    runBtn.textContent = on ? '■ Arrêter' : '▶ Lancer';
    runBtn.classList.toggle('stop', on);
    modeSel.disabled = on;
    if (!on && !simStatus.classList.contains('err')) setStatus('Prêt — clique sur Lancer');
  }
  setStatus('Prêt — clique sur Lancer');

  function stopAll() {
    if (currentEngine) currentEngine.stop();
    currentEngine = null;
    setRunning(false);
  }

  async function run() {
    stopAll();
    const mode = modeSel.value;
    runningEngine = mode;
    setStatus('Démarrage…', 'run');
    // Broches dynamiques : interrupteur si entrée, LED si sortie (selon le programme)
    ui.setPinModes(collectPinModes(getWorkspace()));
    ui.clearOutputs();
    const onError = (e) => { stopAll(); setStatus('Erreur : ' + (e && e.message ? e.message : e), 'err'); };
    if (mode === 'virtual') {
      const vEng = new VirtualEngine(getWorkspace(), jsGenerator, board, {
        speed: 1,
        onStatus: () => {},
        onError,
      });
      currentEngine = vEng;
      setRunning(true);
      vEng.start();
      setStatus('En cours — bascule les interrupteurs, bouge les potentiomètres', 'run');
    } else if (mode === 'avr') {
      const aEng = new Avr8Engine(getWorkspace(), getArduinoGenerator(), board, {
        onStatus: (s) => setStatus(s.replace(/^[^\p{L}\d]+/u, ''), 'run'),
        onError,
      });
      currentEngine = aEng;
      setRunning(true);
      await aEng.start(getSource(), async (source) => {
        try { return await compile(source); }
        catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
      });
    }
  }

  runBtn.addEventListener('click', () => (running ? stopAll() : run()));

  // Hors simulation, les contrôles suivent le programme en cours d'édition.
  function refreshPins() {
    if (!running) ui.setPinModes(collectPinModes(getWorkspace()));
  }

  return { board, ui, stop: stopAll, isRunning: () => running, refreshPins };
}