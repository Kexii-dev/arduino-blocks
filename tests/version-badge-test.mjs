// Vérifie que le badge de version s'affiche dans le header.
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const v = await page.evaluate(() => document.getElementById('appVersion')?.textContent || 'ABSENT');
console.log('Badge version:', v);
const ok = /^v\d+\.\d+\.\d+$/.test(v);
console.log('RESULT:', ok ? 'OK' : 'ECHEC');
await browser.close();
process.exit(0);