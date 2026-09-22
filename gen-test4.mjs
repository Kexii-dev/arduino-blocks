// Validation des variables typées (nombre | texte) — Blockly 13.3
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks } from './src/blocks.js';
import { arduinoGenerator, buildSketch } from './src/generator.js';
import { declareVar } from './src/vars.js';

const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
Blockly.setLocale(Fr);
defineArduinoBlocks();
const ws = new Blockly.Workspace();
const mk = (t) => ws.newBlock(t);
let prev = null;
function add(b) { if (prev) prev.nextConnection.connect(b.previousConnection); prev = b; return b; }

// déclare les variables (comme le ferait le bloc "créer la variable")
declareVar('compteur', 'number');
declareVar('message', 'text');

// --- chaîne principale ---
const createN = add(mk('arduino_var_create')); createN.setFieldValue('compteur', 'NAME'); createN.setFieldValue('number', 'TYPE');
const createT = add(mk('arduino_var_create')); createT.setFieldValue('message', 'NAME'); createT.setFieldValue('text', 'TYPE');

const setN = add(mk('arduino_var_set')); setN.setFieldValue('compteur', 'VAR');
const num = mk('math_number'); num.setFieldValue(5, 'NUM');
setN.getInput('V').connection.connect(num.outputConnection);

const setT = add(mk('arduino_var_set')); setT.setFieldValue('message', 'VAR');
const txt = mk('arduino_text'); txt.setFieldValue('Bonjour', 'TEXT');
setT.getInput('V').connection.connect(txt.outputConnection);

const chg = add(mk('arduino_var_change')); chg.setFieldValue('compteur', 'VAR'); chg.setFieldValue(1, 'DELTA');

const append = add(mk('arduino_text_append')); append.setFieldValue('message', 'VAR');
const txt2 = mk('arduino_text'); txt2.setFieldValue(' !', 'TEXT');
append.getInput('TEXT').connection.connect(txt2.outputConnection);

const print = add(mk('arduino_serial_print'));
const getN = mk('arduino_var_get'); getN.setFieldValue('compteur', 'VAR');
print.getInput('TEXT').connection.connect(getN.outputConnection);

const out = buildSketch(ws, arduinoGenerator);
console.log('===== C++ généré =====\n' + out + '\n======================');
const a = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };

a('int compteur = 0; (nombre)', out.includes('int compteur = 0;'));
a('String message = ""; (texte)', out.includes('String message = "";'));
a('compteur = 5;', out.includes('compteur = 5;'));
a('message = "Bonjour";', out.includes('message = "Bonjour";'));
a('compteur += 1;', out.includes('compteur += 1;'));
a('message += " !";', out.includes('message += " !";'));
a('Serial.println(compteur)', out.includes('Serial.println(compteur);'));
a('bloc créer ne génère PAS de ligne dans loop', !out.includes('créer'));
a('pas de fonction parasite (void compteur/message)', !out.includes('void compteur') && !out.includes('void message'));

console.log('done');
