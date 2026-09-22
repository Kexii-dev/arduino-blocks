// Vérification PROD : https://arduino.rayroud.com — fenêtre sim flottante + LED_BUILTIN.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = 'https://arduino.rayroud.com/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const welcome = await page.evaluate(() => {
  const w = document.getElementById('welcome'); return w && w.style.display !== 'none';
});
if (welcome) { await page.click('#welcomeExample').catch(()=>{}); await page.waitForTimeout(500); }

// Ouvrir la fenêtre sim
await page.click('#simBtn');
await page.waitForTimeout(400);
const r = {};
r.visible = await page.evaluate(() => document.getElementById('simPanelWrap').style.display !== 'none');
r.ledBuiltin = await page.evaluate(() => !!document.querySelector('.sim-ledbuiltin'));
r.sliders = await page.evaluate(() => document.querySelectorAll('.sim-knob').length);

// Plein écran
await page.click('#simMaxBtn', { force: true });
await page.waitForTimeout(300);
r.maxed = await page.evaluate(() => {
  const w = document.getElementById('simPanelWrap');
  return { cls: w.classList.contains('sim-max'), w: w.offsetWidth, h: w.offsetHeight };
});
await page.click('#simMaxBtn', { force: true });
await page.waitForTimeout(200);

// Lancer virtuel + monter A0 -> LED_BUILTIN s'allume
await page.selectOption('#simMode', 'virtual');
await page.click('#simRun');
await page.waitForTimeout(400);
const knob = await page.evaluate(() => {
  const k = document.querySelector('.sim-knob[data-ch="0"]');
  const r = k.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y };
});
await page.mouse.move(knob.x, knob.y + 60);
await page.mouse.down();
await page.mouse.move(knob.x, knob.y + 20, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(500);
r.ledFill = await page.evaluate(() => {
  const lb = document.querySelector('.sim-ledbuiltin');
  return lb ? lb.getAttribute('fill') : 'NONE';
});
await page.click('#simStop');

console.log(JSON.stringify(r, null, 2));
console.log('Erreurs:', errors.slice(0, 3));
const ok = r.visible && r.ledBuiltin && r.sliders === 6 && r.maxed.cls && r.maxed.w === 1200 && r.ledFill === '#00979D';
console.log('PROD RESULT:', ok ? 'OK' : 'ECHEC');
await browser.close();
process.exit(0);