// Test navigateur réel : tooltip "aide fonctions Arduino" (survol) + bracket matching,
// branchés dans l'éditeur C++ direct (CodeMirror 6).
// Vérifie : (1) tooltip sur une fonction PAR pin (digitalWrite) -> explication + svg broches,
// (2) tooltip sur une fonction SANS pin (delay) -> explication sans svg,
// (3) paire d'accolades mise en évidence (cm-matchingBracket).
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:8090/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const benign = ['Failed to fetch', 'Failed to load resource', 'drop.mp3', 'favicon', '401', '404', '/api', 'net::ERR_'];
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

// Éditeur monté
const hasEditor = await page.evaluate(() => !!document.querySelector('#codeEditor .cm-editor'));
fail('éditeur CodeMirror monté', hasEditor);
if (!hasEditor) { console.log('\nErreurs: ' + errors.join(' || ')); await browser.close(); process.exit(1); }

// Injecte un programme de référence dans l'éditeur (setValue = non-manuel)
const SAMPLE = `void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int v = analogRead(A0);\n  digitalWrite(13, HIGH);\n  delay(500);\n}\n`;
await page.evaluate((code) => window.__arduinoEditor.setValue(code), SAMPLE);
await page.waitForTimeout(200);

// Position à l'écran d'un mot donné dans l'éditeur
async function wordBox(word) {
  return page.evaluate((w) => {
    const lines = [...document.querySelectorAll('#codeEditor .cm-line')];
    for (const ln of lines) {
      const walker = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const oi = n.textContent.indexOf(w);
        if (oi >= 0) {
          const r = document.createRange();
          r.setStart(n, oi); r.setEnd(n, oi + w.length);
          const rect = r.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
    }
    return null;
  }, word);
}

// 1) Tooltip digitalWrite : explication + svg broches (PWM mentionné, svg présent)
const dbbox = await wordBox('digitalWrite');
await page.mouse.move(dbbox.x, dbbox.y);
await page.waitForTimeout(500);
let tip = await page.evaluate(() => {
  const t = document.querySelector('#codeEditor .arduino-tip');
  return t ? { text: t.textContent, svg: !!t.querySelector('svg') } : null;
});
fail('tooltip affiché sur digitalWrite', !!tip);
fail('tooltip digitalWrite contient l’explication', !!tip && tip.text.includes('Envoie HAUT'));
fail('tooltip digitalWrite a un schéma de broches', !!tip && tip.svg);

// 2) Tooltip delay : explication SANS schéma de broches
const dlbox = await wordBox('delay');
await page.mouse.move(dlbox.x, dlbox.y);
await page.waitForTimeout(500);
tip = await page.evaluate(() => {
  const t = document.querySelector('#codeEditor .arduino-tip');
  return t ? { text: t.textContent, svg: !!t.querySelector('svg') } : null;
});
fail('tooltip affiché sur delay', !!tip);
fail('tooltip delay = pause (pas de broches)', !!tip && tip.text.includes('Pause') && !tip.svg);

// 3) Bracket matching : curseur juste après une accolade ouvrante -> paire surlignée
const bracketCount = await page.evaluate(() => {
  const editor = window.__arduinoEditor;
  const docStr = editor.getValue();
  const idx = docStr.indexOf('{' , docStr.indexOf('void setup'));
  editor.view.dispatch({ selection: { anchor: idx + 1, head: idx + 1 } });
  return new Promise((res) => setTimeout(() => {
    res(document.querySelectorAll('#codeEditor .cm-matchingBracket').length);
  }, 200));
});
fail('paire d’accolades mise en évidence (≥2 .cm-matchingBracket)', bracketCount >= 2);

console.log('\nErreurs navigateur (hors bénignes) : ' + (errors.length ? errors.join(' || ') : 'aucune'));
if (errors.length) { process.exitCode = 1; }
await browser.close();
