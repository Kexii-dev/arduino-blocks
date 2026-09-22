import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message||String(e)).slice(0,300)));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const out = await page.evaluate(() => ({
  status: document.getElementById('status').textContent,
  blocks: document.querySelectorAll('.blocklyDraggable').length,
  palette: document.querySelectorAll('.pal-btn').length,
  account: !!document.getElementById('acctTopBtn'),
  lang: document.getElementById('langSel').value,
  codeHead: (document.getElementById('code').textContent || '').slice(0, 60).replace(/\n/g, ' '),
  codeHasIf: (document.getElementById('code').textContent || '').includes('analogRead(A0) > 500'),
}));
console.log(JSON.stringify(out, null, 2));
console.log('erreurs:', errs.length ? errs.join('\n') : 'AUCUNE');

// Test : cliquer Compiler via la vraie UI (proxy -> backend prod)
await page.waitForTimeout(300);
await page.click('#compileBtn');
await page.waitForTimeout(4000);
const comp = await page.evaluate(() => document.getElementById('compileStatus').textContent || '');
console.log('status compile:', comp.slice(0, 220).replace(/\n/g, ' | '));
console.log('flashBtn visible:', await page.$eval('#flashBtn', el => el.style.display) !== 'none');
await browser.close();