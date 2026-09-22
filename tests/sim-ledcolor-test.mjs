import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const url = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => { if (document.readyState !== 'complete') window.dispatchEvent(new Event('load')); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const w = document.getElementById('welcome'); if (w) w.style.display = 'none'; });

// Construire un programme : LED sur D4 (sortie) + LED_BUILTIN
await page.evaluate(() => {
  const ws = window.Code.workspace;
  ws.clear();
  const led = ws.newBlock('arduino_digital_write');
  led.setFieldValue('4', 'PIN');
  led.setFieldValue('HIGH', 'STAT');
  try { led.initSvg(); } catch(_) {}
  try { led.render(); } catch(_) {}
});
await page.waitForTimeout(300);

// Ouvrir la simulation
await page.click('#simBtn');
await page.waitForTimeout(800);
// Maximiser la fenêtre sim (sinon la LED est hors de la zone visible)
await page.evaluate(() => { const m = document.getElementById('simMaxBtn'); if (m) m.click(); });
await page.waitForTimeout(300);
// Lancer le mode virtuel
await page.evaluate(() => {
  const run = document.getElementById('simRun');
  if (run) run.click();
});
await page.waitForTimeout(800);

// Vérifier qu'une LED de sortie D4 existe
const ledCount = await page.evaluate(() => document.querySelectorAll('.sim-dig-led').length);
console.log('LEDs de sortie rendues:', ledCount);

// Clic droit sur la LED D4 -> menu de couleurs
const box = await page.evaluate(() => {
  const led = document.querySelector('.sim-dig-led[data-pin="4"]');
  if (!led) return null;
  const r = led.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
});
console.log('position LED D4:', box);
if (box) {
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await page.waitForTimeout(300);
  const menuVisible = await page.evaluate(() => !!document.getElementById('simLedColorMenu'));
  console.log('menu couleur ouvert:', menuVisible);
  const swatches = await page.evaluate(() => {
      const menu = document.getElementById('simLedColorMenu');
      return menu ? menu.querySelectorAll('div[style*="border-radius"]').length : 0;
    });
    console.log('pastilles de couleur:', swatches);
    // cliquer sur la pastille rouge (2e)
    await page.evaluate(() => {
      const menu = document.getElementById('simLedColorMenu');
      const sw = menu ? menu.querySelectorAll('div[style*="border-radius"]')[1] : null;
      if (sw) sw.click();
    });
  await page.waitForTimeout(300);
  const menuGone = await page.evaluate(() => !document.getElementById('simLedColorMenu'));
  console.log('menu fermé après choix:', menuGone);
  const dotColor = await page.evaluate(() => {
    const led = document.querySelector('.sim-dig-led[data-pin="4"] .sim-dig-led-dot');
    return led ? led.getAttribute('fill') : null;
  });
  console.log('couleur du dot D4 après choix rouge:', dotColor);
}

console.log('\nPAGEERRORS:', errors.length ? errors : 'aucune');
await browser.close();
