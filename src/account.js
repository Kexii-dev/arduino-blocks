import { api } from './api.js';

/* Comptes + programmes cloud + email (vérification + mot de passe oublié) + admin.
   Portage de l'account.js legacy (validé en prod), étendu :
   - inscription avec EMAIL obligatoire + vérification par lien (24 h, one-shot);
   - connexion par username OU email ; bloquée si email non vérifié ou compte inactif;
   - « mot de passe oublié » -> mail de réinitialisation (lien 1 h, one-shot);
   - URL  ?verify=TOKEN  et  ?reset=TOKEN  traitées au chargement ;
   - panneau admin (rôle 'admin') : lister / promouvoir / désactiver / supprimer /
     réinitialiser le mot de passe des comptes. */
const MIN_PW = 12, MIN_SCORE = 3;
const BLOCKED_SIMPLE = ['', 'password', 'motdepasse', '123456', '12345678', 'azerty', 'qwerty', 'abcdef', 'abc123'];
const HIBP_URL = 'https://haveibeenpwned.com/';
const TIPS = [
  'Ne réutilise jamais le même mot de passe sur 2 sites. Si l\u0027un fuite, les autres restent protégés.',
  'Une phrase de 4 mots au hasard est plus forte qu\u0027un seul mot compliqué. Utilise « proposer un mot de passe ».',
  'Si un site te demande ton mot de passe par email ou téléphone, c\u0027est une arnaque. Ne le donne jamais.',
  'Ton nom, ta date de naissance ou « motdepasse » se craquent en un éclair. Un robot les teste en premier.',
  'Ne partage jamais ton email de connexion avec des inconnus : il sert à récupérer ton compte.',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initAccount({ getJson, loadJson, getCode, clearWorkspace }) {
  const state = { user: null, programs: [], currentId: null, pendingEmail: '' };
  let adminUsers = [];
  let breachStatus = 'idle';
  let strengthCache = null;
  let tipIndex = 0;
  let activeResetToken = null;

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
      const pct = Math.min(100, Math.max(8, Math.round((pw.length / MIN_PW) * 100)));
      meter.style.width = '';
      if (fill) fill.style.width = pct + '%';
    } else if (!sc) { tone = 'weak'; label = ''; txt = ''; meter.style.width = ''; if (fill) fill.style.width = ''; }
    else {
      meter.style.width = '';
      if (fill) fill.style.width = '';
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
    updateRegButton();
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

  /* ---------- liens URL  ?verify=TOKEN  et  ?reset=TOKEN ---------- */
  function handleUrlParams() {
    const p = new URLSearchParams(window.location.search);
    const verify = p.get('verify');
    const reset = p.get('reset');
    if (verify) {
      window.history.replaceState({}, '', window.location.pathname);
      ensureModal();
      api('/auth/verify', { method: 'POST', body: { token: verify } })
        .then((r) => { state.user = r.user; ampEmailVerified(true); showModal('member'); refreshPrograms(); })
        .catch((e) => { showModal('verifyFilled'); showVerifyError((e && e.message) || 'Lien invalide ou expiré.'); });
    } else if (reset) {
      window.history.replaceState({}, '', window.location.pathname);
      activeResetToken = reset;
      ensureModal();
      showModal('reset');
    }
  }

  /* ---------- éligibilité inscription (email + username + mdp) ---------- */
  function regFeasible() {
    const u = $('acctRegUsername').value, e = $('acctRegEmail').value, p = $('acctRegPassword').value, p2 = $('acctRegPassword2').value;
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(u)) return { ok: false, why: 'Nom d\u0027utilisateur : 3-40 caractères (lettres/chiffres/._-).' };
    if (!EMAIL_RE.test(e)) return { ok: false, why: 'Adresse email invalide.' };
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
    const u = $('acctRegUsername'), e = $('acctRegEmail'), p = $('acctRegPassword'), p2 = $('acctRegPassword2');
    const uName = u ? u.value : '', pw = p ? p.value : '', pw2 = p2 ? p2.value : '', em = e ? e.value : '';
    const uValid = /^[a-zA-Z0-9._-]{3,40}$/.test(uName);
    if (uName && !uValid) {
      uerr.textContent = '3-40 caractères (lettres/chiffres/._-).';
      btn.disabled = true;
      if (rerr) rerr.textContent = '';
      return;
    }
    if (!uName || !em) {
      btn.disabled = true;
      if (rerr) rerr.textContent = !uName ? 'Renseigne un nom d\u0027utilisateur.' : 'Renseigne ton adresse email.';
      return;
    }
    if (!EMAIL_RE.test(em)) { btn.disabled = true; rerr && (rerr.textContent = 'Adresse email invalide.'); return; }
    const f = regFeasible();
    if (!f.ok) { btn.disabled = true; rerr && (rerr.textContent = f.why); return; }
    if (breachStatus === 'pending') { btn.disabled = true; rerr && (rerr.textContent = 'Vérification des fuites en cours…'); return; }
    if (breachStatus === 'bad') { btn.disabled = true; rerr && (rerr.textContent = 'Ce mot de passe a été vu dans des fuites : choisis-en un autre.'); return; }
    btn.disabled = false; rerr && (rerr.textContent = '');
  }
  function submitRegister() {
    const btn = $('acctCreateBtn'), rerr = $('acctRegErr');
    if (btn && btn.disabled) { if (rerr && !rerr.textContent) rerr.textContent = 'Complète les champs correctement.'; return; }
    const u = $('acctRegUsername').value, e = $('acctRegEmail').value, p = $('acctRegPassword').value;
    showBusyReg('Création du compte…');
    api('/auth/register', { method: 'POST', body: { username: u, email: e, password: p } })
      .then((r) => { state.pendingEmail = r.user.email; showModal('verifyEmail'); })
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

  /* ---------- écrans helpers ---------- */
  function showVerifyError(msg) { const e = $('acctVerifyErr'); if (e) { e.textContent = msg; e.style.color = '#ff6b6b'; } }
  function ampEmailVerified(v) { /* no-op hint pour lisibilité */ }
  function switchView(showId, hideIds) {
    hideIds.forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
    const s = $(showId); if (s) s.style.display = 'block';
  }

  /* ---------- modale ---------- */
  function ensureModal() {
    if ($('acctModal')) return;
    const el = document.createElement('div');
    el.innerHTML =
      '<div id="acctModal" class="acct-backdrop" style="display:none">' +
      '  <div class="acct-card acct-wide">' +
      '    <div class="acct-head"><span id="acctTitle">Connexion</span><button class="acct-close" id="acctClose">&times;</button></div>' +
      '    <div class="acct-body">' +
      '      <div id="acctGuest">' +
      '        <div class="acct-tabs"><button class="acct-tab active" id="acctTabLogin" type="button">Se connecter</button>' +
      '        <button class="acct-tab" id="acctTabRegister" type="button">Créer un compte</button></div>' +
      '        <div id="acctLoginView">' +
      '          <label>Nom d\u0027utilisateur ou email</label><input id="acctUsername" type="text" autocomplete="username" placeholder="ex. david">' +
      '          <label>Mot de passe</label><input id="acctPassword" type="password" autocomplete="current-password">' +
      '          <div id="acctErr" class="acct-err"></div>' +
      '          <div class="acct-row"><button id="acctLoginBtn" class="acct-btn acct-primary">Se connecter</button></div>' +
      '          <div class="acct-row"><button id="acctForgotLink" class="acct-link">Mot de passe oublié ?</button></div>' +
      '        </div>' +
      '        <div id="acctRegisterView" style="display:none">' +
      '          <label>Nom d\u0027utilisateur</label><input id="acctRegUsername" type="text" autocomplete="username" placeholder="ex. david">' +
      '          <div id="acctRegUsernameErr" class="acct-err"></div>' +
      '          <label>Adresse email</label><input id="acctRegEmail" type="email" autocomplete="email" placeholder="toi@exemple.ch">' +
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

      '      <div id="acctVerifyEmail" style="display:none">' +
      '        <div class="acct-ok">📨 Vérifie ton email !</div>' +
      '        <p class="acct-hint">Nous avons envoyé un lien à <b id="acctVerifyEmailShown"></b>.<br>Clique dessus pour activer ton compte.</p>' +
      '        <div id="acctVerifyErr" class="acct-err"></div>' +
      '        <div class="acct-row"><button id="acctResendBtn" class="acct-btn">Renvoyer le lien</button>' +
      '          <button id="acctVerifyBackBtn" class="acct-btn">Se connecter</button></div>' +
      '      </div>' +

      '      <div id="acctVerifyFilled" style="display:none">' +
      '        <div class="acct-ok">🎉 Email vérifié !</div>' +
      '        <p class="acct-hint">Ton compte est activé. Connecte-toi pour sauvegarder tes programmes.</p>' +
      '        <div id="acctVerifyFilledErr" class="acct-err"></div>' +
      '        <div class="acct-row"><button id="acctVerifyFilledBtn" class="acct-btn acct-primary">Aller à la connexion</button></div>' +
      '      </div>' +

      '      <div id="acctForgot" style="display:none">' +
      '        <div class="acct-forgot-title">Réinitialisation du mot de passe</div>' +
      '        <p class="acct-hint">Entrre ton adresse email : nous t\u0027enverrons un lien.</p>' +
      '        <label>Adresse email</label><input id="acctForgotEmail" type="email" autocomplete="email">' +
      '        <div id="acctForgotErr" class="acct-err"></div>' +
      '        <div class="acct-row"><button id="acctForgotSendBtn" class="acct-btn acct-primary">Envoyer le lien</button>' +
      '          <button id="acctForgotBackBtn" class="acct-btn">Annuler</button></div>' +
      '      </div>' +

      '      <div id="acctReset" style="display:none">' +
      '        <div class="acct-forgot-title">Choisir un nouveau mot de passe</div>' +
      '        <label>Nouveau mot de passe (' + MIN_PW + ' caractères min.)</label>' +
      '        <div class="acct-pass-row"><input id="acctResetPassword" type="password" autocomplete="new-password">' +
      '          <button class="acct-eye" id="acctResetPwToggle" type="button">👁</button></div>' +
      '        <div class="acct-meter" id="acctResetMeter"><div class="acct-meter-fill"></div></div>' +
      '        <div class="acct-strength-row"><span class="acct-strength-label" id="acctResetStrengthLabel"></span>' +
      '          <span class="acct-strength-time" id="acctResetStrengthTime"></span></div>' +
      '        <label>Confirmer</label>' +
      '        <div class="acct-pass-row"><input id="acctResetPassword2" type="password" autocomplete="new-password">' +
      '          <button class="acct-eye" id="acctResetPw2Toggle" type="button">👁</button></div>' +
      '        <div id="acctResetMatch" class="acct-strength-time" style="margin-top:4px"></div>' +
      '        <div id="acctResetErr" class="acct-err"></div>' +
      '        <div class="acct-row"><button id="acctResetSendBtn" class="acct-btn acct-primary">Mettre à jour</button>' +
      '          <button id="acctResetCancelBtn" class="acct-btn">Annuler</button></div>' +
      '      </div>' +

      '      <div id="acctAdmin" style="display:none">' +
      '        <div class="acct-admin-bar"><span>👑 Gestion des utilisateurs</span>' +
      '          <button id="acctAdminBackBtn" class="acct-btn">Retour</button></div>' +
      '        <div id="acctAdminList" class="acct-admin-list"></div>' +
      '      </div>' +

      '      <div id="acctMember" style="display:none">' +
      '        <div class="acct-who">Connecté : <b id="acctUsernameShown"></b> <span id="acctRoleBadge" class="acct-role"></span>' +
      '          <span id="acctEmailShown" class="acct-hint"></span></div>' +
      '        <div class="acct-program-list" id="acctProgramList"></div>' +
      '        <div class="acct-row">' +
      '          <button id="acctSaveBtn" class="acct-btn acct-primary">💾 Sauvegarder ce programme</button>' +
      '          <button id="acctNewBtn" class="acct-btn">Nouveau</button>' +
      '          <button id="acctLogoutBtn" class="acct-btn acct-danger">Déconnexion</button>' +
      '        </div>' +
      '        <div style="margin-top:8px;display:flex;gap:8px">' +
      '          <button id="acctAdminBtn" class="acct-btn" style="flex:1">👑 Admin</button>' +
      '          <button id="acctChangePwBtn" class="acct-btn" style="flex:1">🔑 Mot de passe</button>' +
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
      const id = $('acctUsername').value.trim(), p = $('acctPassword').value;
      if (!id || !p) return showGuestError('Remplis les deux champs.');
      api('/auth/login', { method: 'POST', body: { username: id, password: p } })
        .then((r) => { state.user = r.user; showModal('member'); refreshPrograms(); })
        .catch((e) => {
          if (e && e.json && e.json.error === 'email_non_verifie') {
            state.pendingEmail = e.json.email || '';
            switchView('acctVerifyEmail', ['acctGuest']);
            showVerifyError('Ton email n\u0027est pas encore vérifié. Clique sur le lien reçu, ou renvoie-le.');
          } else if (e && e.status === 403) {
            showGuestError(e.message);
          } else { showGuestError(e); }
        });
    });
    $('acctForgotLink').addEventListener('click', () => switchView('acctForgot', ['acctGuest']));
    $('acctForgotSendBtn').addEventListener('click', () => {
      const e = $('acctForgotEmail').value.trim(), err = $('acctForgotErr');
      if (!EMAIL_RE.test(e)) { if (err) { err.textContent = 'Adresse email invalide.'; err.style.color = '#ff6b6b'; } return; }
      if (err) { err.textContent = ''; }
      api('/auth/forgot', { method: 'POST', body: { email: e } }).then(() => {
        switchView('acctForgot', ['acctGuest', 'acctLoginView', 'acctRegisterView', 'acctVerifyEmail', 'acctReset', 'acctMember', 'acctAdmin', 'acctVerifyFilled']);
        showForgotDone(e);
      }).catch((e2) => { if (err) { err.textContent = (e2 && e2.message) || 'Erreur'; err.style.color = '#ff6b6b'; } });
    });
    $('acctForgotBackBtn').addEventListener('click', () => switchView('acctGuest', ['acctForgot']));
    $('acctResendBtn').addEventListener('click', () => {
      if (!state.pendingEmail) return;
      api('/auth/resend-verify', { method: 'POST', body: { email: state.pendingEmail } })
        .then(() => showVerifyError('✅ Lien renvoyé. Vérifie ta boîte de réception.'))
        .catch(() => showVerifyError('Erreur lors du renvoi. Réessaie.'));
    });
    $('acctVerifyBackBtn').addEventListener('click', () => { switchView('acctGuest', ['acctVerifyEmail', 'acctVerifyFilled']); showGuestTab('login'); });
    $('acctVerifyFilledBtn').addEventListener('click', () => { switchView('acctGuest', ['acctVerifyFilled']); showGuestTab('login'); });

    $('acctResetCancelBtn').addEventListener('click', () => { activeResetToken = null; switchView('acctGuest', ['acctReset']); showGuestTab('login'); });
    $('acctResetSendBtn').addEventListener('click', submitReset);
    $('acctResetPwToggle').addEventListener('click', () => togglePw('acctResetPassword', 'acctResetPwToggle'));
    $('acctResetPw2Toggle').addEventListener('click', () => togglePw('acctResetPassword2', 'acctResetPw2Toggle'));

    const rp1 = $('acctResetPassword'), rp2 = $('acctResetPassword2');
    if (rp1) {
      rp1.addEventListener('input', () => {
        renderResetStrength(rp1.value);
        const msg = $('acctResetMatch');
        if (rp2.value) { msg.textContent = rp1.value === rp2.value ? '✅ Correspond' : '⚠️ Ne correspond pas'; msg.className = 'acct-strength-time ' + (rp1.value === rp2.value ? 'time-good' : 'time-bad'); }
      });
      rp1.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitReset(); });
    }
    if (rp2) {
      rp2.addEventListener('input', () => {
        const msg = $('acctResetMatch');
        msg.textContent = rp1.value === rp2.value ? '✅ Correspond' : '⚠️ Ne correspond pas';
        msg.className = 'acct-strength-time ' + (rp1.value === rp2.value ? 'time-good' : 'time-bad');
      });
      rp2.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitReset(); });
    }

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
    const dem = $('acctRegEmail');
    if (dem) dem.addEventListener('input', updateRegButton);
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
    $('acctAdminBtn').addEventListener('click', () => { showModal('admin'); loadAdminList(); });
    $('acctAdminBackBtn').addEventListener('click', () => showModal('member'));
    $('acctChangePwBtn').addEventListener('click', () => { switchView('acctForgot', ['acctMember']); });
  }

  /* ---------- reset (lien ?reset=TOKEN) ---------- */
  function renderResetStrength(pw) {
    const meter = $('acctResetMeter'), lab = $('acctResetStrengthLabel'), time = $('acctResetStrengthTime');
    if (!meter) return;
    const sc = window.zxcvbn ? window.zxcvbn(pw) : null;
    const fill = meter.querySelector('.acct-meter-fill');
    if (!pw) { meter.className = 'acct-meter'; if (fill) fill.style.width = '0'; if (lab) lab.textContent = ''; if (time) time.textContent = ''; return; }
    let tone, label, cls = '', txt = '';
    if (pw.length < MIN_PW) { tone = 'weak'; label = 'Trop court (' + pw.length + '/' + MIN_PW + ')'; if (fill) fill.style.width = Math.min(100, Math.max(8, (pw.length / MIN_PW) * 100)) + '%'; }
    else if (!sc) { tone = 'weak'; label = ''; if (fill) fill.style.width = ''; }
    else {
      if (fill) fill.style.width = '';
      const s = sc.score;
      if (s <= 1) { tone = 'weak'; label = 'Très faible'; cls = 'time-bad'; }
      else if (s === 2) { tone = 'weak'; label = 'Faible'; cls = 'time-ok'; }
      else if (s === 3) { tone = 'good'; label = 'Correct'; cls = 'time-ok'; }
      else { tone = 'strong'; label = 'Fort'; cls = 'time-good'; }
      txt = '🕒 cassable en ' + humanDuration(sc.crack_times_seconds.offline_slow_hashing_1e4_per_second);
    }
    meter.className = 'acct-meter ' + tone;
    if (lab) lab.textContent = label;
    if (time) { time.textContent = txt; time.className = 'acct-strength-time ' + cls; }
    const btn = $('acctResetSendBtn');
    if (btn) btn.disabled = !(pw.length >= MIN_PW && sc && sc.score >= MIN_SCORE && rp2Value() === pw);
  }
  function rp2Value() { const e = $('acctResetPassword2'); return e ? e.value : ''; }
  function submitReset() {
    const p = $('acctResetPassword').value, p2 = $('acctResetPassword2').value, err = $('acctResetErr');
    if (err) err.textContent = '';
    if (!activeResetToken) { if (err) { err.textContent = 'Lien manquant. Demande à nouveau « mot de passe oublié ».'; err.style.color = '#ff6b6b'; } return; }
    if (p.length < MIN_PW) { if (err) { err.textContent = MIN_PW + ' caractères minimum.'; err.style.color = '#ff6b6b'; } return; }
    if (p !== p2) { if (err) { err.textContent = 'Les mots de passe ne correspondent pas.'; err.style.color = '#ff6b6b'; } return; }
    api('/auth/reset', { method: 'POST', body: { token: activeResetToken, password: p } })
      .then(() => { activeResetToken = null; switchView('acctForgot', ['acctGuest', 'acctReset', 'acctLoginView', 'acctRegisterView', 'acctVerifyEmail', 'acctMember', 'acctAdmin', 'acctVerifyFilled']); showResetDone(); })
      .catch((e) => { if (err) { err.textContent = (e && e.message) || 'Erreur'; err.style.color = '#ff6b6b'; } });
  }

  /* ---------- message info (done) ---------- */
  function showForgotDone(email) {
    const g = $('acctForgot'); if (!g) return;
    g.innerHTML = '<div class="acct-ok">📬 C\u0027est envoyé !</div>' +
      '<p class="acct-hint">Si un compte existe pour <b>' + email + '</b>, tu vas recevoir un lien de réinitialisation (valable 1 heure).</p>' +
      '<div class="acct-row"><button id="acctForgotDoneLogin" class="acct-btn acct-primary">Revenir à la connexion</button></div>';
    const b = $('acctForgotDoneLogin'); if (b) b.addEventListener('click', () => { switchView('acctGuest', ['acctForgot']); showGuestTab('login'); });
  }
  function showResetDone() {
    const g = $('acctForgot'); if (!g) return;
    switchView('acctForgot', ['acctGuest', 'acctLoginView']);
    g.innerHTML = '<div class="acct-ok">✅ Mot de passe mis à jour !</div>' +
      '<p class="acct-hint">Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>' +
      '<div class="acct-row"><button id="acctResetDoneLogin" class="acct-btn acct-primary">Se connecter</button></div>';
    const b = $('acctResetDoneLogin'); if (b) b.addEventListener('click', () => { switchView('acctGuest', ['acctForgot']); showGuestTab('login'); });
  }

  /* ---------- panneau admin ---------- */
  function loadAdminList() {
    const list = $('acctAdminList'); if (list) list.innerHTML = 'Chargement…';
    api('/admin/users').then((r) => { adminUsers = r.users; renderAdminList(); })
      .catch(() => { if (list) list.innerHTML = '<div class="acct-err">Erreur de chargement.</div>'; });
  }
  function renderAdminList() {
    const list = $('acctAdminList'); if (!list) return;
    list.innerHTML = '';
    const users = adminUsers || [];
    users.forEach((u) => {
      const row = document.createElement('div'); row.className = 'acct-admin-row';
      const info = document.createElement('div'); info.className = 'acct-admin-info';
      info.innerHTML = '<b>' + u.username + '</b> <span class="acct-hint">' + (u.email || '—') + '</span>' +
        '<br><span class="acct-hint">' + (u.role === 'admin' ? '👑 admin' : '👤 user') + ' · ' + (u.active ? 'actif' : '⛔ inactif') + ' · email ' + (u.email_verified ? '✓' : '✗') + ' · ' + u.programs + ' programme(s)</span>';
      row.appendChild(info);
      const acts = document.createElement('div'); acts.className = 'acct-admin-actions';
      if (state.user.id !== u.id) {
        if (u.role !== 'admin') {
          const p = document.createElement('button'); p.className = 'acct-btn acct-admin-act'; p.textContent = '👑';
          p.title = 'Promouvoir admin'; p.addEventListener('click', () => adminPatch(u.id, { role: 'admin' }));
          acts.appendChild(p);
        }
        const d = document.createElement('button'); d.className = 'acct-btn acct-admin-act'; d.textContent = u.active ? '⛔' : '✅';
        d.title = u.active ? 'Désactiver' : 'Activer'; d.addEventListener('click', () => adminPatch(u.id, { active: u.active ? 0 : 1 }));
        acts.appendChild(d);
        const r = document.createElement('button'); r.className = 'acct-btn acct-admin-act'; r.textContent = '🔑';
        r.title = 'Réinitialiser le mot de passe (envoi par mail)'; r.addEventListener('click', () => adminResetPw(u.id));
        acts.appendChild(r);
        const del = document.createElement('button'); del.className = 'acct-btn acct-admin-act acct-admin-del'; del.textContent = '🗑';
        del.title = 'Supprimer'; del.addEventListener('click', () => adminDelete(u.id));
        acts.appendChild(del);
      }
      row.appendChild(acts);
      list.appendChild(row);
    });
    if (!users.length) { const e = document.createElement('div'); e.className = 'acct-empty'; e.textContent = 'Aucun utilisateur.'; list.appendChild(e); }
  }
  function adminPatch(id, body) {
    api('/admin/users/' + id, { method: 'PATCH', body }).then(() => loadAdminList()).catch(() => loadAdminList());
  }
  function adminDelete(id) {
    if (!confirm('Supprimer ce compte et tous ses programmes ?')) return;
    api('/admin/users/' + id, { method: 'DELETE' }).then(() => loadAdminList()).catch(() => loadAdminList());
  }
  function adminResetPw(id) {
    if (!confirm('Réinitialiser le mot de passe de ce compte ? Un nouveau mot de passe sera envoyé par email.')) return;
    api('/admin/users/' + id + '/reset-password', { method: 'POST' })
      .then(() => alert('Nouveau mot de passe envoyé par email.'))
      .catch((e) => alert('Erreur : ' + ((e && e.message) || 'inconnue')));
  }

  /* ---------- guest / member switching ---------- */
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
    const all = ['acctGuest', 'acctMember', 'acctVerifyEmail', 'acctVerifyFilled', 'acctForgot', 'acctReset', 'acctAdmin'];
    all.forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
    if (vue === 'member') {
      $('acctMember').style.display = 'block';
      $('acctTitle').textContent = 'Mes programmes';
      $('acctUsernameShown').textContent = state.user.username;
      const badge = $('acctRoleBadge'), em = $('acctEmailShown');
      if (badge) badge.textContent = state.user.role === 'admin' ? ' (admin)' : '';
      if (em) em.textContent = state.user.email || '';
      const adminBtn = $('acctAdminBtn'); if (adminBtn) adminBtn.style.display = state.user.role === 'admin' ? '' : 'none';
      $('acctErr').textContent = ''; $('acctRegErr').textContent = '';
    } else if (vue === 'verifyEmail') {
      $('acctVerifyEmail').style.display = 'block';
      $('acctTitle').textContent = 'Vérifie ton email';
      const s = $('acctVerifyEmailShown'); if (s) s.textContent = state.pendingEmail;
      const err = $('acctVerifyErr'); if (err) { err.textContent = 'Un lien de confirmation a été envoyé. Clique dessus pour activer ton compte.'; err.style.color = '#8bd8a6'; }
    } else if (vue === 'verifyFilled') {
      $('acctVerifyFilled').style.display = 'block';
      $('acctTitle').textContent = 'Email vérifié';
    } else if (vue === 'forgot') {
      $('acctForgot').style.display = 'block';
      $('acctTitle').textContent = 'Mot de passe oublié';
    } else if (vue === 'reset') {
      $('acctReset').style.display = 'block';
      $('acctTitle').textContent = 'Nouveau mot de passe';
    } else if (vue === 'admin') {
      $('acctAdmin').style.display = 'block';
      $('acctTitle').textContent = 'Administration';
    } else {
      $('acctGuest').style.display = 'block';
      $('acctMember').style.display = 'none';
      $('acctTitle').textContent = 'Connexion / Inscription';
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
    handleUrlParams();
  }

  init();
}
