import { api } from './api.js';
import { t, getLang, applyUI } from './i18n.js';
import { getBoard, setBoard, boardIds, boardLabel, boardAvr } from './board.js';
import { showHackPopup } from './hack.js';

/* Compiler + Téléverser (Web Serial) — portage du contrat prod exact :
   POST /api/compile -> {ok, hex_base64, hex_bytes, size:{flash,flash_pct,ram,ram_pct}}
   Flash via avrgirl-arduino.global + navigator.serial.
   Multi-cartes : envoie `board` (uno|mega) au backend ; le flash utilise le nom
   Avrgirl (boardAvr) et le statut affiche le label (boardLabel). */

export function initCompile(getSource) {
  let lastResult = null;
  let hideTimer = null;

  const host = document.createElement('div');
  host.innerHTML =
    '<div id="compileBar">' +
    '<div id="compileStatus"></div>' +
    '<a id="compileDl"></a>' +
    '<label class="board-lab" id="boardLab" for="boardSel"></label>' +
    '<select id="boardSel" class="board-sel"></select>' +
    '<button id="compileBtn" class="compile-btn">Compiler</button>' +
    '<button id="flashBtn" class="compile-btn"></button>' +
    '</div>';
  document.body.appendChild(host);

  const status = document.getElementById('compileStatus');
  const flashBtn = document.getElementById('flashBtn');
  const dl = document.getElementById('compileDl');
  const compBtn = document.getElementById('compileBtn');
  const boardSel = document.getElementById('boardSel');
  const boardLab = document.getElementById('boardLab');
  flashBtn.textContent = t('flashBtn');
  dl.textContent = t('hexDl');
  boardLab.textContent = t('boardSelect');

  /* Sélecteur de carte : options = boardIds(), valeur = getBoard() (localStorage). */
  for (const id of boardIds()) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = boardLabel(id, getLang());
    boardSel.appendChild(o);
  }
  boardSel.value = getBoard();
  boardSel.addEventListener('change', () => {
    setBoard(boardSel.value);
    applyUI(); // met à jour le titre du panneau C++ avec le nom de la carte
  });

  /* Affiche le statut avec une icône et une classe de couleur ; auto-masquage
     au succès après quelques secondes. */
  function setStatus(msg, kind) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    status.className = kind || '';
    status.style.display = msg ? 'block' : 'none';
    status.textContent = msg || '';
    flashBtn.style.display = (kind === 'ok' && lastResult && lastResult.ok) ? 'block' : 'none';
    if (kind === 'ok' && msg) {
      hideTimer = setTimeout(() => { status.style.display = 'none'; }, 5000);
    }
  }
  setStatus('');

  async function doCompile() {
    const src = getSource();
    if (!src || !src.trim()) { setStatus('⚠️ ' + t('noSource'), 'warn'); return; }
    setStatus('⏳ ' + t('compileRun'), '');
    try {
      const res = await api('/compile', { method: 'POST', body: { source: src, board: getBoard() } });
      if (res.ok) {
        lastResult = res;
        const s = res.size || {};
        const boardName = boardLabel(getBoard(), getLang());
        setStatus('✅ ' + t('compileOkFor') + ' ' + boardName + '.' +
          '\nFlash: ' + (s.flash != null ? s.flash + ' o (' + s.flash_pct + '%)' : '?') +
          ' · RAM: ' + (s.ram != null ? s.ram + ' o (' + s.ram_pct + '%)' : '?') +
          '\n' + res.hex_bytes + ' o de .hex', 'ok');
        dl.style.display = 'block';
      } else {
        lastResult = null;
        setStatus('❌ ' + t('compileErr') + (res.error || 'inconnue'), 'err');
        showHackPopup(res.error || 'Erreur inconnue');
      }
    } catch (e) {
      if (e.status === 429) { setStatus('⚠️ ' + t('compile429'), 'warn'); return; }
      // api() lève une exception quand ok:false (contrat partagé avec auth) :
      // pour /compile c'est une ERREUR DE COMPILATION normale -> popup hacker.
      if (e.json && e.json.ok === false) {
        lastResult = null;
        setStatus('❌ ' + t('compileErr') + (e.json.error || 'inconnue'), 'err');
        showHackPopup(e.json.error || 'Erreur inconnue');
        return;
      }
      setStatus('❌ ' + t('compileNet') + (e.message || e), 'err');
    }
  }

  function hexToArrayBuffer(b64) {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff;
    return buf;
  }

  async function doFlash() {
    if (!lastResult || !lastResult.ok) return;
    if (!navigator.serial || !navigator.serial.requestPort) {
      setStatus('⚠️ ' + t('flashUnavail'), 'warn'); return;
    }
    setStatus('🎯 ' + t('flashPick'), '');
    try {
      const avr = new window.AvrgirlArduino({ board: boardAvr(getBoard()), debug: true });
      avr.flash(hexToArrayBuffer(lastResult.hex_base64), (err) => {
        if (err) {
          setStatus('❌ ' + t('flashFail') + (err.message || String(err)) + t('flashFailHint'), 'err');
        } else {
          setStatus('✅ ' + t('flashOk'), 'ok');
        }
      });
    } catch (e) {
      setStatus('❌ ' + t('flashFail') + (e.message || e), 'err');
    }
  }

  function doDownload() {
    if (!lastResult || !lastResult.ok) return;
    const blob = new Blob([atob(lastResult.hex_base64)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sketch.ino.hex';
    document.body.appendChild(a); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  compBtn.addEventListener('click', doCompile);
  flashBtn.addEventListener('click', doFlash);
  dl.addEventListener('click', doDownload);
}