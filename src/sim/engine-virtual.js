// Approche 1 — moteur virtuel : génère du JS (fake Arduino API) depuis les blocs et
// l'exécute en boucle async. Instantané, 100 % client, zéro compile. Le C++ généré
// reste disponible pour le flash réel ; la simu est une approximation honnête.
import { buildJsProgram } from './generator-js.js';
import { HIGH, LOW } from './board.js';

// async() => Promise<number> : resolve après `ms` réels. La boucle ne fige jamais l'UI.
export function createFakeApi(board, opts = {}) {
  const speed = opts.speed || 1; // 1 = temps réel, >1 = accéléré
  const api = {
    digitalWrite: (pin, value) => { board.digitalWrite(pin, value); },
    digitalRead: (pin) => board.digitalRead(pin),
    analogRead: (ch) => board.analogRead(ch),
    analogWrite: (pin, value) => { board.analogWrite(pin, value); },
    tone: (pin, freq) => { board.tone(pin, freq); },
    noTone: (pin) => { board.noTone(pin); },
    servo: (pin, deg) => { board.onChange('servo', { pin, deg }); },
    serialPrint: async (text) => { board.serialAppend(String(text) + '\n'); },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms / speed)),
    serialRead: () => board.serialReadByte(),
    serialAvailable: () => board.serialRxAvailable() ? 1 : 0,
    pinMode: () => {},
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
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
  }

  /** Génère le programme JS depuis le workspace courant. */
  getProgram() { return buildJsProgram(this.ws, this.jsGen); }

  start() {
    if (this._running) { this.stop(); }
    this._running = true;
    this._stopFlag = false;
    this.board.reset();
    try {
      const api = createFakeApi(this.board, this.opts);
      const program = this.getProgram();
      this._runLoop(api, program).catch((e) => {
        this._running = false;
        this.onError(e);
      });
    } catch (e) {
      this._running = false;
      this.onError(e);
    }
  }

  async _runLoop(api, program) {
    // buildJsProgram produit : let var; funcs; async function setup(){...} async function loop(){...}
    // On les instancie via Function + fake, puis on itère.
    const body = program + '\nreturn { setup: setup, loop: loop };';
    const factory = new Function('fake', 'HIGH', 'LOW', body);
    const { setup, loop } = factory(api, HIGH, LOW);
    this.onStatus('▶ Simulation (virtuelle)…');
    if (setup) await setup();
    while (this._running && !this._stopFlag) {
      if (loop) await loop();
      // sécurité anti-boucle infinie serrée sans delay : petit yield pour laisser respirer l'UI
      await new Promise((r) => setTimeout(r, 0));
    }
    this.onStatus('⏹ Simulation arrêtée');
  }

  stop() {
    this._running = false;
    this._stopFlag = true;
  }
}