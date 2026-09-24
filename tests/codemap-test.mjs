// Validation headless du lien pédagogique bloc ↔ lignes C++ (Option A).
// Vérifie : (1) les commentaires pédagogiques sont présents dans le C++ généré,
// (2) chaque bloc-racine mappe UNIQUEMENT sa propre contribution (pas la chaîne
// `next` suivante), (3) la langue (FR/EN) change les commentaires.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks'; // si/else, boucles, maths, variables
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks } from '../src/blocks.js';
import { arduinoGenerator, buildSketchMapped, buildSketch } from '../src/generator.js';

const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
Blockly.setLocale(Fr);
defineArduinoBlocks();

const ws = new Blockly.Workspace();
const led = ws.newBlock('arduino_led'); led.setFieldValue('LOW', 'STAT');
const del = ws.newBlock('arduino_delay'); del.setFieldValue(500, 'MS');
led.nextConnection.connect(del.previousConnection);
const ifb = ws.newBlock('arduino_if');
const cmp = ws.newBlock('logic_compare'); cmp.setFieldValue('GT', 'OP');
const ar = ws.newBlock('arduino_analog_read'); ar.setFieldValue('A0', 'PIN');
cmp.getInput('A').connection.connect(ar.outputConnection);
const num = ws.newBlock('math_number'); num.setFieldValue(500, 'NUM');
cmp.getInput('B').connection.connect(num.outputConnection);
ifb.getInput('IF0').connection.connect(cmp.outputConnection);
const hi = ws.newBlock('arduino_led'); hi.setFieldValue('HIGH', 'STAT');
ifb.getInput('DO0').connection.connect(hi.previousConnection);
const lo = ws.newBlock('arduino_led'); lo.setFieldValue('LOW', 'STAT');
ifb.getInput('ELSE').connection.connect(lo.previousConnection);
del.nextConnection.connect(ifb.previousConnection);

const assert = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) process.exitCode = 1; };

// FR : commentaires français + contenu complet
const fr = buildSketchMapped(ws, arduinoGenerator, 'fr');
const frLines = fr.code.split('\n');
assert('FR : annotation LED', fr.code.includes('// Contrôle la LED intégrée (pin 13)'));
assert('FR : annotation delay', fr.code.includes('// Pause de 500 ms'));
assert('FR : annotation if', fr.code.includes('// Si la condition est vraie'));
assert('FR : code complet (delay/if/else présents)', /delay\(500\)/.test(fr.code) && /if \(analogRead\(A0\) > 500\) \{/.test(fr.code) && fr.code.includes('else {'));

// Granularité : LED ne couvre QUE sa ligne (+ commentaire), pas delay/if
const [ls, le] = fr.blockLines.get(led.id);
assert('granularité LED : 2 lignes (commentaire + code)', le - ls === 1);
assert('granularité LED : NE contient PAS le delay ni le if',
  !frLines.slice(ls, le + 1).join('\n').includes('delay') &&
  !frLines.slice(ls, le + 1).join('\n').includes('if ('));

// delay mappe commentaire + sa propre action
const [ds, de] = fr.blockLines.get(del.id);
assert('granularité delay : commentaire + delay(500)', de - ds === 1 && frLines[de].includes('delay(500)') && frLines[ds].includes('Pause'));

// if mappe son bloc complet (commentaire + if{...+else})
const [is2, ie] = fr.blockLines.get(ifb.id);
const ifChunk = frLines.slice(is2, ie + 1).join('\n');
assert('granularité if : contient la condition et else', ifChunk.includes('analogRead(A0) > 500') && ifChunk.includes('else {'));

// Chaque bloc map existe et la ligne 0 ne mappe aucun bloc
assert('map couvre 3 blocs', fr.blockLines.size === 3);

// EN : commentaires anglais
const en = buildSketchMapped(ws, arduinoGenerator, 'en');
assert('EN : annotation LED anglaise', en.code.includes('// Controls the on-board LED (pin 13)'));
assert('EN : annotation delay anglaise', en.code.includes('// Pause for 500 ms'));

// buildSketch (source de vérité compile) == version mapped' code (même fr par défaut)
assert('buildSketch == buildSketchMapped(fr).code', buildSketch(ws, arduinoGenerator) === fr.code);

console.log('\ndone');
