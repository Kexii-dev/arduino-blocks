// Validation headless du générateur Arduino — workspace sans DOM.
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks'; // contrôles/conditions par défaut
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks } from '../src/blocks.js';
import { arduinoGenerator, buildSketch } from '../src/generator.js';

// Portable Node/navigateur
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);

Blockly.setLocale(Fr);
defineArduinoBlocks();

const ws = new Blockly.Workspace();

/* Cas 1 : LED + attente + réécriture broche */
const led = ws.newBlock('arduino_led');
led.setFieldValue('LOW', 'STAT');
const del = ws.newBlock('arduino_delay');
del.setFieldValue(500, 'MS');
led.nextConnection.connect(del.previousConnection);
const dw = ws.newBlock('arduino_digital_write');
dw.setFieldValue('9', 'PIN');
dw.setFieldValue('HIGH', 'STAT');
del.nextConnection.connect(dw.previousConnection);

/* Cas 2 : condition analogRead(A0) > 500 avec sinon (notre bloc arduino_if) */
const ifb = ws.newBlock('arduino_if');

const cmp = ws.newBlock('logic_compare');
cmp.setFieldValue('GT', 'OP');
const ar = ws.newBlock('arduino_analog_read');
ar.setFieldValue('A0', 'PIN');
cmp.getInput('A').connection.connect(ar.outputConnection);
const num = ws.newBlock('math_number');
num.setFieldValue(500, 'NUM');
cmp.getInput('B').connection.connect(num.outputConnection);
ifb.getInput('IF0').connection.connect(cmp.outputConnection);

const led2 = ws.newBlock('arduino_led'); led2.setFieldValue('HIGH', 'STAT');
ifb.getInput('DO0').connection.connect(led2.previousConnection);
const led3 = ws.newBlock('arduino_led'); led3.setFieldValue('LOW', 'STAT');
ifb.getInput('ELSE').connection.connect(led3.previousConnection);

led.nextConnection.connect(ifb.previousConnection);

const out = buildSketch(ws, arduinoGenerator);
console.log(out);

const assert = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) process.exitCode = 1; };
assert('pinMode setup pour broche 9', /pinMode\(9, OUTPUT\)/.test(out));
assert('LED_BUILTIN LOW dans loop', /digitalWrite\(LED_BUILTIN, LOW\)/.test(out));
assert('delay(500)', /delay\(500\)/.test(out));
assert('digitalWrite(9, HIGH)', /digitalWrite\(9, HIGH\)/.test(out));
assert('condition analogRead(A0) > 500', /analogRead\(A0\) > 500/.test(out));
assert('branche if { ... }', out.includes('if (analogRead(A0) > 500) {'));
assert('branche else { ... }', out.includes('else {'));
assert('void setup() {', out.includes('void setup() {'));
assert('void loop() {', out.includes('void loop() {'));
console.log('\ndone');
