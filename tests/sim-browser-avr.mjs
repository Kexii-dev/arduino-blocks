// Test navigateur réel du mode "Réelle AVR8js" : compile via /api proxy puis exécute,
// vérifie que la LED blink (svg fill change) sur le VirtualBoard.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
// build un blink simple programmatiquement
await page.evaluate(() => {
  localStorage.removeItem('arduino-blocks-workspace');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const welcome = await page.evaluate(() => {
  const w = document.getElementById('welcome'); return w && w.style.display !== 'none';
});
if (welcome) { await page.click('#welcomeExample').catch(()=>{}); await page.waitForTimeout(400); }

await page.click('#simBtn');
await page.waitForTimeout(300);

// Sélectionner le mode AVR8js réel et lancer
await page.selectOption('#simMode', 'avr');
await page.click('#simRun');

// attendre compile + démarrage
let status = '';
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(400);
  status = await page.textContent('#simStatus');
  if (status.includes('Réelle') || status.includes('❌')) break;
}
console.log('Statut AVR:', JSON.stringify(status));

// La démo fait analogRead(A0)>500. On pousse A0 max -> LED13 HIGH
await page.evaluate(() => {
  const knob = document.querySelector('.sim-knob[data-ch="0"]');
  if (!knob || !document.querySelector('.sim-board-svg').createSVGPoint) return;
  const svg = document.querySelector('.sim-board-svg');
  const s = document.querySelector('.sim-knob[data-ch="1"]'); // référence pour valeurs
  // on simule un pointerdown puis pointermove en haut du slider A0
  const r = knob.getBoundingClientRect();
  knob.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x, clientY: r.y, pointerId: 1 }));
});
await page.waitForTimeout(200);
// drag vers le haut (valeur max) sur le même slider
const box = await page.evaluate(() => {
  const knob = document.querySelector('.sim-knob[data-ch="0"]');
  const r = knob.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y };
});
await page.mouse.move(box.x, box.y + 80);
await page.mouse.down();
await page.mouse.move(box.x, box.y + 40, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(600);

const states = [];
const ledFill = await page.evaluate(() => {
  const led = document.querySelector('.sim-board-svg circle[data-pin="13"]');
  return led ? led.getAttribute('fill') : 'NONE';
});
console.log('LED13 fill (9999 teal attendu en AVR si >500):', ledFill);
const serial = await page.evaluate(() => {
  const body = document.querySelector('.sim-serial-body');
  return body ? body.textContent.slice(0, 200) : '';
});
console.log('Console série (extrait):', JSON.stringify(serial));

await page.click('#simStop');
console.log('\nErreurs:', errors.slice(0, 5));
await browser.close();
process.exit(0);