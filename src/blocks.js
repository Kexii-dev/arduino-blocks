import * as BlocklyNS from 'blockly/core';
/* Portable navigateur (ESM) / Node (CJS core-node.js) : sous Node l'objet complet est dans .default. */
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);

/* Définition des blocs Arduino (I/O, temps, condition). Les blocs de logique,
   boucles, maths et variables viennent de `blockly/blocks` (libraryBlocks). */
export function defineArduinoBlocks() {
  Blockly.defineBlocksWithJsonArray([
    {
      type: 'arduino_led',
      message0: 'LED intégrée %1',
      args0: [{ type: 'field_dropdown', name: 'STAT',
                options: [['allumée', 'HIGH'], ['éteinte', 'LOW']] }],
      previousStatement: null, nextStatement: null,
      colour: '#00979D',
      tooltip: 'Allume ou éteint la LED intégrée de la carte.',
    },
    {
      type: 'arduino_digital_write',
      message0: 'mettre la broche %1 à %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN',
          options: [['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7'],
                     ['8','8'],['9','9'],['10','10'],['11','11'],['12','12'],['13','13']] },
        { type: 'field_dropdown', name: 'STAT',
          options: [['HAUTE (HIGH)','HIGH'], ['BASSE (LOW)','LOW']] },
      ],
      previousStatement: null, nextStatement: null,
      colour: '#00979D',
      tooltip: 'Écrit HIGH ou LOW sur une broche numérique.',
    },
    {
      type: 'arduino_analog_read',
      message0: 'lire la broche analogique %1',
      args0: [{ type: 'field_dropdown', name: 'PIN',
                options: [['A0','A0'],['A1','A1'],['A2','A2'],['A3','A3'],['A4','A4'],['A5','A5']] }],
      output: null,
      colour: '#5b67c9',
      tooltip: 'Lit une valeur analogique (0-1023).',
    },
    {
      type: 'arduino_digital_read',
      message0: 'lire la broche %1',
      args0: [{ type: 'field_dropdown', name: 'PIN',
                options: [['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7'],
                           ['8','8'],['9','9'],['10','10'],['11','11'],['12','12'],['13','13']] }],
      output: null,
      colour: '#5b67c9',
      tooltip: 'Lit une broche numérique (HIGH/LOW).',
    },
    {
      type: 'arduino_highlow',
      message0: '%1',
      args0: [{ type: 'field_dropdown', name: 'VAL',
                options: [['HAUTE','HIGH'], ['BASSE','LOW']] }],
      output: null,
      colour: '#5b67c9',
      tooltip: 'La valeur HIGH ou LOW.',
    },
    {
      type: 'arduino_delay',
      message0: 'attendre %1 millisecondes',
      args0: [{ type: 'field_number', name: 'MS', value: 1000, min: 0, precision: 1 }],
      previousStatement: null, nextStatement: null,
      colour: '#e7662d',
      tooltip: 'Pause en millisecondes.',
    },
    {
      type: 'arduino_if',
      message0: 'si %1 alors %2 sinon %3',
      args0: [
        { type: 'input_value', name: 'IF0' },
        { type: 'input_statement', name: 'DO0' },
        { type: 'input_statement', name: 'ELSE' },
      ],
      previousStatement: null, nextStatement: null,
      colour: '#5b67c9',
      tooltip: 'Condition complète avec une branche sinon.',
      inputsInline: true,
    },
  ]);
}