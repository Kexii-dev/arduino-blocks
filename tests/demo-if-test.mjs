// Valide la démo SI (même XML que le POC) → C++ attendu
import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Fr from 'blockly/msg/fr';
import { defineArduinoBlocks, arduinoGenerator, buildSketch } from '../src/arduino.js';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
Blockly.setLocale(Fr);
defineArduinoBlocks();

const xml =
  '<xml xmlns="https://developers.google.com/blockly/xml">'
  + '<block type="arduino_led"><field name="STAT">HIGH</field>'
  + '<next><block type="arduino_delay"><field name="MS">1000</field>'
  + '<next><block type="arduino_if">'
  + '<value name="IF0"><block type="logic_compare"><field name="OP">GT</field>'
  + '<value name="A"><block type="arduino_analog_read"><field name="PIN">A0</field></block></value>'
  + '<value name="B"><block type="math_number"><field name="NUM">500</field></block></value>'
  + '</block></value>'
  + '<statement name="DO0"><block type="arduino_led"><field name="STAT">HIGH</field></block></statement>'
  + '<statement name="ELSE"><block type="arduino_led"><field name="STAT">LOW</field></block></statement>'
  + '</block></next></next></block>'
  + '</xml>';

const ws = new Blockly.Workspace();
const dom = Blockly.utils.xml.textToDom(xml);
Blockly.Xml.domToWorkspace(dom, ws);

console.log('blocs chargés:', ws.getAllBlocks().length);
const out = buildSketch(ws, arduinoGenerator);
console.log(out);
const a = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };
a('delay(1000)', /delay\(1000\)/.test(out));
a('if (analogRead(A0) > 500)', /if \(analogRead\(A0\) > 500\) \{/.test(out));
a('else {', out.includes('else {'));
a('LED HIGH (alors)', out.includes('digitalWrite(LED_BUILTIN, HIGH);'));
a('LED LOW (sinon)', out.includes('digitalWrite(LED_BUILTIN, LOW);'));
console.log('\ndone');
