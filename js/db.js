// Speicherschicht: alles liegt in IndexedDB, der Datenbank im Browser.
// Schubladen (Stores): drehtage, locations, videos, shots, medien, geloescht, meta.
import { neueId } from './modell.js';

const DB_NAME = 'drehtag-begleiter';
// Version 2: Locations dazu, der Sprechtext steht direkt am Shot.
// Version 3: Videos dazu, außerdem Lösch-Vermerke für den Abgleich mit dem PC.
const DB_VERSION = 3;

let dbPromise;

export const uid = neueId;

// Umzug von Version 1: Dort waren Skripte eigene Einträge, die an Shots hingen.
// Der Text wandert in den Shot. Skripte ohne Shot werden zu eigenen Shots.
export function skripteInShots(shots, skripte) {
  for (const k of skripte) {
    const verknuepft = shots.filter((s) => s.skriptId === k.id);
    for (const s of verknuepft) if (!s.text) s.text = k.text || '';
    if (!verknuepft.length && (k.text || k.titel)) {
      shots.push({
        id: uid(), drehtagId: k.drehtagId, typ: 'oton', titel: k.titel || 'Skript', text: k.text || '',
        locationId: '', format: 'hochkant', erledigt: false, notiz: '', pos: k.erstellt || Date.now(),
      });
    }
  }
  for (const s of shots) {
    delete s.skriptId;
    s.text ??= '';
    s.locationId ??= '';
  }
  return shots;
}

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      // Läuft beim ersten Start und immer dann, wenn DB_VERSION höher ist als die gespeicherte Fassung
      req.onupgradeneeded = (e) => {
        const db = req.result;
        const tx = req.transaction;
        const alt = e.oldVersion; // 0 = ganz neu
        const neu = (name) => db.createObjectStore(name, { keyPath: 'id' });
        if (alt < 1) {
          neu('drehtage');
          neu('shots').createIndex('drehtagId', 'drehtagId');
          const medien = neu('medien');
          medien.createIndex('shotId', 'shotId');
          medien.createIndex('drehtagId', 'drehtagId');
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (alt < 2) {
          neu('locations').createIndex('drehtagId', 'drehtagId');
          tx.objectStore('medien').createIndex('locationId', 'locationId');
        }
        if (alt < 3) {
          neu('videos').createIndex('drehtagId', 'drehtagId');
          neu('geloescht').createIndex('drehtagId', 'drehtagId');
        }
        if (alt === 1) {
          // Bestehende Daten umziehen, danach die alte Skript-Schublade entfernen
          const shots = tx.objectStore('shots');
          tx.objectStore('skripte').getAll().onsuccess = (a) => {
            shots.getAll().onsuccess = (b) => {
              for (const s of skripteInShots(b.target.result, a.target.result)) shots.put(s);
              db.deleteObjectStore('skripte');
            };
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Macht aus einer IndexedDB-Anfrage ein Promise, damit "await" funktioniert
function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll(name) { return wrap((await store(name)).getAll()); }
export async function get(name, id) { return wrap((await store(name)).get(id)); }
export async function byIndex(name, index, value) {
  return wrap((await store(name)).index(index).getAll(value));
}

// Speichern mit Zeitstempel. Der Stempel entscheidet beim Abgleich, welche Fassung jünger ist.
export async function put(name, obj) {
  obj.geaendert = Date.now();
  return wrap((await store(name, 'readwrite')).put(obj));
}
// Speichern ohne neuen Stempel: für eingelesene Daten, die ihren Stempel behalten müssen
export async function putRoh(name, obj) { return wrap((await store(name, 'readwrite')).put(obj)); }
export async function del(name, id) { return wrap((await store(name, 'readwrite')).delete(id)); }

// Löschen mit Vermerk, damit der Eintrag beim nächsten Abgleich nicht zurückkommt
export async function entfernen(name, id) {
  const row = await get(name, id);
  if (!row) return;
  await del(name, id);
  await putRoh('geloescht', { id, store: name, drehtagId: row.drehtagId, zeit: Date.now() });
}

// Alles, was zu einem Drehtag gehört, als ein Bündel
export async function buendel(id) {
  const drehtag = await get('drehtage', id);
  if (!drehtag) return null;
  const [locations, videos, shots, medien, geloescht] = await Promise.all(
    ['locations', 'videos', 'shots', 'medien', 'geloescht'].map((name) => byIndex(name, 'drehtagId', id)),
  );
  return { drehtag, locations, videos, shots, medien, geloescht };
}

// Ein fertiges Bündel speichern (für Kopien und Vorlagen). Die Stempel stehen schon drin.
export async function buendelSchreiben(b) {
  await putRoh('drehtage', b.drehtag);
  for (const name of ['locations', 'videos', 'shots']) for (const row of b[name]) await putRoh(name, row);
}

// Drehtag samt allem löschen, was dranhängt
export async function deleteDrehtag(id) {
  for (const name of ['shots', 'locations', 'videos', 'medien', 'geloescht']) {
    for (const row of await byIndex(name, 'drehtagId', id)) await del(name, row.id);
  }
  await del('drehtage', id);
}

export async function deleteShot(id) {
  for (const m of await byIndex('medien', 'shotId', id)) await entfernen('medien', m.id);
  await entfernen('shots', id);
}

// Location oder Video löschen: die Shots bleiben und verlieren nur die Zuordnung.
// Bei einer Location gehen ihre Bilder mit.
async function loesen(name, feld, id) {
  const row = await get(name, id);
  if (!row) return;
  for (const s of await byIndex('shots', 'drehtagId', row.drehtagId)) {
    if (s[feld] === id) { s[feld] = ''; await put('shots', s); }
  }
  await entfernen(name, id);
}
export async function deleteLocation(id) {
  for (const m of await byIndex('medien', 'locationId', id)) await entfernen('medien', m.id);
  await loesen('locations', 'locationId', id);
}
export async function deleteVideo(id) { await loesen('videos', 'videoId', id); }

export async function getMeta(key) { return (await get('meta', key))?.value; }
export async function setMeta(key, value) { return putRoh('meta', { key, value }); }
