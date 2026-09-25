/* Cartes Arduino supportées (Option Mega).
   La carte est un choix APP (persisté localStorage), pas par-programme.
   id client -> {fqbn (compile), avr (Avrgirl), name{fr,en,key}}. */

const STORE = 'arduino-blocks-board';
const BOARDS = {
  uno: { fqbn: 'arduino:avr:uno', avr: 'uno', name: { fr: 'Arduino Uno', en: 'Arduino Uno' } },
  mega: { fqbn: 'arduino:avr:mega', avr: 'mega', name: { fr: 'Arduino Mega', en: 'Arduino Mega' } },
};
export function boardIds() { return Object.keys(BOARDS); }
export function getBoard() { try { const b = localStorage.getItem(STORE); return b in BOARDS ? b : 'uno'; } catch (_) { return 'uno'; } }
export function setBoard(id) { if (!(id in BOARDS)) id = 'uno'; try { localStorage.setItem(STORE, id); } catch (_) {} return id; }
export function boardLabel(id, lang) { const b = BOARDS[id] || BOARDS.uno; return (b.name[lang] || b.name.fr); }
export function boardFqbn(id) { return (BOARDS[id] || BOARDS.uno).fqbn; }
export function boardAvr(id) { return (BOARDS[id] || BOARDS.uno).avr; }