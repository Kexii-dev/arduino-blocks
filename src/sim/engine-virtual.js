// Approche 1 — moteur virtuel : génère du JS (fake Arduino API) depuis les blocs et
// l'exécute en boucle async. Instantané, 100 % client, zéro compile. Le C++ généré
// reste disponible pour le flash réel ; la simu est une approximation honnête.
import { buildJsProgram } from './generator-js.js';
import { HIGH, LOW } from './board.js';

// Levée par fake.tick() quand la simulation a été arrêtée : sort des boucles du programme.
export class SimStopped extends Error {}

// async() => Promise<number> : resolve après `ms` réels. La boucle ne fige jamais l'UI.
export function createFakeApi(board, opts = {}) {
  // vitesse lue à chaque `delay` : elle peut changer pendant la simulation (1 = temps réel)
  const getSpeed = opts.getSpeed || (() => opts.speed || 1);
  const isStopped = opts.isStopped || (() => false);
  const onBlock = opts.onBlock || (() => {});
  const api = {
    digitalWrite: (pin, value) => { board.digitalWrite(pin, value); },
    digitalRead: (pin) => board.digitalRead(pin),
    analogRead: (ch) => board.analogRead(ch),
    analogWrite: (pin, value) => { board.analogWrite(pin, value); },
    tone: (pin, freq) => { board.tone(pin, freq); },
    noTone: (pin) => { board.noTone(pin); },
    servo: (pin, deg) => { board.servoWrite(pin, deg); },
    serialPrint: async (text) => { board.serialAppend(String(text) + '\n'); },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms / getSpeed())),
    serialRead: () => board.serialReadByte(),
    serialAvailable: () => board.serialRxAvailable() ? 1 : 0,
    pinMode: () => {},
    // Émis avant chaque bloc instruction (cf. generator-js scrub_) : id du bloc exécuté.
    hl: async (id) => { onBlock(id); },
    // Appelé à chaque tour de `tant que` / `répéter` : rend la main à l'UI et
    // interrompt le programme si la simulation a été arrêtée entre-temps.
    tick: async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (isStopped()) throw new SimStopped();
    },
  };
  return api;
}

export class VirtualEngine {
  constructor(ws, jsGen, board, opts = {}) {
    this.ws = ws;
    this.jsGen = jsGen;
    this.board = board;
    this.opts = opts;
    this._running = false;
    this._stopFlag = false;
    this._runId = 0;          // chaque start() a son id : un ancien run voit qu'il est périmé
    this.speed = opts.speed || 1;
    this.onBlock = opts.onBlock || null; // (blockId | null) bloc en cours, au plus une fois par frame
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
  }

  /** Génère le programme JS depuis le workspace courant. */
  getProgram() { return buildJsProgram(this.ws, this.jsGen); }

  start() {
    if (this._running) { this.stop(); }
    this._running = true;
    this._stopFlag = false;
    const runId = ++this._runId;
    const isStopped = () => this._stopFlag || runId !== this._runId;
    this.board.reset();
    try {
      const api = createFakeApi(this.board, {
        ...this.opts, isStopped,
        getSpeed: () => this.speed,
        onBlock: (id) => { if (runId === this._runId) this._queueBlock(id); },
      });
      const program = this.getProgram();
      this._runLoop(api, program, isStopped).catch((e) => {
        if (e instanceof SimStopped) return; // arrêt demandé : pas une erreur
        if (runId === this._runId) this._running = false;
        this.onError(e);
      });
    } catch (e) {
      this._running = false;
      this.onError(e);
    }
  }

  async _runLoop(api, program, isStopped) {
    // buildJsProgram produit : let var; funcs; async function setup(){...} async function loop(){...}
    // On les instancie via Function + fake, puis on itère.
    const body = program + '\nreturn { setup: setup, loop: loop };';
    const factory = new Function('fake', 'HIGH', 'LOW', body);
    const { setup, loop } = factory(api, HIGH, LOW);
    this.onStatus('▶ Simulation (virtuelle)…');
    if (setup) await setup();
    while (!isStopped()) {
      if (loop) await loop();
      // sécurité anti-boucle infinie serrée sans delay : petit yield pour laisser respirer l'UI
      await new Promise((r) => setTimeout(r, 0));
    }
    this.onStatus('⏹ Simulation arrêtée');
  }

  setSpeed(s) { this.speed = s > 0 ? s : 1; }

  /** Regroupe les changements de bloc : une boucle rapide ne doit pas saturer le rendu. */
  _queueBlock(id) {
    if (!this.onBlock) return;
    this._pendingBlock = id;
    if (this._blockFrame) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
    this._blockFrame = raf(() => {
      this._blockFrame = null;
      if (!this._stopFlag) this.onBlock(this._pendingBlock);
    });
  }

  stop() {
    this._running = false;
    this._stopFlag = true;
    if (this.onBlock) this.onBlock(null);
  }
}