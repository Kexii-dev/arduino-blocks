import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const url = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
// force le load si readyState bloqué
await page.evaluate(() => { if (document.readyState !== 'complete') window.dispatchEvent(new Event('load')); });
await page.waitForTimeout(1500);

// 1. bouton Exemple présent
const exBtn = await page.$('#exBtn');
console.log('exBtn présent:', !!exBtn);

// masquer l'overlay d'accueil qui intercepte les clics
await page.evaluate(() => { const w = document.getElementById('welcome'); if (w) w.style.display = 'none'; });
await page.waitForTimeout(200);

// 2. clic -> panneau visible
await page.click('#exBtn');
await page.waitForTimeout(300);
const panelVisible = await page.evaluate(() => document.getElementById('exPanel').style.display);
console.log('panneau exPanel display:', panelVisible);

// 3. thèmes rendus
const themes = await page.$$eval('.ex-theme', (els) => els.map((e) => e.textContent));
console.log('thèmes:', themes);

// 4. liste du 1er thème
const items = await page.$$eval('.ex-item', (els) => els.map((e) => e.textContent));
console.log('exemples du thème actif:', items);

// 5. clic sur un exemple -> fiche
await page.click('.ex-item');
await page.waitForTimeout(200);
const detail = await page.evaluate(() => document.getElementById('exDetail').textContent);
console.log('fiche affichée (début):', detail.slice(0, 60).replace(/\n/g, ' '));

// 6. clic charger -> workspace rempli + panneau fermé
const blocksBefore = await page.evaluate(() => window.Code.workspace.getAllBlocks().length);
await page.click('#exLoadBtn');
await page.waitForTimeout(500);
const blocksAfter = await page.evaluate(() => window.Code.workspace.getAllBlocks().length);
const panelAfter = await page.evaluate(() => document.getElementById('exPanel').style.display);
console.log('blocs avant/après chargement:', blocksBefore, '->', blocksAfter);
console.log('panneau après chargement:', panelAfter);

// 7. C++ généré non vide
const code = await page.evaluate(() => document.getElementById('code').textContent);
console.log('C++ généré (début):', code.slice(0, 80).replace(/\n/g, ' '));

console.log('\nERREURS CONSOLE:', errors.length ? errors : 'aucune');
await browser.close();
