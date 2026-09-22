// Vérifie que la LED_BUILTIN dédiée apparaît sur la carte et s'allume quand pin13 HIGH.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const welcome = await page.evaluate(() => {
  const w = document.getElementById('welcome'); return w && w.style.display !== 'none';
});
if (welcome) { await page.click('#welcomeExample').catch(()=>{}); await page.waitForTimeout(400); }

await page.click('#simBtn');
await page.waitForTimeout(300);

// La LED_BUILTIN dédiée existe-t-elle ?
const lbExists = await page.evaluate(() => !!document.querySelector('.sim-ledbuiltin'));
console.log('LED_BUILTIN dédiée présente:', lbExists);

// Lancer le mode virtuel, monter A0 au max -> analogRead>500 -> LED13 HIGH
await page.selectOption('#simMode', 'virtual');
await page.click('#simRun');
await page.waitForTimeout(400);
// Monter A0 via le modèle (board.setAnalog) en exposant un hook de test
await page.evaluate(() => {
  // on simule un drag du slider A0 vers le haut via pointer events sur le knob
  const knob = document.querySelector('.sim-knob[data-ch="0"]');
  if (!knob) return;
  const svg = document.querySelector('.sim-board-svg');
  const r = knob.getBoundingClientRect();
  knob.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x, clientY: r.y, pointerId: 1 }));
});
await page.waitForTimeout(150);
// pointermove vers le haut (valeur max) puis pointerup
const box = await page.evaluate(() => {
  const knob = document.querySelector('.sim-knob[data-ch="0"]');
  const r = knob.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y };
});
await page.mouse.move(box.x, box.y + 60);
await page.mouse.down();
await page.mouse.move(box.x, box.y + 20, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(500);

const lbFill = await page.evaluate(() => {
  const lb = document.querySelector('.sim-ledbuiltin');
  return lb ? lb.getAttribute('fill') : 'NONE';
});
console.log('LED_BUILTIN fill après A0 max (teal #00979D attendu):', lbFill);

await page.click('#simStop');
console.log('\nErreurs:', errors.slice(0, 3));
console.log('RESULT:', lbExists && lbFill === '#00979D' ? 'OK' : 'ECHEC');
await browser.close();
process.exit(0);