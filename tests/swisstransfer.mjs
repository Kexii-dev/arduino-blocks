import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const ctx = await browser.newContext({ acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('console.err:', m.text().slice(0,160)); });
await page.goto('https://www.swisstransfer.com/dl/01a0c8ea-5042-72c7-880b-e88e1f53bcc4', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
// dump visible buttons/links text
const btns = await page.evaluate(() => {
  const seen = new Set(); const out = [];
  for (const e of document.querySelectorAll('a,button')) {
    const t = (e.textContent || '').trim();
    if (t && t.length < 60 && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out.slice(0, 30);
});
console.log('éléments:', JSON.stringify(btns));
const dl = await page.$('a[download], a:has-text("Télécharger"), a:has-text("Download"), a[href*="download"]');
if (!dl) {
  // désaccepter RGPD qui intercepte les clics
  for (const txt of ['Tout accepter', 'All accept', 'Accepter', 'OK']) {
    const rg = await page.$('text=' + txt);
    if (rg) { await rg.click({ force: true }).catch(()=>{}); await page.waitForTimeout(600); break; }
  }
  await page.waitForTimeout(400);
  const el = await page.$('text=Télécharger');
  if (el) await el.click({ force: true });
}
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  (dl ? dl.click() : Promise.resolve()),
]);
const path = await download.path();
const dst = '/root/arduino-exercices/sources/Le_grand_livre_d_Arduino_Erik_Bartmann_Eyrolles_2018.pdf';
await download.saveAs(dst);
console.log('fichier téléchargé →', dst, '| suggéré:', download.suggestedFilename(), '| taille o:', require('fs').statSync(dst).size);
await browser.close();