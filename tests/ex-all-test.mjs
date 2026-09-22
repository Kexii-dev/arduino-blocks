import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const url = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => { if (document.readyState !== 'complete') window.dispatchEvent(new Event('load')); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const w = document.getElementById('welcome'); if (w) w.style.display = 'none'; });

const results = [];
try {
  await page.click('#exBtn');
  await page.waitForTimeout(200);
  const themes = await page.$$eval('.ex-theme', (els) => els.map((e) => e.dataset.theme));
  for (const th of themes) {
    await page.click(`.ex-theme[data-theme="${th}"]`);
    await page.waitForTimeout(200);
    const items = await page.$$eval('.ex-item', (els) => els.map((e) => e.dataset.id));
    for (const id of items) {
      await page.click(`.ex-item[data-id="${id}"]`);
      await page.waitForTimeout(150);
      await page.click('#exLoadBtn');
      await page.waitForTimeout(400);
      const blocks = await page.evaluate(() => window.Code.workspace.getAllBlocks().length);
      const code = await page.evaluate(() => document.getElementById('code').textContent);
      const ok = blocks > 0 && code.includes('void setup') && code.includes('void loop');
      results.push(`[${th}] ${id}: blocs=${blocks} C++=${ok ? 'OK' : 'VIDE/INVALIDE'}`);
      await page.click('#exBtn');
      await page.waitForTimeout(200);
      await page.click(`.ex-theme[data-theme="${th}"]`);
      await page.waitForTimeout(200);
    }
  }
} catch (e) {
  results.push('EXCEPTION: ' + e.message);
}
console.log(results.join('\n'));
console.log('\nPAGEERRORS:', errors.length ? errors : 'aucune');
await browser.close();
