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

/* ---- assemblage setup()/loop() ---- */
export function collectPinDecls(ws) {
  const pins = new Map();
  for (const b of ws.getAllBlocks()) {
    if (b.type === 'arduino_digital_write') pins.set(b.getFieldValue('PIN'), 'OUTPUT');
    if (b.type === 'arduino_digital_read') pins.set(b.getFieldValue('PIN'), 'INPUT');
  }
  let s = '';
  for (const [pin, mode] of pins) s += 'pinMode(' + pin + ', ' + mode + ');\n';
  return s;
}

export function buildSketch(ws, generator) {
  const gen = generator || arduinoGenerator;
  const loop = gen.workspaceToCode(ws);
  const ind = (s) => s.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
  const setupBody = collectPinDecls(ws);
  const header = '// Arduino Blocks — généré avec Blockly 13.3\n';
  const setup = 'void setup() {\n' + (setupBody ? ind(setupBody) + '\n' : '') + '}\n';
  const loopF = 'void loop() {\n' + (loop ? ind(loop) : '') + '}\n';
  return header + setup + '\n' + loopF;
}