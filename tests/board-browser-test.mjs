// Test navigateur réel : sélection de carte (Mega) + compilation E2E.
// Vérifie : (1) le sélecteur de carte existe avec uno+mega, (2) changer de carte
// met à jour le titre du panneau C++, (3) compiler en Mega renvoie un .hex et
// affiche « Arduino Mega », (4) le même sketch en Uno affiche « Arduino Uno ».
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const benign = ['Failed to fetch', 'Failed to load resource', 'drop.mp3', 'favicon', '401', '404', '/api'];
const errors = [];
page.on('pageerror', (e) => { const m = e.message; if (!benign.some((b) => m.includes(b))) errors.push('pageerror: ' + m); });
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!benign.some((b) => t.includes(b))) errors.push('console: ' + t); } });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.evaluate(() => localStorage.removeItem('arduino-blocks-board'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const welcomeVisible = await page.evaluate(() => { const w = document.getElementById('welcome'); return w && w.style.display !== 'none'; });
if (welcomeVisible) { await page.click('#welcomeExample').catch(() => {}); await page.waitForTimeout(500); }

const fail = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };

// 1) Sélecteur de carte avec uno + mega
const opts = await page.evaluate(() => [...document.getElementById('boardSel').options].map((o) => o.value));
fail('sélecteur de carte présent (uno + mega)', opts.includes('uno') && opts.includes('mega'));

// 2) Changer sur Mega -> titre du panneau C++ mis à jour
await page.selectOption('#boardSel', 'mega');
await page.waitForTimeout(300);
const titleMega = await page.evaluate(() => document.getElementById('codeTitle').textContent);
fail('titre panneau -> Arduino Mega', titleMega.includes('Mega'));
fail('board persiste en localStorage', await page.evaluate(() => localStorage.getItem('arduino-blocks-board') === 'mega'));

// 3) Compiler en Mega -> statut ok + « Arduino Mega » + du .hex
await page.click('#compileBtn');
let st = '';
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  st = await page.evaluate(() => document.getElementById('compileStatus').textContent || '');
  if (st.includes('Compilé pour') || st.includes('Erreur') || st.includes('Réseau')) break;
}
fail('compile Mega -> ok', st.includes('✅') && st.includes('Arduino Mega'));
fail('compile Mega -> .hex présent', st.includes('.hex'));

// 4) Revenir sur Uno -> compile -> « Arduino Uno »
await page.selectOption('#boardSel', 'uno');
await page.waitForTimeout(300);
await page.click('#compileBtn');
st = '';
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  st = await page.evaluate(() => document.getElementById('compileStatus').textContent || '');
  if (st.includes('Compilé pour') || st.includes('Erreur') || st.includes('Réseau')) break;
}
fail('compile Uno -> ok', st.includes('✅') && st.includes('Arduino Uno'));

console.log('\nErreurs navigateur (hors bénignes) : ' + (errors.length ? errors.join(' || ') : 'aucune'));
if (errors.length) { process.exitCode = 1; }
await browser.close();