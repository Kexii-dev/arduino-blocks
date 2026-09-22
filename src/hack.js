/* Popup « effet hacker » + explication des erreurs de compilation.
   Parse la sortie brute d'arduino-cli (res.error), traduit chaque erreur C++
   en explication claire pour débutants, et l'affiche dans un terminal animé. */

/* ---- 1. Parser la sortie brute ---- */
export function parseErrors(raw) {
  if (!raw) return [];
  const errs = [];
  const re = /\.ino:(\d+):(\d+):\s*(?:fatal\s+)?error:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(raw)) !== null) {
    errs.push({ line: +m[1], col: +m[2], message: m[3].trim() });
  }
  return errs;
}

/* ---- 2. Traduire une erreur C++ en explication débutant ---- */
const RULES = [
  { re: /not declared in this scope/, explain: 'Un bloc utilise une variable ou une fonction qui n\'existe pas encore. Ajoute un bloc « créer la variable » avant de l\'utiliser, ou vérifie l\'orthographe du nom.' },
  { re: /expected ';'/, explain: 'Il manque un point-virgule ( ; ) — un bloc est probablement incomplet ou mal connecté.' },
  { re: /expected '}'/, explain: 'Il manque une accolade ( } ) — un bloc « si » ou « tant que » n\'est pas fermé.' },
  { re: /expected '\)'/, explain: 'Il manque une parenthèse — un bloc est incomplet.' },
  { re: /cannot convert .*String.*int|invalid conversion from .*String.*int|no known conversion for argument.*String.*int/, explain: 'Tu mélanges un TEXTE et un NOMBRE. Un bloc texte ne peut pas être branché là où il faut un nombre (et l\'inverse).' },
  { re: /no matching function/, explain: 'Un bloc est appelé avec de mauvaises valeurs (mauvais type ou mauvais nombre d\'arguments).' },
  { re: /redefinition of/, explain: 'Une variable ou une fonction est définie deux fois. Supprime le doublon.' },
  { re: /does not name a type/, explain: 'Un type est mal écrit, ou une bibliothèque manque.' },
  { re: /undefined reference/, explain: 'Une fonction est appelée mais jamais définie.' },
  { re: /too few arguments|too many arguments/, explain: 'Un bloc reçoit le mauvais nombre de valeurs.' },
  { re: /stray/, explain: 'Un caractère étrange s\'est glissé dans le code.' },
  { re: /expected primary-expression/, explain: 'Une valeur est manquante — un bloc « valeur » est vide ou non branché.' },
  { re: /No such file or directory/, explain: 'Une bibliothèque est introuvable (elle n\'est pas installée sur le serveur).' },
  { re: /expected unqualified-id/, explain: 'Erreur de syntaxe générale — un bloc est probablement mal assemblé.' },
];

export function explainError(err) {
  const msg = err.message || '';
  for (const r of RULES) {
    if (r.re.test(msg)) return r.explain;
  }
  return 'Erreur de compilation. Vérifie que tous tes blocs sont bien connectés et complets.';
}

/* ---- 3. Popup hacker ---- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = `
.hack-overlay{position:fixed;inset:0;background:radial-gradient(ellipse at center,#04120a 0%,#000 70%);z-index:12000;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,Consolas,monospace;}
.hack-overlay::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,255,65,.03) 0 1px,transparent 1px 3px);pointer-events:none;animation:hackscan 6s linear infinite;}
@keyframes hackscan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
.hack-term{width:min(720px,94vw);max-height:88vh;background:#050a06;border:1px solid #0f3d1f;border-radius:10px;box-shadow:0 0 40px rgba(0,255,65,.15),inset 0 0 30px rgba(0,255,65,.04);display:flex;flex-direction:column;overflow:hidden;}
.hack-titlebar{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#0a120c;border-bottom:1px solid #0f3d1f;}
.hack-dot{width:11px;height:11px;border-radius:50%;}
.hack-dot.r{background:#ff5f57}.hack-dot.y{background:#febc2e}.hack-dot.g{background:#28c840}
.hack-title{color:#2e8b57;font-size:12px;letter-spacing:1px;margin-left:6px;}
.hack-body{padding:16px 18px;overflow-y:auto;flex:1;font-size:13.5px;line-height:1.55;color:#00ff41;text-shadow:0 0 6px rgba(0,255,65,.5);}
.hack-body .dim{color:#1f7a3a;text-shadow:none;}
.hack-body .red{color:#ff5f57;text-shadow:0 0 6px rgba(255,95,87,.5);}
.hack-body .yellow{color:#febc2e;text-shadow:0 0 6px rgba(254,188,46,.4);}
.hack-body .big{font-size:16px;font-weight:700;letter-spacing:2px;}
.hack-body .errbox{border:1px solid #1f4a2a;border-left:3px solid #00ff41;background:rgba(0,255,65,.04);border-radius:6px;padding:10px 12px;margin:10px 0;}
.hack-body .raw{color:#3fae6a;font-size:12px;white-space:pre-wrap;word-break:break-word;}
.hack-cursor{display:inline-block;width:8px;height:14px;background:#00ff41;vertical-align:middle;animation:blink 1s steps(1) infinite;}
@keyframes blink{50%{opacity:0}}
.hack-bar{height:4px;background:#0a120c;border-radius:2px;overflow:hidden;margin:6px 0 12px;}
.hack-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#00ff41,#7dffb0);animation:hackbar 1.2s ease-out forwards;}
@keyframes hackbar{to{width:100%}}
.hack-footer{padding:10px 14px;border-top:1px solid #0f3d1f;display:flex;justify-content:flex-end;background:#0a120c;}
.hack-close{background:#0f3d1f;color:#00ff41;border:1px solid #00ff41;border-radius:6px;padding:8px 22px;font-family:inherit;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer;}
.hack-close:hover{background:#00ff41;color:#000;}
.hack-skip{position:absolute;top:14px;right:16px;color:#1f7a3a;font-size:11px;cursor:pointer;z-index:1;}
`;

export function showHackPopup(raw) {
  const errs = parseErrors(raw);
  const hasParsed = errs.length > 0;

  // style + overlay
  if (!document.getElementById('hackStyle')) {
    const st = document.createElement('style');
    st.id = 'hackStyle'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const overlay = document.createElement('div');
  overlay.className = 'hack-overlay';
  overlay.innerHTML =
    '<div class="hack-term">' +
    '<div class="hack-titlebar"><span class="hack-dot r"></span><span class="hack-dot y"></span><span class="hack-dot g"></span><span class="hack-title">arduino-compile — analyse du code</span></div>' +
    '<div class="hack-body" id="hackBody"></div>' +
    '<div class="hack-footer"><button class="hack-close" id="hackClose">FERMER</button></div>' +
    '</div>';
  document.body.appendChild(overlay);
  const body = overlay.querySelector('#hackBody');
  const close = overlay.querySelector('#hackClose');
  let skip = false;
  const skipBtn = document.createElement('div');
  skipBtn.className = 'hack-skip'; skipBtn.textContent = '⏩ passer';
  overlay.appendChild(skipBtn);
  skipBtn.addEventListener('click', () => { skip = true; });

  const type = async (el, text, speed = 9) => {
    for (let i = 0; i < text.length; i++) {
      if (skip) { el.textContent = text; return; }
      el.textContent += text[i];
      await sleep(speed);
    }
  };
  const line = (cls) => { const d = document.createElement('div'); d.className = cls || ''; body.appendChild(d); return d; };

  (async () => {
    // en-tête
    const h = line('big red');
    await type(h, '⚠ ERREUR DE COMPILATION');
    await sleep(200);
    const p = line('dim');
    await type(p, '> Décryptage du code source…', 6);
    const bar = line(); bar.innerHTML = '<div class="hack-bar"><div class="hack-bar-fill"></div></div>';
    await sleep(1300);

    if (!hasParsed) {
      const e = line('yellow');
      await type(e, '> Impossible de décoder l\'erreur. Voici le message brut du compilateur :', 8);
      const box = line('errbox');
      const raw = document.createElement('div'); raw.className = 'raw'; raw.textContent = raw || 'erreur inconnue';
      box.appendChild(raw);
    } else {
      const n = line('dim');
      await type(n, '> ' + errs.length + ' erreur' + (errs.length > 1 ? 's' : '') + ' détectée' + (errs.length > 1 ? 's' : '') + ' :', 8);
      await sleep(250);
      for (let i = 0; i < errs.length; i++) {
        const e = errs[i];
        const box = line('errbox');
        const head = document.createElement('div');
        head.className = 'red';
        head.textContent = 'ERREUR #' + (i + 1) + ' — ligne ' + e.line;
        box.appendChild(head);
        const expl = document.createElement('div');
        expl.style.margin = '6px 0';
        box.appendChild(expl);
        await type(expl, '💡 ' + explainError(e), 7);
        const rawEl = document.createElement('div');
        rawEl.className = 'raw';
        rawEl.textContent = '   ' + e.message;
        box.appendChild(rawEl);
        await sleep(180);
      }
    }

    const fin = line('dim');
    await type(fin, '> Analyse terminée. Corrige tes blocs et réessaie.', 8);
    const cur = line(); cur.innerHTML = '<span class="hack-cursor"></span>';
    close.focus();
  })();

  close.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
}
