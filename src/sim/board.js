// Virtual Arduino Uno board — the SHARED model that both simulation engines
// (Approche 1 blocs→JS, Approche 2 AVR8js) drive. Engine-agnostic & headless-testable.
//
// Architecture (doc "Arduino par blocs - Simulateur - Analyse de faisabilité") :
//   l'UI de simulation ne connaît que ce modèle. Chaque moteur traduit ses actions
//   firmware en appels `onPinChange(pin, value)` / `serialWrite(char)` / `toneWrite`.
//   Changer de moteur ne ré-écrit que la couche "traduction", jamais la carte.
//
// Convention de pins (Arduino Uno) :
//   - pins digitales 0..13 (sorties : LED par pin ; entrées : boutons 2 & 3 par défaut)
//   - pins analogiques A0..A5 => channels 0..5, valeurs 0..1023 (analogRead)

export const HIGH = 1;
export const LOW = 0;

export class VirtualBoard {
  constructor(opts = {}) {
    this.onChange = opts.onChange || (() => {}); // (kind, payload) notif UI
    this.onPinChange = opts.onPinChange || (() => {}); // (pin, value)
    this.onSerial = opts.onSerial || (() => {}); // char count (serial text read back by engine via buffer)
    this.onTone = opts.onTone || (() => {}); // (pin, freq | null)
    this.onLog = opts.onLog || (() => {}); // message pédagogique

    // Sorties : pin -> HIGH/LOW (digitalWrite) ou 0..255 (PWM analogWrite).
    this.pinOut = new Map();
    // Entrées analogiques : channel (0..5) -> 0..1023.
    this.analogIn = new Array(6).fill(0);
    // Entrées digitales : pin -> HIGH/LOW (état des boutons virtuels).
    this.digitalIn = new Array(14).fill(LOW);
    // Série : buffer d'octets reçus (Serial.read), modifiés par l'utilisateur en UI.
    this.serialRx = [];
    // Série : texte émis par le programme (Serial.print/println).
    this.serialTx = '';
    // PWM runtime : dérivation visuelle (0..255).
    this.pwmValue = new Map();
    // Tonalité courante par pin.
    this.toneFreq = new Map();
  }

  /* ---------- Sorties (appelées par les moteurs) ---------- */

  /** digitalWrite : pin 0..13, value HIGH/LOW. */
  digitalWrite(pin, value) {
    const v = value === HIGH || value === 1 ? HIGH : LOW;
    this.pinOut.set(pin, v);
    this.pwmValue.delete(pin);
    this.onPinChange(pin, v);
    this.onChange('digital', { pin, value: v });
  }

  /** analogWrite : pin PWM, value 0..255 (on garde la valeur pour l'UI). */
  analogWrite(pin, value) {
    const v = Math.max(0, Math.min(255, Math.round(value || 0)));
    this.pinOut.set(pin, v > 0 ? HIGH : LOW); // "allumée" si >0
    this.pwmValue.set(pin, v);
    this.onPinChange(pin, v / 255);
    this.onChange('pwm', { pin, value: v });
  }

  /** tone / noTone (buzzer virtuel). */
  tone(pin, freq) {
    this.toneFreq.set(pin, freq);
    this.onTone(pin, freq);
    this.onChange('tone', { pin, freq });
  }
  noTone(pin) {
    this.toneFreq.delete(pin);
    this.onTone(pin, null);
    this.onChange('tone', { pin, freq: null });
  }

  /** Serial.print : accumulate du texte vers la console série virtuelle. */
  serialAppend(text) {
    this.serialTx += text;
    this.onChange('serial', { text });
  }
  serialClear() { this.serialTx = ''; }

  /** Pédagogique : message d'explication au niveau bloc (approche 1). */
  log(msg) { this.onLog(msg); }

  /* ---------- Entrées (lecture par les moteurs) ---------- */

  /** digitalRead : lit l'état du bouton virtuel (LOW défaut = bouton non pressé). */
  digitalRead(pin) {
    if (pin >= 2 && pin <= 13) return this.digitalIn[pin] || LOW; // boutons virtuels
    return LOW;
  }

  /** analogRead(channel 0..5) : valeur 0..1023 du slider virtuel. */
  analogRead(channel) {
    const ch = Math.max(0, Math.min(5, channel | 0));
    return Math.round(this.analogIn[ch]);
  }

  /* ---------- Actions utilisateur (UI) ---------- */

  /** L'utilisateur déplace un slider analogique. */
  setAnalog(channel, value) {
    this.analogIn[channel] = Math.max(0, Math.min(1023, Math.round(value)));
    this.onChange('analog', { channel, value: this.analogIn[channel] });
  }

  /** L'utilisateur appuie/relâche un bouton virtuel sur une pin digitale. */
  setButton(pin, pressed) {
    const state = pressed ? HIGH : LOW;
    this.digitalIn[pin] = state;
    this.onChange('button', { pin, state });
    this.onPinChange(pin, state);
  }

  /** L'utilisateur envoie un caractère dans la console série (Serial.read). */
  serialInput(ch) {
    this.serialRx.push(ch);
    this.onChange('serialIn');
  }
  serialRxAvailable() { return this.serialRx.length > 0; }
  serialReadByte() { return this.serialRx.length ? this.serialRx.shift() : -1; }

  reset() {
    this.pinOut.clear();
    this.pwmValue.clear();
    this.toneFreq.clear();
    this.analogIn = new Array(6).fill(0);
    this.digitalIn = new Array(14).fill(LOW);
    this.serialRx = [];
    this.serialTx = '';
  }
}
