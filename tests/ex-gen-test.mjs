import * as BlocklyNS from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import 'blockly/msg/fr';
const Blockly = BlocklyNS.Generator ? BlocklyNS : (BlocklyNS.default || BlocklyNS);
import { defineArduinoBlocks } from '../src/blocks.js';
import { arduinoGenerator, buildSketch } from '../src/generator.js';
import { EXAMPLES } from '../src/examples.js';

defineArduinoBlocks();

for (const group of EXAMPLES) {
  for (const item of group.items) {
    const ws = new Blockly.Workspace();
    try {
      item.build(ws);
      const code = buildSketch(ws, arduinoGenerator);
      const ok = code.includes('void setup') && code.includes('void loop');
      console.log(`[${group.theme}] ${item.id}: C++=${ok ? 'OK' : 'INVALIDE'}`);
      if (!ok) console.log('   ', code.slice(0, 150).replace(/\n/g, ' '));
    } catch (e) {
      console.log(`[${group.theme}] ${item.id}: ERREUR -> ${e.message}`);
    }
  }
}
