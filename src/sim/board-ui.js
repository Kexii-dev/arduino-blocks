// Rendu SVG de la carte Arduino Uno virtuelle — UI UNIQUE pour les 2 moteurs.
// Fond : plan SVG net des pins de l'Uno R3 (coordonnées explicites 800×600).
// Par-dessus : éléments interactifs aux positions réelles des pins.
// Se lie au modèle VirtualBoard via board.onChange ; les interactions (boutons,
// sliders A0-A5, console série) écrivent dans board et/ou appellent les hooks
// fournis par le contrôleur (engine.setButton / engine.setAnalog).
//
// Pins digitales DYNAMIQUES selon le mode (défini par setPinModes avant le run) :
//   - pin en entrée (INPUT)  -> bouton pressable nommé (pour la tester)
//   - pin en sortie (OUTPUT) -> LED nommée (s'allume si HIGH)
// Le témoin (halo) au-dessus du trou reste toujours présent sur la carte.

import unoBg from './assets/uno.svg?raw';

const teal = '#00979D';
const ON = '#ffcc4d';

/** Position réelle des pins dans le viewBox du plan (800 × 600). */
const PIN_X = { 13:392, 12:412, 11:432, 10:452, 9:472, 8:492, 7:552, 6:572, 5:592, 4:612, 3:632, 2:652 };
const PIN_Y = 64;              // trous du header digital haut
const ANA_X = { 0:492, 1:512, 2:532, 3:552, 4:572, 5:592 };
const ANA_Y = 535;             // trous du header analogique
const LED_L = { x: 630, y: 120 }; // LED_BUILTIN « L »

// Zone de contrôle : 2 rangées sous la carte.
const DIG_Y = 610;   // rangée pins digitales (boutons/LEDs dynamiques)
const ANA_Y0 = 700;  // rangée analogiques + buzzer
const ANA_H = 170;   // hauteur rangée analogique (3 lignes A0-A5 + sliders PWM)
const VIEW_H = 880;

function el(tag, attrs, children) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  (children || []).forEach((c) => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}

export class BoardUI {
  constructor(board, hooks = {}) {
    this.board = board;
    this.hooks = hooks; // { setButton(pin,pressed), setAnalog(channel,val) } delivered by controller
    this.leds = {};   // pin -> SVG circle (LED témoin par pin digitale)
    this.buttons = {}; // pin -> SVG group (bouton ou LED nommée, zone de contrôle)
    this.sliders = {}; // channel -> {trace,knob,label}
    this.serialEl = null;
    this.buzzerEl = null;
    this.pinModes = {}; // pin -> 'INPUT' | 'OUTPUT' (défini par setPinModes)
    // abonnement au modèle
    this.board.onChange = (kind, p) => this._onModel(kind, p);
  }

  /** Définit le mode (INPUT/OUTPUT) de chaque pin digitale, puis re-rend la zone de contrôle. */
  setPinModes(map) {
    this.pinModes = {};
    for (const [pin, mode] of (map || new Map())) this.pinModes[pin] = mode;
    if (this._ctrlG) this._renderDigitalControls();
  }

  build(container) {
    container.innerHTML = '';
    this._container = container;
    const svg = el('svg', { viewBox: '0 0 820 ' + VIEW_H, class: 'sim-board-svg', xmlns: 'http://www.w3.org/2000/svg' });
    this._svgEl = svg;

    // ---- Fond : plan Uno (800×600) en haut à gauche ----------------------
    const bgSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bgSvg.setAttribute('viewBox', '0 0 800 600');
    bgSvg.setAttribute('x', '0');
    bgSvg.setAttribute('y', '0');
    bgSvg.setAttribute('width', '800');
    bgSvg.setAttribute('height', '600');
    bgSvg.setAttribute('class', 'uno-bg');
    bgSvg.innerHTML = unoBg.replace(/^<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    svg.appendChild(bgSvg);

    // =====================================================================
    // ÉLÉMENTS INTERACTIFS SUPERPOSÉS
    // =====================================================================

    // ---- LED_BUILTIN dédiée : par-dessus la LED « L » du plan ----------
    const lb = el('g', { transform: 'translate(' + LED_L.x + ',' + LED_L.y + ')' });
    lb.appendChild(el('circle', { cx: 0, cy: 0, r: 4, fill: '#555', stroke: '#333', 'stroke-width': 1, class: 'sim-ledbuiltin' }));
    svg.appendChild(lb);
    this.ledBuiltin = lb.childNodes[0];

    // ---- Témoins LEDs des pins digitales 2..13 (halo autour du trou) ----
    for (let p = 2; p <= 13; p++) {
      const led = el('circle', { cx: PIN_X[p], cy: PIN_Y - 12, r: 4, fill: '#2a2c30', stroke: '#777', 'stroke-width': .8, 'data-pin': p });
      this.leds[p] = { led, x: PIN_X[p], y: PIN_Y - 12 };
      svg.appendChild(led);
    }

    // =====================================================================
    // ZONE DE CONTRÔLE (sous la carte)
    // =====================================================================

    // ---- Rangée 1 : pins digitales dynamiques (boutons/LEDs nommés) ----
    svg.appendChild(el('rect', { x: 10, y: DIG_Y, width: 800, height: 82, rx: 10, fill: '#16181a', stroke: '#2a2d30' }));
    svg.appendChild(el('text', { x: 20, y: DIG_Y + 16, fill: '#9fd8db', 'font-size': 10, 'font-family': 'monospace' }, ['DIGITAL']));
    const ctrlG = el('g', { class: 'sim-digital-ctrl' });
    this._ctrlG = ctrlG;
    svg.appendChild(ctrlG);

    // ---- Rangée 2 : analogiques + buzzer ----
    svg.appendChild(el('rect', { x: 10, y: ANA_Y0, width: 800, height: ANA_H, rx: 10, fill: '#16181a', stroke: '#2a2d30' }));
    svg.appendChild(el('text', { x: 20, y: ANA_Y0 + 16, fill: '#9fd8db', 'font-size': 10, 'font-family': 'monospace' }, ['ANALOG']));
    // conteneur des sliders PWM (sorties read-only, pilotés par l'app)
    const pwmG = el('g', { class: 'sim-pwm-ctrl' });
    this._pwmG = pwmG;
    svg.appendChild(pwmG);

    // Sliders A0..A5 — horizontaux, 2 par ligne (3 lignes)
    // Chaque slider : piste horizontale + curseur qui glisse + label A0..A5 à gauche.
    const SL_W = 250;          // longueur de piste
    const SL_X1 = 70;          // départ piste slider 1
    const SL_X2 = 420;         // départ piste slider 2
    const SL_ROW = [22, 46, 70]; // décalages Y des 3 lignes
    for (let c = 0; c < 6; c++) {
      const row = Math.floor(c / 2);       // 0,1,2
      const col = c % 2;                   // 0=gauche, 1=droite
      const y = ANA_Y0 + SL_ROW[row];
      const x1 = col === 0 ? SL_X1 : SL_X2;
      const x2 = x1 + SL_W;
      const trace = el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: '#2a2d30', 'stroke-width': 5, 'stroke-linecap': 'round' });
      const fill = el('line', { x1: x1, y1: y, x2: x1, y2: y, stroke: teal, 'stroke-width': 5, 'stroke-linecap': 'round', class: 'sim-slider-fill' });
      const knob = el('circle', { cx: x1, cy: y, r: 6, fill: teal, stroke: '#dff6f7', 'stroke-width': 1.5, 'data-ch': c, class: 'sim-knob' });
      const label = el('text', { x: x1 - 12, y: y + 3, fill: '#cfe', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'end', 'data-ch': c }, ['A' + c]);
      const pct = el('text', { x: x2 + 14, y: y + 3, fill: '#9fd8db', 'font-size': 8, 'font-family': 'monospace', 'data-ch': c, class: 'sim-slider-pct' }, ['0%']);
      this.sliders[c] = { trace, fill, knob, label, pct, x1, x2, y, val: 0 };
      svg.appendChild(trace); svg.appendChild(fill); svg.appendChild(knob); svg.appendChild(label); svg.appendChild(pct);
    }

    // Buzzer (pin 11), à droite
    const buz = el('g', { transform: 'translate(760,' + (ANA_Y0 + 38) + ')' });
    buz.appendChild(el('circle', { cx: 0, cy: 0, r: 16, fill: '#6f42c1', stroke: '#43256e', 'stroke-width': 2 }));
    buz.appendChild(el('text', { x: 0, y: 4, fill: '#fff', 'font-size': 12, 'text-anchor': 'middle', class: 'sim-buz-ico' }, ['♪']));
    buz.appendChild(el('text', { x: 0, y: -22, fill: '#d7c5f0', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle', class: 'sim-buz-freq' }, ['— Hz']));
    this.buzzerEl = { ico: buz.childNodes[1], freq: buz.childNodes[2] };
    svg.appendChild(buz);
    svg.appendChild(el('text', { x: 760, y: ANA_Y0 + 74, fill: '#9fd8db', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['Buzzer D11']));

    container.appendChild(svg);

    // ---- Console série (hors SVG, en dessous) ----------------------------
    const console = document.createElement('div');
    console.className = 'sim-serial';
    console.innerHTML = '<div class="sim-serial-title">📡 Console série <span class="sim-serial-clear">vider</span></div><pre class="sim-serial-body"></pre>';
    this.serialBody = console.querySelector('.sim-serial-body');
    const clearBtn = console.querySelector('.sim-serial-clear');
    clearBtn.addEventListener('click', () => { this.serialBody.textContent = ''; this.board.serialClear(); });
    container.appendChild(console);

    this._bindSliders();

    // état initial position des sliders à 0
    this._renderAll();
    this._renderDigitalControls();
    return this;
  }

  /** Rend les boutons (entrée) / LEDs (sortie) des pins digitales dans la rangée 1. */
  _renderDigitalControls() {
    const g = this._ctrlG;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    this.buttons = {};
    this.btnState = {}; // pin -> boolean (interrupteur à bascule ON/OFF)
    let x = 26;
    // Passe 1 : toutes les entrées (interrupteurs) à gauche
    for (let p = 2; p <= 13; p++) {
      const mode = this.pinModes[p] || this.pinModes['' + p];
      if (mode !== 'INPUT') continue;
      // Interrupteur à bascule ON/OFF nommé (track + curseur + étiquette O/I)
      const b = el('g', { transform: 'translate(' + x + ',' + (DIG_Y + 38) + ')', 'data-pin': p, class: 'sim-btn' });
      b.appendChild(el('rect', { x: 0, y: 0, width: 52, height: 26, rx: 13, fill: '#2b2e31', stroke: '#4a4e53', 'stroke-width': 1.2, class: 'sim-sw-track' }));
      b.appendChild(el('rect', { x: 3, y: 3, width: 46, height: 20, rx: 10, fill: 'none', stroke: '#1d2023', 'stroke-width': 1 }));
      b.appendChild(el('circle', { cx: 13, cy: 13, r: 9, fill: '#e8eaed', stroke: '#9aa0a6', 'stroke-width': 1, class: 'sim-sw-knob' }));
      b.appendChild(el('circle', { cx: 11, cy: 9.5, r: 3, fill: '#fff', opacity: .55 }));
      b.appendChild(el('text', { x: 9.5, y: 18, fill: '#7d848c', 'font-size': 7, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['O']));
      b.appendChild(el('text', { x: 42.5, y: 18, fill: '#7d848c', 'font-size': 7, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['I']));
      b.appendChild(el('text', { x: 26, y: 43, fill: '#eee', 'font-size': 9, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['D' + p]));
      this.buttons[p] = b;
      this.btnState[p] = false;
      g.appendChild(b);
      x += 68;
    }
    // Passe 2 : toutes les sorties (LEDs) alignées TOUT À DROITE de la rangée
    const outPins = [];
    for (let p = 2; p <= 13; p++) {
      const m = this.pinModes[p] || this.pinModes['' + p];
      if (m === 'OUTPUT') outPins.push(p);
    }
    // bord droit fixe (rangée 800 de large, marge ~20) ; on remonte vers la gauche
    let lx = 757 - (outPins.length - 1) * 68;
    for (const p of outPins) {
      const l = el('g', { transform: 'translate(' + lx + ',' + (DIG_Y + 34) + ')', 'data-pin': p, class: 'sim-dig-led' });
      l.appendChild(el('circle', { cx: 26, cy: 14, r: 17, fill: 'none', class: 'sim-dig-led-halo' }));
      l.appendChild(el('circle', { cx: 26, cy: 14, r: 12, fill: '#1c1f22', stroke: '#3a3e43', 'stroke-width': 1.5 }));
      l.appendChild(el('circle', { cx: 26, cy: 14, r: 10, fill: '#2a2c30', stroke: '#555', 'stroke-width': 1, class: 'sim-dig-led-dot' }));
      l.appendChild(el('ellipse', { cx: 22, cy: 10, rx: 4, ry: 2.5, fill: '#fff', opacity: .5, class: 'sim-dig-led-gloss' }));
      l.appendChild(el('text', { x: 26, y: 46, fill: '#eee', 'font-size': 9, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['D' + p]));
      this.buttons[p] = l;
      g.appendChild(l);
      lx += 68;
    }
    this._bindButtons();
    this._renderPwmSliders();
  }

  /** Rend les sliders PWM (sorties analogWrite) — read-only, pilotés par l'app. */
  _renderPwmSliders() {
    const g = this._pwmG;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    this.pwmSliders = {};
    const pwmPins = [];
    for (let p = 2; p <= 13; p++) {
      const m = this.pinModes[p] || this.pinModes['' + p];
      if (m === 'PWM') pwmPins.push(p);
    }
    if (!pwmPins.length) return;
    // titre SORTIES PWM
    g.appendChild(el('text', { x: 20, y: ANA_Y0 + 92, fill: '#e0a35c', 'font-size': 9, 'font-family': 'monospace' }, ['SORTIES PWM (analogWrite)']));
    const SL_W = 250, SL_X1 = 70, SL_X2 = 420;
    const rows = [116, 140, 164];
    for (let i = 0; i < pwmPins.length; i++) {
      const pin = pwmPins[i];
      const row = Math.floor(i / 2);
      const col = i % 2;
      const y = ANA_Y0 + rows[row];
      const x1 = col === 0 ? SL_X1 : SL_X2;
      const x2 = x1 + SL_W;
      const trace = el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: '#2a2d30', 'stroke-width': 5, 'stroke-linecap': 'round' });
      const fill = el('line', { x1: x1, y1: y, x2: x1, y2: y, stroke: '#e0a35c', 'stroke-width': 5, 'stroke-linecap': 'round', class: 'sim-pwm-fill' });
      const knob = el('circle', { cx: x1, cy: y, r: 6, fill: '#e0a35c', stroke: '#f5d9b0', 'stroke-width': 1.5, class: 'sim-pwm-knob' });
      const label = el('text', { x: x1 - 12, y: y + 3, fill: '#e0a35c', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'end' }, ['D' + pin]);
      const pct = el('text', { x: x2 + 14, y: y + 3, fill: '#e0a35c', 'font-size': 8, 'font-family': 'monospace', class: 'sim-pwm-pct' }, ['0%']);
      this.pwmSliders[pin] = { trace, fill, knob, label, pct, x1, x2, y, val: 0 };
      g.appendChild(trace); g.appendChild(fill); g.appendChild(knob); g.appendChild(label); g.appendChild(pct);
    }
  }

  /** Repaint un interrupteur selon son état ON/OFF (track teal/grau, curseur coulé). */
  _paintSwitch(pin) {
    const g = this.buttons[pin];
    if (!g) return;
    const on = !!this.btnState[pin];
    const track = g.querySelector('.sim-sw-track');
    const knob = g.querySelector('.sim-sw-knob');
    if (track) {
      track.setAttribute('fill', on ? '#00979D' : '#2b2e31');
      track.setAttribute('stroke', on ? '#0ec4cc' : '#4a4e53');
    }
    if (knob) knob.setAttribute('cx', on ? 39 : 13);
    g.setAttribute('class', 'sim-btn' + (on ? ' on' : ''));
  }

  _bindButtons() {
    for (const pin of Object.keys(this.buttons)) {
      const g = this.buttons[pin];
      if (g._bound) continue;
      g._bound = true;
      // Interrupteur à bascule : un clic/tap inverse l'état et le verrouille.
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
      });
      g.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.btnState[pin] = !this.btnState[pin];
        this._paintSwitch(+pin);
        const val = this.btnState[pin] ? 1 : 0;
        this.board.setButton(+pin, val);
        if (this.hooks.setButton) this.hooks.setButton(+pin, val);
      });
    }
  }

  _bindSliders() {
    for (const ch of Object.keys(this.sliders)) {
      const s = this.sliders[ch];
      s.knob.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this._dragCh = +ch;
        this._moveSlider(+ch, ev);
      });
    }
    const onMove = (ev) => { if (this._dragCh != null) this._moveSlider(this._dragCh, ev); };
    const onUp = () => { this._dragCh = null; };
    this._container.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _moveSlider(ch, ev) {
    const ctm = this._svgEl.getScreenCTM ? this._svgEl.getScreenCTM().inverse() : null;
    let x = 0;
    if (ctm) { const p = this._svgEl.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; x = p.matrixTransform(ctm).x; }
    const s = this.sliders[ch];
    x = Math.max(s.x1, Math.min(s.x2, x));
    this._setSliderValue(ch, Math.round(((x - s.x1) / (s.x2 - s.x1)) * 1023));
  }

  _setSliderValue(ch, val) {
    const s = this.sliders[ch];
    s.val = val;
    const x = s.x1 + ((val / 1023) * (s.x2 - s.x1));
    s.knob.setAttribute('cx', x);
    s.fill.setAttribute('x2', x);
    s.pct.textContent = Math.round((val / 1023) * 100) + '%';
    this.board.setAnalog(ch, val);
    if (this.hooks.setAnalog) this.hooks.setAnalog(ch, val);
  }

  _renderAll() {
    for (let c = 0; c < 6; c++) {
      const s = this.sliders[c];
      const x = s.x1 + ((s.val / 1023) * (s.x2 - s.x1));
      s.knob.setAttribute('cx', x);
      s.fill.setAttribute('x2', x);
      s.pct.textContent = Math.round((s.val / 1023) * 100) + '%';
    }
  }

  _onModel(kind, p) {
    if (!p) return;
    if (kind === 'digital' || kind === 'pwm') {
      const on = p.pin === 13 && p.value > 0;
      if (this.ledBuiltin) {
        this.ledBuiltin.setAttribute('fill', on ? ON : '#555');
        this.ledBuiltin.setAttribute('stroke', on ? '#ffe08a' : '#333');
      }
      const target = this.leds[13];
      if (p.pin === 13 && target) {
        target.led.setAttribute('fill', on ? ON : '#2a2c30');
        target.led.setAttribute('stroke', on ? '#ffe08a' : '#777');
      }
      const pin = this.leds[p.pin];
      if (pin && p.pin !== 13) {
        const pinOn = p.value > 0;
        pin.led.setAttribute('fill', pinOn ? ON : '#2a2c30');
        pin.led.setAttribute('stroke', pinOn ? '#ffe08a' : '#777');
      }
      // LED nommée de la rangée de contrôle (si la pin est en sortie)
      const ctrl = this.buttons[p.pin];
      if (ctrl && this.pinModes[p.pin] === 'OUTPUT') {
        const dot = ctrl.querySelector('.sim-dig-led-dot');
        const halo = ctrl.querySelector('.sim-dig-led-halo');
        const gloss = ctrl.querySelector('.sim-dig-led-gloss');
        const on2 = p.value > 0;
        if (dot) {
          dot.setAttribute('fill', on2 ? '#ffcc4d' : '#2a2c30');
          dot.setAttribute('stroke', on2 ? '#ffe08a' : '#555');
        }
        if (halo) {
          halo.setAttribute('fill', on2 ? 'rgba(255,204,77,0.35)' : 'none');
          halo.setAttribute('stroke', on2 ? 'rgba(255,204,77,0.6)' : 'none');
        }
        if (gloss) gloss.setAttribute('opacity', on2 ? 0.85 : 0.5);
      }
      // Slider PWM (sortie analogWrite) : l'app fait bouger le curseur
      if (this.pwmSliders && this.pwmSliders[p.pin]) {
        const s = this.pwmSliders[p.pin];
        s.val = p.value; // 0..255
        const x = s.x1 + ((p.value / 255) * (s.x2 - s.x1));
        s.knob.setAttribute('cx', x);
        s.fill.setAttribute('x2', x);
        s.pct.textContent = Math.round((p.value / 255) * 100) + '%';
      }
    } else if (kind === 'analog') {
      if (this.sliders['' + p.channel]) this._renderAll();
    } else if (kind === 'tone') {
      if (this.buzzerEl) {
        if (p.freq) { this.buzzerEl.freq.textContent = p.freq + ' Hz'; this.buzzerEl.ico.setAttribute('fill', '#ffe08a'); }
        else { this.buzzerEl.freq.textContent = '— Hz'; this.buzzerEl.ico.setAttribute('fill', '#fff'); }
      }
    } else if (kind === 'serial' && this.serialBody) {
      this.serialBody.textContent += p.text;
      this.serialBody.scrollTop = this.serialBody.scrollHeight;
    }
  }
}