// Exemples pensés pour le simulateur : C++ attendu + comportement en simulation virtuelle.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { arduinoGenerator, buildSketch } from '../src/generator.js';
import { jsGenerator } from '../src/sim/generator-js.js';
import { VirtualEngine } from '../src/sim/engine-virtual.js';
import { VirtualBoard } from '../src/sim/board.js';
import { EXAMPLES } from '../src/examples.js';

Blockly.setLocale(Fr);
defineArduinoBlocks();
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const byId = Object.fromEntries(EXAMPLES.flatMap((g) => g.items.map((it) => [it.id, it])));

/** Construit l'exemple, renvoie le C++ et un moteur virtuel prêt (vitesse ×10). */
function load(id) {
  const ws = new Blockly.Workspace();
  byId[id].build(ws);
  const code = buildSketch(ws, arduinoGenerator);
  const board = new VirtualBoard();
  const log = { servo: [], tone: [], serial: '', pins: {} };
  board.onChange = (k, p) => {
    if (k === 'servo') log.servo.push(p.deg);
    if (k === 'tone') log.tone.push(p.freq);
    if (k === 'serial') log.serial += p.text;
    if (k === 'digital') log.pins[p.pin] = p.value;
  };
  const errors = [];
  const eng = new VirtualEngine(ws, jsGenerator, board, { speed: 10, onError: (e) => errors.push(String(e)) });
  return { code, board, log, eng, errors };
}

for (const id of ['barriere', 'sonnette', 'essuieglace', 'compteappuis', 'commande']) {
  ok(!!byId[id], 'exemple « ' + id + ' » présent dans le catalogue');
}

console.log('barrière de parking');
{
  const { code, board, log, eng, errors } = load('barriere');
  ok(/#include <Servo.h>/.test(code) && /servo_9\.write\(90\)/.test(code) && /pinMode\(4, OUTPUT\)/.test(code), 'C++ : Servo, write(90), pinMode(4)');
  eng.start();
  await wait(30);
  ok(log.servo.at(-1) === 0 && log.pins[4] === 0, 'repos : servo 0°, D4 éteinte');
  board.setButton(2, 1); await wait(30);
  ok(log.servo.at(-1) === 90 && log.pins[4] === 1, 'bouton enfoncé : servo 90°, D4 allumée');
  board.setButton(2, 0); await wait(30);
  ok(log.servo.at(-1) === 0, 'relâché : servo revient à 0°');
  eng.stop();
  ok(!errors.length, 'aucune erreur (' + errors.join(', ') + ')');
}

console.log('sonnette');
{
  const { code, board, log, eng, errors } = load('sonnette');
  ok(/tone\(11, 880\)/.test(code) && /noTone\(11\)/.test(code), 'C++ : tone(11, 880) / noTone(11)');
  eng.start();
  board.setButton(2, 1); await wait(30);
  ok(log.tone.at(-1) === 880, 'enfoncé : 880 Hz');
  board.setButton(2, 0); await wait(30);
  ok(log.tone.at(-1) === null, 'relâché : silence');
  eng.stop();
  ok(!errors.length, 'aucune erreur');
}

console.log('essuie-glace');
{
  const { code, log, eng, errors } = load('essuieglace');
  ok((code.match(/servo_9\.write/g) || []).length === 8, 'C++ : 8 positions');
  eng.start();
  await wait(250); // 8 × 250 ms à ×10 = 200 ms
  eng.stop();
  ok(log.servo.slice(0, 8).join(',') === '0,45,90,135,180,135,90,45', 'balayage : ' + log.servo.slice(0, 8).join(','));
  ok(!errors.length, 'aucune erreur');
}

console.log('compter les appuis');
{
  const { code, board, log, eng, errors } = load('compteappuis');
  ok(/int appuis = 0;/.test(code) && /appuis \+= 1;/.test(code) && /Serial\.println\(appuis\);/.test(code) && /while \(digitalRead\(2\)\)/.test(code), 'C++ : variable, incrément, println, attente du relâchement');
  eng.start();
  for (let i = 0; i < 2; i++) { board.setButton(2, 1); await wait(40); board.setButton(2, 0); await wait(40); }
  eng.stop();
  ok(log.serial === '1\n2\n', '2 appuis -> « 1 », « 2 » (' + JSON.stringify(log.serial) + ')');
  ok(!errors.length, 'aucune erreur');
}

console.log('commander la LED par la console');
{
  const { code, board, log, eng, errors } = load('commande');
  ok(/Serial\.begin\(9600\)/.test(code) && /lettre = \(int\)Serial\.read\(\);/.test(code) && /if \(lettre == 97\)/.test(code), 'C++ : Serial.read() + comparaison au code 97');
  eng.start();
  board.serialInput('a'.charCodeAt(0)); await wait(40);
  ok(log.pins[13] === 1 && log.serial.includes('LED allumée'), '« a » : LED allumée');
  board.serialInput('e'.charCodeAt(0)); await wait(40);
  ok(log.pins[13] === 0 && log.serial.includes('LED éteinte'), '« e » : LED éteinte');
  eng.stop();
  ok(!errors.length, 'aucune erreur');
}

console.log(fail === 0 ? '\nPASS ' + pass + '/' + (pass + fail) : '\nFAIL ' + fail + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
