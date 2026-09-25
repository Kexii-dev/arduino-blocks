/* Aide contextuelle sur les fonctions Arduino (par survol, dans l'éditeur C++).
   Associe chaque fonction clé à une explication claire pour débutants + un
   schéma des broches de l'Uno quand la fonction touche des pins. Branché dans
   editor.js via la CM6 extension `arduinoTooltip`.

   Le public est collégien/lycéen débutant : les explications évitent le jargon,
   donnent la signature réelle ET ce que ça fait en français simple. */

import { hoverTooltip } from '@codemirror/view';

/* Valeurs par défaut pour le schéma SVG (style teal de l'app).
   - rows : DIGITAL (0-13) et ANALOG (A0-A5), deux rangées.
   - pinW/pinH : taille d'une boîte de pin ; gap : espace entre boîtes. */
const PIN_W = 24, PIN_H = 15, GAP = 4, LABEL_H = 16;
const DIG_ROW_Y = 24, ANA_ROW_Y = 88;
const TEAL = '#00979D', TEAL_LIGHT = 'rgba(0,151,157,.20)', GRAY = '#3c3c3c', TEXT = '#d4d4d4';

/* Petit SVG pédagogique : une rangée de broches, celles correspondant au mode
   demandé sont surlignées en teal. Renvoie une chaîne svg (à injecter via
   innerHTML dans une div). */
export function buildPinSVG(mode) {
  let sets;
  let anaLbl = '';
  if (mode === 'pwm') {
    sets = [['3', '5', '6', '9', '10', '11']];
    anaLbl = 'Sortie PWM (analogWrite) — broches ~ marquées ~ sur la carte';
  } else if (mode === 'analog') {
    sets = [['A0', 'A1', 'A2', 'A3', 'A4', 'A5']];
    anaLbl = 'Entrées analogiques (analogRead) — valeurs 0 → 1023';
  } else if (mode === 'digital') {
    sets = [['2','3','4','5','6','7','8','9','10','11','12','13']];
    anaLbl = 'Broches numériques — entrées ou sorties (HIGH/LOW)';
  } else {
    return '';
  }

  const pins = sets[0];
  const n = pins.length;
  const w = n * (PIN_W + GAP) + GAP;
  const h = mode === 'digital' ? DIG_ROW_Y + PIN_H + LABEL_H : ANA_ROW_Y + 10;
  const x0 = GAP;
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="background:transparent">`;
  if (mode !== 'digital') {
    // rangée de pins analogiques
    svg += `<text x="0" y="${ANA_ROW_Y - 8}" fill="${TEXT}" font-size="11">Entrées analogiques</text>`;
    pins.forEach((p, i) => {
      const x = x0 + i * (PIN_W + GAP);
      svg += `<rect x="${x}" y="${ANA_ROW_Y}" width="${PIN_W}" height="${PIN_H}" rx="2" fill="${TEAL_LIGHT}" stroke="${TEAL}" stroke-width="1"/>`;
      svg += `<text x="${x + PIN_W / 2}" y="${ANA_ROW_Y + PIN_H / 2 + 4}" text-anchor="middle" fill="${TEAL}" font-size="10" font-weight="bold">${p}</text>`;
    });
  } else {
    // rangée de pins numériques (0-13) — on surligne celles du set
    svg += `<text x="0" y="${DIG_ROW_Y - 8}" fill="${TEXT}" font-size="11">Broches numériques D0 → D13</text>`;
    const setObj = {};
    pins.forEach((p) => { setObj[p] = true; });
    for (let p = 0; p <= 13; p++) {
      const x = x0 + p * (PIN_W + GAP);
      const hot = setObj[String(p)];
      svg += `<rect x="${x}" y="${DIG_ROW_Y}" width="${PIN_W}" height="${PIN_H}" rx="2" fill="${hot ? TEAL_LIGHT : 'transparent'}" stroke="${hot ? TEAL : GRAY}" stroke-width="1"/>`;
      svg += `<text x="${x + PIN_W / 2}" y="${DIG_ROW_Y + PIN_H / 2 + 4}" text-anchor="middle" fill="${hot ? TEAL : '#888888'}" font-size="9">${p}</text>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

/* Dictionnaire des fonctions Arduino expliquées. key = le nom tapé dans le code.
   - sig  : signature réelle (à afficher en monospace)
   - kind : court descriptif (header du tooltip)
   - fr   : explication claire débutant
   - pin  : optional mode SVG (pwm|analog|digital)
   - ex   : optional extra (plage de valeur / astuce) */
export const HELP = {
  'pinMode': {
    sig: 'pinMode(pin, mode)',
    kind: 'Configurer une broche',
    fr: 'Dit à la broche de servir d’entrée (INPUT) ou de sortie (OUTPUT). On appelle ça en général une fois, dans setup(). Ajoute PULLUP pour que la broche passe en entrée avec sa "résistance interne" (le bouton n’a plus besoin de fil à GND).',
    pin: 'digital',
    ex: 'mode : OUTPUT, INPUT, INPUT_PULLUP.',
  },
  'digitalWrite': {
    sig: 'digitalWrite(pin, valeur)',
    kind: 'Sortie numérique',
    fr: 'Envoie HAUT (HIGH = allumée, ~5 V) ou BAS (LOW = éteinte, 0 V) sur la broche. La broche doit être déclarée en OUTPUT avec pinMode().',
    pin: 'digital',
    ex: 'valeur : HIGH ou LOW.',
  },
  'digitalRead': {
    sig: 'digitalRead(pin)',
    kind: 'Entrée numérique',
    fr: 'Lit l’état de la broche : renvoie HIGH si elle voit ~5 V, LOW sinon. Sert à savoir si un bouton est appuyé (un bouton branché relie la broche à GND ou à 5 V).',
    pin: 'digital',
    ex: 'Renvoie HIGH (1) ou LOW (0).',
  },
  'analogWrite': {
    sig: 'analogWrite(pin, valeur)',
    kind: 'Sortie PWM (varier une LED/moteur)',
    fr: 'Fait varier la luminosité d’une LED ou la vitesse d’un moteur entre éteint et plein. Ce n’est pas une vraie tension variable : la broche s’allume/s’éteint très vite (PWM).',
    pin: 'pwm',
    ex: 'valeur : 0 (éteint) → 255 (plein). Broches ~ : 3, 5, 6, 9, 10, 11.',
  },
  'analogRead': {
    sig: 'analogRead(pin)',
    kind: 'Entrée analogique (capteur)',
    fr: 'Mesure une tension et renvoie un nombre de 0 à 1023 (0 V → ~5 V). Sert à lire un capteur de lumière, une température, un potentiomètre…',
    pin: 'analog',
    ex: 'Broches A0 → A5. 0 à 1023 (10 bits).',
  },
  'delay': {
    sig: 'delay(millisecondes)',
    kind: 'Pause',
    fr: 'Stoppe le programme pendant un moment (en millisecondes). 1000 ms = 1 seconde. Utile pour que tu puisses Voir le clignotement d’une LED. Pendant la pause, le programme ne fait rien d’autre.',
  },
  'delayMicroseconds': {
    sig: 'delayMicroseconds(microsecondes)',
    kind: 'Micro-pause',
    fr: 'Comme delay() mais en microsecondes (1000 µs = 1 ms). Pour des temporisations très courtes, souvent avec des capteurs.',
  },
  'tone': {
    sig: 'tone(pin, fréquence, durée?)',
    kind: 'Jouer un son',
    fr: 'Fait vibrer un buzzer ou un haut-parleur à une fréquence donnée (en hertz). Par exemple tone(11, 440) joue la note "la". La durée est optionnelle.',
    ex: 'Frères et sœurs de note : 262 (do), 294 (ré), 330 (mi), 349 (fa), 392 (sol), 440 (la), 494 (si).',
  },
  'noTone': {
    sig: 'noTone(pin)',
    kind: 'Couper le son',
    fr: 'Arrête un son lancé avec tone() sur la broche.',
  },
  'map': {
    sig: 'map(valeur, deMin, deMax, àMin, àMax)',
    kind: 'Mettre à l’échelle un nombre',
    fr: 'Convertit un nombre d’une plage vers une autre. Exemple : map(analogRead(A0), 0, 1023, 0, 255) transforme la valeur du capteur (0→1023) en valeur PWM (0→255).',
  },
  'constrain': {
    sig: 'constrain(valeur, min, max)',
    kind: 'Borne un nombre',
    fr: 'Empêche un nombre de dépasser une plage : s’il est trop petit, il devient min ; trop grand, il devient max.',
  },
  'millis': {
    sig: 'millis()',
    kind: 'Compteur de temps',
    fr: 'Renvoie le nombre de millisecondes écoulées depuis le démarrage de la carte. Sert à mesurer du temps SANS bloquer le programme (contrairement à delay()).',
  },
  'Serial.begin': {
    sig: 'Serial.begin(baud)',
    kind: 'Ouvrir le port série',
    fr: 'Prépare le port Série (USB) pour envoyer/recevoir des textes entre la carte et l’ordinateur. À mettre une fois dans setup().',
    ex: 'Baud le plus courant : 9600. À mettre d’accord avec le "moniteur série".',
  },
  'Serial.print': {
    sig: 'Serial.print(texte)',
    kind: 'Envoyer un texte',
    fr: 'Envoie du texte (ou un nombre) au moniteur série, sans aller à la ligne. Pratique pour voir ce que fait ton programme en direct.',
  },
  'Serial.println': {
    sig: 'Serial.println(texte)',
    kind: 'Envoyer un texte + saut de ligne',
    fr: 'Comme Serial.print mais passe à la ligne après. C’est le plus pratique pour lire une valeur à la suite.',
  },
};

/* Extension CodeMirror : tooltip qui apparaît au survol (ou focus) d’un nom de
   fonction connu. `hoverTooltip` de @codemirror/view. */

function tokenAt(view, pos) {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const rel = Math.max(0, Math.min(text.length, pos - line.from));
  let s = rel;
  while (s > 0 && /[A-Za-z0-9_.]/.test(text[s - 1])) s--;
  let e = rel;
  while (e < text.length && /[A-Za-z0-9_.]/.test(text[e])) e++;
  const word = text.slice(s, e);
  if (!(word in HELP)) return null;
  return { from: line.from + s, to: line.from + e, word };
}

function buildTipDom(word) {
  const h = HELP[word];
  const dom = document.createElement('div');
  dom.className = 'arduino-tip';
  const inner = document.createElement('div');
  inner.innerHTML =
    `<div class="arduino-tip-head">` +
    `<span class="arduino-tip-fn">${h.sig}</span>` +
    `<span class="arduino-tip-kind">${h.kind}</span>` +
    `</div>` +
    `<div class="arduino-tip-fr">${h.fr}</div>` +
    (h.ex ? `<div class="arduino-tip-ex">💡 ${h.ex}</div>` : '') +
    (h.pin ? `<div class="arduino-tip-pins">${buildPinSVG(h.pin)}</div>` : '');
  dom.appendChild(inner);
  return dom;
}

export const arduinoTooltip = hoverTooltip((view, pos) => {
  const t = tokenAt(view, pos);
  if (!t) return null;
  return {
    pos: t.from,
    end: t.to,
    above: true,
    create: () => ({ dom: buildTipDom(t.word) }),
  };
}, { hoverTime: 120 });
