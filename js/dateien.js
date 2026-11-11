// Alles, was Daten aus der App hinaus- oder hineinbringt:
// Teilen, Kopieren, Dateien speichern, Backup, Drehtag-Datei für Claude.
import * as db from './db.js';
import { DATEI_KOPF, buendelMischen, heute } from './modell.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Rückfall für Browser ohne Zwischenablage-Zugriff
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// Öffnet das Teilen-Menü des Handys. Ohne Teilen-Menü wird kopiert.
// Ergebnis: 'geteilt', 'abgebrochen' oder 'kopiert'.
export async function shareText(titel, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titel, text });
      return 'geteilt';
    } catch (e) {
      if (e.name === 'AbortError') return 'abgebrochen';
    }
  }
  await copyText(text);
  return 'kopiert';
}

export function herunterladen(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Datei über das Teilen-Menü weitergeben (zum Beispiel an Google Drive).
// Am PC oder wenn das nicht geht: in den Download-Ordner speichern.
export async function dateiTeilen(name, inhalt, typ = 'text/plain') {
  const datei = new File([inhalt], name, { type: typ });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: name });
      return 'geteilt';
    } catch (e) {
      if (e.name === 'AbortError') return 'abgebrochen';
    }
  }
  herunterladen(name, datei);
  return 'gespeichert';
}

export const slug = (t) =>
  String(t || 'drehtag').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'drehtag';

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
const dataUrlToBlob = async (url) => (await fetch(url)).blob();

// Bilder können nicht als Blob in eine Textdatei. Sie werden als Base64-Text eingebettet.
async function medienFuerDatei(m) {
  const { blob, original, ...rest } = m;
  const aus = { ...rest, data: await blobToDataUrl(blob) };
  if (original) aus.originalData = await blobToDataUrl(original);
  return aus;
}
async function medienAusDatei(m) {
  if (!m.data) return m; // liegt schon als Blob vor
  const { data, originalData, ...rest } = m;
  const aus = { ...rest, blob: await dataUrlToBlob(data) };
  if (originalData) aus.original = await dataUrlToBlob(originalData);
  return aus;
}

// ---------- Drehtag-Datei (Austausch mit Claude am PC) ----------

export async function drehtagDatei(id) {
  const b = await db.buendel(id);
  const medien = [];
  for (const m of b.medien) medien.push(await medienFuerDatei(m));
  const inhalt = { ...DATEI_KOPF, exportiert: new Date().toISOString(), ...b, medien };
  // Endung .txt, weil Android beim Teilen keine .json-Dateien annimmt
  const name = `drehtag-${slug(b.drehtag.kunde)}-${b.drehtag.datum || 'ohne-datum'}.txt`;
  return { name, text: JSON.stringify(inhalt) };
}

// ---------- Backup ----------

export async function exportBackup() {
  const daten = { app: 'drehtag-begleiter', art: 'backup', version: 3, erstellt: new Date().toISOString() };
  for (const name of ['drehtage', 'locations', 'videos', 'shots', 'geloescht']) daten[name] = await db.getAll(name);
  daten.medien = [];
  for (const m of await db.getAll('medien')) daten.medien.push(await medienFuerDatei(m));
  herunterladen(`drehtag-backup-${heute()}.json`, new Blob([JSON.stringify(daten)], { type: 'application/json' }));
  await db.setMeta('letztesBackup', daten.erstellt);
  return daten.drehtage.length;
}

// ---------- Einlesen (Backup oder Drehtag-Datei) ----------

// Backups liegen "flach" vor (alle Drehtage in einer Liste). Hier wird daraus ein Bündel pro Drehtag.
function flachZuBuendeln(d) {
  const shots = d.shots || [];
  if (d.skripte) db.skripteInShots(shots, d.skripte); // Backups aus der ersten Fassung
  const von = (liste, id) => (liste || []).filter((r) => r.drehtagId === id);
  return (d.drehtage || []).map((t) => ({
    drehtag: t,
    locations: von(d.locations, t.id), videos: von(d.videos, t.id), shots: von(shots, t.id),
    medien: von(d.medien, t.id), geloescht: von(d.geloescht, t.id),
  }));
}

// Ein Bündel mit dem Stand auf diesem Gerät zusammenführen: pro Eintrag gewinnt die jüngere Fassung
async function einspielen(fremd) {
  const leer = { drehtag: null, locations: [], videos: [], shots: [], medien: [], geloescht: [] };
  const lokal = (await db.buendel(fremd.drehtag.id)) || leer;
  const m = buendelMischen(lokal, { ...leer, ...fremd });
  await db.putRoh('drehtage', m.drehtag);
  for (const name of ['locations', 'videos', 'shots']) for (const r of m[name]) await db.putRoh(name, r);
  for (const r of m.medien) await db.putRoh('medien', await medienAusDatei(r));
  for (const t of m.geloescht) {
    if (t.store) await db.del(t.store, t.id);
    await db.putRoh('geloescht', { ...t, drehtagId: t.drehtagId || m.drehtag.id });
  }
}

// Liest ein Backup oder eine Drehtag-Datei ein. Nichts wird überschrieben, was hier neuer ist.
export async function importDatei(file) {
  let daten;
  try { daten = JSON.parse(await file.text()); } catch { daten = null; }
  if (daten?.app !== 'drehtag-begleiter') throw new Error('Das ist keine Datei vom Drehtag-Begleiter.');
  const buendel = daten.art === 'drehtag' ? [daten] : flachZuBuendeln(daten);
  for (const b of buendel) await einspielen(b);
  return buendel;
}
