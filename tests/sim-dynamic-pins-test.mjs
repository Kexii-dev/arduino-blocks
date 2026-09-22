// Test navigateur réel : pins digitales dynamiques selon le mode.
// Programme : digitalRead(2) [entrée] + digitalWrite(4, HIGH) [sortie].
// Après run, la rangée DIGITAL doit montrer un BOUTON D2 et une LED D4.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Fermer l'accueil s'il est visible
const welcome = await page.evaluate(() => {
  const w = document.getElementById('welcome'); return w && w.style.display !== 'none';
});
if (welcome) { await page.click('#welcomeNew').catch(() => {}); await page.waitForTimeout(300); }

// Construire le programme via le workspace exposé : D2 entrée, D4 sortie
await page.evaluate(() => {
  const ws = window.Code.workspace;
  ws.clear();
  // D4 en sortie (statement)
  const dw = ws.newBlock('arduino_digital_write'); dw.setFieldValue('4', 'PIN'); dw.setFieldValue('HIGH', 'STAT');
  // D2 en entrée (bloc-valeur) branché dans un if
  const ifb = ws.newBlock('arduino_if');
  const dr = ws.newBlock('arduino_digital_read'); dr.setFieldValue('2', 'PIN');
  ifb.getInput('IF0').connection.connect(dr.outputConnection);
  dw.previousConnection.connect(ifb.nextConnection);
  ws.getAllBlocks(true).forEach((b) => { try { b.initSvg(); } catch (_) {} try { b.render(); } catch (_) {} });
});

// Ouvrir le panneau sim et lancer le mode virtuel
await page.click('#simBtn');
await page.waitForTimeout(300);
await page.selectOption('#simMode', 'virtual');
await page.click('#simRun');
await page.waitForTimeout(500);

// Vérifier le rendu dynamique
const result = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.sim-digital-ctrl .sim-btn')].map((g) => g.getAttribute('data-pin'));
  const leds = [...document.querySelectorAll('.sim-digital-ctrl .sim-dig-led')].map((g) => g.getAttribute('data-pin'));
  const btnLabels = [...document.querySelectorAll('.sim-digital-ctrl .sim-btn text')].map((t) => t.textContent);
  const ledLabels = [...document.querySelectorAll('.sim-digital-ctrl .sim-dig-led text')].map((t) => t.textContent);
  const ledD4 = document.querySelector('.sim-digital-ctrl .sim-dig-led[data-pin="4"] .sim-dig-led-dot');
  return {
    btnPins: btns, ledPins: leds, btnLabels, ledLabels,
    ledD4Fill: ledD4 ? ledD4.getAttribute('fill') : 'NONE',
  };
});
console.log('Boutons (pins):', JSON.stringify(result.btnPins));
console.log('LEDs (pins):', JSON.stringify(result.ledPins));
console.log('Labels boutons:', JSON.stringify(result.btnLabels));
console.log('Labels LEDs:', JSON.stringify(result.ledLabels));
console.log('LED D4 fill (HIGH -> #ffcc4d attendu):', result.ledD4Fill);

// Screenshot du panneau
await page.screenshot({ path: 'tests/sim-dynamic-pins.png' });

await page.click('#simStop');
console.log('\nErreurs:', errors.slice(0, 3));
const okBtn = result.btnPins.includes('2') && result.btnLabels.includes('D2');
const okLed = result.ledPins.includes('4') && result.ledLabels.includes('D4');
const okFill = result.ledD4Fill === '#ffcc4d';
console.log('RESULT:', okBtn && okLed && okFill ? 'OK' : 'ECHEC');
await browser.close();
process.exit(0);
