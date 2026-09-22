import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import 'blockly/msg/fr';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { EXAMPLES } from '../src/examples.js';

defineArduinoBlocks();

for (const group of EXAMPLES) {
  for (const item of group.items) {
    const ws = new Blockly.Workspace();
    try {
      item.build(ws);
      const n = ws.getAllBlocks().length;
      console.log(`[${group.theme}] ${item.id}: ${n} blocs OK`);
    } catch (e) {
      console.log(`[${group.theme}] ${item.id}: ERREUR -> ${e.message}`);
    }
  }
}
