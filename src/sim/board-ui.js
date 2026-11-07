// Rendu de la carte Arduino Uno virtuelle — UI UNIQUE pour les 2 moteurs.
// - La carte : plan SVG de l'Uno R3 (assets/uno.svg) + témoins lumineux superposés
//   (LED « L » = pin 13, un témoin au-dessus de chaque trou D2-D13).
// - Le panneau de contrôle : cartes HTML à côté de la carte (ou dessous si étroit) :
//   broches numériques, potentiomètres A0-A5, sorties PWM, buzzer, console série.
// Se lie au modèle VirtualBoard via board.onChange ; les interactions écrivent dans
// board et appellent les hooks du contrôleur (engine.setButton / engine.setAnalog).
//
// Broches numériques DYNAMIQUES selon le programme (setPinModes avant le run) :
//   - entrée (INPUT)  -> interrupteur nommé (pour la tester)
//   - sortie (OUTPUT) -> LED nommée (s'allume si HIGH ; clic droit = couleur)
//   - PWM             -> jauge 0-255 en lecture seule
//   - SERVO           -> servomoteur dessiné, palonnier orienté selon l'angle
// Une entrée est un bouton-POUSSOIR (HIGH tant qu'on appuie, défaut) ou un
// INTERRUPTEUR (bascule) : choix par broche, mémorisé pendant la session.

import unoBg from './assets/uno.svg?raw';

const ON = '#ffcc4d';
const LED_COLORS = [
  ['#ffcc4d', 'Jaune'], ['#ff4d4d', 'Rouge'], ['#4dff4d', 'Vert'], ['#4d9dff', 'Bleu'],
  ['#ff8c00', 'Orange'], ['#ff4dff', 'Rose'], ['#ffffff', 'Blanc'], ['#00e5ff', 'Cyan'],
];

/** Position réelle des trous dans le viewBox du plan (800 × 600). */
const PIN_X = { 13:392, 12:412, 11:432, 10:452, 9:472, 8:492, 7:552, 6:572, 5:592, 4:612, 3:632, 2:652 };
const PIN_Y = 64;                 // trous du header digital haut
const LED_L = { x: 630, y: 120 }; // LED_BUILTIN « L »
const BOARD_VIEWBOX = '8 40 752 520'; // recadré sur la carte (le plan fait 800 × 600)

function svgEl(tag, attrs) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}
function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export class BoardUI {
  constructor(board, hooks = {}) {
    this.board = board;
    this.hooks = hooks;     // { setButton(pin,pressed), setAnalog(channel,val) } fournis par le contrôleur
    this.leds = {};         // pin -> { led } témoin SVG au-dessus du trou
    this.buttons = {};      // pin -> élément HTML (interrupteur ou LED nommée)
    this.btnState = {};     // pin -> boolean (entrée à HIGH)
    this.inputKind = {};    // pin -> 'push' (défaut) | 'switch'
    this.servos = {};       // pin -> { horn, val }
    this.sliders = {};      // channel -> { input, value }
    this.pwmBars = {};      // pin -> { fill, value }
    this.pinModes = {};     // pin -> 'INPUT' | 'OUTPUT' | 'PWM'
    this.ledColors = {};    // pin -> couleur choisie (clic droit)
    this._ledOn = {};       // pin -> boolean
    this.board.onChange = (kind, p) => this._onModel(kind, p);
  }

  /** Définit le mode de chaque broche numérique, puis re-rend les contrôles. */
  setPinModes(map) {
    this.pinModes = {};
    for (const [pin, mode] of (map || new Map())) this.pinModes[+pin] = mode;
    if (this._digBody) { this._renderDigital(); this._renderPwm(); this._renderServos(); }
  }

  build(container) {
    container.innerHTML = '';
    this._container = container;
    container.classList.add('sim-layout');

    // ---- Carte (SVG) ----------------------------------------------------
    const stage = h('div', 'sim-stage');
    const svg = svgEl('svg', { viewBox: BOARD_VIEWBOX, class: 'sim-board-svg', role: 'img', 'aria-label': 'Carte Arduino Uno virtuelle' });
    this._svgEl = svg;
    const bg = svgEl('g', { class: 'uno-bg' });
    bg.innerHTML = unoBg.replace(/^<\?xml[^>]*\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    svg.appendChild(bg);
    // halo commun aux LEDs allumées
    const defs = svgEl('defs');
    defs.innerHTML = '<filter id="simGlow" x="-200%" y="-200%" width="500%" height="500%">' +
      '<feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg.appendChild(defs);
    // LED_BUILTIN « L » (pin 13)
    this.ledBuiltin = svgEl('circle', { cx: LED_L.x, cy: LED_L.y, r: 6, fill: '#555', stroke: '#333', 'stroke-width': 1, class: 'sim-ledbuiltin' });
    svg.appendChild(this.ledBuiltin);
    // témoins au-dessus des trous D2..D13
    for (let p = 2; p <= 13; p++) {
      const led = svgEl('circle', { cx: PIN_X[p], cy: PIN_Y - 12, r: 4, fill: '#2a2c30', stroke: '#777', 'stroke-width': .8, 'data-pin': p });
      this.leds[p] = { led };
      svg.appendChild(led);
    }
    stage.appendChild(svg);
    container.appendChild(stage);

    // ---- Panneau de contrôle (HTML) --------------------------------------
    const side = h('div', 'sim-side');

    // Broches numériques
    const dig = this._card('🔘 Broches numériques', 'sim-card-dig');
    this._digBody = h('div', 'sim-digital-ctrl');
    dig.appendChild(this._digBody);
    side.appendChild(dig);

    // Potentiomètres A0-A5
    const ana = this._card('🎛️ Entrées analogiques (A0-A5)', 'sim-card-ana');
    ana.appendChild(h('p', 'sim-hint', 'Déplace un curseur : analogRead() renvoie une valeur de 0 à 1023.'));
    const list = h('div', 'sim-ana-list');
    for (let c = 0; c < 6; c++) {
      const row = h('label', 'sim-ana-row');
      const name = h('span', 'sim-pin-name', 'A' + c);
      const input = h('input', 'sim-knob');
      input.type = 'range'; input.min = 0; input.max = 1023; input.value = 0; input.dataset.ch = c;
      input.setAttribute('aria-label', 'Potentiomètre A' + c);
      const val = h('output', 'sim-ana-val', '0');
      input.addEventListener('input', () => this._setSliderValue(c, +input.value));
      row.append(name, input, val);
      list.appendChild(row);
      this.sliders[c] = { input, val, value: 0 };
    }
    ana.appendChild(list);
    side.appendChild(ana);

    // Sorties PWM (masquée s'il n'y en a pas)
    this._pwmCard = this._card('🎚️ Sorties PWM (analogWrite)', 'sim-card-pwm');
    this._pwmBody = h('div', 'sim-pwm-list');
    this._pwmCard.appendChild(this._pwmBody);
    side.appendChild(this._pwmCard);

    // Servomoteurs (masquée s'il n'y en a pas)
    this._servoCard = this._card('⚙️ Servomoteurs', 'sim-card-servo');
    this._servoBody = h('div', 'sim-servo-list');
    this._servoCard.appendChild(this._servoBody);
    side.appendChild(this._servoCard);

    // Buzzer
    const buz = this._card('🔊 Buzzer', 'sim-card-buz');
    const buzRow = h('div', 'sim-buz');
    this._buzIcon = h('span', 'sim-buz-ico', '♪');
    this._buzFreq = h('span', 'sim-buz-freq', 'silencieux');
    buzRow.append(this._buzIcon, this._buzFreq);
    buz.appendChild(buzRow);
    side.appendChild(buz);

    // Console série
    const ser = this._card('📡 Console série', 'sim-serial');
    const clear = h('button', 'sim-serial-clear', 'Vider');
    clear.type = 'button';
    clear.addEventListener('click', () => { this.serialBody.textContent = ''; this.board.serialClear(); this._serialEmpty(true); });
    ser.querySelector('.sim-card-title').appendChild(clear);
    this.serialBody = h('pre', 'sim-serial-body');
    this._serialPh = h('div', 'sim-serial-empty', "Rien reçu pour l'instant. Le bloc « Envoyer ligne » écrit ici.");
    const send = h('form', 'sim-serial-send');
    const sendIn = h('input', 'sim-serial-input');
    sendIn.placeholder = 'Envoyer à la carte (Serial.read)…';
    sendIn.setAttribute('aria-label', 'Texte à envoyer à la carte');
    const sendBtn = h('button', 'sim-serial-btn', 'Envoyer');
    sendBtn.type = 'submit';
    send.append(sendIn, sendBtn);
    send.addEventListener('submit', (ev) => {
      ev.preventDefault();
      for (const ch of sendIn.value) this.board.serialInput(ch.charCodeAt(0));
      sendIn.value = '';
    });
    ser.append(this._serialPh, this.serialBody, send);

    // console = enfant direct de la grille : sous la carte en mode large, en dernier si étroit
    container.append(side, ser);

    this._renderDigital();
    this._renderPwm();
    this._renderServos();
    return this;
  }

  _card(title, cls) {
    const c = h('section', 'sim-card ' + (cls || ''));
    const t = h('div', 'sim-card-title');
    t.appendChild(h('span', null, title));
    c.appendChild(t);
    return c;
  }

  _pinsWith(mode) {
    const out = [];
    for (let p = 2; p <= 13; p++) if (this.pinModes[p] === mode) out.push(p);
    return out;
  }

  /** Interrupteurs (entrées) puis LEDs nommées (sorties). */
  _renderDigital() {
    const g = this._digBody;
    g.innerHTML = '';
    this.buttons = {};
    const ins = this._pinsWith('INPUT');
    const outs = this._pinsWith('OUTPUT');
    if (!ins.length && !outs.length) {
      g.appendChild(h('p', 'sim-hint',
        'Aucune broche utilisée. Ajoute « Écrire broche » (LED) ou « Lire broche » (interrupteur) à ton programme, puis lance la simulation.'));
      return;
    }
    if (ins.length) {
      const grp = h('div', 'sim-pin-group');
      grp.appendChild(h('div', 'sim-group-label', 'Entrées : appuie (poussoir) ou bascule (interrupteur)'));
      const row = h('div', 'sim-pin-row');
      for (const p of ins) row.appendChild(this._inputTile(p));
      grp.appendChild(row);
      g.appendChild(grp);
    }
    if (outs.length) {
      const grp = h('div', 'sim-pin-group');
      grp.appendChild(h('div', 'sim-group-label', 'Sorties : clic droit (ou appui long) pour la couleur'));
      const row = h('div', 'sim-pin-row');
      for (const p of outs) {
        const l = h('div', 'sim-dig-led');
        l.dataset.pin = p;
        l.title = 'Clic droit ou appui long : changer la couleur';
        l.append(h('span', 'sim-dig-led-dot'), h('span', 'sim-pin-name', 'D' + p));
        l.addEventListener('contextmenu', (ev) => this._openLedColorMenu(p, ev));
        this.buttons[p] = l;
        row.appendChild(l);
        this._repaintCtrlLed(p);
      }
      grp.appendChild(row);
      g.appendChild(grp);
    }
  }

  /** Jauges des sorties PWM (pilotées par le programme). */
  _renderPwm() {
    this._pwmBody.innerHTML = '';
    this.pwmBars = {};
    const pins = this._pinsWith('PWM');
    this._pwmCard.hidden = !pins.length;
    for (const p of pins) {
      const row = h('div', 'sim-pwm-row');
      const bar = h('div', 'sim-pwm-bar');
      const fill = h('div', 'sim-pwm-fill');
      bar.appendChild(fill);
      const val = h('output', 'sim-pwm-val', '0');
      row.append(h('span', 'sim-pin-name', 'D' + p), bar, val);
      this._pwmBody.appendChild(row);
      this.pwmBars[p] = { fill, val, value: 0 };
    }
  }

  /** Tuile d'une entrée : le contrôle (poussoir ou interrupteur) + le choix du type. */
  _inputTile(p) {
    const kind = this.inputKind[p] || 'push';
    const tile = h('div', 'sim-in-tile');
    const b = h('button', 'sim-btn sim-' + kind);
    b.type = 'button';
    b.dataset.pin = p;
    if (kind === 'switch') {
      b.setAttribute('role', 'switch');
      const track = h('span', 'sim-sw-track');
      track.appendChild(h('span', 'sim-sw-knob'));
      b.appendChild(track);
      b.addEventListener('click', () => this._setInput(p, !this.btnState[p]));
    } else {
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(h('span', 'sim-push-cap'));
      // HIGH tant qu'on appuie (souris, tactile, clavier)
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); b.setPointerCapture(ev.pointerId); this._setInput(p, true); });
      const up = () => { if (this.btnState[p]) this._setInput(p, false); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('keydown', (ev) => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); this._setInput(p, true); } });
      b.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); up(); } });
    }
    b.append(h('span', 'sim-pin-name', 'D' + p), h('span', 'sim-sw-state'));
    const sw = h('button', 'sim-kind', kind === 'push' ? '⇄ interrupteur' : '⏺ poussoir');
    sw.type = 'button';
    sw.title = 'Changer le type d\u0027entrée';
    sw.addEventListener('click', () => {
      this.inputKind[p] = kind === 'push' ? 'switch' : 'push';
      this._setInput(p, false);
      tile.replaceWith(this._inputTile(p));
    });
    tile.append(b, sw);
    this.buttons[p] = b;
    this._paintSwitch(p);
    return tile;
  }

  _setInput(p, on) {
    this.btnState[p] = on;
    this._paintSwitch(p);
    const val = on ? 1 : 0;
    this.board.setButton(p, val);
    if (this.hooks.setButton) this.hooks.setButton(p, val);
  }

  _paintSwitch(pin) {
    const b = this.buttons[pin];
    if (!b) return;
    const on = !!this.btnState[pin];
    b.classList.toggle('on', on);
    b.setAttribute(b.classList.contains('sim-switch') ? 'aria-checked' : 'aria-pressed', on ? 'true' : 'false');
    b.querySelector('.sim-sw-state').textContent = on ? 'HIGH' : 'LOW';
  }

  /** Servomoteurs : corps + palonnier qui tourne de 0 à 180°. */
  _renderServos() {
    this._servoBody.innerHTML = '';
    this.servos = {};
    const pins = this._pinsWith('SERVO');
    this._servoCard.hidden = !pins.length;
    for (const p of pins) {
      const row = h('div', 'sim-servo');
      const svg = svgEl('svg', { viewBox: '-50 -50 100 60', class: 'sim-servo-svg', 'aria-hidden': 'true' });
      svg.appendChild(svgEl('path', { d: 'M -40 0 A 40 40 0 0 1 40 0', fill: 'none', stroke: '#3a3e43', 'stroke-width': 2, 'stroke-dasharray': '2 4' }));
      svg.appendChild(svgEl('rect', { x: -22, y: -6, width: 44, height: 16, rx: 3, fill: '#1f4fa8' }));
      const horn = svgEl('g', { class: 'sim-servo-horn' });
      horn.appendChild(svgEl('path', { d: 'M -5 0 L -3 -36 Q 0 -40 3 -36 L 5 0 Z', fill: '#f2f2f2', stroke: '#bbb', 'stroke-width': 1 }));
      horn.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 7, fill: '#f2f2f2', stroke: '#bbb', 'stroke-width': 1 }));
      svg.appendChild(horn);
      const val = h('output', 'sim-servo-val', '90°');
      row.append(h('span', 'sim-pin-name', 'D' + p), svg, val);
      this._servoBody.appendChild(row);
      this.servos[p] = { horn, val };
      this._paintServo(p, this.board.servoAngle?.get(p) ?? 90);
    }
  }

  _paintServo(pin, deg) {
    const s = this.servos[pin];
    if (!s) return;
    // 0° = palonnier à gauche, 90° = vertical, 180° = à droite (vu de dessus)
    s.horn.style.transform = 'rotate(' + (deg - 90) + 'deg)';
    s.val.textContent = deg + '°';
  }

  _repaintCtrlLed(pin) {
    const l = this.buttons[pin];
    if (!l) return;
    const dot = l.querySelector('.sim-dig-led-dot');
    const on = !!this._ledOn[pin];
    const color = this.ledColors[pin] || ON;
    l.classList.toggle('on', on);
    dot.style.background = on ? color : '';
    dot.style.boxShadow = on ? '0 0 14px 4px ' + this._rgba(color, 0.55) : '';
  }

  /** Menu contextuel de choix de couleur pour une LED de sortie. */
  _openLedColorMenu(pin, ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const old = document.getElementById('simLedColorMenu');
    if (old) old.remove();
    const menu = h('div', 'sim-color-menu');
    menu.id = 'simLedColorMenu';
    menu.appendChild(h('div', 'sim-color-title', 'Couleur LED D' + pin));
    const grid = h('div', 'sim-color-grid');
    for (const [c, name] of LED_COLORS) {
      const sw = h('button', 'sim-color-swatch' + (this.ledColors[pin] === c ? ' sel' : ''));
      sw.type = 'button';
      sw.style.background = c;
      sw.title = name;
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ledColors[pin] = c;
        menu.remove();
        this._repaintCtrlLed(pin);
      });
      grid.appendChild(sw);
    }
    menu.appendChild(grid);
    document.body.appendChild(menu);
    // positionne près du clic, dans les limites de l'écran
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(ev.clientX, window.innerWidth - r.width - 8) + 'px';
    menu.style.top = Math.min(ev.clientY, window.innerHeight - r.height - 8) + 'px';
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', close); } };
    setTimeout(() => document.addEventListener('pointerdown', close), 0);
  }

  _rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  _setSliderValue(ch, val) {
    const s = this.sliders[ch];
    s.value = val;
    s.input.value = val;
    s.val.textContent = String(val);
    s.input.style.setProperty('--pct', (val / 1023 * 100) + '%');
    this.board.setAnalog(ch, val);
    if (this.hooks.setAnalog) this.hooks.setAnalog(ch, val);
  }

  /** Repousse l'état des interrupteurs et potentiomètres dans le modèle (après un reset). */
  syncInputs() {
    for (let c = 0; c < 6; c++) this.board.setAnalog(c, this.sliders[c].value);
    for (const p of Object.keys(this.btnState)) this.board.setButton(+p, this.btnState[p] ? 1 : 0);
  }

  /** Éteint toutes les sorties affichées (début d'un nouveau run). */
  clearOutputs() {
    this._paintLed(13, false);
    for (let p = 2; p <= 13; p++) this._paintLed(p, false);
    for (const p of Object.keys(this._ledOn)) { this._ledOn[p] = false; this._repaintCtrlLed(+p); }
    for (const p of Object.keys(this.pwmBars)) this._paintPwm(+p, 0);
    for (const p of Object.keys(this.servos)) this._paintServo(+p, 90);
    this._paintTone(null);
  }

  _paintLed(pin, on) {
    if (pin === 13 && this.ledBuiltin) {
      this.ledBuiltin.setAttribute('fill', on ? ON : '#555');
      this.ledBuiltin.setAttribute('stroke', on ? '#ffe08a' : '#333');
      if (on) this.ledBuiltin.setAttribute('filter', 'url(#simGlow)'); else this.ledBuiltin.removeAttribute('filter');
    }
    const t = this.leds[pin];
    if (t) {
      t.led.setAttribute('fill', on ? (this.ledColors[pin] || ON) : '#2a2c30');
      t.led.setAttribute('stroke', on ? '#ffe08a' : '#777');
      if (on) t.led.setAttribute('filter', 'url(#simGlow)'); else t.led.removeAttribute('filter');
    }
  }

  _paintPwm(pin, value) {
    const b = this.pwmBars[pin];
    if (!b) return;
    b.value = value;
    b.fill.style.width = (value / 255 * 100) + '%';
    b.val.textContent = String(value);
  }

  _paintTone(freq) {
    if (!this._buzIcon) return;
    this._buzIcon.classList.toggle('on', !!freq);
    this._buzFreq.textContent = freq ? freq + ' Hz' : 'silencieux';
  }

  _serialEmpty(empty) {
    if (this._serialPh) this._serialPh.hidden = !empty;
  }

  _onModel(kind, p) {
    if (!p) return;
    if (kind === 'digital' || kind === 'pwm') {
      const on = p.value > 0;
      this._paintLed(p.pin, on);
      if (this.pinModes[p.pin] === 'OUTPUT') {
        this._ledOn[p.pin] = on;
        this._repaintCtrlLed(p.pin);
      }
      if (kind === 'pwm') this._paintPwm(p.pin, p.value);
    } else if (kind === 'servo') {
      this._paintServo(p.pin, p.deg);
    } else if (kind === 'tone') {
      this._paintTone(p.freq);
    } else if (kind === 'serial' && this.serialBody) {
      this._serialEmpty(false);
      this.serialBody.textContent += p.text;
      this.serialBody.scrollTop = this.serialBody.scrollHeight;
    }
  }
}
