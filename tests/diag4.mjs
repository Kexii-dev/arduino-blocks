// Rendu navigateur des nouveaux blocs Textes + Fonctions (palette par onglets)
import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
await page.addInitScript(() => {
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(e.error && e.error.stack ? e.error.stack : e.message));
});
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('drop.mp3')) console.log('console.err:', m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const cats = await page.evaluate(() => Array.from(document.querySelectorAll('.cat-tab')).map(t => t.textContent));
console.log('onglets:', JSON.stringify(cats));

// basculer sur Textes puis ajouter un bloc texte
await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.cat-tab')).find(x => x.textContent.includes('Textes')); t.click(); });
await page.waitForTimeout(200);
const textBtns = await page.evaluate(() => Array.from(document.querySelectorAll('.pal-btn')).map(b => b.textContent));
console.log('palette Textes:', JSON.stringify(textBtns));
await page.evaluate(() => document.querySelectorAll('.pal-btn')[0].click());
await page.waitForTimeout(300);

// basculer sur Fonctions puis ajouter une fonction
await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.cat-tab')).find(x => x.textContent.includes('Fonctions')); t.click(); });
await page.waitForTimeout(200);
const fnBtns = await page.evaluate(() => Array.from(document.querySelectorAll('.pal-btn')).map(b => b.textContent));
console.log('palette Fonctions:', JSON.stringify(fnBtns));
await page.evaluate(() => document.querySelectorAll('.pal-btn')[0].click());
await page.waitForTimeout(300);

const out = await page.evaluate(() => ({
  status: document.getElementById('status').textContent,
  blocks: document.querySelectorAll('.blocklyDraggable').length,
  code: (document.getElementById('code') || {}).textContent || '',
}));
console.log('page:', JSON.stringify({ status: out.status, blocks: out.blocks }));
console.log('C++ contient fonction:', out.code.includes('void maFonction()'));
console.log('C++ contient texte:', out.code.includes('"Bonjour"'));
const errs = await page.evaluate(() => window.__errs);
console.log('STACKS:\n' + (errs.length ? errs.join('\n======\n') : 'AUCUNE'));
await browser.close();
