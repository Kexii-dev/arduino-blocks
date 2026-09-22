// Rendu SVG de la carte Arduino Uno virtuelle — UI UNIQUE pour les 2 moteurs.
// Se lie au modèle VirtualBoard via board.onChange; les interactions utilisateur
// (boutons, sliders A0-A5, console série) écrivent dans board et/ou appellent
// les hooks fournis par le contrôleur (engine.setButton / engine.setAnalog).

const teal = '#00979D';
const dark = '#1e1f22';
const pcb = '#0d5c63';
const pinCh = '#b9bbbe';

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
    this.buttons = {}; // pin -> SVG group
    this.sliders = {}; // channel -> {trace,knob,label}
    this.serialEl = null;
    this.buzzerEl = null;
    // abonnement au modèle
    this.board.onChange = (kind, p) => this._onModel(kind, p);
  }

  build(container) {
    container.innerHTML = '';
    this._container = container;
    const svg = el('svg', { viewBox: '0 0 560 320', class: 'sim-board-svg', xmlns: 'http://www.w3.org/2000/svg' });
    this._svgEl = svg;
    // PCB
    svg.appendChild(el('rect', { x: 12, y: 12, width: 536, height: 296, rx: 14, fill: pcb, stroke: '#0a474c', 'stroke-width': 3 }));
    // silkscreen text
    svg.appendChild(el('text', { x: 28, y: 34, fill: '#bfeef0', 'font-size': 13, 'font-family': 'monospace' }, ['ARDUINO UNO']));
    svg.appendChild(el('text', { x: 28, y: 292, fill: '#9fd8db', 'font-size': 9, 'font-family': 'monospace', opacity: .7 }, ['Simulation virtuelle — blocs ↔ AVR8js']));

    // ATmega328p chip
    const chip = el('g', { transform: 'translate(205,120)' });
    chip.appendChild(el('rect', { x: 0, y: 0, width: 150, height: 80, rx: 4, fill: '#121315', stroke: '#333', 'stroke-width': 1 }));
    chip.appendChild(el('text', { x: 75, y: 44, fill: '#ddd', 'font-size': 11, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['ATmega328P']));
    chip.appendChild(el('text', { x: 75, y: 60, fill: '#888', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['A5 A4 A3 A2 A1 A0']));
    // analog pins labels on chip bottom
    for (let c = 0; c < 6; c++) {
      chip.appendChild(el('circle', { cx: 208 + c * 22, cy: 200, r: 2.5, fill: '#777' }));
    }
    svg.appendChild(chip);

    // Boutons (pins 2 & 3) + LED témoin par pin digitale 2..13
    // rangée de pins digitales droite (2-13) -> LEDs je peux dessiner
    const pinX = 470;
    for (let p = 2; p <= 13; p++) {
      const y = 52 + (p - 2) * 18;
      svg.appendChild(el('circle', { cx: pinX, cy: y, r: 4, fill: pinCh }));
      svg.appendChild(el('text', { x: pinX + 12, y: y + 3, fill: '#b9bbbe', 'font-size': 8, 'font-family': 'monospace' }, [String(p)]));
      const led = el('circle', { cx: pinX + 46, cy: y, r: 5, fill: '#2a2c30', stroke: '#555', 'stroke-width': 1, 'data-pin': p });
      this.leds[p] = { led, x: pinX + 46, y };
      svg.appendChild(led);
    }
    svg.appendChild(el('text', { x: pinX - 4, y: 44, fill: '#9fd8db', 'font-size': 9, 'font-family': 'monospace' }, ['DIGITAL']));
    svg.appendChild(el('text', { x: pinX + 34, y: 44, fill: '#9fd8db', 'font-size': 9, 'font-family': 'monospace' }, ['LED']));

    // Boutons tactiles sur pins 2 et 3 (impulsion)
    let bx = 60;
    for (const p of [2, 3]) {
      const g = el('g', { transform: 'translate(' + bx + ',80)', 'data-pin': p, class: 'sim-btn' });
      g.appendChild(el('circle', { cx: 0, cy: 0, r: 22, fill: '#c0392b', stroke: '#7d2418', 'stroke-width': 2 }));
      g.appendChild(el('circle', { cx: 0, cy: 0, r: 12, fill: '#a93226' }));
      g.appendChild(el('text', { x: 0, y: 42, fill: '#eee', 'font-size': 9, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['Btn D' + p]));
      this.buttons[p] = g;
      svg.appendChild(g);
      bx += 56;
    }

    // Sliders analogiques A0..A5 (potentiomètres)
    const sx = 240;
    const sy = 228;
    svg.appendChild(el('text', { x: sx, y: sy - 14, fill: '#9fd8db', 'font-size': 9, 'font-family': 'monospace' }, ['ANALOG (potentiomètres) / console série']));
    for (let c = 0; c < 6; c++) {
      const x = sx + c * 40;
      const trace = el('line', { x1: x, y1: sy + 8, x2: x, y2: sy + 46, stroke: '#3a8b91', 'stroke-width': 5, 'stroke-linecap': 'round' });
      const knob = el('circle', { cx: x, cy: sy + 8, r: 7, fill: teal, stroke: '#dff6f7', 'stroke-width': 1.5, 'data-ch': c, class: 'sim-knob' });
      const label = el('text', { x: x, y: sy + 66, fill: '#cfe', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle', 'data-ch': c }, ['A' + c]);
      this.sliders[c] = { trace, knob, label, x, minY: sy + 8, maxY: sy + 46, val: 0 };
      svg.appendChild(trace); svg.appendChild(knob); svg.appendChild(label);
    }

    // Buzzer (pin 11) témoin + affichage fréquence
    const buz = el('g', { transform: 'translate(398,80)' });
    buz.appendChild(el('circle', { cx: 0, cy: 0, r: 20, fill: '#6f42c1', stroke: '#43256e', 'stroke-width': 2 }));
    buz.appendChild(el('text', { x: 0, y: 4, fill: '#fff', 'font-size': 14, 'text-anchor': 'middle', class: 'sim-buz-ico' }, ['♪']));
    buz.appendChild(el('text', { x: 0, y: 30, fill: '#d7c5f0', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle', class: 'sim-buz-freq' }, ['— Hz']));
    this.buzzerEl = { ico: buz.childNodes[1], freq: buz.childNodes[2] };
    svg.appendChild(buz);
    svg.appendChild(el('text', { x: 398, y: 116, fill: '#9fd8db', 'font-size': 9, 'font-family': 'monospace', 'text-anchor': 'middle' }, ['Buzzer D11']));

    container.appendChild(svg);

    // Console série (hors SVG, en dessous)
    const console = document.createElement('div');
    console.className = 'sim-serial';
    console.innerHTML = '<div class="sim-serial-title">📡 Console série <span class="sim-serial-clear">vider</span></div><pre class="sim-serial-body"></pre>';
    this.serialBody = console.querySelector('.sim-serial-body');
    const clearBtn = console.querySelector('.sim-serial-clear');
    clearBtn.addEventListener('click', () => { this.serialBody.textContent = ''; this.board.serialClear(); });
    container.appendChild(console);

    this._bind();

    // état initial position des sliders à 0
    this._renderAll();
    return this;
  }

  _bind() {
    // Boutons : pointerdown presser / pointerup relâcher
    for (const pin of Object.keys(this.buttons)) {
      const g = this.buttons[pin];
      const press = (down) => (ev) => {
        ev.preventDefault();
        g.setAttribute('opacity', down ? 0.7 : 1);
        this.board.setButton(+pin, down); // modèle (lecture par le moteur virtuel)
        if (this.hooks.setButton) this.hooks.setButton(+pin, down); // relais moteur réel
      };
      g.addEventListener('pointerdown', press(true));
      g.addEventListener('pointerup', press(false));
      g.addEventListener('pointerleave', press(false));
    }
    // Sliders : cliquer/déplacer le curseur
    for (const ch of Object.keys(this.sliders)) {
      const s = this.sliders[ch];
      s.knob.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this._dragCh = +ch;
        this._moveSlider(+ch, ev);
      });
    }
    // Drag global
    const onMove = (ev) => { if (this._dragCh != null) this._moveSlider(this._dragCh, ev); };
    const onUp = () => { this._dragCh = null; };
    this._container.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _moveSlider(ch, ev) {
    const ctm = this._svgEl.getScreenCTM ? this._svgEl.getScreenCTM().inverse() : null;
    let y = 0;
    if (ctm) { const p = this._svgEl.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; y = p.matrixTransform(ctm).y; }
    const s = this.sliders[ch];
    y = Math.max(s.minY, Math.min(s.maxY, y));
    this._setSliderValue(ch, Math.round(((s.maxY - y) / (s.maxY - s.minY)) * 1023));
  }

  _setSliderValue(ch, val) {
    const s = this.sliders[ch];
    s.val = val;
    // translate knob + trace
    const y = s.maxY - ((val / 1023) * (s.maxY - s.minY));
    s.knob.setAttribute('cy', y);
    this.board.setAnalog(ch, val);
    if (this.hooks.setAnalog) this.hooks.setAnalog(ch, val);
  }

  _renderAll() {
    for (let c = 0; c < 6; c++) {
      const s = this.sliders[c];
      const y = s.maxY - ((s.val / 1023) * (s.maxY - s.minY));
      s.knob.setAttribute('cy', y);
      s.trace.setAttribute('y2', y);
    }
  }

  _onModel(kind, p) {
    if (!p) return;
    if (kind === 'digital' || kind === 'pwm') {
      // pin 13 = LED built-in (même témoin que la LED pin13) ; on illumine le témoin de la pin si elle existe
      const target = this.leds[13]; // LED_BUILTIN
      if (p.pin === 13 && target) {
        const on = p.value > 0;
        target.led.setAttribute('fill', on ? teal : '#2a2c30');
        if (on) target.led.setAttribute('stroke', '#7ff0f4');
        else target.led.setAttribute('stroke', '#555');
      }
      // témoin par pin (digital write sur n'importe quelle pin)
      const pin = this.leds[p.pin];
      if (pin && p.pin !== 13) {
        const on = p.value > 0;
        pin.led.setAttribute('fill', on ? teal : '#2a2c30');
        pin.led.setAttribute('stroke', on ? '#7ff0f4' : '#555');
      }
    } else if (kind === 'analog') {
      // refleter aussi sur le modèle si c'est l'engine réel qui appelle
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