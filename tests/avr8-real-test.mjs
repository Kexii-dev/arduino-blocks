// Test AVR8js (Approche 2) : compile C++ réel via le backend cloud puis exécute
// dans avr8js, vérifie que la LED blink sur le VirtualBoard.
import { VirtualBoard } from '../src/sim/board.js';

const SKETCH = `
void setup() { pinMode(LED_BUILTIN, OUTPUT); }
void loop() { digitalWrite(LED_BUILTIN, HIGH); delay(50); digitalWrite(LED_BUILTIN, LOW); delay(50); }
`;

async function compile(src) {
  const resp = await fetch('http://127.0.0.1:5173/api/compile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: src }),
  });
  let json;
  try { json = await resp.json(); } catch (_) { json = { ok: false, error: 'resp ' + resp.status }; }
  return json;
}

async function main() {
  console.log('Compile…');
  const res = await compile(SKETCH);
  if (!res.ok) { console.log('COMPILE FAIL (backend indisponible?)', res.error); process.exit(2); }
  console.log('Compile OK, hex_bytes=', res.hex_bytes, 'flash%', res.size && res.size.flash_pct);

  const { AVRRunner } = await import('../src/sim/avr-runner.js');
  const hex = atob(res.hex_base64);
  const runner = new AVRRunner(hex);
  const board = new VirtualBoard();
  const states = [];
  board.onPinChange = (pin, v) => states.push([pin, v]);
  runner.portB.addListener(() => {
    if (board && runner) board.digitalWrite(13, runner.isOutputHigh(13) ? 1 : 0);
  });
  runner.usart.onByteTransmit = (v) => board.serialAppend(String.fromCharCode(v));

  const started = Date.now();
  await new Promise((resolve) => {
    runner.start(200000, null, (e) => { console.log('EMUL ERR', e); resolve(); });
    setTimeout(resolve, 500);
  });
  runner.stop();
  const led = board.pinOut.get(13);
  console.log('LED13 final =', led, '(1=HIGH)');
  console.log('pins touchés (13):', states.filter(([p]) => p === 13).length, 'changements');
  console.log('cycles =', runner.cpu.cycles);
  console.log(states.filter(([p]) => p === 13).length >= 4 ? '\nAVR8js LED blink OK' : '\nAVR8js pas de blink');
  process.exit(0);
}
main();
