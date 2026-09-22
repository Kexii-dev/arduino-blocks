import { createRequire } from 'module';
const require = createRequire('/root/arduino-blockly-poc/');
const { chromium } = require('playwright-core');
const NODE = process.env; const url = 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const logs = [];
page.on('console', m => logs.push('CONSOLE ' + m.type() + ': ' + m.text().slice(0, 300)));
page.on('pageerror', e => logs.push('PAGEERROR: ' + (e.message||String(e)).slice(0, 500)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const status = document.getElementById('status');
  return {
    status: status ? status.textContent : 'NO #status',
    paletteBtns: document.querySelectorAll('.pal-btn').length,
    blocklyBlocks: document.querySelectorAll('.blocklyDraggable').length,
    blocklyDivH: (document.getElementById('blocklyDiv') || {}).offsetHeight,
    containerH: (document.getElementById('container') || {}).offsetHeight,
    codeFirst150: (document.getElementById('code') || {}).textContent ? document.getElementById('code').textContent.slice(0, 200) : 'NO #code',
  };
});
await page.screenshot({ path: '/tmp/poc_full.png' });
console.log(JSON.stringify(info, null, 2));
console.log('--- logs ---');
logs.forEach(l => console.log(l.slice(0, 600)));
await browser.close();