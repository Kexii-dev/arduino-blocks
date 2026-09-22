// Test du mapping dynamique des pins digitales : une pin programmée en entrée
// (digitalRead) doit être lisible sur n'importe quelle pin, et collectPinModes
// doit exposer le mode (INPUT/OUTPUT) pour l'affichage bouton/LED.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { collectPinModes } from '../src/generator.js';
import { VirtualBoard, HIGH, LOW } from '../src/sim/board.js';

defineArduinoBlocks();
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

function wsWith(fn) {
  const ws = new Blockly.Workspace();
  const mk = (t) => ws.newBlock(t);
  fn(ws, mk);
  ws.getAllBlocks(true).forEach((b) => { try { b.initSvg(); } catch (_) {} try { b.render(); } catch (_) {} });
  return ws;
}

// --- Test 1 : collectPinModes déduit INPUT/OUTPUT depuis les blocs ---
console.log('Test 1: collectPinModes');
{
  const ws = wsWith((ws, mk) => {
    const dr = mk('arduino_digital_read'); dr.setFieldValue('2', 'PIN');   // entrée D2
    const dw = mk('arduino_digital_write'); dw.setFieldValue('4', 'PIN'); dw.setFieldValue('HIGH', 'STAT'); // sortie D4
    const led = mk('arduino_led'); led.setFieldValue('HIGH', 'STAT');      // sortie D13
  });
  const modes = collectPinModes(ws);
  ok(modes.get('2') === 'INPUT', 'D2 = INPUT (digitalRead)');
  ok(modes.get('4') === 'OUTPUT', 'D4 = OUTPUT (digitalWrite)');
  ok(modes.get('13') === 'OUTPUT', 'D13 = OUTPUT (arduino_led)');
  ok(!modes.has('3'), 'D3 non utilisé -> absent');
}

// --- Test 2 : digitalRead sur une pin arbitraire (plus seulement D2/D3) ---
console.log('Test 2: digitalRead pin arbitraire');
{
  const board = new VirtualBoard();
  ok(board.digitalRead(2) === LOW, 'D2 LOW par défaut');
  ok(board.digitalRead(7) === LOW, 'D7 LOW par défaut (avant: non lisible)');
  board.setButton(7, true);
  ok(board.digitalRead(7) === HIGH, 'D7 HIGH après setButton(7,true)');
  board.setButton(7, false);
  ok(board.digitalRead(7) === LOW, 'D7 LOW après relâchement');
}

// --- Test 3 : setButton sur n'importe quelle pin (2..13) ---
console.log('Test 3: setButton pin arbitraire');
{
  const board = new VirtualBoard();
  for (const p of [2, 5, 9, 13]) {
    board.setButton(p, true);
    ok(board.digitalRead(p) === HIGH, 'D' + p + ' pressé -> HIGH');
    board.setButton(p, false);
    ok(board.digitalRead(p) === LOW, 'D' + p + ' relâché -> LOW');
  }
}

console.log(fail === 0 ? '\nPASS ' + pass + '/' + (pass + fail) : '\nFAIL ' + fail + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
