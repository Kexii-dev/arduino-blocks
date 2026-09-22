import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const r = await page.evaluate(async () => {
  const ws = window.Code.workspace;
  // compter les listeners
  const nListeners = ws.listeners ? ws.listeners.length : 'n/a';
  // créer un bloc et lire son champ
  const create = ws.newBlock('arduino_var_create');
  const nameVal = create.getFieldValue('NAME');
  const typeVal = create.getFieldValue('TYPE');
  // vérifier si un event create a été émis : ajouter un listener temporaire
  let fired = null;
  const tmp = (e) => { fired = e.type; };
  ws.addChangeListener(tmp);
  const b2 = ws.newBlock('arduino_led');
  ws.removeChangeListener(tmp);
  return { nListeners, nameVal, typeVal, fired };
});
console.log('listeners:', r.nListeners);
console.log('NAME field:', JSON.stringify(r.nameVal), '| TYPE field:', JSON.stringify(r.typeVal));
console.log('event émis par newBlock:', r.fired);
await browser.close();
