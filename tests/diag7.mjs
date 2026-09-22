// Test réel : palette "Appeler fonction" (non définie) -> Compiler -> popup hacker
import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
await page.addInitScript(() => {
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(e.error && e.error.stack ? e.error.stack : e.message));
});
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// onglet Fonctions -> ajouter "Appeler fonction"
await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.cat-tab')).find(x => x.textContent.includes('Fonctions')); t.click(); });
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('.pal-btn')[1].click()); // Appeler fonction
await page.waitForTimeout(300);

const code = await page.evaluate(() => (document.getElementById('code')||{}).textContent || '');
console.log('C++ contient maFonction();:', code.includes('maFonction();'));

// cliquer Compiler
await page.evaluate(() => document.getElementById('rdCompileBtn').click());
await page.waitForTimeout(5000);
const popup = await page.evaluate(() => ({
  open: !!document.querySelector('.hack-overlay'),
  text: (document.getElementById('hackBody')||{}).textContent || '',
}));
console.log('popup ouvert:', popup.open);
console.log('contient explication "n\'existe pas":', popup.text.includes("n'existe pas"));
console.log('contient erreur brute maFonction:', popup.text.includes('maFonction'));
const errs = await page.evaluate(() => window.__errs);
console.log('STACKS:\n' + (errs.length ? errs.join('\n======\n') : 'AUCUNE'));
await browser.close();
