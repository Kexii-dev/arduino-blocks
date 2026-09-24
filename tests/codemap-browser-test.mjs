// Test navigateur réel du lien pédagogique bloc ↔ lignes C++ (Option A).
// Charge l'app (exemple bloom analogRead), vérifie les commentaires pédagogiques,
// puis teste les 2 directions : (a) sélection d'un bloc -> ses lignes sont surlignées,
// (b) clic sur une ligne -> son bloc est sélectionné.
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

// Panneau code visible (fine pointer -> ouvert)
const codePanelOn = await page.evaluate(() => { const p = document.getElementById('codePanel'); return p && p.style.display !== 'none'; });
fail('panneau code visible (souris)', codePanelOn);

// 1) Commentaires pédagogiques dans le code rendu
const codeText = await page.textContent('#code');
fail('annotation « Pause » présente', (codeText || '').includes('// Pause de'));
fail('annotation « LED » présente', (codeText || '').includes('// Contrôle la LED'));

// 2) Chaque ligne rendue en span .code-l, avec des lignes liées à un bloc
const lineStats = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('#code .code-l')];
  return { total: spans.length, mapped: spans.filter((s) => s.dataset.b).length, sampleB: spans.filter((s) => s.dataset.b).slice(0, 3).map((s) => ({ b: s.dataset.b, txt: s.textContent })) };
});
fail('lignes rendues en .code-l', lineStats.total >= 8);
fail('lignes reliées à un bloc', lineStats.mapped >= 3);

// 3) Sens A : sélectionner un bloc (delay) -> ses lignes surlignées
const delayId = await page.evaluate(() => {
  const ws = window.Code.workspace;
  const b = ws.getAllBlocks().find((x) => x.type === 'arduino_delay');
  if (!b) return null;
  b.select();
  return b.id;
});
await page.waitForTimeout(300);
const hlAfterBlockSelect = await page.evaluate((id) => {
  const hl = [...document.querySelectorAll('#code .code-l.hl')];
  return { n: hl.length, txt: hl.map((s) => s.textContent).join(' | ') };
}, delayId);
fail('sélection bloc -> lignes surlignées', hlAfterBlockSelect.n >= 2);
fail('le surlignage vise le delay', hlAfterBlockSelect.txt.includes('delay('));

// 4) Sens B : clic sur la ligne d'un AUTRE bloc (if) -> son bloc sélectionné + highlight déplacé
let ifClicked = null;
await page.evaluate(() => {
  const ws = window.Code.workspace;
  const b = ws.getAllBlocks().find((x) => x.type === 'arduino_if');
  if (!b) return;
  const line = document.querySelector(`#code .code-l[data-b="${b.id}"]`);
  if (line) line.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  ifClicked = b.id;
});
await page.waitForTimeout(300);
const hlAfterLineClick = await page.evaluate(() => {
  const hl = [...document.querySelectorAll('#code .code-l.hl')];
  return hl.map((s) => ({ b: s.dataset.b, txt: s.textContent })).filter((x) => x.b);
});
const atIf = hlAfterLineClick.some((x) => x.txt.includes('condition') || x.txt.includes('if ('));
fail('clic ligne -> surlignage déplacé vers le bloc if', atIf);

console.log('\nErreurs navigateur (hors bénignes) : ' + (errors.length ? errors.join(' || ') : 'aucune'));
if (errors.length) { process.exitCode = 1; }
await browser.close();
