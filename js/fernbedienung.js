// Bluetooth-Fernbedienung (z. B. die vom Teleprompter).
// Solche Fernbedienungen melden sich am Handy wie eine kleine Tastatur und senden Tasten wie
// Bild ab, Pfeil runter oder Leertaste. Die App hört darauf:
//   Roter Faden:  "Weiter" = aktuellen Shot erledigen,  "Zurück" = letzten Haken rückgängig
//   Teleprompter: "Weiter" = Start/Pause,               "Zurück" = ein Stück zurück
// Welche Taste was ist, lässt sich unter „Sicherung“ anlernen. Gespeichert nur auf diesem Gerät.
import { esc, toast } from './util.js';

const KEY = 'fernbedienung';
const STANDARD = {
  weiter: ['PageDown', 'ArrowDown', 'ArrowRight', ' ', 'Enter', 'MediaPlayPause', 'MediaTrackNext', 'AudioVolumeDown'],
  zurueck: ['PageUp', 'ArrowUp', 'ArrowLeft', 'MediaTrackPrevious', 'AudioVolumeUp'],
};

const laden = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const speichern = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* privat, dann eben nicht */ } };

// Name der Taste: Manche Fernbedienungen liefern keinen "key", dann den "code" oder die Nummer
const tastenName = (e) => (e.key && e.key !== 'Unidentified' ? e.key : e.code || `Taste ${e.keyCode}`);
const anzeige = (k) => ({ ' ': 'Leertaste', ArrowDown: 'Pfeil runter', ArrowUp: 'Pfeil hoch', ArrowLeft: 'Pfeil links', ArrowRight: 'Pfeil rechts', PageDown: 'Bild ab', PageUp: 'Bild auf' }[k] || k);

function bedeutung(name) {
  const g = laden();
  if (g.weiter === name) return 'weiter';
  if (g.zurueck === name) return 'zurueck';
  if (STANDARD.weiter.includes(name)) return 'weiter';
  if (STANDARD.zurueck.includes(name)) return 'zurueck';
  return null;
}

let lernen = null;   // 'weiter' | 'zurueck' während des Anlernens
let letzteTaste = '–';
let gesperrt = 0;    // gegen doppelte Auslösung (Prellen, gedrückt halten)

function klicken(sel) {
  const el = document.querySelector(sel);
  if (!el || el.disabled) return false;
  el.click();
  navigator.vibrate?.(30);
  return true;
}

function beiTaste(e) {
  const name = tastenName(e);
  letzteTaste = anzeige(name);
  const zuletzt = document.getElementById('fb-zuletzt');
  if (zuletzt) zuletzt.textContent = letzteTaste;

  if (lernen) {
    e.preventDefault();
    const g = laden();
    g[lernen] = name;
    if (g[lernen === 'weiter' ? 'zurueck' : 'weiter'] === name) delete g[lernen === 'weiter' ? 'zurueck' : 'weiter'];
    speichern(g);
    toast(`${anzeige(name)} = ${lernen === 'weiter' ? 'Erledigt / Weiter' : 'Zurück'}`);
    lernen = null;
    karteAuffrischen();
    return;
  }

  const ziel = e.target;
  if (ziel?.closest?.('input, textarea, select, [contenteditable]')) return; // beim Tippen nicht stören
  const was = bedeutung(name);
  if (!was || e.repeat) return;

  const overlay = document.getElementById('overlay');
  const prompter = !overlay.hidden && overlay.querySelector('.prompter');
  const imFaden = location.hash.startsWith('#/faden/') && overlay.hidden;
  if (!prompter && !imFaden) return;

  e.preventDefault(); // sonst löst z. B. die Leertaste zusätzlich den zuletzt getippten Knopf aus
  if (Date.now() < gesperrt) return;
  gesperrt = Date.now() + 600;

  if (prompter) {
    if (was === 'weiter') klicken('#overlay [data-p="play"]');
    else { const sc = prompter.querySelector('.p-scroll'); sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight / 3); }
    return;
  }
  if (was === 'weiter') klicken('[data-action="faden-erledigt"]');
  else if (!klicken('[data-action="faden-undo"]')) toast('Nichts zum Zurücknehmen');
}

// ---------- Karte unter „Sicherung“: Tasten testen und anlernen ----------

export function fernbedienungKarte() {
  const g = laden();
  const zeile = (was, text) => `<div class="info-row"><span>${text}</span><b>${g[was] ? esc(anzeige(g[was])) + ' (angelernt)' : 'Standard'}</b></div>`;
  return `
    <section class="card" id="fb-karte">
      <h2>Fernbedienung</h2>
      <p class="mute" style="margin-bottom:10px">Bluetooth-Fernbedienung mit dem Handy koppeln. Im Roten Faden erledigt „Weiter“ den aktuellen Shot, „Zurück“ nimmt den letzten Haken zurück. Im Teleprompter: Start/Pause und ein Stück zurück.</p>
      <div class="info-row"><span>Zuletzt gedrückt</span><b id="fb-zuletzt">${esc(letzteTaste)}</b></div>
      ${zeile('weiter', 'Weiter')}
      ${zeile('zurueck', 'Zurück')}
      <div class="row2" style="margin-top:10px">
        <button class="btn" data-fb="weiter">${lernen === 'weiter' ? 'Jetzt Taste drücken …' : 'Weiter anlernen'}</button>
        <button class="btn" data-fb="zurueck">${lernen === 'zurueck' ? 'Jetzt Taste drücken …' : 'Zurück anlernen'}</button>
      </div>
      ${g.weiter || g.zurueck ? '<button class="btn" style="width:100%;margin-top:8px" data-fb="reset">Auf Standard zurücksetzen</button>' : ''}
    </section>`;
}

function karteAuffrischen() {
  const alt = document.getElementById('fb-karte');
  if (alt) alt.outerHTML = fernbedienungKarte();
}

function beiKlick(e) {
  const b = e.target.closest('[data-fb]');
  if (!b) return;
  if (b.dataset.fb === 'reset') { speichern({}); lernen = null; }
  else lernen = lernen === b.dataset.fb ? null : b.dataset.fb;
  b.blur(); // damit Leertaste/Enter der Fernbedienung nicht den Knopf noch einmal drückt
  karteAuffrischen();
}

export function initFernbedienung() {
  document.addEventListener('keydown', beiTaste, true);
  document.addEventListener('click', beiKlick);
}
