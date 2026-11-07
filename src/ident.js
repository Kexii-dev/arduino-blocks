/* Identifiants et littéraux sûrs, partagés par le générateur C++ et le générateur JS
   du simulateur. Un nom de variable/fonction saisi par l'élève (« ma fonction »,
   « école », « int ») doit devenir un identifiant valide dans les DEUX langages,
   sinon la compile casse (C++) ou du JS arbitraire s'exécute (simu via new Function). */

// Mots réservés C++/JS + noms déjà pris par le sketch ou la fausse API du simulateur.
const RESERVED = new Set([
  // C++
  'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default',
  'delete', 'do', 'double', 'else', 'enum', 'extern', 'false', 'float', 'for', 'goto', 'if',
  'inline', 'int', 'long', 'namespace', 'new', 'operator', 'private', 'protected', 'public',
  'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template',
  'this', 'throw', 'true', 'try', 'typedef', 'union', 'unsigned', 'using', 'virtual', 'void',
  'volatile', 'while', 'and', 'or', 'not', 'xor',
  // JS
  'async', 'await', 'export', 'function', 'import', 'in', 'instanceof', 'let', 'null',
  'of', 'typeof', 'undefined', 'var', 'with', 'yield', 'arguments', 'eval',
  // Arduino / sketch / simulateur
  'setup', 'loop', 'main', 'String', 'Serial', 'Servo', 'HIGH', 'LOW', 'INPUT', 'OUTPUT',
  'LED_BUILTIN', 'byte', 'boolean', 'word', 'delay', 'millis', 'micros', 'pinMode',
  'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'tone', 'noTone', 'random',
  'pow', 'map', 'min', 'max', 'abs', 'fake',
]);

/** Transforme une saisie libre en identifiant valide C++ et JS (idempotent). */
export function toIdent(raw) {
  let s = String(raw == null ? '' : raw)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!s) s = 'nom';
  if (/^[0-9]/.test(s)) s = '_' + s;
  if (RESERVED.has(s)) s += '_';
  return s;
}

/** Littéral chaîne entre guillemets doubles, valide en C++ comme en JS. */
export function toStringLiteral(raw) {
  return '"' + String(raw == null ? '' : raw)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t') + '"';
}
