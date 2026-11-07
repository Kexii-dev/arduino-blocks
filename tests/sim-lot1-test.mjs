// Simulateur, lot 1 (docs/PLAN-SIMULATEUR.md) : servo, vitesse, bloc en cours signalé.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { jsGenerator, buildJsProgram } from '../src/sim/generator-js.js';
import { VirtualEngine } from '../src/sim/engine-virtual.js';
import { VirtualBoard } from '../src/sim/board.js';

Blockly.setLocale(Fr);
defineArduinoBlocks();
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function chain(ws, specs) {
  const blocks = specs.map(([t, f]) => { const b = ws.newBlock(t); for (const [k, v] of Object.entries(f || {})) b.setFieldValue(v, k); return b; });
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].nextConnection.connect(blocks[i + 1].previousConnection);
  return blocks;
}

console.log('servo : l\'angle arrive dans le modèle, borné à 0-180');
{
  const ws = new Blockly.Workspace();
  chain(ws, [['arduino_servo', { PIN: '9', DEG: 45 }], ['arduino_delay', { MS: 1000 }]]);
  const board = new VirtualBoard();
  const seen = [];
  board.onChange = (k, p) => { if (k === 'servo') seen.push(p); };
  const eng = new VirtualEngine(ws, jsGenerator, board, {});
  eng.start();
  await wait(50);
  eng.stop();
  ok(seen.length && seen[0].pin === 9 && seen[0].deg === 45, 'servo D9 à 45° (' + JSON.stringify(seen[0]) + ')');
  board.servoWrite(9, 400);
  ok(board.servoAngle.get(9) === 180, 'angle borné à 180');
}

console.log('vitesse : delay(400) à ×4 ≈ 100 ms, modifiable en cours de route');
{
  const ws = new Blockly.Workspace();
  chain(ws, [['arduino_led', { STAT: 'HIGH' }], ['arduino_delay', { MS: 400 }], ['arduino_led', { STAT: 'LOW' }], ['arduino_delay', { MS: 400 }]]);
  const board = new VirtualBoard();
  const t = [];
  board.onChange = (k, p) => { if (k === 'digital') t.push(performance.now()); };
  const eng = new VirtualEngine(ws, jsGenerator, board, { speed: 4 });
  eng.start();
  await wait(260);
  eng.stop();
  const gap = t[1] - t[0];
  ok(t.length >= 2 && gap > 70 && gap < 200, 'écart HIGH→LOW ≈ 100 ms (' + Math.round(gap) + ' ms)');
  eng.setSpeed(0);
  ok(eng.speed === 1, 'vitesse invalide -> ×1');
}

console.log('bloc en cours : signalé dans l\'ordre, effacé à l\'arrêt');
{
  const ws = new Blockly.Workspace();
  const [a, b, c] = chain(ws, [['arduino_led', { STAT: 'HIGH' }], ['arduino_delay', { MS: 30 }], ['arduino_led', { STAT: 'LOW' }]]);
  const fn = ws.newBlock('arduino_function'); fn.setFieldValue('clignote', 'NAME');
  const prog = buildJsProgram(ws, jsGenerator);
  ok(!/^await/m.test(prog.split('async function setup')[0]), 'aucun await au niveau global (définition de fonction)');
  ok(prog.includes('await fake.hl(' + JSON.stringify(a.id) + ')'), 'chaque bloc instruction appelle fake.hl(id)');
  const board = new VirtualBoard();
  const ids = [];
  const eng = new VirtualEngine(ws, jsGenerator, board, { onBlock: (id) => ids.push(id) });
  eng.start();
  await wait(20);   // pendant le delay : le bloc en cours est le delay
  ok(ids.at(-1) === b.id, 'pendant « attendre », le bloc signalé est « attendre »');
  eng.stop();
  ok(ids.at(-1) === null, 'arrêt -> surlignage effacé');
  await wait(40);
  ok(ids.at(-1) === null, 'aucun surlignage tardif après l\'arrêt');
}

console.log(fail === 0 ? '\nPASS ' + pass + '/' + (pass + fail) : '\nFAIL ' + fail + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
