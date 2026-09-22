import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const r = await page.evaluate(async () => {
  const ws = window.Code.workspace;
  ws.clear();
  const create = ws.newBlock('arduino_var_create');
  // lire VARS après création du create
  const m = await import('/src/vars.js');
  const afterCreate = Array.from(m.VARS.entries());
  const set = ws.newBlock('arduino_var_set');
  const opts = set.getField('VAR').getOptions();
  const afterSet = Array.from(m.VARS.entries());
  return { afterCreate, afterSet, opts };
});
console.log('VARS après create:', JSON.stringify(r.afterCreate));
console.log('VARS après set:', JSON.stringify(r.afterSet));
console.log('options dropdown set:', JSON.stringify(r.opts));
await browser.close();
