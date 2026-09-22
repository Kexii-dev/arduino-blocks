/* Registre des variables typées (nombre | texte).
   Un bloc `arduino_var_create` déclare une variable ; les blocs set/get/change/append
   listent dynamiquement les variables du bon type via un menuGenerator Blockly. */

export const VARS = new Map(); // nom -> 'number' | 'text'

export function declareVar(name, type) {
  if (!name) return;
  VARS.set(name, type);
}

export function varType(name) {
  return VARS.get(name) || 'number';
}

/* Générateur d'options pour un dropdown de variables d'un type donné.
   Retourne une fonction (menuGenerator Blockly) : [ [label, value], ... ]. */
export function varOptions(type) {
  return function () {
    const opts = [];
    for (const [name, t] of VARS) {
      if (t === type) opts.push([name, name]);
    }
    if (!opts.length) opts.push(['(aucune variable ' + (type === 'number' ? 'nombre' : 'texte') + ')', '']);
    return opts;
  };
}

/* Toutes les variables, quel que soit le type (pour set/get qui acceptent les deux). */
export function varOptionsAll() {
  return function () {
    const opts = [];
    for (const [name, t] of VARS) opts.push([name + (t === 'text' ? ' (texte)' : ''), name]);
    if (!opts.length) opts.push(['(créer une variable avant)', '']);
    return opts;
  };
}

/* Options par défaut (si aucune variable déclarée) — garde un fallback lisible. */
export function defaultVarOptions(type) {
  const base = type === 'number'
    ? [['valeur', 'valeur'], ['x', 'x'], ['y', 'y'], ['compteur', 'compteur'], ['v', 'v'], ['t', 't']]
    : [['message', 'message'], ['texte', 'texte'], ['nom', 'nom'], ['s', 's']];
  return base;
}
