/* Registre des fonctions définies par l'utilisateur.
   Un bloc `arduino_function` déclare une fonction ; le bloc `arduino_function_call`
   liste dynamiquement les fonctions via un menuGenerator Blockly (même pattern
   que les variables dans vars.js). */

export const FUNCTIONS = new Set(); // noms de fonctions

export function declareFunction(name) {
  if (name) FUNCTIONS.add(name);
}

/* Générateur d'options pour le dropdown d'appel de fonction.
   Retourne une fonction (menuGenerator Blockly) : [ [label, value], ... ].
   Inclut la valeur courante du champ en fallback (programmes legacy / renommage
   en cours) pour que setFieldValue ne casse pas sur une valeur hors options. */
export function functionOptions() {
  return function () {
    const opts = [];
    for (const n of FUNCTIONS) opts.push([n, n]);
    const cur = this && typeof this.getValue === 'function' ? this.getValue() : null;
    if (cur && !FUNCTIONS.has(cur)) opts.unshift([cur, cur]);
    if (!opts.length) opts.push(['(définir une fonction avant)', '']);
    return opts;
  };
}
