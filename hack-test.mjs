// Test du parseur + explicateur d'erreurs de compilation
import { parseErrors, explainError } from './src/hack.js';

const samples = [
  {
    name: 'variable non déclarée',
    raw: "sketch/sketch.ino:12:5: error: 'compteur' was not declared in this scope\n   compteur = 5;\n   ^~~~~~~~~",
    expect: /créer la variable/,
  },
  {
    name: 'point-virgule manquant',
    raw: "sketch/sketch.ino:8:1: error: expected ';' before '}' token\n }",
    expect: /point-virgule/,
  },
  {
    name: 'accolade manquante',
    raw: "sketch/sketch.ino:20:1: error: expected '}' at end of input",
    expect: /accolade/,
  },
  {
    name: 'mélange String/int',
    raw: "sketch/sketch.ino:15:10: error: cannot convert 'String' to 'int' in assignment",
    expect: /TEXTE et un NOMBRE/,
  },
  {
    name: 'fonction inconnue',
    raw: "sketch/sketch.ino:9:3: error: 'digitalWrite' was not declared in this scope",
    expect: /n'existe pas/,
  },
  {
    name: 'bibliothèque manquante',
    raw: "sketch/sketch.ino:1:10: fatal error: Servo.h: No such file or directory",
    expect: /bibliothèque/,
  },
  {
    name: 'erreur générique (aucune règle)',
    raw: "sketch/sketch.ino:3:1: error: expected unqualified-id before numeric constant",
    expect: /syntaxe générale/,
  },
];

let pass = 0;
for (const s of samples) {
  const errs = parseErrors(s.raw);
  const okParse = errs.length === 1 && errs[0].line > 0;
  const expl = errs.length ? explainError(errs[0]) : '';
  const okExpl = s.expect.test(expl);
  const ok = okParse && okExpl;
  if (ok) pass++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + s.name + (ok ? '' : '  → parse=' + okParse + ' expl=' + okExpl + ' "' + expl + '"'));
}
console.log(pass + '/' + samples.length);
process.exitCode = pass === samples.length ? 0 : 1;
