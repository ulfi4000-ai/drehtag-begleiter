// Sprachnotiz aufnehmen: Mikrofon im Vollbild, große Uhr, offene Fragen als Gedächtnisstütze.
// Die Aufnahme bleibt auf dem Gerät; transkribiert wird später am PC (Whisper, lokal).
import { esc, showOverlay, toast } from './util.js';

// Formate in der Reihenfolge, in der wir sie versuchen (Android Chrome: WebM/Opus)
const FORMATE = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const uhr = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Ergebnis: { blob, dauer, typ } oder null bei Abbruch
export async function sprachnotizAufnehmen({ fragen = [] } = {}) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Aufnehmen geht in diesem Browser nicht');
    return null;
  }
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    toast('Kein Zugriff aufs Mikrofon. Bitte in den Einstellungen erlauben.');
    return null;
  }
  const typ = FORMATE.find((f) => MediaRecorder.isTypeSupported(f)) || '';
  // 32 kbit/s reichen für Sprache: etwa 0,25 MB pro Minute
  const rec = new MediaRecorder(strom, { ...(typ ? { mimeType: typ } : {}), audioBitsPerSecond: 32000 });
  const teile = [];
  rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data); };

  let wachhalter = null;
  try { wachhalter = await navigator.wakeLock?.request('screen'); } catch { /* ohne geht es auch */ }

  return new Promise((resolve) => {
    let ergebnis = null;
    let verworfen = false;
    let start = 0;
    let takt = 0;
    const fertig = () => ({
      blob: new Blob(teile, { type: rec.mimeType || typ || 'audio/webm' }),
      dauer: Math.round((performance.now() - start) / 1000),
      typ: rec.mimeType || typ,
    });
    const aufraeumen = () => {
      clearInterval(takt);
      strom.getTracks().forEach((t) => t.stop());
      wachhalter?.release().catch(() => {});
    };
    const o = showOverlay(`
      <div class="aufnahme">
        <div class="auf-kopf"><span class="auf-punkt"></span><span>Aufnahme läuft</span></div>
        <p class="auf-uhr">0:00</p>
        ${fragen.length ? `
          <div class="auf-fragen">
            <p class="auf-hinweis">Noch offen – kurz etwas dazu sagen:</p>
            <ul>${fragen.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          </div>` : '<p class="auf-hinweis">Sprich alles ein, was aus dem Gespräch wichtig ist.</p>'}
        <div class="auf-knoepfe">
          <button class="btn primary big" data-a="stopp">■ Stopp und speichern</button>
          <button class="btn big auf-weg" data-a="weg">Verwerfen</button>
        </div>
      </div>`, {
      onClose: () => {
        // Versehentlich geschlossen (Zurück-Taste)? Dann trotzdem speichern, nichts geht verloren.
        if (!ergebnis && !verworfen && rec.state !== 'inactive') {
          rec.onstop = () => { aufraeumen(); resolve(fertig()); };
          rec.stop();
          return;
        }
        if (rec.state !== 'inactive') rec.stop();
        aufraeumen();
        resolve(ergebnis);
      },
    });
    const anzeige = o.el.querySelector('.auf-uhr');
    rec.onstart = () => {
      start = performance.now();
      takt = setInterval(() => { anzeige.textContent = uhr((performance.now() - start) / 1000); }, 250);
    };
    o.el.querySelector('.aufnahme').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'weg') {
        if (teile.length > 2 && !confirm('Aufnahme verwerfen?')) return;
        verworfen = true;
        o.close();
        return;
      }
      // Stopp: erst die letzten Daten abholen, dann schließen
      b.disabled = true;
      rec.onstop = () => { ergebnis = fertig(); o.close(); };
      rec.stop();
    });
    rec.start(1000); // jede Sekunde ein Stück, damit bei Problemen nicht alles verloren ist
  });
}
