import { api } from './api.js';

/* Comptes + programmes cloud — portage de l'account.js legacy (validé en prod).
   Différence : les blocs sont sérialisés en JSON Blockly 13 (au lieu de XML)
   mais stockés dans le même champ `xml` (chaîne opaque, backend inchangé). */
const MIN_PW = 12, MIN_SCORE = 3;
const BLOCKED_SIMPLE = ['', 'password', 'motdepasse', '123456', '12345678', 'azerty', 'qwerty', 'abcdef', 'abc123'];
const HIBP_URL = 'https://haveibeenpwned.com/';
const TIPS = [
  'Ne réutilise jamais le même mot de passe sur 2 sites. Si l\u0027un fuite, les autres restent protégés.',
  'Une phrase de 4 mots au hasard est plus forte qu\u0027un seul mot compliqué. Utilise « proposer un mot de passe ».',
  'Si un site te demande ton mot de passe par email ou téléphone, c\u0027est une arnaque. Ne le donne jamais.',
  'Ton nom, ta date de naissance ou « motdepasse » se craquent en un éclair. Un robot les teste en premier.',
];

export function initAccount({ getJson, loadJson, getCode, clearWorkspace }) {
  const state = { user: null, programs: [], currentId: null };
  let breachStatus = 'idle';
  let strengthCache = null;
  let tipIndex = 0;

  const $ = (id) => document.getElementById(id);

  /* ---------- sérialisation JSON blocs ---------- */
  function getJsonBlockly() { try { return getJson(); } catch (e) { return ''; } }
  function loadJsonBlockly(s) { try { loadJson(s); } catch (e) { /* blocs incompatibles : on continue */ } }

  /* ---------- mot de passe : jauge / temps / HIBP ---------- */
  function nWord(n, s) { n = Math.round(n); return n + ' ' + s; }
  function humanDuration(sec) {
    if (!isFinite(sec) || sec < 0) return '?';
    if (sec < 1) return 'moins d\u00271 seconde';
    if (sec < 60) return nWord(sec, 'seconde' + (sec === 1 ? '' : 's'));
    const m = sec / 60; if (m < 60) return nWord(m, 'minute' + (m === 1 ? '' : 's'));
    const h = m / 60; if (h < 24) return nWord(h, 'heure' + (h === 1 ? '' : 's'));
    const d = h / 24; if (d < 30) return nWord(d, 'jour' + (d === 1 ? '' : 's'));
    const mo = d / 30; if (mo < 12) return nWord(mo, 'mois');
    const y = d / 365; return y < 1000 ? nWord(y, 'an' + (y === 1 ? '' : 's')) : nWord(y / 1000, 'siècle' + (y / 1000 === 1 ? '' : 's'));
  }
  function renderStrength(pw) {
    const meter = $('acctMeter'), lab = $('acctStrengthLabel'), time = $('acctStrengthTime');
    if (!meter) return;
    if (!pw) { meter.className = 'acct-meter'; meter.style.width = ''; const fl = meter.querySelector('.acct-meter-fill'); if (fl) fl.style.width = ''; lab && (lab.textContent = ''); time && (time.textContent = ''); return; }
    strengthCache = window.zxcvbn ? window.zxcvbn(pw) : null;
    const sc = strengthCache;
    let tone, label, cls, txt;
    const fill = meter.querySelector('.acct-meter-fill');
    if (pw.length < MIN_PW) {
      tone = 'weak'; label = 'Trop court (' + pw.length + '/' + MIN_PW + ')'; txt = '';
      // L2 : largeur PROPORTIONNELLE à l'avancement vers le minimum, pas figée à 25%
      const pct = Math.min(100, Math.max(8, Math.round((pw.length / MIN_PW) * 100)));
      meter.style.width = '';
      if (fill) fill.style.width = pct + '%';
    } else if (!sc) { tone = 'weak'; label = ''; txt = ''; meter.style.width = ''; if (fill) fill.style.width = ''; }
    else {
      meter.style.width = '';
      if (fill) fill.style.width = ''; // largeur par paliers CSS .weak/.good/.strong
      const s = sc.score;
      if (s <= 1) { tone = 'weak'; label = 'Très faible'; cls = 'time-bad'; }
      else if (s === 2) { tone = 'weak'; label = 'Faible'; cls = 'time-ok'; }
      else if (s === 3) { tone = 'good'; label = 'Correct'; cls = 'time-ok'; }
      else { tone = 'strong'; label = 'Fort'; cls = 'time-good'; }
      const tt = sc.crack_times_seconds.offline_slow_hashing_1e4_per_second;
      txt = '🕒 cassable en ' + humanDuration(tt);
    }
    meter.className = 'acct-meter ' + tone;
    lab && (lab.textContent = label);
    if (time) { time.textContent = txt; time.className = 'acct-strength-time ' + cls; }
  }
  function sha1Hex(str) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)).then((buf) =>
      Array.prototype.map.call(new Uint8Array(buf), (x) => ('0' + x.toString(16)).slice(-2)).join(''));
  }
  function checkBreach(pw) {
    const box = $('acctBreach');
    if (!pw) { breachStatus = 'idle'; box && (box.style.display = 'none'); updateRegButton(); return; }
    if (!window.crypto || !window.crypto.subtle) { updateRegButton(); return; }
    breachStatus = 'pending';
    if (box) { box.style.display = 'block'; box.className = 'acct-breach pending'; box.innerHTML = 'Vérification des fuites de données…'; }
    updateRegButton();
    sha1Hex(pw).then((hex) => {
      const prefix = hex.slice(0, 5).toUpperCase(), suffix = hex.slice(5).toUpperCase();
      return fetch('https://api.pwnedpasswords.com/range/' + prefix)
        .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
        .then((txt) => {
          let count = 0;
          for (const line of txt.split(/\r?\n/)) {
            if (!line) continue;
            const parts = line.split(':');
            if (parts[0] === suffix) { count = parseInt(parts[1], 10) || 0; break; }
          }
          return count;
        });
    }).then((count) => {
      breachStatus = count > 0 ? 'bad' : 'ok';
      if (box) {
        box.className = 'acct-breach ' + (count > 0 ? 'bad' : 'ok');
        box.innerHTML = count > 0
          ? '⚠️ Ce mot de passe est apparu dans <b>' + count + '</b> fuite' + (count > 1 ? 's' : '') + ' de données, il se craque très vite. <b>Choisis-en un autre.</b>'
          : '✅ Aucune trace de ce mot de passe dans les fuites connues (<a href="' + HIBP_URL + '" target="_blank" rel="noopener">Have I Been Pwned</a>).';
      }
      updateRegButton();
    }).catch(() => {
      breachStatus = 'unknown';
      if (box) { box.className = 'acct-breach pending'; box.innerHTML = 'Vérification des fuites indisponible (réseau).'; }
      updateRegButton();
    });
  }
  function randomIndex(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  function generatePassphrase() {
    const words = window.PASSWORD_WORDS;
    if (!words || !words.length) return null;
    const picked = [];
    while (picked.length < 5) { const w = words[randomIndex(words.length)]; if (!picked.includes(w)) picked.push(w); }
    return picked.join('-');
  }

  /* ---------- éligibilité inscription ---------- */
  function regFeasible() {
    const u = $('acctRegUsername').value, p = $('acctRegPassword').value, p2 = $('acctRegPassword2').value;
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(u)) return { ok: false, why: 'Nom d\u0027utilisateur : 3-40 caractères (lettres/chiffres/._-).' };
    if (p.length < MIN_PW) return { ok: false, why: 'Mot de passe : ' + MIN_PW + ' caractères minimum.' };
    if (p !== p2) return { ok: false, why: 'Les mots de passe ne correspondent pas.' };
    if (BLOCKED_SIMPLE.indexOf(p.toLowerCase()) !== -1) return { ok: false, why: 'Ce mot de passe est beaucoup trop courant.' };
    if (u.toLowerCase() && p.toLowerCase() === u.toLowerCase()) return { ok: false, why: 'Le mot de passe ne doit pas être identique au nom d\u0027utilisateur.' };
    if (!strengthCache) return { ok: false, why: 'Le vérificateur de force est indisponible.' };
    if (strengthCache.score < MIN_SCORE) return { ok: false, why: 'Mot de passe trop facile à deviner. Utilise « Proposer un mot de passe fort ».' };
    return { ok: true };
  }
  function updateRegButton() {
    const btn = $('acctCreateBtn'), rerr = $('acctRegErr'), uerr = $('acctRegUsernameErr');
    if (uerr) uerr.textContent = '';
    if (!btn) return;
    const u = $('acctRegUsername'), p = $('acctRegPassword'), p2 = $('acctRegPassword2');
    const uName = u ? u.value : '', pw = p ? p.value : '', pw2 = p2 ? p2.value : '';
    const uValid = /^[a-zA-Z0-9._-]{3,40}$/.test(uName);

    // Erreur username sous son propre champ (H1 : plus de message dissocié en bas)
    if (uName && !uValid) {
      uerr.textContent = '3-40 caractères (lettres/chiffres/._-).';
      btn.disabled = true;
      if (rerr) rerr.textContent = '';
      return;
    }
    if (!uName) {
      const f = regFeasible();
      if (u && !pw && !pw2) { btn.disabled = true; if (rerr) rerr.textContent = 'Renseigne un nom d\u0027utilisateur.'; return; }
      btn.disabled = true; rerr && (rerr.textContent = f.why); return;
    }
    const f = regFeasible();
    if (!f.ok) { btn.disabled = true; rerr && (rerr.textContent = f.why); return; }
    if (breachStatus === 'pending') { btn.disabled = true; rerr && (rerr.textContent = 'Vérification des fuites en cours…'); return; }
    if (breachStatus === 'bad') { btn.disabled = true; rerr && (rerr.textContent = 'Ce mot de passe a été vu dans des fuites : choisis-en un autre.'); return; }
    btn.disabled = false; rerr && (rerr.textContent = '');
  }
  function submitRegister() {
    const btn = $('acctCreateBtn'), rerr = $('acctRegErr');
    if (btn && btn.disabled) { if (rerr && !rerr.textContent) rerr.textContent = 'Complète les champs correctement.'; return; }
    const u = $('acctRegUsername').value, p = $('acctRegPassword').value;
    showBusyReg('Création du compte…');
    api('/auth/register', { method: 'POST', body: { username: u, password: p } })
      .then((r) => { state.user = r.user; showModal('member'); refreshPrograms(); })
      .catch((e) => { showBusyReg((e && e.message) || 'Erreur'); updateRegButton(); });
  }
  function showTip() {
    const tip = $('acctTip'); if (!tip) return;
    tipIndex = (tipIndex + 1) % TIPS.length;
    tip.innerHTML = '<b>🛡️ Bonne hygiène numérique :</b> ' + TIPS[tipIndex] +
      '<br>Vérifie aussi si ton email a déjà fuité : <a href="' + HIBP_URL + '" target="_blank" rel="noopener">haveibeenpwned.com</a>';
  }
  function updateMatch() {
    const msg = $('acctMatchMsg'); if (!msg) return;
    const p = $('acctRegPassword').value, p2 = $('acctRegPassword2').value;
    if (!p2) { msg.textContent = ''; return; }
    if (p === p2) { msg.textContent = '✅ Les mots de passe correspondent'; msg.className = 'acct-strength-time time-good'; }
    else { msg.textContent = '⚠️ Les mots de passe ne correspondent pas'; msg.className = 'acct-strength-time time-bad'; }
  }
  function togglePw(inputId, eyeId) {
    const inp = $(inputId), eye = $(eyeId);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    eye && (eye.textContent = show ? '🙈' : '👁');
  }

  /* ---------- modale ---------- */
  function ensureModal() {
    if ($('acctModal')) return;
    const el = document.createElement('div');
    el.innerHTML =
      '<div id="acctModal" class="acct-backdrop" style="display:none">' +
      '  <div class="acct-card">' +
      '    <div class="acct-head"><span id="acctTitle">Connexion</span><button class="acct-close" id="acctClose">&times;</button></div>' +
      '    <div class="acct-body">' +
      '      <div id="acctGuest">' +
      '        <div class="acct-tabs"><button class="acct-tab active" id="acctTabLogin" type="button">Se connecter</button>' +
      '        <button class="acct-tab" id="acctTabRegister" type="button">Créer un compte</button></div>' +
      '        <div id="acctLoginView">' +
      '          <label>Nom d\u0027utilisateur</label><input id="acctUsername" type="text" autocomplete="username" placeholder="ex. david">' +
      '          <label>Mot de passe</label><input id="acctPassword" type="password" autocomplete="current-password">' +
      '          <div id="acctErr" class="acct-err"></div>' +
      '          <div class="acct-row"><button id="acctLoginBtn" class="acct-btn acct-primary">Se connecter</button></div>' +
      '        </div>' +
      '        <div id="acctRegisterView" style="display:none">' +
      '          <label>Nom d\u0027utilisateur</label><input id="acctRegUsername" type="text" autocomplete="username" placeholder="ex. david">' +
      '          <div id="acctRegUsernameErr" class="acct-err"></div>' +
      '          <label>Mot de passe (' + MIN_PW + ' caractères min.)</label>' +
      '          <div class="acct-pass-row"><input id="acctRegPassword" type="password" autocomplete="new-password">' +
      '            <button class="acct-eye" id="acctRegPwToggle" type="button">👁</button></div>' +
      '          <div class="acct-meter" id="acctMeter"><div class="acct-meter-fill"></div></div>' +
      '          <div class="acct-strength-row"><span class="acct-strength-label" id="acctStrengthLabel"></span>' +
      '            <span class="acct-strength-time" id="acctStrengthTime"></span></div>' +
      '          <div class="acct-breach" id="acctBreach" style="display:none"></div>' +
      '          <label style="margin-top:10px">Confirmer le mot de passe</label>' +
      '          <div class="acct-pass-row"><input id="acctRegPassword2" type="password" autocomplete="new-password">' +
      '            <button class="acct-eye" id="acctRegPw2Toggle" type="button">👁</button></div>' +
      '          <div id="acctMatchMsg" class="acct-strength-time" style="margin-top:4px"></div>' +
      '          <div id="acctRegErr" class="acct-err"></div>' +
      '          <button class="acct-gen" id="acctRegGenBtn" type="button">🎲 Proposer un mot de passe fort</button>' +
      '          <div class="acct-row"><button id="acctCreateBtn" class="acct-btn acct-primary" disabled>Créer mon compte</button></div>' +
      '          <div class="acct-tip" id="acctTip"></div>' +
      '        </div>' +
      '      </div>' +
      '      <div id="acctMember" style="display:none">' +
      '        <div class="acct-who">Connecté : <b id="acctUsernameShown"></b></div>' +
      '        <div class="acct-program-list" id="acctProgramList"></div>' +
      '        <div class="acct-row">' +
      '          <button id="acctSaveBtn" class="acct-btn acct-primary">💾 Sauvegarder ce programme</button>' +
      '          <button id="acctNewBtn" class="acct-btn">Nouveau</button>' +
      '          <button id="acctLogoutBtn" class="acct-btn acct-danger">Déconnexion</button>' +
      '        </div>' +
      '        <div class="acct-hint">Les programmes (blocs) sont sauvegardés sur le serveur et liés à ton compte.</div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(el);
    $('acctClose').addEventListener('click', hideModal);
    el.addEventListener('click', (e) => { if (e.target === el) hideModal(); });
    $('acctTabLogin').addEventListener('click', () => showGuestTab('login'));
    $('acctTabRegister').addEventListener('click', () => showGuestTab('register'));

    $('acctLoginBtn').addEventListener('click', () => {
      showBusy('Connexion…');
      const u = $('acctUsername').value, p = $('acctPassword').value;
      if (!u || !p) return showGuestError('Remplis les deux champs.');
      api('/auth/login', { method: 'POST', body: { username: u, password: p } })
        .then((r) => { state.user = r.user; showModal('member'); refreshPrograms(); })
        .catch(showGuestError);
    });

    $('acctRegPwToggle').addEventListener('click', () => togglePw('acctRegPassword', 'acctRegPwToggle'));
    $('acctRegPw2Toggle').addEventListener('click', () => togglePw('acctRegPassword2', 'acctRegPw2Toggle'));
    const pw1 = $('acctRegPassword'), pw2 = $('acctRegPassword2');
    let debounce = null;
    pw1.addEventListener('input', () => {
      renderStrength(pw1.value); updateRegButton();
      if (pw2.value) updateMatch();
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => checkBreach(pw1.value), 500);
    });
    pw2.addEventListener('input', () => { updateMatch(); updateRegButton(); });
    pw1.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitRegister(); });
    pw2.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitRegister(); });
    $('acctRegGenBtn').addEventListener('click', () => {
      const pw = generatePassphrase(); if (!pw) return;
      pw1.value = pw; pw2.value = pw; updateMatch(); renderStrength(pw);
      if (debounce) clearTimeout(debounce);
      checkBreach(pw);
      pw1.type = 'text'; pw2.type = 'text';
      setTimeout(() => { pw1.type = 'password'; pw2.type = 'password'; }, 4000);
    });
    $('acctCreateBtn').addEventListener('click', submitRegister);
    $('acctLogoutBtn').addEventListener('click', () => {
      api('/auth/logout', { method: 'POST' }).finally(() => {
        state.user = null; state.programs = []; state.currentId = null;
        showModal('guest'); refreshTopButton();
      });
    });
    $('acctSaveBtn').addEventListener('click', saveCurrentProgram);
    $('acctNewBtn').addEventListener('click', () => {
      try { clearWorkspace(); } catch (e) { loadJsonBlockly('{"blocks":{"languageVersion":0,"blocks":[]}}'); }
      state.currentId = null; showModal('member');
    });
  }

  function showGuestTab(tab) {
    const lv = $('acctLoginView'), rv = $('acctRegisterView'), tL = $('acctTabLogin'), tR = $('acctTabRegister');
    if (tab === 'register') {
      lv.style.display = 'none'; rv.style.display = 'block'; tL.className = 'acct-tab'; tR.className = 'acct-tab active';
      $('acctErr').textContent = ''; showTip();
    } else {
      rv.style.display = 'none'; lv.style.display = 'block'; tR.className = 'acct-tab'; tL.className = 'acct-tab active';
      $('acctRegErr').textContent = '';
    }
  }
  function showBusy(msg) { const e = $('acctErr'); if (e) { e.textContent = msg; e.style.color = '#ffb55c'; } }
  function showBusyReg(msg) { const e = $('acctRegErr'); if (e) { e.textContent = msg; e.style.color = '#ffb55c'; } }
  function showGuestError(err) { const e = $('acctErr'); if (e) { e.textContent = (err && err.message) || 'Erreur'; e.style.color = '#ff6b6b'; } }
  function hideModal() { const m = $('acctModal'); if (m) m.style.display = 'none'; }
  function showModal(vue) {
    const m = $('acctModal'); if (m) m.style.display = 'flex';
    if (vue === 'member') {
      $('acctGuest').style.display = 'none'; $('acctMember').style.display = 'block';
      $('acctUsernameShown').textContent = state.user.username;
      $('acctTitle').textContent = 'Mes programmes';
      $('acctErr').textContent = ''; $('acctRegErr').textContent = '';
    } else {
      $('acctGuest').style.display = 'block'; $('acctMember').style.display = 'none';
      $('acctTitle').textContent = 'Connexion / Inscription';
      $('acctSaveBtn').textContent = '💾 Sauvegarder ce programme';
      showGuestTab('login');
    }
  }
  function refreshPrograms() {
    const list = $('acctProgramList'); if (list) list.textContent = 'Chargement…';
    api('/programs').then((r) => { state.programs = r.programs; renderProgramList(); refreshTopButton(); })
      .catch(() => { if (list) list.textContent = 'Erreur de chargement.'; });
  }
  function renderProgramList() {
    const list = $('acctProgramList'); if (!list) return;
    list.innerHTML = '';
    $('acctSaveBtn').textContent = state.currentId
      ? '💾 Enregistrer (id ' + state.currentId + ')'
      : '💾 Sauvegarder ce programme comme nouveau';
    if (!state.programs.length) {
      const empty = document.createElement('div'); empty.className = 'acct-empty'; empty.textContent = 'Aucun programme sauvegardé.';
      list.appendChild(empty); return;
    }
    state.programs.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'acct-prog' + (p.id === state.currentId ? ' acct-prog-active' : '');
      const name = document.createElement('span'); name.className = 'acct-prog-name';
      name.textContent = p.name; name.title = 'Charger « ' + p.name + ' »';
      name.addEventListener('click', () => loadProgram(p));
      const save = document.createElement('button'); save.className = 'acct-prog-btn'; save.textContent = '💾'; save.title = 'Écraser avec les blocs actuels';
      save.addEventListener('click', () => overwriteProgram(p.id));
      const del = document.createElement('button'); del.className = 'acct-prog-btn acct-prog-del'; del.textContent = '🗑'; del.title = 'Supprimer';
      del.addEventListener('click', () => deleteProgram(p.id));
      row.appendChild(name); row.appendChild(save); row.appendChild(del);
      list.appendChild(row);
    });
  }
  function saveCurrentProgram() {
    if (!state.user) return;
    const name = prompt('Nom du programme :', 'Mon programme'); if (!name) return;
    const payload = { name, xml: getJsonBlockly(), code: getSketchCode() };
    if (state.currentId) {
      api('/programs/' + state.currentId, { method: 'PUT', body: payload })
        .then(() => { refreshPrograms(); showBusy('Enregistré ✓'); }).catch((e) => showBusy('Erreur : ' + e.message));
    } else {
      api('/programs', { method: 'POST', body: payload })
        .then((r) => { state.currentId = r.program.id; refreshPrograms(); showBusy('Sauvegardé ✓ (id ' + r.program.id + ')'); })
        .catch((e) => showBusy('Erreur : ' + e.message));
    }
  }
  function overwriteProgram(id) {
    const payload = { name: undefined, xml: getJsonBlockly(), code: getSketchCode() };
    api('/programs/' + id, { method: 'PUT', body: payload })
      .then(() => { state.currentId = id; refreshPrograms(); showBusy('Enregistré ✓'); }).catch((e) => showBusy('Erreur : ' + e.message));
  }
  function deleteProgram(id) {
    if (!confirm('Supprimer ce programme ?')) return;
    api('/programs/' + id, { method: 'DELETE' }).then(() => {
      if (state.currentId === id) state.currentId = null;
      refreshPrograms();
    }).catch((e) => showBusy('Erreur : ' + e.message));
  }
  function loadProgram(p) {
    api('/programs/' + p.id).then((r) => { state.currentId = p.id; loadJsonBlockly(r.program.xml); renderProgramList(); })
      .catch((e) => showBusy('Erreur : ' + e.message));
  }

  /* getSketchCode = code C++ courant (fourni par main.js via buildSketch). */
  let getSketchCode = () => '';
  if (typeof getCode === 'function') getSketchCode = getCode;

  function refreshTopButton() {
    const btn = $('acctTopBtn');
    if (btn) btn.textContent = state.user ? '👤 ' + state.user.username : '👤';
  }
  function ensureAndShow() {
    ensureModal();
    if (state.user) { showModal('member'); refreshPrograms(); }
    else { api('/auth/me').then((r) => { state.user = r.user; refreshPrograms(); showModal('member'); })
      .catch(() => showModal('guest')); }
  }
  function init() {
    ensureModal();
    const btn = $('acctTopBtn');
    if (btn) btn.addEventListener('click', ensureAndShow);
    api('/auth/me').then((r) => { state.user = r.user; refreshTopButton(); }).catch(() => {});
  }

  init();
}