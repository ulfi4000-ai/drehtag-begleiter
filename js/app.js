// Einstieg: liest die Adresse (#/...), baut die passende Ansicht und hängt die Aktionen an.
//
// Aufbau der App:
//   modell.js    Daten-Logik ohne Browser (auch vom MCP-Server am PC benutzt)
//   db.js        Speichern im Browser (IndexedDB)
//   ansichten.js HTML der Seiten
//   aktionen.js  was beim Tippen passiert
//   dateien.js   Teilen, Backup, Drehtag-Datei, Zusammenführen
//   sketch.js, prompter.js  Zeichenfläche und Teleprompter
import * as db from './db.js';
import { z, urlsWechseln } from './zustand.js';
import * as A from './ansichten.js';
import { init, wachsen, sucheFuellen } from './aktionen.js';

const app = document.getElementById('app');
let letzteRoute = null;
let renderNr = 0;

async function render() {
  const nr = ++renderNr;
  const freigeben = urlsWechseln();
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const neueSeite = location.hash !== letzteRoute;
  if (neueSeite) { z.sortieren = false; z.bearbeiten = false; }
  let html = null;
  if (!a) html = await A.viewHome();
  else if (a === 'neu') html = A.viewTagForm(null, b);
  else if (a === 'tag' && c === 'bearbeiten') { const t = await db.get('drehtage', b); html = t ? A.viewTagForm(t) : null; }
  else if (a === 'tag') html = await A.viewTag(b, ['briefing', 'orte', 'plan'].includes(c) ? c : 'shots');
  else if (a === 'shot') html = await A.viewShot(b);
  else if (a === 'ort') html = await A.viewOrt(b);
  else if (a === 'video') html = await A.viewVideo(b);
  else if (a === 'faden') html = await A.viewFaden(b);
  else if (a === 'setting') html = await A.viewSetting(b, c);
  else if (a === 'sicherung') html = await A.viewSicherung();
  if (nr !== renderNr) return; // inzwischen wurde schon neu gezeichnet
  // Scroll-Position merken, damit die Seite beim Neuaufbau nicht nach oben springt
  const y = window.scrollY;
  app.innerHTML = html ?? `
    <header class="top"><a class="back" href="#/" aria-label="Zurück">‹</a><h1>Nicht gefunden</h1></header>
    <main><p class="leer">Diesen Eintrag gibt es nicht mehr.</p></main>`;
  freigeben();
  app.querySelectorAll('textarea.auto').forEach(wachsen);
  if (document.getElementById('suche') && z.suche) sucheFuellen();
  window.scrollTo(0, neueSeite ? 0 : y);
  letzteRoute = location.hash;
  fadenPflege(a === 'faden');
}

// Im Roten Faden: Bildschirm anlassen, aktuelle Station im Band zeigen, Uhrzeit-Abgleich jede Minute
let wachhalter = null;
let minutenTakt = 0;
async function fadenPflege(aktiv) {
  const band = document.getElementById('faden-band');
  const jetzt = band?.querySelector('.faden-punkt.jetzt');
  if (band && jetzt) band.scrollLeft = jetzt.offsetLeft - band.clientWidth / 2 + jetzt.clientWidth / 2;
  if (aktiv) {
    if (!wachhalter && document.visibilityState === 'visible') {
      try {
        wachhalter = await navigator.wakeLock?.request('screen');
        wachhalter?.addEventListener('release', () => { wachhalter = null; });
      } catch { /* nicht überall erlaubt, dann eben ohne */ }
    }
    if (!minutenTakt) {
      minutenTakt = setInterval(() => {
        if (location.hash.startsWith('#/faden/') && document.getElementById('overlay').hidden) render();
      }, 60000);
    }
  } else {
    wachhalter?.release().catch(() => {});
    wachhalter = null;
    clearInterval(minutenTakt);
    minutenTakt = 0;
  }
}
// Nach dem Zurückkehren in die App den Bildschirm wieder wach halten
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/faden/')) fadenPflege(true);
});

init(render);
window.addEventListener('hashchange', render);
render();

// Service Worker: macht die App offline nutzbar
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
