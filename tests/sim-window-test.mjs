import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
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

// Utiliser force:true pour contourner l'actionability check
const r = {};
r.visible = await page.evaluate(() => document.getElementById('simPanelWrap').style.display !== 'none');
await page.click('#simMaxBtn', { force: true });
await page.waitForTimeout(200);
r.maxed = await page.evaluate(() => {
  const w = document.getElementById('simPanelWrap');
  return { cls: w.classList.contains('sim-max'), w: w.offsetWidth, h: w.offsetHeight, btn: document.getElementById('simMaxBtn').textContent };
});
await page.click('#simMaxBtn', { force: true });
await page.waitForTimeout(200);
r.reduced = await page.evaluate(() => !document.getElementById('simPanelWrap').classList.contains('sim-max'));

// drag
const before = await page.evaluate(() => { const w = document.getElementById('simPanelWrap'); return { l: w.offsetLeft, t: w.offsetTop }; });
const bar = await page.evaluate(() => { const b = document.getElementById('simWinBar').getBoundingClientRect(); return { x: b.x + 40, y: b.y + 15 }; });
await page.mouse.move(bar.x, bar.y); await page.mouse.down(); await page.mouse.move(bar.x - 80, bar.y + 40, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(200);
const after = await page.evaluate(() => { const w = document.getElementById('simPanelWrap'); return { l: w.offsetLeft, t: w.offsetTop }; });
r.moved = after.l !== before.l || after.t !== before.t;

// resize
const size0 = await page.evaluate(() => { const w = document.getElementById('simPanelWrap'); return { w: w.offsetWidth, h: w.offsetHeight }; });
const rsz = await page.evaluate(() => { const r = document.getElementById('simResize').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(rsz.x, rsz.y); await page.mouse.down(); await page.mouse.move(rsz.x + 100, rsz.y + 60, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(200);
const sizeAfter = await page.evaluate(() => { const w = document.getElementById('simPanelWrap'); return { w: w.offsetWidth, h: w.offsetHeight }; });
r.resized = sizeAfter.w > size0.w && sizeAfter.h > size0.h;

await page.click('#simCloseBtn', { force: true });
await page.waitForTimeout(200);
r.closed = await page.evaluate(() => document.getElementById('simPanelWrap').style.display === 'none');

console.log(JSON.stringify(r, null, 2));
console.log('Erreurs:', errors.slice(0, 3));
const ok = r.visible && r.maxed.cls && r.reduced && r.moved && r.resized && r.closed;
console.log('RESULT:', ok ? 'OK' : 'ECHEC');
await browser.close();
process.exit(0);