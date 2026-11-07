// Non-régression des bugs P0 du générateur (C++ + JS simulateur) :
// priorité de « pas » / « jusqu'à », échappement des textes, noms d'identifiants,
// boucle `tant que` sans « attendre » qui figeait le simulateur.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { arduinoGenerator, buildSketch } from '../src/generator.js';
import { jsGenerator, buildJsProgram } from '../src/sim/generator-js.js';
import { VirtualEngine } from '../src/sim/engine-virtual.js';
import { VirtualBoard } from '../src/sim/board.js';
import { toIdent, toStringLiteral } from '../src/ident.js';

Blockly.setLocale(Fr);
defineArduinoBlocks();
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

const ws = new Blockly.Workspace();
const num = (n) => { const b = ws.newBlock('math_number'); b.setFieldValue(n, 'NUM'); return b; };
const eq = () => {
  const c = ws.newBlock('logic_compare'); c.setFieldValue('EQ', 'OP');
  c.getInput('A').connection.connect(num(1).outputConnection);
  c.getInput('B').connection.connect(num(2).outputConnection);
  return c;
};
const both = (block) => {
  arduinoGenerator.init(ws); jsGenerator.init(ws);
  const c = arduinoGenerator.blockToCode(block, true), j = jsGenerator.blockToCode(block, true);
  return [Array.isArray(c) ? c[0] : c, Array.isArray(j) ? j[0] : j];
};

console.log('« pas » garde les parenthèses');
{
  const n = ws.newBlock('logic_negate'); n.getInput('BOOL').connection.connect(eq().outputConnection);
  const [c, j] = both(n);
  ok(c === '!(1 == 2)', 'C++ : ' + c);
  ok(j === '!(1 === 2)', 'JS : ' + j);
}

console.log('« répéter jusqu\'à » nie toute la condition');
{
  const w = ws.newBlock('controls_whileUntil'); w.setFieldValue('UNTIL', 'MODE');
  w.getInput('BOOL').connection.connect(eq().outputConnection);
  const [c, j] = both(w);
  ok(c.startsWith('while (!(1 == 2))'), 'C++ : ' + c.split('\n')[0]);
  ok(j.startsWith('while (!(1 === 2))'), 'JS : ' + j.split('\n')[0]);
}

console.log('textes échappés');
{
  ok(toStringLiteral('a\\') === '"a\\\\"', 'antislash final');
  ok(toStringLiteral('dit "oui"\n') === '"dit \\"oui\\"\\n"', 'guillemets + retour ligne');
  const evil = '\\";globalThis.__pwned=1;//';
  ok(eval(toStringLiteral(evil)) === evil, 'aucune injection : le littéral JS redonne le texte exact');
}

console.log('noms de variables / fonctions');
{
  ok(toIdent('ma fonction') === 'ma_fonction', 'espace -> _');
  ok(toIdent('école') === 'ecole', 'accents retirés');
  ok(toIdent('2eme') === '_2eme', 'pas de chiffre en tête');
  ok(toIdent('int') === 'int_' && toIdent('loop') === 'loop_', 'mots réservés suffixés');
  ok(toIdent(toIdent('int')) === 'int_', 'idempotent');
  const f = ws.newBlock('arduino_function'); f.setFieldValue('ma fonction', 'NAME');
  ok(f.getFieldValue('NAME') === 'ma_fonction', 'le validateur corrige la saisie du bloc');
  const v = ws.newBlock('arduino_var_create'); v.setFieldValue('x;alert(1)', 'NAME');
  ok(v.getFieldValue('NAME') === 'x_alert_1', 'nom de variable assaini : ' + v.getFieldValue('NAME'));
  const code = buildSketch(ws, arduinoGenerator);
  ok(/void ma_fonction\(\) \{/.test(code), 'C++ : void ma_fonction()');
  ok(/int x_alert_1 = 0;/.test(code), 'C++ : int x_alert_1 = 0;');
}

console.log('« vrai / faux » donne true / false');
{
  const b = ws.newBlock('logic_boolean'); b.setFieldValue('TRUE', 'BOOL');
  const [c, j] = both(b);
  ok(c === 'true' && j === 'true', 'TRUE -> true (C++ ' + c + ', JS ' + j + ')');
}

console.log('simulateur : `tant que vrai` sans attendre ne fige pas et s\'arrête');
{
  const w2 = new Blockly.Workspace();
  const loop = w2.newBlock('controls_whileUntil'); loop.setFieldValue('WHILE', 'MODE');
  const t = w2.newBlock('logic_boolean'); t.setFieldValue('TRUE', 'BOOL');
  loop.getInput('BOOL').connection.connect(t.outputConnection);
  const led = w2.newBlock('arduino_led'); led.setFieldValue('HIGH', 'STAT');
  loop.getInput('DO').connection.connect(led.previousConnection);
  ok(/await fake\.tick\(\)/.test(buildJsProgram(w2, jsGenerator)), 'le corps de boucle appelle fake.tick()');

  const errors = [];
  const eng = new VirtualEngine(w2, jsGenerator, new VirtualBoard(), { onError: (e) => errors.push(e) });
  eng.start();
  let timerFired = false;
  setTimeout(() => { timerFired = true; }, 20); // ne se déclenche que si l'event loop respire
  setTimeout(() => {
    ok(timerFired, 'l\'event loop n\'est pas bloquée');
    eng.stop();
    setTimeout(() => {
      ok(errors.length === 0, 'arrêt propre, sans erreur (' + errors.map(String).join(', ') + ')');
      console.log(fail === 0 ? '\nPASS ' + pass + '/' + (pass + fail) : '\nFAIL ' + fail + '/' + (pass + fail));
      process.exit(fail === 0 ? 0 : 1);
    }, 30);
  }, 60);
}
