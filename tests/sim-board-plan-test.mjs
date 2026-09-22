import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const welcome = await page.evaluate(() => { const w = document.getElementById('welcome'); return w && w.style.display !== 'none'; });
if (welcome) await page.click('#welcomeExample').catch(()=>{});
await page.waitForTimeout(400);
await page.click('#simBtn');
await page.waitForTimeout(600);
// max
await page.click('#simMaxBtn', { force: true }).catch(()=>{});
await page.waitForTimeout(500);

const r = {};
r.unoBg = await page.evaluate(() => {
  const bg = document.querySelector('.uno-bg');
  if (!bg) return null;
  const pinHoles = bg.querySelectorAll('.pin-hole').length;
  const leds = bg.querySelectorAll('.led-off').length;
  const shapes = bg.querySelectorAll('path, rect, circle, polygon').length;
  const vb = bg.getAttribute('viewBox');
  return { pinHoles, leds, shapes, vb };
});
r.ledBuiltin = await page.evaluate(() => !!document.querySelector('.sim-ledbuiltin'));
r.sliders = await page.evaluate(() => document.querySelectorAll('.sim-knob').length);
r.buttons = await page.evaluate(() => document.querySelectorAll('.sim-btn').length);
r.digLeds = await page.evaluate(() => document.querySelectorAll('.sim-board-svg circle[data-pin]').length);

await page.screenshot({ path: '/tmp/uno-svg/board-plan.png', fullPage: true });
console.log(JSON.stringify(r, null, 2));
console.log('Erreurs:', errors.slice(0, 3));
console.log('RESULT: OK');
await browser.close();
process.exit(0);