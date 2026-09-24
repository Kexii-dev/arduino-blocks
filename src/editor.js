/* Éditeur C++ direct (Option B) — CodeMirror 6.
   Le panneau `</>` devient un vrai éditeur de code, prérempli du C++ généré par
   les blocs. Modèle UN SENS : les blocs restent la source de vérité. Si
   l'utilisateur édite à la main, une bannière prévient que « retourner aux blocs
   effacera ses modifications ». Pas de synchronisation bidirectionnelle (relire
   du C++ arbitraire → blocs est fragile et cher).

   Le lien pédagogique bloc↔lignes (Option A) reste actif tant que le code n'est
   PAS modifié à la main : on surligne les lignes du bloc sélectionné. Dès que
   l'utilisateur tape, on bascule en « mode manuel » (bannière + plus de mapping). */

import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

/* Thème sombre teal cohérent avec l'app (accent #00979D). On part de oneDark et
   on surcharge la sélection + le fond pour coller au style Arduino Blocks. */
const tealTheme = EditorView.theme({
  '&': { backgroundColor: '#1e1e1e', color: '#d4d4d4', height: '100%' },
  '.cm-content': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '12px', lineHeight: '1.5' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#00979D' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(0,151,157,.30)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(0,151,157,.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(0,151,157,.12)', color: '#a5f0f4' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#6a9955', borderRight: '1px solid #3c3c3c' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#6a9955' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(0,151,157,.25)', outline: '1px solid #00979D' },
});

/* Décoration de ligne pour le lien bloc↔lignes : surligne [start,end] (0-based). */
const setHighlight = StateEffect.define();
const highlightField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        deco = Decoration.none;
        if (e.value) {
          const { start, end } = e.value;
          const doc = tr.state.doc;
          const lines = [];
          for (let i = start; i <= end; i++) {
            // Decoration.line().range() attend une POSITION (offset caractère),
            // pas un numéro de ligne -> doc.line(n).from
            const line = doc.line(i + 1);
            lines.push(Decoration.line({ class: 'cm-block-hl' }).range(line.from));
          }
          deco = Decoration.set(lines);
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function createEditor(container, initialCode, { onManualEdit, onSelectionChange }) {
  let manual = false;

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      indentUnit.of('  '),
      syntaxHighlighting(defaultHighlightStyle),
      cpp(),
      oneDark,
      tealTheme,
      highlightField,
      EditorView.updateListener.of((u) => {
        // Détection d'une édition manuelle : le doc change (hors sélection/cursor).
        if (u.docChanged && !manual) {
          manual = true;
          if (onManualEdit) onManualEdit();
        }
        // Sélection (clic / curseur) -> surligner le bloc correspondant (mode non manuel).
        if (u.selectionSet && !manual && onSelectionChange) {
          const line = u.state.doc.lineAt(u.state.selection.main.head).number - 1; // 0-based
          onSelectionChange(line);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent: container });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (code) => {
      // manual=true pendant le dispatch : empêche le listener de re-détecter notre
      // propre changement de doc comme une édition manuelle (sinon boucle).
      manual = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
      manual = false;
    },
    highlight: (start, end) => {
      view.dispatch({ effects: setHighlight.of({ start, end }) });
    },
    clearHighlight: () => {
      view.dispatch({ effects: setHighlight.of(null) });
    },
    isManual: () => manual,
    setManual: (v) => { manual = v; },
    destroy: () => view.destroy(),
  };
}
