// Sprachbefehle im Roten Faden: „Faden“ = erledigt/weiter, „Faden zurück“, „Faden später“, „Faden Marker“.
// Im Browser über die Spracherkennung des Handys (Chrome: Google, Safari: Apple). Der Ton geht dafür
// an deren Dienst; die App speichert nichts. Nur an, solange der Faden offen ist und man es eingeschaltet hat.
// In der Android-App gibt es das so nicht (WebView ohne Spracherkennung); dort kommt später eine Offline-Lösung.
import { toast } from './util.js';
import { befehl, befehlMoeglich } from './fernbedienung.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sprachMoeglich = !!SR && !window.Capacitor?.isNativePlatform?.();
const KEY = 'sprachbefehle';

// Erkennt den Befehl in einem Satz. Nur das Kennwort „Faden“ (auch falsch gehört als „Fahden“/„Pfaden“)
// mit einem bekannten Wort danach oder allein zählt; „Faden ist gerissen“ löst nichts aus.
export function befehlAusText(text) {
  const t = String(text || '').toLowerCase().replace(/[.,!?;:]/g, ' ');
  const m = /(?:^|\s)(?:faden|fahden|pfaden)\s*(\S*)\s*$/.exec(t);
  if (!m) return null;
  const w = m[1];
  if (!w || /^(weiter|erledigt|fertig|ok|okay|gut|done)$/.test(w)) return 'weiter';
  if (/^(zurück|zurueck|zurück\S*)$/.test(w)) return 'zurueck';
  if (/^(später|spaeter)$/.test(w)) return 'spaeter';
  if (/^(marker|merken|markieren|markier)$/.test(w)) return 'marker';
  return null;
}

let rec = null;
let aktiv = false;
let sitzung = 0;
let zuletzt = 0;
const erledigt = new Set();

export const sprachGewuenscht = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const sprachAn = () => aktiv;

function ausloesen(was) {
  if (Date.now() - zuletzt < 1500 || !befehlMoeglich()) return; // nicht doppelt aus Zwischen- und Endergebnis
  zuletzt = Date.now();
  if (befehl(was)) {
    navigator.vibrate?.(was === 'zurueck' ? [30, 50, 30] : 60);
    if (was !== 'marker') toast(`🎙 ${{ weiter: 'Erledigt', zurueck: 'Zurück', spaeter: 'Später' }[was]}`);
  }
}

function starteSitzung() {
  const s = ++sitzung;
  rec = new SR();
  rec.lang = 'de-DE';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const key = `${s}:${i}`;
      if (erledigt.has(key)) continue;
      let was = null;
      for (let a = 0; a < r.length && !was; a++) was = befehlAusText(r[a].transcript);
      if (!was) continue;
      // „Faden“ allein: aufs Satzende warten, es könnte noch „zurück“ kommen. Mit Zusatzwort sofort.
      if (!r.isFinal && was === 'weiter' && !/(weiter|erledigt|fertig)\s*$/i.test(r[0].transcript)) continue;
      erledigt.add(key);
      ausloesen(was);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      aktiv = false;
      try { localStorage.setItem(KEY, '0'); } catch { /* privat */ }
      toast('Mikrofon nicht erlaubt – in den Browser-Einstellungen freigeben');
      window.dispatchEvent(new Event('daten-neu'));
    }
  };
  // Die Erkennung beendet sich nach Pausen von selbst; solange gewünscht, gleich neu starten
  rec.onend = () => {
    if (s !== sitzung) return;
    if (aktiv && document.visibilityState === 'visible') setTimeout(() => { if (aktiv && s === sitzung) starteSitzung(); }, 300);
  };
  try { rec.start(); } catch { /* läuft schon */ }
}

export function sprachStarten() {
  if (!sprachMoeglich || aktiv) return;
  aktiv = true;
  starteSitzung();
}

export function sprachStoppen() {
  if (!aktiv) return;
  aktiv = false;
  sitzung += 1;
  try { rec?.abort(); } catch { /* egal */ }
  rec = null;
}

// Knopf im Faden: an/aus, Wunsch wird gemerkt
export function sprachUmschalten() {
  const an = !sprachGewuenscht();
  try { localStorage.setItem(KEY, an ? '1' : '0'); } catch { /* privat */ }
  if (an) {
    sprachStarten();
    toast('🎙 Sprachbefehle an: „Faden“ = erledigt · „Faden zurück“ · „Faden später“ · „Faden Marker“. Die Erkennung läuft über Google bzw. Apple.', { dauer: 9000 });
  } else {
    sprachStoppen();
    toast('Sprachbefehle aus');
  }
}
