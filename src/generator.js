import * as BlocklyNS from 'blockly/core';
/* Portable navigateur / Node (CJS core-node.js -> .default). */
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);

/* Générateur Arduino maison (le nouveau Blockly n'en inclut AUCUN).
   Produit setup() { pinMode... } + loop() { ... }. */
export const arduinoGenerator = new Blockly.Generator('Arduino');
Object.assign(arduinoGenerator, {
  ORDER_NONE: 99, ORDER_ATOMIC: 0, ORDER_UNARY: 10,
  ORDER_MULTIPLICATIVE: 20, ORDER_ADDITIVE: 30, ORDER_RELATIONAL: 40,
  ORDER_LOGICAL_NOT: 50, ORDER_LOGICAL_AND: 60, ORDER_LOGICAL_OR: 70,
  ORDER_ASSIGNMENT: 80,
});

/* ---- handlers Arduino I/O ---- */
arduinoGenerator.forBlock['arduino_led'] = function (block, generator) {
  return 'digitalWrite(LED_BUILTIN, ' + block.getFieldValue('STAT') + ');\n';
};
arduinoGenerator.forBlock['arduino_digital_write'] = function (block) {
  return 'digitalWrite(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('STAT') + ');\n';
};
arduinoGenerator.forBlock['arduino_analog_read'] = function (block) {
  return ['analogRead(' + block.getFieldValue('PIN') + ')', arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_digital_read'] = function (block) {
  return ['digitalRead(' + block.getFieldValue('PIN') + ')', arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_highlow'] = function (block) {
  return [block.getFieldValue('VAL'), arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_delay'] = function (block) {
  return 'delay(' + block.getFieldValue('MS') + ');\n';
};
arduinoGenerator.forBlock['arduino_if'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'IF0', arduinoGenerator.ORDER_NONE) || 'false';
  const then = generator.statementToCode(block, 'DO0');
  const els = generator.statementToCode(block, 'ELSE');
  let code = 'if (' + cond + ') {\n' + then + '}\n';
  if (els.trim()) code += 'else {\n' + els + '}\n';
  return code;
};

/* ---- PWM / sons / servo ---- */
arduinoGenerator.forBlock['arduino_analog_write'] = function (block) {
  return 'analogWrite(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('VAL') + ');\n';
};
arduinoGenerator.forBlock['arduino_tone'] = function (block) {
  return 'tone(' + block.getFieldValue('PIN') + ', ' + block.getFieldValue('FREQ') + ');\n';
};
arduinoGenerator.forBlock['arduino_notone'] = function (block) {
  return 'noTone(' + block.getFieldValue('PIN') + ');\n';
};
arduinoGenerator.forBlock['arduino_servo'] = function (block) {
  const pin = block.getFieldValue('PIN');
  return 'servo_' + pin + '.write(' + block.getFieldValue('DEG') + ');\n';
};

/* ---- variables typées ---- */
arduinoGenerator.forBlock['arduino_var_create'] = function () { return ''; }; // déclaration émise dans le préambule
arduinoGenerator.forBlock['arduino_var_set'] = function (block, generator) {
  const v = generator.valueToCode(block, 'V', arduinoGenerator.ORDER_ASSIGNMENT) || '0';
  return block.getFieldValue('VAR') + ' = ' + v + ';\n';
};
arduinoGenerator.forBlock['arduino_var_change'] = function (block) {
  return block.getFieldValue('VAR') + ' += ' + block.getFieldValue('DELTA') + ';\n';
};
arduinoGenerator.forBlock['arduino_var_get'] = function (block) {
  return [block.getFieldValue('VAR'), arduinoGenerator.ORDER_ATOMIC];
};

/* ---- série ---- */
arduinoGenerator.forBlock['arduino_serial_init'] = function () { return ''; }; // émise dans setup (preamble)
arduinoGenerator.forBlock['arduino_serial_print'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', arduinoGenerator.ORDER_NONE) || '""';
  return 'Serial.println(' + text + ');\n';
};
arduinoGenerator.forBlock['arduino_serial_read'] = function () {
  return ['(int)Serial.read()', arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_serial_available'] = function () {
  return ['Serial.available()', arduinoGenerator.ORDER_ATOMIC];
};

/* ---- textes ---- */
arduinoGenerator.forBlock['arduino_text'] = function (block) {
  const t = block.getFieldValue('TEXT') || '';
  return ['"' + t.replace(/"/g, '\\"') + '"', arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_text_append'] = function (block, generator) {
  const v = block.getFieldValue('VAR');
  const text = generator.valueToCode(block, 'TEXT', arduinoGenerator.ORDER_NONE) || '""';
  return v + ' += ' + text + ';\n';
};
arduinoGenerator.forBlock['arduino_text_length'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', arduinoGenerator.ORDER_NONE) || '""';
  return [text + '.length()', arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['arduino_text_equals'] = function (block, generator) {
  const O = arduinoGenerator.ORDER_RELATIONAL;
  const a = generator.valueToCode(block, 'A', O) || '""';
  const b = generator.valueToCode(block, 'B', O) || '""';
  return [a + ' == ' + b, O];
};

/* ---- fonctions ---- */
arduinoGenerator.forBlock['arduino_function'] = function (block, generator) {
  const name = block.getFieldValue('NAME') || 'maFonction';
  const body = generator.statementToCode(block, 'BODY');
  return 'void ' + name + '() {\n' + body + '}\n';
};
arduinoGenerator.forBlock['arduino_function_call'] = function (block) {
  return block.getFieldValue('NAME') + '();\n';
};

/* ---- boucle tant que + maths de base ---- */
arduinoGenerator.forBlock['controls_whileUntil'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'BOOL', arduinoGenerator.ORDER_NONE) || 'false';
  const body = generator.statementToCode(block, 'DO');
  const inv = block.getFieldValue('MODE') === 'UNTIL' ? '!' : '';
  return 'while (' + inv + cond + ') {\n' + body + '}\n';
};
arduinoGenerator.forBlock['math_arithmetic'] = function (block, generator) {
  const O = arduinoGenerator.ORDER_ADDITIVE;
  const op = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' }[block.getFieldValue('OP')];
  const a = generator.valueToCode(block, 'A', O) || '0';
  const b = generator.valueToCode(block, 'B', O) || '0';
  if (op === '**') return ['pow(' + a + ', ' + b + ')', arduinoGenerator.ORDER_ATOMIC];
  return [a + ' ' + op + ' ' + b, O];
};
arduinoGenerator.forBlock['math_modulo'] = function (block, generator) {
  const O = arduinoGenerator.ORDER_MULTIPLICATIVE;
  const a = generator.valueToCode(block, 'DIVIDEND', O) || '0';
  const b = generator.valueToCode(block, 'DIVISOR', O) || '1';
  return [a + ' % ' + b, O];
};
arduinoGenerator.forBlock['math_random_int'] = function (block, generator) {
  const a = generator.valueToCode(block, 'FROM', arduinoGenerator.ORDER_NONE) || '0';
  const b = generator.valueToCode(block, 'TO', arduinoGenerator.ORDER_NONE) || '100';
  return ['random(' + a + ', ' + b + ' + 1)', arduinoGenerator.ORDER_ATOMIC];
};

/* ---- handlers logique de base (blocs de `blockly/blocks`) ---- */
arduinoGenerator.forBlock['controls_repeat'] = function (block, generator) {
  const times = block.getFieldValue('TIMES') || '0';
  const branch = generator.statementToCode(block, 'DO');
  return 'for (int _i = 0; _i < ' + times + '; _i++) {\n' + branch + '}\n';
};
arduinoGenerator.forBlock['controls_repeat_ext'] = arduinoGenerator.forBlock['controls_repeat'];
arduinoGenerator.forBlock['logic_compare'] = function (block, generator) {
  const O = arduinoGenerator.ORDER_RELATIONAL;
  const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[block.getFieldValue('OP')];
  const a = generator.valueToCode(block, 'A', O) || '0';
  const b = generator.valueToCode(block, 'B', O) || '0';
  return [a + ' ' + op + ' ' + b, O];
};
arduinoGenerator.forBlock['logic_operation'] = function (block, generator) {
  const O = arduinoGenerator.ORDER_LOGICAL_AND;
  const a = generator.valueToCode(block, 'A', O) || 'false';
  const b = generator.valueToCode(block, 'B', O) || 'false';
  const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||';
  return [a + ' ' + op + ' ' + b, O];
};
arduinoGenerator.forBlock['logic_negate'] = function (block, generator) {
  const a = generator.valueToCode(block, 'BOOL', arduinoGenerator.ORDER_LOGICAL_NOT) || 'false';
  return ['!' + a, arduinoGenerator.ORDER_LOGICAL_NOT];
};
arduinoGenerator.forBlock['logic_boolean'] = function (block) {
  return [block.getFieldValue('BOOL'), arduinoGenerator.ORDER_ATOMIC];
};
arduinoGenerator.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), arduinoGenerator.ORDER_ATOMIC];
};

/* scrubbing : chaîne le bloc suivant (le CodeGenerator de base est un no-op,
   sans quoi seul le premier bloc est émis). */
arduinoGenerator.scrub_ = function (block, code, opt_thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = opt_thisOnly ? '' : this.blockToCode(nextBlock);
  return code + nextCode;
};

/* ---- assemblage : préambule (includes/globaux) + setup() + loop() ---- */
/** Déduit le mode (OUTPUT/INPUT) de chaque pin digitale depuis les blocs du workspace.
    Source de vérité partagée entre le C++ généré (setup pinMode) et le simulateur
    (affichage dynamique bouton/LED par pin). */
export function collectPinModes(ws) {
  const pins = new Map();      // pin (string) -> 'OUTPUT' | 'INPUT'
  for (const b of ws.getAllBlocks()) {
    if (!b.type) continue;
    if (b.type === 'arduino_digital_write') pins.set(b.getFieldValue('PIN'), 'OUTPUT');
    else if (b.type === 'arduino_digital_read') pins.set(b.getFieldValue('PIN'), 'INPUT');
    else if (b.type === 'arduino_led') pins.set('13', 'OUTPUT');
    else if (b.type === 'arduino_analog_write') pins.set(b.getFieldValue('PIN'), 'PWM');
  }
  return pins;
}

export function collectPreamble(ws, gen) {
  const globals = [];          // ex: 'int valeur = 0;', 'Servo servo_9;'
  const setupLines = [];       // ex: 'pinMode(9, OUTPUT);', 'servo_9.attach(9);', 'Serial.begin(9600);'
  const pins = collectPinModes(ws); // pin -> mode OUTPUT/INPUT (digital)
    const servos = new Set();    // pins servo (globaux + attach)
        const varTypes = new Map();  // nom -> 'number' | 'text' (déclaré ou déduit)
        let baud = null;

        for (const b of ws.getAllBlocks()) {
          if (!b.type) continue;
          if (b.type === 'arduino_digital_write') pins.set(b.getFieldValue('PIN'), 'OUTPUT');
          else if (b.type === 'arduino_digital_read') pins.set(b.getFieldValue('PIN'), 'INPUT');
          else if (b.type === 'arduino_servo') servos.add(b.getFieldValue('PIN'));
          else if (b.type === 'arduino_var_create') {
            const n = b.getFieldValue('NAME');
            if (n) varTypes.set(n, b.getFieldValue('TYPE') === 'text' ? 'text' : 'number');
          }
          else if (b.type === 'arduino_var_set' || b.type === 'arduino_var_get' || b.type === 'arduino_var_change') {
            const n = b.getFieldValue('VAR');
            if (n && !varTypes.has(n)) varTypes.set(n, 'number');
          }
          else if (b.type === 'arduino_text_append') {
            const n = b.getFieldValue('VAR');
            if (n && !varTypes.has(n)) varTypes.set(n, 'text');
          }
          else if (b.type === 'arduino_serial_init' && baud == null) baud = b.getFieldValue('BAUD');
        }

        if (servos.size) {
          globals.push('#include <Servo.h>');
          for (const pin of servos) {
            globals.push('Servo servo_' + pin + ';');
            setupLines.push('servo_' + pin + '.attach(' + pin + ');');
          }
        }
        for (const [pin, mode] of pins) setupLines.push('pinMode(' + pin + ', ' + (mode === 'PWM' ? 'OUTPUT' : mode) + ');');
        for (const [v, t] of varTypes) globals.push(t === 'text' ? 'String ' + v + ' = "";' : 'int ' + v + ' = 0;');
        if (baud != null) setupLines.unshift('Serial.begin(' + baud + ');');

  return { globals: globals.join('\n') + (globals.length ? '\n' : ''), setupLines };
}

/* N'émet que les blocs-racines STATEMENTS (qui ont une suite next/prev) : un bloc
   "valeur" laissé orphelin (Nombre, Lire analogique…) générerait une ligne nue
   (`42` ou `analogRead(A0)` sans `;`) qui casse la compile. On le saute. */
function emitRoots(gen, ws) {
  let code = '';
  for (const b of ws.getTopBlocks(true)) {
    if (b.outputConnection) continue; // bloc-valeur orphelin
    code += gen.blockToCode(b) || '';
  }
  return code;
}

/* Sépare les définitions de fonction (arduino_function) du corps de loop() :
   une définition `void f() {...}` ne peut PAS vivre dans loop() (C++ invalide).
   Elles sont émises comme fonctions globales, avant setup(). */
function splitFunctions(gen, ws) {
  let loop = '';
  let funcs = '';
  for (const b of ws.getTopBlocks(true)) {
    if (b.outputConnection) continue; // bloc-valeur orphelin
    const code = gen.blockToCode(b) || '';
    if (b.type === 'arduino_function') funcs += code;
    else loop += code;
  }
  return { loop, funcs };
}

export function buildSketch(ws, generator) {
  const gen = generator || arduinoGenerator;
  const { loop, funcs } = splitFunctions(gen, ws);
  const ind = (s) => s.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
  const pre = collectPreamble(ws, gen);
  const header = '// Arduino Blocks — généré avec Blockly 13.3\n';
  const setup = 'void setup() {\n' + (pre.setupLines.length ? ind(pre.setupLines.join('\n')) + '\n' : '') + '}\n';
  const loopF = 'void loop() {\n' + (loop ? ind(loop) : '') + '}\n';
  return header + pre.globals + funcs + setup + '\n' + loopF;
}