// Zeichenfläche: Skizze mit Finger, Stift oder Maus – auf weißem Grund oder auf einem Foto.
// Leere Skizzen haben das Format des Shots (hochkant 9:16 oder quer 16:9).
// Gezeichnet wird auf einer eigenen Ebene über dem Hintergrund. Deshalb kann der
// Radierer Striche entfernen, ohne das Foto darunter zu beschädigen.
import { showOverlay } from './util.js';

// Ergebnis: { blob, strokes, format } oder null bei Abbruch.
// symbole: zusätzliche Leiste mit Licht, Kamera, Person, Mikro (für Aufbau-Skizzen)
export async function openSketch({ format = 'hochkant', strokes = [], hintergrund = null, symbole = false } = {}) {
  let bild = null;
  if (hintergrund) {
    try { bild = await createImageBitmap(hintergrund); } catch { bild = null; }
  }
  return new Promise((resolve) => {
    const W = bild ? bild.width : format === 'quer' ? 1920 : 1080;
    const H = bild ? bild.height : format === 'quer' ? 1080 : 1920;
    const mass = Math.max(W, H) / 1920; // Strichstärken passen sich der Bildgröße an
    let ergebnis = null;

    const o = showOverlay(`
      <div class="sketch">
        <div class="s-bar">
          <button data-s="cancel">Abbrechen</button>
          <span class="s-titel">${bild ? 'Auf Foto zeichnen' : 'Skizze · ' + format}</span>
          <button data-s="save" class="s-save">Speichern</button>
        </div>
        <div class="s-stage"><canvas></canvas></div>
        <div class="s-bar s-tools">
          <button data-s="farbe" data-c="#111111" class="s-farbe ${bild ? '' : 'an'}" style="--c:#111111" aria-label="Schwarz"></button>
          <button data-s="farbe" data-c="#CD0000" class="s-farbe ${bild ? 'an' : ''}" style="--c:#CD0000" aria-label="Rot"></button>
          <button data-s="farbe" data-c="#FFFFFF" class="s-farbe" style="--c:#FFFFFF" aria-label="Weiß"></button>
          <button data-s="radierer">Radierer</button>
          <button data-s="dicke">Dünn</button>
          <button data-s="undo">Zurück</button>
          <button data-s="clear">Leeren</button>
          ${symbole ? '<button data-s="symbolleiste">Symbole</button>' : ''}
        </div>
        ${symbole ? `
        <div class="s-bar s-tools s-symbole" hidden>
          <button data-s="sym" data-sym="licht">💡 Licht</button>
          <button data-s="sym" data-sym="kamera">🎥 Kamera</button>
          <button data-s="sym" data-sym="person">🧍 Person</button>
          <button data-s="sym" data-sym="mikro">🎙 Mikro</button>
        </div>` : ''}
      </div>`, { onClose: () => { zu = true; window.removeEventListener('resize', einpassen); bild?.close?.(); resolve(ergebnis); } });

    const root = o.el.querySelector('.sketch');
    const stage = root.querySelector('.s-stage');
    const canvas = root.querySelector('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Unsichtbare Ebene nur für die Striche
    const ebene = document.createElement('canvas');
    ebene.width = W;
    ebene.height = H;
    const ectx = ebene.getContext('2d');

    // Jeder Strich: Farbe (oder "radier"), Breite, Punkte [x0, y0, x1, y1, ...]
    const alle = strokes.map((s) => ({ ...s, pts: s.pts.slice() }));
    let aktuell = null;
    let farbe = bild ? '#CD0000' : '#111111';
    let dick = false;
    let radierer = false;
    let symbol = ''; // gewähltes Symbol: antippen setzt es, ziehen dreht es in die Richtung
    let geplant = false;
    let zu = false; // nach dem Schließen nichts mehr zeichnen, das Foto ist dann freigegeben

    // Canvas so groß wie möglich in den freien Platz legen, Seitenverhältnis bleibt
    function einpassen() {
      const f = Math.min((stage.clientWidth - 16) / W, (stage.clientHeight - 16) / H);
      canvas.style.width = Math.floor(W * f) + 'px';
      canvas.style.height = Math.floor(H * f) + 'px';
    }

    // Symbol zeichnen: Position x/y, Richtung a (Bogenmaß), Größe g
    function zeichneSymbol(s) {
      const g = s.g;
      ectx.save();
      ectx.globalCompositeOperation = 'source-over';
      ectx.translate(s.x, s.y);
      ectx.rotate(s.a);
      ectx.strokeStyle = s.c;
      ectx.fillStyle = s.c;
      ectx.lineWidth = Math.max(3, g * 0.12);
      ectx.lineCap = 'round';
      ectx.beginPath();
      if (s.sym === 'licht') {
        // Lampe mit Lichtkegel in Richtung a
        ectx.arc(0, 0, g * 0.35, 0, Math.PI * 2);
        ectx.fill();
        ectx.beginPath();
        ectx.moveTo(g * 0.4, -g * 0.2); ectx.lineTo(g * 1.6, -g * 0.8);
        ectx.moveTo(g * 0.4, g * 0.2); ectx.lineTo(g * 1.6, g * 0.8);
        ectx.moveTo(g * 0.45, 0); ectx.lineTo(g * 1.7, 0);
        ectx.stroke();
      } else if (s.sym === 'kamera') {
        // Gehäuse und Objektiv, das in Richtung a zeigt
        ectx.fillRect(-g * 0.6, -g * 0.4, g * 0.9, g * 0.8);
        ectx.beginPath();
        ectx.moveTo(g * 0.3, -g * 0.15); ectx.lineTo(g * 0.8, -g * 0.45); ectx.lineTo(g * 0.8, g * 0.45); ectx.lineTo(g * 0.3, g * 0.15);
        ectx.closePath();
        ectx.fill();
      } else if (s.sym === 'person') {
        // Kopf von oben, Schultern, Blickrichtung a
        ectx.arc(0, 0, g * 0.3, 0, Math.PI * 2);
        ectx.fill();
        ectx.beginPath();
        ectx.ellipse(-g * 0.15, 0, g * 0.25, g * 0.7, 0, 0, Math.PI * 2);
        ectx.stroke();
        ectx.beginPath();
        ectx.moveTo(g * 0.35, 0); ectx.lineTo(g * 0.75, 0);
        ectx.stroke();
      } else if (s.sym === 'mikro') {
        ectx.arc(g * 0.3, 0, g * 0.22, 0, Math.PI * 2);
        ectx.fill();
        ectx.beginPath();
        ectx.moveTo(g * 0.1, 0); ectx.lineTo(-g * 0.7, 0);
        ectx.stroke();
      }
      ectx.restore();
    }

    function strich(s, ab = 0) {
      if (s.sym) { zeichneSymbol(s); return; }
      ectx.globalCompositeOperation = s.c === 'radier' ? 'destination-out' : 'source-over';
      ectx.strokeStyle = s.c === 'radier' ? '#000' : s.c;
      ectx.lineWidth = s.w;
      ectx.lineCap = 'round';
      ectx.lineJoin = 'round';
      ectx.beginPath();
      const p = s.pts;
      ectx.moveTo(p[ab], p[ab + 1]);
      if (p.length - ab === 2) ectx.lineTo(p[ab] + 0.01, p[ab + 1]);
      for (let i = ab + 2; i < p.length; i += 2) ectx.lineTo(p[i], p[i + 1]);
      ectx.stroke();
    }

    // Hintergrund und Strich-Ebene zum sichtbaren Bild zusammensetzen
    function zusammensetzen() {
      geplant = false;
      if (zu) return;
      if (bild) ctx.drawImage(bild, 0, 0, W, H);
      else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(ebene, 0, 0);
    }
    const bald = () => { if (!geplant) { geplant = true; requestAnimationFrame(zusammensetzen); } };

    function neuZeichnen() {
      ectx.clearRect(0, 0, W, H);
      for (const s of alle) strich(s);
      zusammensetzen();
    }

    // Bildschirmposition des Fingers in Flächen-Koordinaten umrechnen
    function punkt(e) {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const [x, y] = punkt(e);
      if (symbol) {
        aktuell = { sym: symbol, c: farbe === '#FFFFFF' ? '#CD0000' : farbe, x, y, a: -Math.PI / 2, g: Math.round(120 * mass), pts: [x, y] };
        alle.push(aktuell);
        neuZeichnen();
        return;
      }
      aktuell = {
        c: radierer ? 'radier' : farbe,
        w: Math.round((radierer ? 60 : dick ? 18 : 7) * mass),
        pts: [x, y],
      };
      alle.push(aktuell);
      strich(aktuell);
      bald();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!aktuell) return;
      const [x, y] = punkt(e);
      if (aktuell.sym) {
        // Ziehen dreht das Symbol in Richtung Finger
        if (Math.hypot(x - aktuell.x, y - aktuell.y) > 10 * mass) aktuell.a = Math.atan2(y - aktuell.y, x - aktuell.x);
        neuZeichnen();
        return;
      }
      aktuell.pts.push(x, y);
      strich(aktuell, aktuell.pts.length - 4); // nur das neue Stück zeichnen
      bald();
    });
    const ende = () => { aktuell = null; };
    canvas.addEventListener('pointerup', ende);
    canvas.addEventListener('pointercancel', ende);

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      switch (b.dataset.s) {
        case 'cancel':
          if (alle.length === strokes.length || confirm('Änderungen verwerfen?')) o.close();
          break;
        case 'save':
          zusammensetzen();
          // Fotos als JPEG (kleiner), Skizzen als PNG (scharfe Linien)
          canvas.toBlob((blob) => {
            ergebnis = { blob, strokes: alle, format };
            o.close();
          }, bild ? 'image/jpeg' : 'image/png', 0.88);
          break;
        case 'farbe': farbe = b.dataset.c; radierer = false; symbol = ''; break;
        case 'radierer': radierer = true; symbol = ''; break;
        case 'symbolleiste': {
          const leiste = root.querySelector('.s-symbole');
          leiste.hidden = !leiste.hidden;
          if (leiste.hidden) symbol = '';
          requestAnimationFrame(einpassen);
          break;
        }
        case 'sym': symbol = symbol === b.dataset.sym ? '' : b.dataset.sym; radierer = false; break;
        case 'dicke': dick = !dick; b.textContent = dick ? 'Dick' : 'Dünn'; break;
        case 'undo': alle.pop(); neuZeichnen(); break;
        case 'clear':
          if (alle.length && confirm('Alle Striche löschen?')) { alle.length = 0; neuZeichnen(); }
          break;
      }
      for (const f of root.querySelectorAll('.s-farbe')) f.classList.toggle('an', !radierer && f.dataset.c === farbe);
      root.querySelector('[data-s="radierer"]').classList.toggle('an', radierer);
      for (const x of root.querySelectorAll('[data-s="sym"]')) x.classList.toggle('an', x.dataset.sym === symbol);
    });

    window.addEventListener('resize', einpassen);
    einpassen();
    neuZeichnen();
  });
}
