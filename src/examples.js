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
/* Exemples pensés pour le simulateur (servo animé, bouton-poussoir,   */
/* envoi série vers la carte, vitesse ×0,25 + bloc surligné).          */
/* ------------------------------------------------------------------ */
function numBlock(ws, n) {
  const b = mk(ws, 'math_number'); b.setFieldValue(n, 'NUM');
  return b;
}
function readPin(ws, pin) {
  const b = mk(ws, 'arduino_digital_read'); b.setFieldValue(pin, 'PIN');
  return b;
}
function servoTo(ws, deg) {
  const b = mk(ws, 'arduino_servo'); b.setFieldValue('9', 'PIN'); b.setFieldValue(deg, 'DEG');
  return b;
}
function waitMs(ws, ms) {
  const b = mk(ws, 'arduino_delay'); b.setFieldValue(ms, 'MS');
  return b;
}
function printValue(ws, value) {
  const p = mk(ws, 'arduino_serial_print');
  p.getInput('TEXT').connection.connect(value.outputConnection);
  return p;
}
function printText(ws, text) {
  const t = mk(ws, 'arduino_text'); t.setFieldValue(text, 'TEXT');
  return printValue(ws, t);
}

/* 11. Barrière de parking : bouton D2 -> servo levé + feu vert D4 */
function buildBarriere(ws) {
  const ifb = mk(ws, 'arduino_if');
  ifb.getInput('IF0').connection.connect(readPin(ws, '2').outputConnection);
  const up = servoTo(ws, 90);
  ifb.getInput('DO0').connection.connect(up.previousConnection);
  const vert = mk(ws, 'arduino_digital_write'); vert.setFieldValue('4', 'PIN'); vert.setFieldValue('HIGH', 'STAT');
  chain(up, vert);
  const down = servoTo(ws, 0);
  ifb.getInput('ELSE').connection.connect(down.previousConnection);
  const eteint = mk(ws, 'arduino_digital_write'); eteint.setFieldValue('4', 'PIN'); eteint.setFieldValue('LOW', 'STAT');
  chain(down, eteint);
  chain(ifb, waitMs(ws, 50));
  renderAll(ws);
}

/* 12. Sonnette : le buzzer sonne tant que le bouton D2 est enfoncé */
function buildSonnette(ws) {
  const ifb = mk(ws, 'arduino_if');
  ifb.getInput('IF0').connection.connect(readPin(ws, '2').outputConnection);
  const tone = mk(ws, 'arduino_tone'); tone.setFieldValue('11', 'PIN'); tone.setFieldValue(880, 'FREQ');
  ifb.getInput('DO0').connection.connect(tone.previousConnection);
  const notone = mk(ws, 'arduino_notone'); notone.setFieldValue('11', 'PIN');
  ifb.getInput('ELSE').connection.connect(notone.previousConnection);
  chain(ifb, waitMs(ws, 20));
  renderAll(ws);
}

/* 13. Essuie-glace : le servo balaie de 0° à 180° par pas de 45° */
function buildEssuieGlace(ws) {
  let prev = null;
  for (const deg of [0, 45, 90, 135, 180, 135, 90, 45]) {
    const s = servoTo(ws, deg);
    chain(prev, s);
    const d = waitMs(ws, 250);
    chain(s, d);
    prev = d;
  }
  renderAll(ws);
}

/* 14. Compter les appuis : chaque appui sur D2 ajoute 1 et l'affiche */
function buildCompteAppuis(ws) {
  declareVar('appuis', 'number');
  const init = mk(ws, 'arduino_serial_init'); init.setFieldValue(9600, 'BAUD');
  const vc = mk(ws, 'arduino_var_create'); vc.setFieldValue('appuis', 'NAME'); vc.setFieldValue('number', 'TYPE');
  chain(init, vc);
  const ifb = mk(ws, 'arduino_if');
  ifb.getInput('IF0').connection.connect(readPin(ws, '2').outputConnection);
  chain(vc, ifb);
  const inc = mk(ws, 'arduino_var_change'); inc.setFieldValue('appuis', 'VAR'); inc.setFieldValue(1, 'DELTA');
  ifb.getInput('DO0').connection.connect(inc.previousConnection);
  const get = mk(ws, 'arduino_var_get'); get.setFieldValue('appuis', 'VAR');
  const print = printValue(ws, get);
  chain(inc, print);
  // attendre que le bouton soit relâché : sinon un seul appui compterait plusieurs fois
  const wait = mk(ws, 'controls_whileUntil'); wait.setFieldValue('WHILE', 'MODE');
  wait.getInput('BOOL').connection.connect(readPin(ws, '2').outputConnection);
  wait.getInput('DO').connection.connect(waitMs(ws, 10).previousConnection);
  chain(print, wait);
  renderAll(ws);
}

/* 15. Commander la LED depuis la console : « a » allume, « e » éteint */
function buildCommandeSerie(ws) {
  declareVar('lettre', 'number');
  const init = mk(ws, 'arduino_serial_init'); init.setFieldValue(9600, 'BAUD');
  const vc = mk(ws, 'arduino_var_create'); vc.setFieldValue('lettre', 'NAME'); vc.setFieldValue('number', 'TYPE');
  chain(init, vc);
  const ifb = mk(ws, 'arduino_if');
  ifb.getInput('IF0').connection.connect(mk(ws, 'arduino_serial_available').outputConnection);
  chain(vc, ifb);
  const set = mk(ws, 'arduino_var_set'); set.setFieldValue('lettre', 'VAR');
  set.getInput('V').connection.connect(mk(ws, 'arduino_serial_read').outputConnection);
  ifb.getInput('DO0').connection.connect(set.previousConnection);
  // une lettre = un code : « a » = 97, « e » = 101 (table ASCII)
  let prev = set;
  for (const [code, stat, msg] of [[97, 'HIGH', 'LED allumée'], [101, 'LOW', 'LED éteinte']]) {
    const test = mk(ws, 'arduino_if');
    const cmp = mk(ws, 'logic_compare'); cmp.setFieldValue('EQ', 'OP');
    const get = mk(ws, 'arduino_var_get'); get.setFieldValue('lettre', 'VAR');
    cmp.getInput('A').connection.connect(get.outputConnection);
    cmp.getInput('B').connection.connect(numBlock(ws, code).outputConnection);
    test.getInput('IF0').connection.connect(cmp.outputConnection);
    const led = mk(ws, 'arduino_led'); led.setFieldValue(stat, 'STAT');
    test.getInput('DO0').connection.connect(led.previousConnection);
    chain(led, printText(ws, msg));
    chain(prev, test);
    prev = test;
  }
  chain(ifb, waitMs(ws, 20));
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
      { id: 'compteappuis', title: '🔢 Compter les appuis', desc: 'Chaque appui sur le bouton (broche 2) ajoute 1 au compteur, affiché dans la console série.',
        matos: '1 bouton-poussoir sur la broche 2 (avec résistance de tirage).',
        expl: 'La variable « appuis » augmente de 1 à chaque appui. La boucle « tant que » attend que le bouton soit relâché : sans elle, un seul appui compterait des dizaines de fois. Dans le simulateur, appuie sur D2 et regarde la console ; passe en vitesse ×0,25 avec « Suivre le programme » pour voir chaque étape.',
        build: buildCompteAppuis },
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
      { id: 'barriere', title: '🚧 Barrière de parking', desc: 'Tant qu\'on appuie sur le bouton (broche 2), la barrière se lève et le feu vert (broche 4) s\'allume.',
        matos: '1 servo sur la broche 9, 1 bouton sur la broche 2, 1 LED verte sur la broche 4.',
        expl: 'Si le bouton est enfoncé, le servo tourne à 90° (barrière levée) et la LED s\'allume ; sinon il revient à 0°. Dans le simulateur, garde D2 enfoncé et regarde le servo bouger.',
        build: buildBarriere },
      { id: 'sonnette', title: '🔔 Sonnette', desc: 'Le buzzer sonne tant qu\'on appuie sur le bouton (broche 2).',
        matos: '1 bouton sur la broche 2, 1 buzzer piézo sur la broche 11.',
        expl: 'Si le bouton est enfoncé, tone() joue 880 Hz ; dès qu\'on le relâche, noTone() coupe le son. Dans le simulateur, appuie sur D2 : la carte Buzzer s\'anime.',
        build: buildSonnette },
      { id: 'essuieglace', title: '🌧️ Essuie-glace', desc: 'Le servo balaie de 0° à 180° par pas de 45°, puis revient.',
        matos: '1 servo moteur sur la broche 9.',
        expl: 'Chaque bloc « servo » donne un angle, chaque « attendre » laisse le temps au servo d\'y arriver. Dans le simulateur, essaie les vitesses ×0,25 et ×4 pour voir le balayage ralentir ou accélérer.',
        build: buildEssuieGlace },
    ],
  },
  {
    theme: 'Série',
    items: [
      { id: 'serie', title: '💬 Envoyer un message', desc: 'La carte envoie « Bonjour ! » sur le port série toutes les secondes.',
        matos: 'Câble USB (moniteur série).',
        expl: 'Serial.begin(9600) prépare la communication. Serial.println() envoie le texte. On le voit dans le moniteur série de l\'ordinateur.',
        build: buildSerie },
      { id: 'commande', title: '⌨️ Commander la LED', desc: 'Envoie « a » pour allumer la LED, « e » pour l\'éteindre.',
        matos: 'Câble USB (moniteur série).',
        expl: 'Serial.available() dit si un caractère est arrivé, Serial.read() le lit. Chaque lettre a un code (table ASCII) : « a » = 97, « e » = 101. Dans le simulateur, tape a ou e dans le champ de la console série puis Envoyer.',
        build: buildCommandeSerie },
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
