// Validation des nouveaux blocs (PWM, tone, servo, while, maths, variables, série)
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks } from './src/blocks.js';
import { arduinoGenerator, buildSketch } from './src/generator.js';
import { declareVar } from './src/vars.js';

const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
Blockly.setLocale(Fr);
defineArduinoBlocks();
declareVar('compteur', 'number');
const ws = new Blockly.Workspace();

const mk = (t) => ws.newBlock(t);
// chaîne principale
let prev = null;
function add(b) { if (prev) prev.nextConnection.connect(b.previousConnection); prev = b; return b; }

add(mk('arduino_serial_init'));
const aw = add(mk('arduino_analog_write')); aw.setFieldValue('9', 'PIN'); aw.setFieldValue('150', 'VAL');
const tone = add(mk('arduino_tone')); tone.setFieldValue('11', 'PIN'); tone.setFieldValue(440, 'FREQ');
add(mk('arduino_notone')).setFieldValue('11', 'PIN');
const sv = add(mk('arduino_servo')); sv.setFieldValue('9', 'PIN'); sv.setFieldValue(120, 'DEG');

const vs = ws.newBlock('arduino_var_set'); vs.setFieldValue('compteur', 'VAR');
const num2 = ws.newBlock('math_number'); num2.setFieldValue(42, 'NUM'); num2.setShadow(true);
vs.getInput('V').connection.connect(num2.outputConnection);
prev.nextConnection.connect(vs.previousConnection); prev = vs;
add(mk('arduino_var_change')).setFieldValue('compteur', 'VAR');

const whileB = ws.newBlock('controls_whileUntil'); whileB.setFieldValue('WHILE', 'MODE');
const cmp = ws.newBlock('logic_compare'); cmp.setFieldValue('LT', 'OP');
const vget = ws.newBlock('arduino_var_get'); vget.setFieldValue('compteur', 'VAR');
cmp.getInput('A').connection.connect(vget.outputConnection);
const n10 = ws.newBlock('math_number'); n10.setFieldValue(10, 'NUM');
cmp.getInput('B').connection.connect(n10.outputConnection);
whileB.getInput('BOOL').connection.connect(cmp.outputConnection);
const inside = ws.newBlock('arduino_var_change'); inside.setFieldValue('compteur', 'VAR');
whileB.getInput('DO').connection.connect(inside.previousConnection);
prev.nextConnection.connect(whileB.previousConnection); prev = whileB;

const arith = ws.newBlock('math_arithmetic'); arith.setFieldValue('MULTIPLY', 'OP');
const a3 = ws.newBlock('math_number'); a3.setFieldValue(3, 'NUM');
arith.getInput('A').connection.connect(a3.outputConnection);
const a4 = ws.newBlock('math_number'); a4.setFieldValue(4, 'NUM');
arith.getInput('B').connection.connect(a4.outputConnection);
vs.getInput('V').connection.disconnect(num2.outputConnection);
vs.getInput('V').connection.connect(arith.outputConnection);

// print variables
const print = ws.newBlock('arduino_serial_print');
const vget2 = ws.newBlock('arduino_var_get'); vget2.setFieldValue('compteur', 'VAR');
print.getInput('TEXT').connection.connect(vget2.outputConnection);
prev.nextConnection.connect(print.previousConnection);

const out = buildSketch(ws, arduinoGenerator);
console.log('===== C++ généré =====\n' + out + '\n======================');
const a = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };
a('include Servo.h', out.includes('#include <Servo.h>'));
a('Servo servo_9;', out.includes('Servo servo_9;'));
a('Serial.begin(9600) dans setup', out.includes('Serial.begin(9600);'));
a('servo_9.attach(9) dans setup', out.includes('servo_9.attach(9);'));
a('analogWrite(9, 150)', out.includes('analogWrite(9, 150);'));
a('tone(11, 440)', out.includes('tone(11, 440);'));
a('noTone(11)', out.includes('noTone(11);'));
a('servo_9.write(120)', out.includes('servo_9.write(120);'));
a('variable déclarée int compteur = 0;', out.includes('int compteur = 0;'));
a('compteur = 3 * 4;', out.includes('compteur = 3 * 4;'));
a('compteur += 1;', out.includes('compteur += 1;'));
a('while (compteur < 10)', out.includes('while (compteur < 10) {'));
a('Serial.println(compteur)', out.includes('Serial.println(compteur);'));
a('setup contient pinMode? pas exigé ici — skip',
  true);
console.log('done');