// Test navigateur réel (playwright-core + chromium caché) : une fois la page chargée,
// on ouvre le panneau simulation, on construit un blink via l'Exemple, on lance le mode
// VIRTUEL et on vérifie que la LED pin13 s'allume (attribut fill SVG).
import { chromium } from 'playwright-core';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const URL = process.env.URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Vider la sauvegarde auto pour repartir vide, puis charger l'exemple (blink analogRead)
await page.evaluate(() => localStorage.removeItem('arduino-blocks-workspace'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// S'il y a l'accueil, charger l'exemple
const welcomeVisible = await page.evaluate(() => {
  const w = document.getElementById('welcome');
  return w && w.style.display !== 'none';
});
if (welcomeVisible) {
  await page.click('#welcomeExample').catch(() => {});
  await page.waitForTimeout(400);
}

// Ouvrir le panneau simulation
await page.click('#simBtn');
await page.waitForTimeout(300);
const panelVisible = await page.evaluate(() => {
  const w = document.getElementById('simPanelWrap');
  return w && w.style.display !== 'none';
});
console.log('Panneau sim visible:', panelVisible);

// On force un programme simple : on nettoie et on ajoute LED clignotante via l'exemple est déjà bon.
// L'exemple fait analogRead(A0)>500 -> LED13. En virtuel, le slider A0 est à 0 -> SINON (LOW).
// Pour tester un allumage, on met le slider A0 à fond (valeur ~1023).
const sliderCount = await page.evaluate(() => document.querySelectorAll('.sim-knob').length);
console.log('Nombre de sliders A0..A5:', sliderCount);

// Lancer la simulation virtuelle
await page.selectOption('#simMode', 'virtual');
await page.click('#simRun');
await page.waitForTimeout(500);

// Vérifier le statut
const status = await page.textContent('#simStatus');
console.log('Statut virtuel:', JSON.stringify(status));

// Monter le slider A0 au maximum via le clic/pointerdown sur le knob + pointermove
// Simpler : appeler le modèle via l'objet sim n'est pas exposé ; on clique le slider défectueux.
// On utilise un pointerdown sur le knob A0 puis pointermove vertical pour le monter.
await page.evaluate(() => {
  const knob = document.querySelector('.sim-knob[data-ch="0"]');
  const svg = document.querySelector('.sim-board-svg');
  if (!knob || !svg || !svg.createSVGPoint) return;
  // Pointeur bas du slider (valeur max) : on simule un drag jusqu'en haut du trace
  const r = knob.getBoundingClientRect();
  knob.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1 }));
  const trace = document.querySelectorAll('.sim-knob')[0];
  window.__dragClientY = trace.getBoundingClientRect().y + 60;
});
await page.waitForTimeout(200);
await page.mouse.move(200, 100);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(400);

// Vérifier que la LED pin13 s'allume (fill teal) quand analogRead(A0) ~1023 > 500
const ledState = await page.evaluate(() => {
  const led = document.querySelector('.sim-board-svg circle[data-pin="13"]');
  return led ? led.getAttribute('fill') : 'NO_ELEMENT';
});
console.log('LED13 fill après A0 max (teal #00979D attendu):', ledState);

// Arrêter
await page.click('#simStop');
await page.waitForTimeout(200);

console.log('\nErreurs console:', errors.length ? errors.slice(0, 5) : 'aucune');
console.log('VISIBLE:', panelVisible, '| SLIDERS:', sliderCount, '| LED:', ledState);
await browser.close();
process.exit(0);