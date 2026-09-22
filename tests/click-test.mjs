import { createRequire } from 'module';
const require = createRequire('/root/arduino-blockly-poc/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message||String(e)).slice(0,300)));
page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text().slice(0,200)); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const before = await page.evaluate(() => document.querySelectorAll('.blocklyDraggable').length);
await page.click('button.pal-btn');           // tap-to-add
await page.waitForTimeout(800);
const after = await page.evaluate(() => document.querySelectorAll('.blocklyDraggable').length);
console.log('blocs avant:', before, '| après clic:', after);
console.log('status:', await page.evaluate(() => document.getElementById('status').textContent));
const real = errs.filter(e => !/appspot|drop\.mp3|ERR_FAILED|Failed to load resource/i.test(e));
console.log('erreurs restantes (hors média actif):', real.length ? real.join('\n') : 'AUCUNE');
await browser.close();