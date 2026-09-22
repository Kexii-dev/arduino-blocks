/* Catalogue d'exemples pour la fenêtre 💡 Exemples.
   Chaque exemple = un builder de blocs (construit le workspace) + une fiche
   explicative (titre, description, matériel, explication).
   Les exemples s'inspirent des TP du livre « Arduino : premiers pas en
   informatique embarquée » (Eskimon) et des blocs disponibles dans l'app. */

/* Helper : crée un bloc, le rend, et le retourne. */
function mk(ws, type) {
  const b = ws.newBlock(type);
  try { b.initSvg(); } catch (_) {}
  try { b.render(); } catch (_) {}
  return b;
}
/* Déclare une fonction dans le registre (pour que le dropdown d'appel la liste). */
import { declareFunction } from './functions.js';
/* Déclare une variable dans le registre (pour que les dropdowns dynamiques la listent). */
import { declareVar } from './vars.js';
/* Chaîne deux blocs statement (a.next -> b.prev). */
function chain(a, b) {
  if (a && b && a.nextConnection && b.previousConnection) {
    a.nextConnection.connect(b.previousConnection);
  }
}
/* Rend tous les blocs du workspace (après construction). */
function renderAll(ws) {
  ws.getAllBlocks(true).forEach((b) => {
    try { b.initSvg(); } catch (_) {}
    try { b.render(); } catch (_) {}
  });
}

/* ------------------------------------------------------------------ */
/* 1. LED clignotante (Blink)                                          */
/* ------------------------------------------------------------------ */
function buildBlink(ws) {
  const led = mk(ws, 'arduino_led'); led.setFieldValue('HIGH', 'STAT');
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(1000, 'MS');
  chain(led, del);
  const led2 = mk(ws, 'arduino_led'); led2.setFieldValue('LOW', 'STAT');
  const del2 = mk(ws, 'arduino_delay'); del2.setFieldValue(1000, 'MS');
  chain(led2, del2);
  chain(del, led2);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 2. LED + capteur (analogRead > seuil)                               */
/* ------------------------------------------------------------------ */
function buildLedCapteur(ws) {
  const ifb = mk(ws, 'arduino_if');
  const cmp = mk(ws, 'logic_compare'); cmp.setFieldValue('GT', 'OP');
  ifb.getInput('IF0').connection.connect(cmp.outputConnection);
  const ar = mk(ws, 'arduino_analog_read'); ar.setFieldValue('A0', 'PIN');
  cmp.getInput('A').connection.connect(ar.outputConnection);
  const num = mk(ws, 'math_number'); num.setFieldValue(500, 'NUM');
  cmp.getInput('B').connection.connect(num.outputConnection);
  const hi = mk(ws, 'arduino_led'); hi.setFieldValue('HIGH', 'STAT');
  ifb.getInput('DO0').connection.connect(hi.previousConnection);
  const lo = mk(ws, 'arduino_led'); lo.setFieldValue('LOW', 'STAT');
  ifb.getInput('ELSE').connection.connect(lo.previousConnection);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 3. Bouton -> LED (digitalRead)                                      */
/* ------------------------------------------------------------------ */
function buildBouton(ws) {
  const ifb = mk(ws, 'arduino_if');
  const dr = mk(ws, 'arduino_digital_read'); dr.setFieldValue('2', 'PIN');
  ifb.getInput('IF0').connection.connect(dr.outputConnection);
  const hi = mk(ws, 'arduino_led'); hi.setFieldValue('HIGH', 'STAT');
  ifb.getInput('DO0').connection.connect(hi.previousConnection);
  const lo = mk(ws, 'arduino_led'); lo.setFieldValue('LOW', 'STAT');
  ifb.getInput('ELSE').connection.connect(lo.previousConnection);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 4. Feux de signalisation (2 feux synchronisés)                      */
/* ------------------------------------------------------------------ */
function buildFeux(ws) {
  // Feu 1 : rouge D2, jaune D3, vert D4
  const r1 = mk(ws, 'arduino_digital_write'); r1.setFieldValue('2', 'PIN'); r1.setFieldValue('HIGH', 'STAT');
  const g2 = mk(ws, 'arduino_digital_write'); g2.setFieldValue('7', 'PIN'); g2.setFieldValue('HIGH', 'STAT');
  chain(r1, g2);
  const d3 = mk(ws, 'arduino_delay'); d3.setFieldValue(3000, 'MS');
  chain(g2, d3);
  const g2off = mk(ws, 'arduino_digital_write'); g2off.setFieldValue('7', 'PIN'); g2off.setFieldValue('LOW', 'STAT');
  chain(d3, g2off);
  const j2 = mk(ws, 'arduino_digital_write'); j2.setFieldValue('6', 'PIN'); j2.setFieldValue('HIGH', 'STAT');
  chain(g2off, j2);
  const d1 = mk(ws, 'arduino_delay'); d1.setFieldValue(1000, 'MS');
  chain(j2, d1);
  const j2off = mk(ws, 'arduino_digital_write'); j2off.setFieldValue('6', 'PIN'); j2off.setFieldValue('LOW', 'STAT');
  chain(d1, j2off);
  const r2 = mk(ws, 'arduino_digital_write'); r2.setFieldValue('5', 'PIN'); r2.setFieldValue('HIGH', 'STAT');
  chain(j2off, r2);
  const d3b = mk(ws, 'arduino_delay'); d3b.setFieldValue(3000, 'MS');
  chain(r2, d3b);
  const r1off = mk(ws, 'arduino_digital_write'); r1off.setFieldValue('2', 'PIN'); r1off.setFieldValue('LOW', 'STAT');
  chain(d3b, r1off);
  const g1 = mk(ws, 'arduino_digital_write'); g1.setFieldValue('4', 'PIN'); g1.setFieldValue('HIGH', 'STAT');
  chain(r1off, g1);
  const d3c = mk(ws, 'arduino_delay'); d3c.setFieldValue(3000, 'MS');
  chain(g1, d3c);
  const g1off = mk(ws, 'arduino_digital_write'); g1off.setFieldValue('4', 'PIN'); g1off.setFieldValue('LOW', 'STAT');
  chain(d3c, g1off);
  const j1 = mk(ws, 'arduino_digital_write'); j1.setFieldValue('3', 'PIN'); j1.setFieldValue('HIGH', 'STAT');
  chain(g1off, j1);
  const d1b = mk(ws, 'arduino_delay'); d1b.setFieldValue(1000, 'MS');
  chain(j1, d1b);
  const j1off = mk(ws, 'arduino_digital_write'); j1off.setFieldValue('3', 'PIN'); j1off.setFieldValue('LOW', 'STAT');
  chain(d1b, j1off);
  const r1b = mk(ws, 'arduino_digital_write'); r1b.setFieldValue('2', 'PIN'); r1b.setFieldValue('HIGH', 'STAT');
  chain(j1off, r1b);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 5. Compteur (variable + boucle)                                     */
/* ------------------------------------------------------------------ */
function buildCompteur(ws) {
  declareVar('compteur', 'number'); // déclare avant de créer les blocs (dropdowns dynamiques)
  const vc = mk(ws, 'arduino_var_create'); vc.setFieldValue('compteur', 'NAME'); vc.setFieldValue('number', 'TYPE');
  const rep = mk(ws, 'controls_whileUntil'); rep.setFieldValue('WHILE', 'MODE');
  chain(vc, rep);
  // condition : compteur < 5
  const cmp = mk(ws, 'logic_compare'); cmp.setFieldValue('LT', 'OP');
  rep.getInput('BOOL').connection.connect(cmp.outputConnection);
  const vget = mk(ws, 'arduino_var_get'); vget.setFieldValue('compteur', 'VAR');
  cmp.getInput('A').connection.connect(vget.outputConnection);
  const num = mk(ws, 'math_number'); num.setFieldValue(5, 'NUM');
  cmp.getInput('B').connection.connect(num.outputConnection);
  // corps : compteur += 1, LED, attendre
  const vch = mk(ws, 'arduino_var_change'); vch.setFieldValue('compteur', 'VAR'); vch.setFieldValue(1, 'DELTA');
  rep.getInput('DO').connection.connect(vch.previousConnection);
  const led = mk(ws, 'arduino_led'); led.setFieldValue('HIGH', 'STAT');
  chain(vch, led);
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(500, 'MS');
  chain(led, del);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 6. Série : envoyer un message                                       */
/* ------------------------------------------------------------------ */
function buildSerie(ws) {
  const init = mk(ws, 'arduino_serial_init'); init.setFieldValue(9600, 'BAUD');
  const txt = mk(ws, 'arduino_text'); txt.setFieldValue('Bonjour !', 'TEXT');
  const print = mk(ws, 'arduino_serial_print');
  print.getInput('TEXT').connection.connect(txt.outputConnection);
  chain(init, print);
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(1000, 'MS');
  chain(print, del);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 7. Tonalité (buzzer)                                                */
/* ------------------------------------------------------------------ */
function buildTone(ws) {
  const tone = mk(ws, 'arduino_tone'); tone.setFieldValue('11', 'PIN'); tone.setFieldValue(440, 'FREQ');
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(500, 'MS');
  chain(tone, del);
  const notone = mk(ws, 'arduino_notone'); notone.setFieldValue('11', 'PIN');
  chain(del, notone);
  const del2 = mk(ws, 'arduino_delay'); del2.setFieldValue(500, 'MS');
  chain(notone, del2);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 8. Servo moteur                                                      */
/* ------------------------------------------------------------------ */
function buildServo(ws) {
  const s1 = mk(ws, 'arduino_servo'); s1.setFieldValue('9', 'PIN'); s1.setFieldValue(0, 'DEG');
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(1000, 'MS');
  chain(s1, del);
  const s2 = mk(ws, 'arduino_servo'); s2.setFieldValue('9', 'PIN'); s2.setFieldValue(180, 'DEG');
  chain(del, s2);
  const del2 = mk(ws, 'arduino_delay'); del2.setFieldValue(1000, 'MS');
  chain(s2, del2);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 9. PWM : LED qui respire (fade)                                     */
/* ------------------------------------------------------------------ */
function buildPwm(ws) {
  const aw = mk(ws, 'arduino_analog_write'); aw.setFieldValue('9', 'PIN'); aw.setFieldValue(0, 'VAL');
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(100, 'MS');
  chain(aw, del);
  const aw2 = mk(ws, 'arduino_analog_write'); aw2.setFieldValue('9', 'PIN'); aw2.setFieldValue(128, 'VAL');
  chain(del, aw2);
  const del2 = mk(ws, 'arduino_delay'); del2.setFieldValue(100, 'MS');
  chain(aw2, del2);
  const aw3 = mk(ws, 'arduino_analog_write'); aw3.setFieldValue('9', 'PIN'); aw3.setFieldValue(255, 'VAL');
  chain(del2, aw3);
  const del3 = mk(ws, 'arduino_delay'); del3.setFieldValue(100, 'MS');
  chain(aw3, del3);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* 10. Fonction : clignoter (définir + appeler)                        */
/* ------------------------------------------------------------------ */
function buildFonction(ws) {
  declareFunction('clignoter'); // déclare avant de créer l'appel (dropdown dynamique)
  const fn = mk(ws, 'arduino_function'); fn.setFieldValue('clignoter', 'NAME');
  const led = mk(ws, 'arduino_led'); led.setFieldValue('HIGH', 'STAT');
  fn.getInput('BODY').connection.connect(led.previousConnection);
  const del = mk(ws, 'arduino_delay'); del.setFieldValue(500, 'MS');
  chain(led, del);
  const led2 = mk(ws, 'arduino_led'); led2.setFieldValue('LOW', 'STAT');
  chain(del, led2);
  const del2 = mk(ws, 'arduino_delay'); del2.setFieldValue(500, 'MS');
  chain(led2, del2);
  const call = mk(ws, 'arduino_function_call'); call.setFieldValue('clignoter', 'NAME');
  chain(fn, call);
  renderAll(ws);
}

/* ------------------------------------------------------------------ */
/* Catalogue : thèmes -> exemples                                      */
/* ------------------------------------------------------------------ */
export const EXAMPLES = [
  {
    theme: 'LED',
    items: [
      { id: 'blink', title: '💡 LED clignotante', desc: 'La LED intégrée s\'allume et s\'éteint toutes les secondes.',
        matos: 'Aucun (LED intégrée sur la carte).',
        expl: 'C\'est le programme « Hello World » de l\'Arduino. On allume la LED (HIGH), on attend 1 s, on l\'éteint (LOW), on attend 1 s, et on recommence pour toujours.',
        build: buildBlink },
      { id: 'pwm', title: '🎚 LED qui respire (PWM)', desc: 'Une LED sur la broche 9 change de luminosité en douceur.',
        matos: '1 LED + 1 résistance 220 Ω sur la broche 9.',
        expl: 'La broche 9 est une sortie PWM : elle peut varier la luminosité de 0 à 255. On change la valeur par paliers pour créer un effet de respiration.',
        build: buildPwm },
    ],
  },
  {
    theme: 'Capteurs',
    items: [
      { id: 'ledcapteur', title: '🔆 LED + capteur', desc: 'Si le capteur analogique A0 dépasse 500, la LED s\'allume, sinon elle s\'éteint.',
        matos: '1 potentiomètre ou photorésistance sur A0 + 1 LED.',
        expl: 'On lit la valeur analogique (0 à 1023) sur A0. Si elle est supérieure à 500, on allume la LED ; sinon on l\'éteint. C\'est une condition « si / alors / sinon ».',
        build: buildLedCapteur },
      { id: 'bouton', title: '🔘 Bouton → LED', desc: 'Quand on appuie sur le bouton (broche 2), la LED s\'allume.',
        matos: '1 bouton poussoir sur la broche 2 + 1 LED.',
        expl: 'On lit l\'état du bouton avec digitalRead. S\'il est appuyé (HIGH), on allume la LED ; sinon on l\'éteint.',
        build: buildBouton },
    ],
  },
  {
    theme: 'Contrôle',
    items: [
      { id: 'feux', title: '🚦 Feux de signalisation', desc: 'Deux feux routiers synchronisés (rouge, jaune, vert).',
        matos: '6 LED (2 rouges, 2 jaunes, 2 vertes) + 6 résistances 220 Ω sur les broches 2-7.',
        expl: 'On pilote 6 LED pour simuler deux feux routiers synchronisés. Chaque séquence dure 3 s (vert) ou 1 s (jaune). C\'est le TP classique du livre Eskimon.',
        build: buildFeux },
      { id: 'compteur', title: '🔢 Compteur', desc: 'Une variable compte de 1 à 5, la LED clignote à chaque pas.',
        matos: 'Aucun (LED intégrée).',
        expl: 'On crée une variable « compteur », on la répète 5 fois en l\'augmentant de 1, et on fait clignoter la LED à chaque tour.',
        build: buildCompteur },
    ],
  },
  {
    theme: 'Sons & servo',
    items: [
      { id: 'tone', title: '🎵 Tonalité (buzzer)', desc: 'Le buzzer émet un son de 440 Hz pendant 0,5 s.',
        matos: '1 buzzer piézo sur la broche 11.',
        expl: 'tone() fait émettre une fréquence au buzzer, noTone() l\'arrête. 440 Hz = la note « la » du diapason.',
        build: buildTone },
      { id: 'servo', title: '🔄 Moteur servo', desc: 'Le servo va de 0° à 180° et revient.',
        matos: '1 servo moteur sur la broche 9.',
        expl: 'Le servo tourne à l\'angle demandé (0 à 180°). On le met à 0°, on attend, puis à 180°, et on recommence.',
        build: buildServo },
    ],
  },
  {
    theme: 'Série',
    items: [
      { id: 'serie', title: '💬 Envoyer un message', desc: 'La carte envoie « Bonjour ! » sur le port série toutes les secondes.',
        matos: 'Câble USB (moniteur série).',
        expl: 'Serial.begin(9600) prépare la communication. Serial.println() envoie le texte. On le voit dans le moniteur série de l\'ordinateur.',
        build: buildSerie },
    ],
  },
  {
    theme: 'Fonctions',
    items: [
      { id: 'fonction', title: '📦 Fonction clignoter', desc: 'On définit une fonction « clignoter » puis on l\'appelle.',
        matos: 'Aucun (LED intégrée).',
        expl: 'Une fonction regroupe des actions réutilisables. On définit « clignoter » (allumer, attendre, éteindre, attendre) puis on l\'appelle pour l\'exécuter.',
        build: buildFonction },
    ],
  },
];
