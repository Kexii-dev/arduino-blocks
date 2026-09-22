// Test AVR8js: analogRead(A0) -> LED13 réagit au slider virtuel (firmware réel).
// Vérifie l'état STABLE de la LED (pas le ratio d'échantillons, qui compte la
// transition initiale).
import { VirtualBoard } from '../src/sim/board.js';

const SKETCH = `
void setup() { pinMode(LED_BUILTIN, OUTPUT); }
void loop() {
  int v = analogRead(A0);
  digitalWrite(LED_BUILTIN, v > 500 ? HIGH : LOW);
  delay(5);
}
`;

const res = await (await fetch('http://127.0.0.1:5173/api/compile', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ source: SKETCH }),
})).json();
if (!res.ok) { console.log('COMPILE FAIL', res.error); process.exit(2); }

const { AVRRunner } = await import('../src/sim/avr-runner.js');
const hex = atob(res.hex_base64);

async function settledLed(volts) {
  const runner = new AVRRunner(hex);
  runner.setAnalogChannels([volts, 0, 0, 0, 0, 0]);
  const board = new VirtualBoard();
  let last = 0;
  runner.portB.addListener(() => { last = runner.isOutputHigh(13) ? 1 : 0; });
  await new Promise((resolve) => { runner.start(500000, null, resolve); setTimeout(resolve, 300); });
  runner.stop();
  return last;
}

const high = await settledLed(5);   // 5V -> 1023 > 500 -> HIGH
const low = await settledLed(0);   // 0V -> 0 < 500 -> LOW
console.log('A0=5V  -> LED13 =', high, '(attendu 1)');
console.log('A0=0V  -> LED13 =', low, '(attendu 0)');
const ok = high === 1 && low === 0;
console.log(ok ? '\nAVR8js analogRead->LED OK' : '\nECHEC seuil analogique');
process.exit(ok ? 0 : 1);