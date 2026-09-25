// Screenshot du tooltip "aide fonctions Arduino" + bracket matching (pour montrer à David).
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:8090/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 980, height: 760 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const welcomeVisible = await page.evaluate(() => { const w = document.getElementById('welcome'); return w && w.style.display !== 'none'; });
if (welcomeVisible) { await page.click('#welcomeExample').catch(() => {}); await page.waitForTimeout(500); }

// Injecte un programme de référence, positionne le curseur sur une accolade (bracket match)
const SAMPLE = `void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int v = analogRead(A0);\n  digitalWrite(13, HIGH);\n  delay(500);\n}\n`;
await page.evaluate((code) => window.__arduinoEditor.setValue(code), SAMPLE);
await page.waitForTimeout(200);
await page.evaluate(() => {
  const editor = window.__arduinoEditor;
  const s = editor.getValue();
  const idx = s.indexOf('{', s.indexOf('void setup'));
  editor.view.dispatch({ selection: { anchor: idx + 1, head: idx + 1 } });
});

// Survol de digitalWrite pour afficher le tooltip
const box = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('#codeEditor .cm-line')];
  for (const ln of lines) {
    const walker = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const oi = n.textContent.indexOf('digitalWrite');
      if (oi >= 0) {
        const r = document.createRange();
        r.setStart(n, oi); r.setEnd(n, oi + 'digitalWrite'.length);
        const rect = r.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
  }
  return null;
});
await page.mouse.move(box.x, box.y);
await page.waitForTimeout(500);
await page.screenshot({ path: '/root/arduino-blocks/tests/help-tooltip.png' });
console.log('saved /root/arduino-blocks/tests/help-tooltip.png');
await browser.close();
