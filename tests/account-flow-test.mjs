import { createRequire } from 'module';
const require = createRequire('/root/arduino-blocks/');
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });

// flap usable clock for real async
let saved = { xml: '', code: '' };
await page.route('**/api/**', async (rt) => {
  const url = rt.request().url();
  const m = rt.request().method();
  const body = () => rt.request().postDataJSON ? rt.request().postDataJSON() : {};
  if (url.includes('/api/auth/me')) return rt.fulfill({ json: { ok: false, error: 'guest' } });
  if (url.includes('/api/auth/register') && m === 'POST') {
    const b = body();
    saved.username = b.username;
    return rt.fulfill({ json: { ok: true, user: { username: b.username, id: 1 } } });
  }
  if (url.includes('/api/programs') && m === 'GET') {
    return rt.fulfill({ json: { ok: true, programs: [saved.pg || { id: 42, name: saved.name || 'Mon programme' }] } });
  }
  if (/\/api\/programs\/\d+$/.test(url) && m === 'GET') {
    return rt.fulfill({ json: { ok: true, program: { id: 42, name: saved.name, xml: saved.xml, code: saved.code } } });
  }
  if (url.includes('/api/programs') && m === 'POST') {
    const b = body(); saved.name = b.name; saved.xml = b.xml; saved.code = b.code; saved.pg = { id: 42, name: b.name };
    return rt.fulfill({ json: { ok: true, program: { id: 42 } } });
  }
  if (url.includes('/api/programs') && m === 'PUT') {
    const b = body(); saved.xml = b.xml; saved.code = b.code;
    return rt.fulfill({ json: { ok: true } });
  }
  return rt.fulfill({ json: { ok: false, error: 'unhandled ' + m + ' ' + url } });
});
// mock HIBP (k-anonymity) => no breach
await page.route('**/api.pwnedpasswords.com/**', (rt) => rt.fulfill({ body: '0000000000000000000000000000000000000000:1\nABCDEF0123:0\n' }));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const errs = [];
page.on('pageerror', e => errs.push((e.message||'').slice(0,150)));

// open account modal (guest)
await page.click('#acctTopBtn');
await page.waitForTimeout(200);
await page.click('#acctTabRegister');
await page.fill('#acctRegUsername', 'testuser');
const pw = 'correct-horse-battery-staple';
await page.fill('#acctRegPassword', pw);
await page.fill('#acctRegPassword2', pw);
await page.waitForTimeout(700); // let zxcvbn + HIBP mock settle
const createEnabled = await page.$eval('#acctCreateBtn', el => !el.disabled);
console.log('choix:#acctCreateBtn activé:', createEnabled);
await page.click('#acctCreateBtn');
await page.waitForTimeout(500);
const member = await page.evaluate(() => document.getElementById('acctUsernameShown').textContent);
console.log('membre:', member);

// save current program (JSON)
await page.click('#acctSaveBtn');
await page.waitForTimeout(300);
// page.prompt handling for the name prompt
page.once('dialog', async (d) => { await d.accept('Ma démo SI'); });
await page.click('#acctSaveBtn');
await page.waitForTimeout(400);
const savedAfterSave = await page.evaluate(() => ({
  listRows: document.querySelectorAll('.acct-prog').length,
  saveLabel: document.getElementById('acctSaveBtn').textContent,
}));
console.log('programme:', JSON.stringify(savedAfterSave));
console.log('xml stocké (JSON?)', saved.xml.trim().startsWith('{'));
console.log('xml contient arduino_if:', saved.xml.includes('"type":"arduino_if"'));

// load back into workspace + code regenerated
const cppHasIf = (saved.code || '').includes('analogRead(A0) > 500');
console.log('code C++ sauvegardé contient la condition:', cppHasIf);
await browser.close();