// Test navigateur réel de l'éditeur C++ direct (Option B) + lien bloc↔lignes (A).
// Vérifie : (1) l'éditeur CodeMirror est monté, (2) les annotations sont présentes,
// (3) sélection d'un bloc -> surlignage des lignes, (4) édition manuelle -> bannière
// + getSource renvoie le code édité, (5) « Revenir aux blocs » -> régénère.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:8090/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const benign = ['Failed to fetch', 'Failed to load resource', 'drop.mp3', 'favicon', '401', '404', '/api'];
const errors = [];
page.on('pageerror', (e) => { const m = e.message; if (!benign.some((b) => m.includes(b))) errors.push('pageerror: ' + m); });
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!benign.some((b) => t.includes(b))) errors.push('console: ' + t); } });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const welcomeVisible = await page.evaluate(() => { const w = document.getElementById('welcome'); return w && w.style.display !== 'none'; });
if (welcomeVisible) { await page.click('#welcomeExample').catch(() => {}); await page.waitForTimeout(500); }

const fail = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) process.exitCode = 1; };

// 1) Éditeur CodeMirror monté
const hasEditor = await page.evaluate(() => !!document.querySelector('#codeEditor .cm-editor'));
fail('éditeur CodeMirror monté', hasEditor);

// 2) Annotations présentes dans le contenu de l'éditeur
const content = await page.evaluate(() => window.__arduinoEditor.getValue());
fail('annotation « Pause » présente', content.includes('// Pause de'));
fail('annotation « LED » présente', content.includes('// Contrôle la LED'));

// 3) Sélection d'un bloc -> surlignage des lignes (.cm-block-hl)
await page.evaluate(() => {
  const ws = window.Code.workspace;
  const b = ws.getAllBlocks().find((x) => x.type === 'arduino_delay');
  if (b) b.select();
});
await page.waitForTimeout(300);
const hlCount = await page.evaluate(() => document.querySelectorAll('#codeEditor .cm-block-hl').length);
fail('sélection bloc -> lignes surlignées', hlCount >= 2);

// 4) Édition manuelle -> bannière + getSource renvoie le code édité
await page.evaluate(() => {
  window.__arduinoEditor.view.dispatch({ changes: { from: 0, insert: '// test manuel\n' } });
});
await page.waitForTimeout(200);
const bannerVisible = await page.evaluate(() => {
  const b = document.getElementById('manualBanner');
  return b && b.style.display !== 'none';
});
fail('édition manuelle -> bannière visible', bannerVisible);
const src = await page.evaluate(() => window.__getSource());
fail('getSource renvoie le code édité', src.startsWith('// test manuel'));

// 5) « Revenir aux blocs » -> bannière masquée + code régénéré (sans l'édition)
await page.click('#manualRevert');
await page.waitForTimeout(300);
const afterRevert = await page.evaluate(() => {
  const b = document.getElementById('manualBanner');
  return {
    banner: b && b.style.display !== 'none',
    src: window.__getSource(),
    editor: window.__arduinoEditor.getValue(),
  };
});
fail('revert -> bannière masquée', !afterRevert.banner);
fail('revert -> code régénéré (sans édition manuelle)', !afterRevert.src.startsWith('// test manuel') && afterRevert.editor.includes('void loop()'));

console.log('\nErreurs navigateur (hors bénignes) : ' + (errors.length ? errors.join(' || ') : 'aucune'));
if (errors.length) { process.exitCode = 1; }
await browser.close();
