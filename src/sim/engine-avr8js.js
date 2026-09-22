// Approche 2 — moteur "réel" AVR8js : compile le C++ généré (blocs) via le backend
// cloud existant (POST /api/compile -> .hex), charge le binaire dans l'émulateur
// ATmega328p (avr8js) et pilote le même VirtualBoard à travers les ports GPIO.
// Cohérence totale simu <-> carte réelle : c'est le vrai firmware qui tourne.
import { AVRRunner, PinState } from './avr-runner.js';

// Pins digitales Arduino -> port + bit (mêmes règles que AVRRunner.pinLocation mais
// regroupées par port pour ré-attacher efficacement sur un portListener).
const DIGITAL = {};
for (let p = 0; p <= 7; p++) DIGITAL[p] = ['D', p];
for (let p = 8; p <= 13; p++) DIGITAL[p] = ['B', p - 8];

export class Avr8Engine {
  constructor(ws, gen, board, opts = {}) {
    this.ws = ws;
    this.gen = gen;          // générateur C++ (arduinoGenerator)
    this.board = board;
    this.opts = opts;
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
    this.runner = null;
    this._marshalled = true; // éviter de re-synchroniser inutilement
  }

  /**
   * Compile le sketch (blocs -> C++ -> /api/compile -> hex base64) puis lance AVR8js.
   * source: chaîne C++ ; compileFn: (src)=>Promise<{ok,hex_base64,error}> (vient de api.js)
   */
  async start(source, compileFn) {
    this.stop();
    this.board.reset();
    this.onStatus('⏳ Compilation…');
    let hex;
    try {
      const res = await compileFn(source);
      if (!res.ok || !res.hex_base64) {
        this.onError(new Error(res.error || 'Compilation échouée'));
        this.onStatus('❌ ' + (res.error || 'Compilation échouée'));
        return;
      }
      hex = atob(res.hex_base64); // -> texte Intel HEX
    } catch (e) {
      this.onError(e);
      this.onStatus('❌ ' + (e && e.message ? e.message : e));
      return;
    }

    try {
      this.runner = new AVRRunner(hex);
      // Synchronise les sliders analogiques (0..1023 -> volts 0..5) dès le départ
      this._syncAnalog();
      this._wire();
      this.onStatus('▶ Simulation (réelle AVR8js)…');
      this.runner.start(undefined, undefined, (err) => {
        this.onError(new Error('Erreur émulation : ' + (err && err.message ? err.message : err)));
        this.onStatus('❌ Émulation arrêtée');
      });
    } catch (e) {
      this.onError(e);
      this.onStatus('❌ ' + (e && e.message ? e.message : e));
    }
  }

  /** Branche le runner sur le VirtualBoard. */
  _wire() {
    const b = this.board;
    // 1) Sorties : chaque port notifie quand un pin change -> on lit tous ses pins.
    for (const [reg, port] of [['B', this.runner.portB], ['C', this.runner.portC], ['D', this.runner.portD]]) {
      port.addListener(() => {
        if (!this.runner) return;
        for (const pin of Object.keys(DIGITAL)) {
          if (DIGITAL[pin][0] !== reg) continue;
          const [r, bit] = DIGITAL[pin];
          const portObj = { B: this.runner.portB, C: this.runner.portC, D: this.runner.portD }[r];
          const bitIdx = { B: bit, C: bit, D: bit }[r];
          const st = portObj.pinState(bitIdx);
          // écriture OUTPUT only : on ne répercute que si la pin est en sortie
          if (st === PinState.High || st === PinState.Low) {
            b.digitalWrite(pin, st === PinState.High ? 1 : 0);
          }
        }
      });
    }
    // 2) Série : Serial.print -> console virtuelle
    this.runner.usart.onByteTransmit = (value) => {
      b.serialAppend(String.fromCharCode(value));
    };
    // 3) Entrées : boutons virtuels -> setPin sur le port correspondant
    b._setButtonHooks = (pin, pressed) => {
      if (!this.runner) return;
      try { this.runner.setDigitalPin(pin, pressed); } catch (_) {}
    };
    // 4) Tonalité : AVR8js n'émet pas d'événement tone ; on scrute les pins PWM
    //    via un timer cadencé (approximation visuelle du buzzer).
  }

  /** Pousse les valeurs des sliders (0..1023) vers l'ADC (volts 0..5). */
  _syncAnalog() {
    if (!this.runner) return;
    const volts = new Array(6);
    for (let ch = 0; ch < 6; ch++) volts[ch] = (this.board.analogIn[ch] / 1023) * 5;
    this.runner.setAnalogChannels(volts);
  }

  /** Appelé par l'UI quand l'utilisateur bouge un slider. */
  setAnalog(channel, value) {
    this.board.setAnalog(channel, value);
    this._syncAnalog();
  }

  /** Appelé par l'UI quand l'utilisateur presse/relâche un bouton. */
  setButton(pin, pressed) {
    this.board.setButton(pin, pressed);
    if (this.runner) { try { this.runner.setDigitalPin(pin, pressed); } catch (_) {} }
  }

  stop() {
    if (this.runner) { this.runner.stop(); this.runner = null; }
  }
}
