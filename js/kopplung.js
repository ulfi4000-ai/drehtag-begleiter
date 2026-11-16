// Teleprompter auf einem zweiten Gerät koppeln und steuern (nur in der Android-App).
// Die App wird im WLAN oder Hotspot zum kleinen Server (PrompterServer.java). Das zweite Gerät
// scannt den QR-Code mit der Kamera und öffnet die Teleprompter-Seite – ohne Internet.
import { esc, showOverlay, toast } from './util.js';
import { istNativ } from './nativ.js';

const C = window.Capacitor;
const rufe = (methode, daten = {}) => C.nativePromise('Drehtag', methode, daten);

// Dieselben Einstellungen wie der eigene Teleprompter (js/prompter.js)
const KEY = 'prompter-einstellungen';
const einstellung = () => {
  try { return { tempo: 60, groesse: 40, spiegeln: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { tempo: 60, groesse: 40, spiegeln: false }; }
};
const merken = (e) => { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* privat */ } };

export const kopplung = { aktiv: false, geraete: 0, titel: '' };
let hoerer = null;

export const gekoppelt = () => istNativ && kopplung.aktiv && kopplung.geraete > 0;

async function senden(befehl, art = '') {
  const r = await rufe('prompterSenden', { befehl: JSON.stringify(befehl), art });
  kopplung.geraete = r.geraete ?? kopplung.geraete;
  return kopplung.geraete;
}

function einstellungSenden(e = einstellung()) {
  // Auf dem großen Display etwas größere Schrift als im Handy-Prompter
  return senden({ typ: 'einstellung', tempo: e.tempo, groesse: Math.round(e.groesse * 1.1), spiegeln: e.spiegeln }, 'einstellung');
}

// Koppeln: Server starten, QR-Code zeigen, warten bis das zweite Gerät da ist
export async function koppelnZeigen(render) {
  let r;
  try {
    r = await rufe('kopplungStarten');
  } catch (e) {
    toast(e?.message || 'Kopplung ließ sich nicht starten');
    return;
  }
  kopplung.aktiv = true;
  kopplung.geraete = r.geraete || 0;
  hoerer ??= C.addListener('Drehtag', 'prompterGeraete', (d) => {
    const vorher = kopplung.geraete;
    kopplung.geraete = d.anzahl;
    if (d.anzahl > vorher) { toast('Teleprompter-Gerät verbunden'); einstellungSenden(); }
    else if (d.anzahl < vorher) toast('Teleprompter-Gerät getrennt');
    const z = document.querySelector('.kopplung-status');
    if (z) z.textContent = statusText();
    render?.();
  });
  const o = showOverlay(`
    <div class="sheet-wrap"><div class="sheet kopplung" role="dialog" aria-label="Teleprompter-Gerät koppeln">
      <h2>Teleprompter-Gerät koppeln</h2>
      ${r.fehler ? `<p class="hinweis">${esc(r.fehler)}</p>` : `
        <ol class="mute kopplung-schritte">
          <li>Zweites Gerät ins selbe WLAN oder in den Hotspot dieses Handys.</li>
          <li>Mit der Kamera-App diesen Code scannen und den Link öffnen.</li>
          <li>Dort „Antippen und loslegen“.</li>
        </ol>
        <img class="kopplung-qr" src="${r.qr}" alt="QR-Code zum Koppeln">
        <p class="kopplung-url">${esc(r.url)}</p>
        ${r.weitere?.length ? `<p class="mute">Andere Netze: ${r.weitere.map(esc).join('<br>')}</p>` : ''}`}
      <p class="kopplung-status">${statusText()}</p>
      <button class="btn primary big" data-k="fertig">Fertig</button>
      <button class="btn big" data-k="beenden">Kopplung beenden</button>
    </div></div>`);
  o.el.querySelector('.sheet').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    if (b.dataset.k === 'beenden') await koppelnBeenden();
    o.close();
    render?.();
  });
}

export async function koppelnBeenden() {
  await rufe('kopplungBeenden').catch(() => {});
  kopplung.aktiv = false;
  kopplung.geraete = 0;
  hoerer?.remove();
  hoerer = null;
  toast('Kopplung beendet');
}

const statusText = () => (kopplung.geraete ? `✓ ${kopplung.geraete === 1 ? 'Ein Gerät' : `${kopplung.geraete} Geräte`} verbunden` : 'Noch kein Gerät verbunden');

// Text aufs zweite Gerät schicken (steht dort pausiert am Anfang)
export async function textSenden(titel, text) {
  kopplung.titel = titel || '';
  await einstellungSenden();
  return senden({ typ: 'text', titel: titel || '', text: text || '' }, 'text');
}

// Fernsteuerung als Leiste unten. Bluetooth-Tasten am Hauptgerät: Weiter = Start/Pause, Zurück = zurück.
export function steuerungZeigen() {
  const e = einstellung();
  const o = showOverlay(`
    <div class="sheet-wrap"><div class="sheet fern-prompter" role="dialog" aria-label="Teleprompter steuern">
      <p class="mute">Auf dem Teleprompter-Gerät: <b>${esc(kopplung.titel)}</b></p>
      <button class="btn primary big" data-fp="umschalten">▶ Start / ⏸ Pause</button>
      <div class="fp-reihe">
        <button class="btn" data-fp="anfang">⟲ Anfang</button>
        <button class="btn" data-fp="zurueck">↑ Zurück</button>
        <button class="btn" data-fp="vor">↓ Weiter</button>
      </div>
      <div class="fp-reihe">
        <button class="btn" data-fp="langsamer">Tempo −</button><span class="fp-wert" data-w="tempo">${e.tempo}</span><button class="btn" data-fp="schneller">Tempo +</button>
      </div>
      <div class="fp-reihe">
        <button class="btn" data-fp="kleiner">A −</button><span class="fp-wert" data-w="groesse">${e.groesse}</span><button class="btn" data-fp="groesser">A +</button>
        <button class="btn ${e.spiegeln ? 'an' : ''}" data-fp="spiegeln">Spiegeln</button>
      </div>
      <button class="btn big" data-fp="zu">Schließen</button>
    </div></div>`);
  const zeigen = () => {
    o.el.querySelector('[data-w="tempo"]').textContent = e.tempo;
    o.el.querySelector('[data-w="groesse"]').textContent = e.groesse;
    o.el.querySelector('[data-fp="spiegeln"]').classList.toggle('an', e.spiegeln);
  };
  o.el.querySelector('.sheet').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-fp]');
    if (!b) return;
    const was = b.dataset.fp;
    if (was === 'zu') { o.close(); return; }
    if (['umschalten', 'anfang', 'zurueck', 'vor'].includes(was)) {
      if (!(await senden({ typ: was }))) toast('Kein Teleprompter-Gerät verbunden');
      return;
    }
    if (was === 'langsamer') e.tempo = Math.max(10, e.tempo - 10);
    if (was === 'schneller') e.tempo = Math.min(300, e.tempo + 10);
    if (was === 'kleiner') e.groesse = Math.max(20, e.groesse - 4);
    if (was === 'groesser') e.groesse = Math.min(120, e.groesse + 4);
    if (was === 'spiegeln') e.spiegeln = !e.spiegeln;
    merken(e);
    zeigen();
    await einstellungSenden(e);
  });
}
