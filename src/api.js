/* api.js — enveloppe réseau vers le backend arduino-compile (/api/* via nginx). */
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) || '/api';

export function api(path, opts = {}) {
  return fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  }).then((r) =>
    r.json().catch(() => ({ ok: false, error: 'réponse illisible (code ' + r.status + ')' }))
  ).then((json) => {
    if (!json.ok) throw Object.assign(new Error(json.error || 'erreur API'), { status: json.statusCode, json });
    return json;
  });
}

export { API_BASE };