// Rendu navigateur : variables typées (créer -> dropdowns dynamiques)
import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
await page.addInitScript(() => {
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(e.error && e.error.stack ? e.error.stack : e.message));
});
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('drop.mp3')) console.log('console.err:', m.text().slice(0, 180)); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// onglet Variables
await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.cat-tab')).find(x => x.textContent.includes('Variables')); t.click(); });
await page.waitForTimeout(200);
const pal = await page.evaluate(() => Array.from(document.querySelectorAll('.pal-btn')).map(b => b.textContent));
console.log('palette Variables:', JSON.stringify(pal));

// ajouter "Créer variable" (défaut: compteur / nombre)
await page.evaluate(() => document.querySelectorAll('.pal-btn')[0].click());
await page.waitForTimeout(300);

// ajouter "Mettre variable" -> son dropdown doit lister compteur
await page.evaluate(() => document.querySelectorAll('.pal-btn')[1].click());
await page.waitForTimeout(300);

const out = await page.evaluate(() => {
  const code = (document.getElementById('code') || {}).textContent || '';
  // lire les options du dropdown VAR du bloc set (dernier bloc statement)
  const blocks = document.querySelectorAll('.blocklyDraggable');
  return {
    blocks: blocks.length,
    hasDecl: code.includes('int compteur = 0;'),
    code: code,
  };
});
console.log('blocks:', out.blocks, '| déclaration int compteur:', out.hasDecl);
console.log('C++:\n' + out.code);
const errs = await page.evaluate(() => window.__errs);
console.log('STACKS:\n' + (errs.length ? errs.join('\n======\n') : 'AUCUNE'));
await browser.close();
