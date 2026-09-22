// Test headless du moteur virtuel (Approche 1) : génère du JS depuis des blocs et
// vérifie les changements de pins sur VirtualBoard.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { jsGenerator, buildJsProgram } from '../src/sim/generator-js.js';
import { VirtualEngine } from '../src/sim/engine-virtual.js';
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

// --- Test 1 : génération JS d'un blink simple ---
console.log('Test 1: buildJsProgram (LED + delay)');
{
  const ws = wsWith((ws, mk) => {
    const led = mk('arduino_led'); led.setFieldValue('HIGH', 'STAT');
    const del = mk('arduino_delay'); del.setFieldValue(500, 'MS');
    led.nextConnection.connect(del.previousConnection);
  });
  const prog = buildJsProgram(ws, jsGenerator);
  ok(prog.includes('await fake.digitalWrite(13, HIGH)'), 'digitalWrite LED_BUILTIN');
  ok(prog.includes('await fake.delay(500)'), 'delay 500');
  ok(prog.includes('async function setup()'), 'setup()');
  ok(prog.includes('async function loop()'), 'loop()');
}

// --- Test 2 : condition analogRead(A0) > 500 -> if/else ---
console.log('Test 2: analogRead condition');
{
  const ws = wsWith((ws, mk) => {
    const ifb = mk('arduino_if');
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
  });
  const prog = buildJsProgram(ws, jsGenerator);
  ok(prog.includes('fake.analogRead(0) > 500'), 'analogRead(0) > 500');
  ok(prog.includes('else {'), 'else branch');
}

// --- Test 3 : exécution réelle (blink) ---
console.log('Test 3: exécution blink');
{
  const ws = wsWith((ws, mk) => {
    const led = mk('arduino_led'); led.setFieldValue('HIGH', 'STAT');
    const del = mk('arduino_delay'); del.setFieldValue(30, 'MS');
    led.nextConnection.connect(del.previousConnection);
    const led2 = mk('arduino_led'); led2.setFieldValue('LOW', 'STAT');
    del.nextConnection.connect(led2.previousConnection);
  });
  const board = new VirtualBoard();
  const states = [];
  board.onPinChange = (pin, v) => states.push([pin, v]);
  const eng = new VirtualEngine(ws, jsGenerator, board, { speed: 20, onError: (e) => console.log('  ERR', e) });
  eng.start();
  setTimeout(() => {
    eng.stop();
    ok(states.length >= 2, 'au moins 2 changements de pin (' + states.length + ')');
    ok(states[0] && states[0][0] === 13 && states[0][1] === HIGH, '1er = LED13 HIGH');
    ok(states.some(([p, v]) => p === 13 && v === LOW), 'LED13 passe LOW ensuite');
    console.log('  états:', JSON.stringify(states));
    console.log(fail === 0 ? '\nPASS ' + pass + '/' + (pass + fail) : '\nFAIL ' + fail + '/' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
  }, 150);
}