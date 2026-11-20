// Unterschrift auf dem Handy: Text der Einverständniserklärung oben, Name, Feld zum Unterschreiben.
// Ergebnis ist ein PNG (weißer Grund, schwarze Linie) oder null bei Abbruch.
import { esc, showOverlay } from './util.js';

export function openUnterschrift({ text = '', name = '' } = {}) {
  return new Promise((fertig) => {
    let ergebnis = null;
    const o = showOverlay(`
      <div class="unterschrift">
        <div class="u-text">${text.trim() ? esc(text) : '<b>Noch kein Text hinterlegt.</b> Den Text der Einverständniserklärung unter „Sicherung“ eintragen.'}</div>
        <label class="u-name">Name <input name="name" value="${esc(name)}" autocomplete="off"></label>
        <div class="u-flaeche"><canvas></canvas><span class="u-linie">Hier unterschreiben</span></div>
        <div class="s-bar">
          <button data-u="zu">Abbrechen</button>
          <button data-u="leer">Löschen</button>
          <button data-u="ok" class="s-save" disabled>Unterschrift speichern</button>
        </div>
      </div>`, { onClose: () => fertig(ergebnis) });
    const root = o.el.querySelector('.unterschrift');
    const c = root.querySelector('canvas');
    const ok = root.querySelector('[data-u="ok"]');
    const ctx = c.getContext('2d');
    let gezeichnet = false;
    let zuletzt = null;

    function groesse() {
      const r = c.getBoundingClientRect();
      const f = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * f);
      c.height = Math.round(r.height * f);
      ctx.setTransform(f, 0, 0, f, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, r.width, r.height);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
      gezeichnet = false;
      ok.disabled = true;
    }
    const punkt = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); zuletzt = punkt(e); });
    c.addEventListener('pointermove', (e) => {
      if (!zuletzt) return;
      const p = punkt(e);
      ctx.beginPath();
      ctx.moveTo(zuletzt.x, zuletzt.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      zuletzt = p;
      if (!gezeichnet) { gezeichnet = true; ok.disabled = false; }
    });
    const ende = () => { zuletzt = null; };
    c.addEventListener('pointerup', ende);
    c.addEventListener('pointercancel', ende);

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-u]');
      if (!b) return;
      if (b.dataset.u === 'zu') o.close();
      if (b.dataset.u === 'leer') groesse();
      if (b.dataset.u === 'ok' && gezeichnet) {
        const n = root.querySelector('input[name="name"]').value.trim();
        c.toBlob((blob) => { ergebnis = { blob, name: n }; o.close(); }, 'image/png');
      }
    });
    requestAnimationFrame(groesse);
  });
}
