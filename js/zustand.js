// Gemeinsamer Zustand der Oberfläche und kleine Helfer, die Ansichten und Aktionen beide brauchen.

const gemerkt = localStorage.getItem('gruppierung');

export const z = {
  sortieren: false,          // Reihenfolge-Modus mit Pfeilen
  bearbeiten: false,         // Bearbeiten-Modus für Fragen und Packliste
  gruppierung: ['location', 'video'].includes(gemerkt) ? gemerkt : 'art',
  letzterTyp: 'hook',        // zuletzt gewählte Art beim Schnell-Anlegen
  letzteLocation: '',
  letztesVideo: '',
  aufgeklappt: new Set(),    // Shots, deren langer Text ganz gezeigt wird
  infoOffen: false,          // ist der Kasten mit Details und Export aufgeklappt
  orteOffen: new Set(),      // Locations, deren Shot-Liste im Reiter "Orte" aufgeklappt ist
  suche: '',
  fadenShot: '',             // im Roten Faden von Hand gewählter Shot
  fadenZuletzt: '',          // zuletzt abgehakter Shot (für "Rückgängig")
  fadenModus: '',            // 'nachholen', wenn die zurückgestellten Shots dran sind
};

// Bild-Adressen der aktuellen Ansicht. Beim Wechsel der Ansicht werden die alten freigegeben.
let urls = [];
export const bildUrl = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
export function urlsWechseln() {
  const alt = urls;
  urls = [];
  return () => alt.forEach((u) => URL.revokeObjectURL(u));
}

// Speichern nacheinander abarbeiten, damit schnelle Eingaben sich nicht gegenseitig überschreiben
let schlange = Promise.resolve();
export function einreihen(fn) {
  schlange = schlange.then(fn).catch(console.error);
  return schlange;
}
export const allesGespeichert = () => schlange;

export const nachPos = (a, b) => (a.pos || 0) - (b.pos || 0);
export const anzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
export const woerter = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;
// Grobe Sprechdauer: Annahme 150 Wörter pro Minute
export function dauer(t) {
  const sek = Math.round((woerter(t) / 150) * 60);
  return `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
}
export const statsText = (t) => `${woerter(t)} Wörter · ca. ${dauer(t)} Min bei 150 Wörtern pro Minute`;
// Lange Texte (Skripte) werden in der Liste gekürzt, kurze (Hooks) stehen ganz da
export const istLang = (t) => (t || '').length > 220 || ((t || '').match(/\n/g) || []).length > 4;
// Bei Hook und CTA ist das Eingetippte der Sprechtext, sonst der Titel
export const istSpruch = (typ) => typ === 'hook' || typ === 'cta';
export const platzhalter = (typ) =>
  typ === 'hook' ? 'Hook-Text …' : typ === 'cta' ? 'CTA-Text …' : typ === 'karussell' ? 'Thema des Karussells …' : 'Neuer Shot …';
// Karussell: eine Folie pro Zeile
export const folien = (t) => (t || '').split('\n').filter((z) => z.trim()).length;
export const folienText = (t) => `${folien(t)} ${folien(t) === 1 ? 'Folie' : 'Folien'} · eine Folie pro Zeile`;
export const mobil = () => matchMedia('(pointer: coarse)').matches;
