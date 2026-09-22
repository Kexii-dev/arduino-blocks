// Rendu navigateur du popup hacker (appel direct avec une erreur réaliste)
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

// appeler showHackPopup via import dynamique
const raw = "sketch/sketch.ino:12:5: error: 'compteur' was not declared in this scope\n   compteur = 5;\n   ^~~~~~~~~\nsketch/sketch.ino:15:10: error: cannot convert 'String' to 'int' in assignment";
await page.evaluate(async (r) => {
  const m = await import('/src/hack.js');
  window.__hack = m;
  m.showHackPopup(r);
}, raw);

// attendre que l'effet machine à écrire avance
await page.waitForTimeout(2500);
const mid = await page.evaluate(() => ({
  overlay: !!document.querySelector('.hack-overlay'),
  bodyText: (document.querySelector('#hackBody') || {}).textContent || '',
}));
console.log('overlay présent:', mid.overlay);
console.log('contient explication variable:', mid.bodyText.includes('créer la variable'));
console.log('contient explication String/int:', mid.bodyText.includes('TEXTE et un NOMBRE'));
console.log('contient erreur brute:', mid.bodyText.includes('was not declared in this scope'));

// attendre la fin de l'animation puis fermer
await page.waitForTimeout(4000);
const fin = await page.evaluate(() => ({
  bodyText: (document.getElementById('hackBody') || {}).textContent || '',
}));
console.log('fin: contient "Analyse terminée":', fin.bodyText.includes('Analyse terminée'));

// clic fermer
await page.evaluate(() => document.getElementById('hackClose').click());
await page.waitForTimeout(300);
const closed = await page.evaluate(() => !document.querySelector('.hack-overlay'));
console.log('fermé après clic:', closed);

const errs = await page.evaluate(() => window.__errs);
console.log('STACKS:\n' + (errs.length ? errs.join('\n======\n') : 'AUCUNE'));
await browser.close();
