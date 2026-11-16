// Abgleich mit Supabase (vorbereitet, noch nicht eingeschaltet).
//
// Die App bleibt offline voll nutzbar: Gespeichert wird wie bisher im Gerät (IndexedDB).
// abgleichen() schickt alles hoch, was sich seit dem letzten Mal geändert hat, holt die
// Änderungen anderer Geräte (Handy, PC, Claude) und führt beides nach „jüngere Fassung
// gewinnt“ zusammen – dieselbe Regel wie beim Einlesen einer Drehtag-Datei.
//
// Ohne Zusatzbibliothek: Supabase hat einfache HTTP-Schnittstellen
//   Anmeldung   POST {url}/auth/v1/token
//   Daten       {url}/rest/v1/eintraege        (Tabelle aus server/supabase/schema.sql)
//   Bilder/Ton  {url}/storage/v1/object/medien/<nutzer>/<drehtag>/<id>
// Eingerichtet wird über setzeCloud({ url, anonKey }); bis dahin tut diese Datei nichts.
import * as db from './db.js';
import { buendelEinspielen } from './dateien.js';
import { DATEI_KOPF, stempel } from './modell.js';

const STORES = { drehtage: 'drehtag', locations: 'location', videos: 'video', shots: 'shot', medien: 'medium', geloescht: 'geloescht' };
const ART_ZU_STORE = Object.fromEntries(Object.entries(STORES).map(([s, a]) => [a, s]));

// ---------- Einstellungen und Anmeldung ----------

export async function cloud() { return (await db.getMeta('cloud')) || null; }                 // { url, anonKey }
export async function setzeCloud(c) { await db.setMeta('cloud', c ? { url: c.url.replace(/\/+$/, ''), anonKey: c.anonKey } : null); }
const sitzung = () => db.getMeta('cloudSitzung');
const merkeSitzung = (s) => db.setMeta('cloudSitzung', s);

async function auth(pfad, koerper) {
  const c = await cloud();
  if (!c) throw new Error('Cloud ist nicht eingerichtet');
  const r = await fetch(`${c.url}/auth/v1/${pfad}`, {
    method: 'POST',
    headers: { apikey: c.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(koerper),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || d.message || `Anmeldung fehlgeschlagen (${r.status})`);
  const s = { zugang: d.access_token, erneuern: d.refresh_token, bis: Date.now() + (d.expires_in || 3600) * 1000, nutzer: d.user?.id, email: d.user?.email };
  await merkeSitzung(s);
  return s;
}

export const anmelden = (email, passwort) => auth('token?grant_type=password', { email, password: passwort });
export const registrieren = (email, passwort) => auth('signup', { email, password: passwort });
export async function abmelden() { await merkeSitzung(null); await db.setMeta('cloudStand', null); }
export async function angemeldet() { return !!(await sitzung())?.erneuern; }

// Gültigen Zugang holen, bei Bedarf erneuern (Zugänge laufen nach etwa einer Stunde ab)
async function zugang() {
  let s = await sitzung();
  if (!s?.erneuern) throw new Error('Nicht angemeldet');
  if (Date.now() > s.bis - 60000) s = await auth('token?grant_type=refresh_token', { refresh_token: s.erneuern });
  return s;
}

async function anfrage(pfad, { methode = 'GET', koerper, kopf = {}, roh = false } = {}) {
  const [c, s] = [await cloud(), await zugang()];
  const r = await fetch(`${c.url}${pfad}`, {
    method: methode,
    headers: { apikey: c.anonKey, Authorization: `Bearer ${s.zugang}`, ...(roh ? {} : { 'Content-Type': 'application/json' }), ...kopf },
    body: koerper === undefined ? undefined : roh ? koerper : JSON.stringify(koerper),
  });
  if (!r.ok) throw new Error(`Cloud: ${r.status} ${await r.text().catch(() => '')}`.trim());
  return r;
}

// ---------- Abgleich ----------

// Stempel eines Eintrags: Drehtage haben Teile mit eigenem Stempel, Lösch-Vermerke eine "zeit"
function stempelVon(store, r) {
  if (store === 'geloescht') return r.zeit || 0;
  if (store === 'drehtage') {
    const teile = ['briefing', 'zeitplan', 'packliste', 'faden', 'settings', 'bereit'].map((t) => r[t]?.geaendert || 0);
    return Math.max(stempel(r), r.basisGeaendert || 0, ...teile);
  }
  return stempel(r);
}
const drehtagVon = (store, r) => (store === 'drehtage' ? r.id : r.drehtagId);

async function hochladen(seit, s) {
  const zeilen = [];
  const dateien = [];
  for (const [store, art] of Object.entries(STORES)) {
    for (const r of await db.getAll(store)) {
      if (store === 'drehtage' && r.vorlage) continue;           // Vorlagen bleiben auf dem Gerät
      const st = stempelVon(store, r);
      if (st <= seit) continue;
      let daten = r;
      if (store === 'medien') {
        const { blob, original, ...rest } = r;
        daten = { ...rest, hatOriginal: !!original };
        if (blob) dateien.push({ pfad: `${s.nutzer}/${r.drehtagId}/${r.id}`, blob });
        if (original) dateien.push({ pfad: `${s.nutzer}/${r.drehtagId}/${r.id}-original`, blob: original });
      }
      zeilen.push({ id: r.id, besitzer: s.nutzer, drehtag_id: drehtagVon(store, r), art, daten, geaendert: st });
    }
  }
  // Erst die Dateien, dann die Zeilen: Wer eine Zeile sieht, findet die Datei schon vor
  for (const d of dateien) {
    await anfrage(`/storage/v1/object/medien/${d.pfad}`, { methode: 'POST', koerper: d.blob, roh: true, kopf: { 'x-upsert': 'true', 'Content-Type': d.blob.type || 'application/octet-stream' } });
  }
  for (let i = 0; i < zeilen.length; i += 200) {
    await anfrage('/rest/v1/eintraege?on_conflict=besitzer,id', {
      methode: 'POST', koerper: zeilen.slice(i, i + 200), kopf: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
  }
  return zeilen.length;
}

async function holen(seit, s) {
  const zeilen = [];
  for (let ab = 0; ; ab += 1000) {
    const r = await anfrage(`/rest/v1/eintraege?select=id,drehtag_id,art,daten,aktualisiert&aktualisiert=gt.${encodeURIComponent(seit)}&order=aktualisiert.asc&limit=1000&offset=${ab}`);
    const teil = await r.json();
    zeilen.push(...teil);
    if (teil.length < 1000) break;
  }
  // Nach Drehtag bündeln, wie eine Drehtag-Datei. Was lokal schon gleich neu ist (z. B. die eigenen
  // Uploads vom letzten Lauf), wird übersprungen – so werden Bilder nicht unnötig noch einmal geladen.
  const buendel = new Map();
  for (const z of zeilen) {
    const store = ART_ZU_STORE[z.art];
    if (!store) continue;
    const lokal = await db.get(store, z.id);
    if (lokal && stempelVon(store, lokal) >= stempelVon(store, z.daten)) continue;
    if (!buendel.has(z.drehtag_id)) buendel.set(z.drehtag_id, { ...DATEI_KOPF, drehtag: null, locations: [], videos: [], shots: [], medien: [], geloescht: [] });
    const b = buendel.get(z.drehtag_id);
    if (store === 'drehtage') b.drehtag = z.daten;
    else b[store].push(z.daten);
  }
  for (const [tagId, b] of buendel) {
    if (!b.drehtag) {
      // Nur Teile geändert: den Drehtag selbst dazuholen (lokal oder aus der Cloud)
      b.drehtag = (await db.get('drehtage', tagId))
        || (await (await anfrage(`/rest/v1/eintraege?select=daten&art=eq.drehtag&id=eq.${encodeURIComponent(tagId)}`)).json())[0]?.daten;
      if (!b.drehtag) continue;
    }
    for (const m of b.medien) {
      const hatOriginal = m.hatOriginal;
      delete m.hatOriginal;
      m.blob = await (await anfrage(`/storage/v1/object/authenticated/medien/${s.nutzer}/${tagId}/${m.id}`)).blob();
      if (hatOriginal) m.original = await (await anfrage(`/storage/v1/object/authenticated/medien/${s.nutzer}/${tagId}/${m.id}-original`)).blob();
    }
    await buendelEinspielen(b);
  }
  return { zeilen: zeilen.length, bis: zeilen.length ? zeilen[zeilen.length - 1].aktualisiert : seit };
}

let laeuft = null;
// Ein Abgleich-Lauf. Ergebnis: { hoch, runter }. Läuft schon einer, wird auf ihn gewartet.
export function abgleichen() {
  laeuft ??= (async () => {
    try {
      if (!(await cloud()) || !(await angemeldet())) return { hoch: 0, runter: 0, aus: true };
      const s = await zugang();
      const stand = (await db.getMeta('cloudStand')) || { hoch: 0, runter: '1970-01-01T00:00:00Z' };
      const beginn = Date.now();
      const runter = await holen(stand.runter, s);       // erst holen und zusammenführen …
      const hoch = await hochladen(stand.hoch, s);        // … dann den gemeinsamen Stand hochladen
      await db.setMeta('cloudStand', { hoch: beginn, runter: runter.bis });
      return { hoch, runter: runter.zeilen };
    } finally {
      laeuft = null;
    }
  })();
  return laeuft;
}
