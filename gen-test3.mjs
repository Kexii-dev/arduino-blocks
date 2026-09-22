// Validation des blocs Textes + Fonctions (Blockly 13.3)
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks } from './src/blocks.js';
import { arduinoGenerator, buildSketch } from './src/generator.js';

const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
Blockly.setLocale(Fr);
defineArduinoBlocks();
const ws = new Blockly.Workspace();
const mk = (t) => ws.newBlock(t);
let prev = null;
function add(b) { if (prev) prev.nextConnection.connect(b.previousConnection); prev = b; return b; }

// --- chaîne principale (statements) ---
const print1 = add(mk('arduino_serial_print'));
const txt1 = mk('arduino_text'); txt1.setFieldValue('Bonjour', 'TEXT');
print1.getInput('TEXT').connection.connect(txt1.outputConnection);

const append = add(mk('arduino_text_append')); append.setFieldValue('message', 'VAR');
const txt2 = mk('arduino_text'); txt2.setFieldValue(' le monde', 'TEXT');
append.getInput('TEXT').connection.connect(txt2.outputConnection);

const print2 = add(mk('arduino_serial_print'));
const len = mk('arduino_text_length');
const txt3 = mk('arduino_text'); txt3.setFieldValue('abc', 'TEXT');
len.getInput('TEXT').connection.connect(txt3.outputConnection);
print2.getInput('TEXT').connection.connect(len.outputConnection);

const print3 = add(mk('arduino_serial_print'));
const eq = mk('arduino_text_equals');
const ta = mk('arduino_text'); ta.setFieldValue('a', 'TEXT');
const tb = mk('arduino_text'); tb.setFieldValue('b', 'TEXT');
eq.getInput('A').connection.connect(ta.outputConnection);
eq.getInput('B').connection.connect(tb.outputConnection);
print3.getInput('TEXT').connection.connect(eq.outputConnection);

const call = add(mk('arduino_function_call')); call.setFieldValue('clignoter', 'NAME');

// --- définition de fonction (racine séparée) ---
const fn = ws.newBlock('arduino_function'); fn.setFieldValue('clignoter', 'NAME');
const led = ws.newBlock('arduino_led'); led.setFieldValue('HIGH', 'STAT');
fn.getInput('BODY').connection.connect(led.previousConnection);
const del = ws.newBlock('arduino_delay'); del.setFieldValue(500, 'MS');
led.nextConnection.connect(del.previousConnection);

const out = buildSketch(ws, arduinoGenerator);
console.log('===== C++ généré =====\n' + out + '\n======================');
const a = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };

// textes
a('texte "Bonjour"', out.includes('"Bonjour"'));
a('Serial.println("Bonjour")', out.includes('Serial.println("Bonjour");'));
a('String message = ""; (preamble)', out.includes('String message = "";'));
a('message += " le monde";', out.includes('message += " le monde";'));
a('"abc".length()', out.includes('"abc".length()'));
a('"a" == "b"', out.includes('"a" == "b"'));

// fonctions
a('void clignoter() {', out.includes('void clignoter() {'));
a('clignoter(); (appel dans loop)', out.includes('clignoter();'));
a('fonction définie AVANT setup()', out.indexOf('void clignoter()') < out.indexOf('void setup()'));
a('fonction PAS dans loop()', out.indexOf('void clignoter()') < out.indexOf('void loop()'));
a('corps de la fonction (digitalWrite LED)', out.includes('digitalWrite(LED_BUILTIN, HIGH);'));
a('delay(500) dans la fonction', out.includes('delay(500);'));

console.log('done');
