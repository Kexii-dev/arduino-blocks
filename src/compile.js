import { api } from './api.js';
import { t } from './i18n.js';

/* Compiler + Téléverser (Web Serial) — portage du contrat prod exact :
   POST /api/compile -> {ok, hex_base64, hex_bytes, size:{flash,flash_pct,ram,ram_pct}}
   Flash via avrgirl-arduino.global + navigator.serial. */

export function initCompile(getSource) {
  let lastResult = null;

  const host = document.createElement('div');
  host.innerHTML =
    '<div id="rdCompile">' +
    '<div id="rdStatus"></div>' +
    '<a id="rdDl"></a>' +
    '<button id="rdCompileBtn" class="rdbtn">Compiler</button>' +
    '<button id="rdFlashBtn" class="rdbtn"></button>' +
    '</div>';
  document.body.appendChild(host);

  const status = document.getElementById('rdStatus');
  const flashBtn = document.getElementById('rdFlashBtn');
  const dl = document.getElementById('rdDl');
  const compBtn = document.getElementById('rdCompileBtn');
  flashBtn.textContent = t('flashBtn');
  dl.textContent = t('hexDl');

  function setStatus(msg, showFlash) {
    status.style.display = msg ? 'block' : 'none';
    status.textContent = msg || '';
    flashBtn.style.display = (showFlash && lastResult && lastResult.ok) ? 'block' : 'none';
  }
  setStatus('');

  async function doCompile() {
    const src = getSource();
    if (!src || !src.trim()) { setStatus(t('noSource'), false); return; }
    setStatus(t('compileRun'), false);
    try {
      const res = await api('/compile', { method: 'POST', body: { source: src } });
      if (res.ok) {
        lastResult = res;
        const s = res.size || {};
        setStatus(t('compileOk') +
          'Flash: ' + (s.flash != null ? s.flash + ' o (' + s.flash_pct + '%)' : '?') +
          ' · RAM: ' + (s.ram != null ? s.ram + ' o (' + s.ram_pct + '%)' : '?') +
          '\n' + res.hex_bytes + ' o de .hex', true);
        dl.style.display = 'block';
      } else {
        lastResult = null;
        setStatus(t('compileErr') + (res.error || 'inconnue'), false);
      }
    } catch (e) {
      if (e.status === 429) { setStatus(t('compile429'), false); return; }
      setStatus(t('compileNet') + (e.message || e), false);
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
      setStatus(t('flashUnavail'), false); return;
    }
    setStatus(t('flashPick'), true);
    try {
      const avr = new window.AvrgirlArduino({ board: 'uno', debug: true });
      avr.flash(hexToArrayBuffer(lastResult.hex_base64), (err) => {
        if (err) {
          setStatus(t('flashFail') + (err.message || String(err)) + t('flashFailHint'), false);
        } else {
          setStatus(t('flashOk'), false);
        }
      });
    } catch (e) {
      setStatus(t('flashFail') + (e.message || e), false);
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