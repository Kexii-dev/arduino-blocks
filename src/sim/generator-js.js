// Générateur JS pour le simulateur virtuel (Approche 1) — miroir de generator.js
// mais émet du JS exécutable avec une fausse API Arduino (`fake`), pilotée par
// VirtualBoard. Les statements peuvent être async (`await fake.delay(...)`) donc
// l'exécution ne fige jamais l'UI.
import * as BlocklyNS from 'blockly/core';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);

export const jsGenerator = new Blockly.Generator('ArduinoJS');
Object.assign(jsGenerator, {
  ORDER_NONE: 99, ORDER_ATOMIC: 0, ORDER_UNARY: 10,
  ORDER_MULTIPLICATIVE: 20, ORDER_ADDITIVE: 30, ORDER_RELATIONAL: 40,
  ORDER_LOGICAL_NOT: 50, ORDER_LOGICAL_AND: 60, ORDER_LOGICAL_OR: 70,
  ORDER_ASSIGNMENT: 80,
});

// A0..A5 -> channel 0..5 (fake.analogRead prend un channel numérique).
const A_CH = { A0: 0, A1: 1, A2: 2, A3: 3, A4: 4, A5: 5 };

jsGenerator.forBlock['arduino_led'] = function (block) {
  return 'await fake.digitalWrite(13, ' + block.getFieldValue('STAT') + ');\n';
};
jsGenerator.forBlock['arduino_digital_write'] = function (block) {
  return 'await fake.digitalWrite(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('STAT') + ');\n';
};
jsGenerator.forBlock['arduino_analog_read'] = function (block) {
  const ch = A_CH[block.getFieldValue('PIN')] ?? 0;
  return ['fake.analogRead(' + ch + ')', jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_digital_read'] = function (block) {
  return ['fake.digitalRead(' + block.getFieldValue('PIN') + ')', jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_highlow'] = function (block) {
  return [block.getFieldValue('VAL'), jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_delay'] = function (block) {
  return 'await fake.delay(' + block.getFieldValue('MS') + ');\n';
};
jsGenerator.forBlock['arduino_if'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'IF0', jsGenerator.ORDER_NONE) || 'false';
  const then = generator.statementToCode(block, 'DO0');
  const els = generator.statementToCode(block, 'ELSE');
  let code = 'if (' + cond + ') {\n' + then + '}\n';
  if (els.trim()) code += 'else {\n' + els + '}\n';
  return code;
};
jsGenerator.forBlock['arduino_analog_write'] = function (block) {
  return 'await fake.analogWrite(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('VAL') + ');\n';
};
jsGenerator.forBlock['arduino_tone'] = function (block) {
  return 'await fake.tone(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('FREQ') + ');\n';
};
jsGenerator.forBlock['arduino_notone'] = function (block) {
  return 'await fake.noTone(' + block.getFieldValue('PIN') + ');\n';
};
jsGenerator.forBlock['arduino_servo'] = function (block) {
  return 'await fake.servo(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('DEG') + ');\n';
};

/* variables typées */
jsGenerator.forBlock['arduino_var_create'] = function () { return ''; };
jsGenerator.forBlock['arduino_var_set'] = function (block, generator) {
  const v = generator.valueToCode(block, 'V', jsGenerator.ORDER_ASSIGNMENT) || '0';
  return block.getFieldValue('VAR') + ' = ' + v + ';\n';
};
jsGenerator.forBlock['arduino_var_change'] = function (block) {
  return block.getFieldValue('VAR') + ' += ' + block.getFieldValue('DELTA') + ';\n';
};
jsGenerator.forBlock['arduino_var_get'] = function (block) {
  return [block.getFieldValue('VAR'), jsGenerator.ORDER_ATOMIC];
};

/* série */
jsGenerator.forBlock['arduino_serial_init'] = function () { return ''; };
jsGenerator.forBlock['arduino_serial_print'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', jsGenerator.ORDER_NONE) || '""';
  return 'await fake.serialPrint(' + text + ');\n';
};
jsGenerator.forBlock['arduino_serial_read'] = function () {
  return ['fake.serialRead()', jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_serial_available'] = function () {
  return ['fake.serialAvailable()', jsGenerator.ORDER_ATOMIC];
};

/* textes */
jsGenerator.forBlock['arduino_text'] = function (block) {
  const t = block.getFieldValue('TEXT') || '';
  return ['"' + t.replace(/"/g, '\\"') + '"', jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_text_append'] = function (block, generator) {
  const v = block.getFieldValue('VAR');
  const text = generator.valueToCode(block, 'TEXT', jsGenerator.ORDER_NONE) || '""';
  return v + ' += ' + text + ';\n';
};
jsGenerator.forBlock['arduino_text_length'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', jsGenerator.ORDER_NONE) || '""';
  return [text + '.length', jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['arduino_text_equals'] = function (block, generator) {
  const O = jsGenerator.ORDER_RELATIONAL;
  const a = generator.valueToCode(block, 'A', O) || '""';
  const b = generator.valueToCode(block, 'B', O) || '""';
  return [a + ' === ' + b, O];
};

/* fonctions */
jsGenerator.forBlock['arduino_function'] = function (block, generator) {
  const name = block.getFieldValue('NAME') || 'maFonction';
  const body = generator.statementToCode(block, 'BODY');
  return 'async function ' + name + '() {\n' + body + '}\n';
};
jsGenerator.forBlock['arduino_function_call'] = function (block) {
  return 'await ' + block.getFieldValue('NAME') + '();\n';
};

/* boucle tant que + maths */
jsGenerator.forBlock['controls_whileUntil'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'BOOL', jsGenerator.ORDER_NONE) || 'false';
  const body = generator.statementToCode(block, 'DO');
  const inv = block.getFieldValue('MODE') === 'UNTIL' ? '!' : '';
  return 'while (' + inv + cond + ') {\n' + body + '}\n';
};
jsGenerator.forBlock['math_arithmetic'] = function (block, generator) {
  const O = jsGenerator.ORDER_ADDITIVE;
  const op = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' }[block.getFieldValue('OP')];
  const a = generator.valueToCode(block, 'A', O) || '0';
  const b = generator.valueToCode(block, 'B', O) || '0';
  if (op === '**') return ['Math.pow(' + a + ', ' + b + ')', jsGenerator.ORDER_ATOMIC];
  return [a + ' ' + op + ' ' + b, O];
};
jsGenerator.forBlock['math_modulo'] = function (block, generator) {
  const O = jsGenerator.ORDER_MULTIPLICATIVE;
  const a = generator.valueToCode(block, 'DIVIDEND', O) || '0';
  const b = generator.valueToCode(block, 'DIVISOR', O) || '1';
  return [a + ' % ' + b, O];
};
jsGenerator.forBlock['math_random_int'] = function (block, generator) {
  const a = generator.valueToCode(block, 'FROM', jsGenerator.ORDER_NONE) || '0';
  const b = generator.valueToCode(block, 'TO', jsGenerator.ORDER_NONE) || '100';
  return ['Math.floor(Math.random() * (' + b + ' - ' + a + ' + 1)) + ' + a, jsGenerator.ORDER_ATOMIC];
};

/* logique + boucles (blocs de blockly/blocks) */
jsGenerator.forBlock['controls_repeat'] = function (block, generator) {
  const times = block.getFieldValue('TIMES') || '0';
  const branch = generator.statementToCode(block, 'DO');
  return 'for (let _i = 0; _i < ' + times + '; _i++) {\n' + branch + '}\n';
};
jsGenerator.forBlock['controls_repeat_ext'] = jsGenerator.forBlock['controls_repeat'];
jsGenerator.forBlock['logic_compare'] = function (block, generator) {
  const O = jsGenerator.ORDER_RELATIONAL;
  const op = { EQ: '===', NEQ: '!==', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[block.getFieldValue('OP')];
  const a = generator.valueToCode(block, 'A', O) || '0';
  const b = generator.valueToCode(block, 'B', O) || '0';
  return [a + ' ' + op + ' ' + b, O];
};
jsGenerator.forBlock['logic_operation'] = function (block, generator) {
  const O = jsGenerator.ORDER_LOGICAL_AND;
  const a = generator.valueToCode(block, 'A', O) || 'false';
  const b = generator.valueToCode(block, 'B', O) || 'false';
  const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||';
  return [a + ' ' + op + ' ' + b, O];
};
jsGenerator.forBlock['logic_negate'] = function (block, generator) {
  const a = generator.valueToCode(block, 'BOOL', jsGenerator.ORDER_LOGICAL_NOT) || 'false';
  return ['!' + a, jsGenerator.ORDER_LOGICAL_NOT];
};
jsGenerator.forBlock['logic_boolean'] = function (block) {
  return [block.getFieldValue('BOOL'), jsGenerator.ORDER_ATOMIC];
};
jsGenerator.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), jsGenerator.ORDER_ATOMIC];
};

jsGenerator.scrub_ = function (block, code, opt_thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = opt_thisOnly ? '' : this.blockToCode(nextBlock);
  return code + nextCode;
};

/* ---- assemblage : globals + setup() + loop() en JS ---- */
export function collectJsPreamble(ws) {
  const globals = [];
  const setupLines = [];
  const varTypes = new Map();
  for (const b of ws.getAllBlocks()) {
    if (!b.type) continue;
    if (b.type === 'arduino_var_create') {
      const n = b.getFieldValue('NAME');
      if (n) varTypes.set(n, b.getFieldValue('TYPE') === 'text' ? 'text' : 'number');
    } else if (b.type === 'arduino_var_set' || b.type === 'arduino_var_get' || b.type === 'arduino_var_change') {
      const n = b.getFieldValue('VAR');
      if (n && !varTypes.has(n)) varTypes.set(n, 'number');
    } else if (b.type === 'arduino_text_append') {
      const n = b.getFieldValue('VAR');
      if (n && !varTypes.has(n)) varTypes.set(n, 'text');
    }
  }
  for (const [v, t] of varTypes) globals.push(t === 'text' ? 'let ' + v + ' = "";' : 'let ' + v + ' = 0;');
  return { globals: globals.join('\n') + (globals.length ? '\n' : ''), setupLines };
}

function splitFunctions(gen, ws) {
  let loop = '';
  let funcs = '';
  for (const b of ws.getTopBlocks(true)) {
    if (b.outputConnection) continue;
    const code = gen.blockToCode(b) || '';
    if (b.type === 'arduino_function') funcs += code;
    else loop += code;
  }
  return { loop, funcs };
}

export function buildJsProgram(ws, generator) {
  const gen = generator || jsGenerator;
  const { loop, funcs } = splitFunctions(gen, ws);
  const ind = (s) => s.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
  const pre = collectJsPreamble(ws);
  const setup = 'async function setup() {\n' + (pre.setupLines.length ? ind(pre.setupLines.join('\n')) + '\n' : '') + '}\n';
  const loopF = 'async function loop() {\n' + (loop ? ind(loop) : '') + '}\n';
  return pre.globals + funcs + setup + '\n' + loopF;
}