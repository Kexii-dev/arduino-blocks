import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
await page.addInitScript(() => {
  window.__errs = [];
  window.addEventListener('error', (e) => {
    window.__errs.push(e.error && e.error.stack ? e.error.stack : e.message);
  });
});
page.on('console', m => { if (m.type() === 'error') console.log('console.err:', m.text().slice(0, 260)); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const errs = await page.evaluate(() => window.__errs);
console.log('STACKS:\n' + (errs.length ? errs.join('\n======\n') : 'AUCUNE'));
const out = await page.evaluate(() => ({
  status: document.getElementById('status').textContent,
  blocks: document.querySelectorAll('.blocklyDraggable').length,
  palette: document.querySelectorAll('.pal-btn').length,
}));
console.log('page:', JSON.stringify(out));
await browser.close();