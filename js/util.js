// Kleine Helfer für die Oberfläche, die mehrere Dateien brauchen.
export { fmtDatum, heute } from './modell.js';

// Text sicher in HTML einsetzen (verhindert, dass Eingaben als HTML gelesen werden)
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
// Kurzer Hinweis unten. Optional mit Knopf (z. B. „Rückgängig“), dann bleibt er länger stehen.
export function toast(msg, { knopf = '', beiKnopf = null, dauer = 0 } = {}) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('mit-knopf', !!knopf);
  if (knopf) {
    const b = document.createElement('button');
    b.className = 'toast-knopf';
    b.textContent = knopf;
    b.addEventListener('click', () => { clearTimeout(toastTimer); el.hidden = true; beiKnopf?.(); });
    el.append(' ', b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, dauer || (knopf ? 8000 : 2600));
}

// Vollbild-Ebene öffnen. Die Zurück-Taste am Handy schließt sie wieder,
// statt die Seite dahinter zu wechseln.
let offen = null;
export function showOverlay(html, { onClose } = {}) {
  const el = document.getElementById('overlay');
  el.innerHTML = html;
  el.hidden = false;
  document.body.classList.add('no-scroll');
  history.pushState({ overlay: true }, '');
  const o = {
    el,
    closed: false,
    close() { if (!o.closed) history.back(); },
    finish() {
      o.closed = true;
      el.hidden = true;
      el.innerHTML = '';
      document.body.classList.remove('no-scroll');
      onClose?.();
    },
  };
  offen = o;
  return o;
}

window.addEventListener('popstate', () => {
  if (offen && !offen.closed) {
    const o = offen;
    offen = null;
    o.finish();
  }
});
