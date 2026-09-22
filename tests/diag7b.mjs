import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.cat-tab')).find(x => x.textContent.includes('Variables')); t.click(); });
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('.pal-btn')[0].click());
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('.pal-btn')[1].click());
await page.waitForTimeout(300);
await page.evaluate(() => {
  const ws = window.Code.workspace;
  const set = ws.getAllBlocks().find(b => b.type === 'arduino_var_set');
  const txt = ws.newBlock('arduino_text'); txt.setFieldValue('Bonjour', 'TEXT');
  set.getInput('V').connection.connect(txt.outputConnection);
});
// intercepter la réponse réseau du compile
const resp = page.waitForResponse(r => r.url().includes('/api/compile'));
await page.evaluate(() => document.getElementById('compileBtn').click());
const r = await resp;
let body = null; try { body = await r.json(); } catch(e){}
console.log('HTTP status:', r.status());
console.log('réponse:', JSON.stringify(body));
await page.waitForTimeout(1500);
const st = await page.evaluate(() => (document.getElementById('compileStatus')||{}).textContent || '');
const popup = await page.evaluate(() => !!document.querySelector('.hack-overlay'));
console.log('compileStatus:', JSON.stringify(st));
console.log('popup ouvert:', popup);
await browser.close();
