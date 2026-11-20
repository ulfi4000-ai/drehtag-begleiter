// Wettervorhersage für den Drehort über Open-Meteo (kostenlos, ohne Schlüssel).
// Übertragen werden nur die Koordinaten und das Datum. Abschaltbar unter „Sicherung“.
// Das Ergebnis wird drei Stunden gemerkt; ohne Netz gilt der letzte Stand.
import * as db from './db.js';
import { koordinatenAus, heute } from './modell.js';

const ALTER = 3 * 3600 * 1000;
const laufend = new Set();
const fehlversuch = new Map(); // ohne Netz nicht bei jedem Neuzeichnen erneut versuchen, höchstens alle 10 Minuten

function schluessel(tag) {
  const k = koordinatenAus(tag?.koordinaten);
  if (!k || !tag?.datum) return null;
  const tage = (new Date(tag.datum + 'T12:00') - new Date(heute() + 'T12:00')) / 86400000;
  if (tage < 0 || tage > 15) return null; // Vorhersage reicht etwa 16 Tage
  return { k, key: `wetter:${k.lat.toFixed(2)},${k.lon.toFixed(2)},${tag.datum}` };
}

async function laden(k, datum) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${k.lat}&longitude=${k.lon}`
    + `&hourly=temperature_2m,precipitation_probability,precipitation&timezone=auto&start_date=${datum}&end_date=${datum}`;
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ab.signal });
    if (!r.ok) return null;
    const d = await r.json();
    const h = d.hourly || {};
    return {
      stunden: (h.time || []).map((zeit, i) => ({
        h: Number(String(zeit).slice(11, 13)),
        temp: h.temperature_2m?.[i] ?? null,
        regen: h.precipitation_probability?.[i] ?? 0,
        mm: h.precipitation?.[i] ?? 0,
      })),
    };
  } finally {
    clearTimeout(t);
  }
}

// Gemerktes Wetter sofort zurückgeben; ist es alt, im Hintergrund neu laden und dann neu zeichnen lassen
export async function wetterVon(tag) {
  if ((await db.getMeta('wetterAn')) === false) return null;
  const s = schluessel(tag);
  if (!s) return null;
  const alt = await db.getMeta(s.key);
  const kurzVorher = Date.now() - (fehlversuch.get(s.key) || 0) < 10 * 60000;
  if ((!alt || Date.now() - alt.zeit > ALTER) && navigator.onLine !== false && !laufend.has(s.key) && !kurzVorher) {
    laufend.add(s.key);
    laden(s.k, tag.datum)
      .then(async (daten) => {
        if (!daten?.stunden?.length) { fehlversuch.set(s.key, Date.now()); return; }
        await db.setMeta(s.key, { zeit: Date.now(), daten });
        window.dispatchEvent(new Event('daten-neu'));
      })
      .catch(() => { fehlversuch.set(s.key, Date.now()); /* ohne Netz eben nicht */ })
      .finally(() => laufend.delete(s.key));
  }
  return alt?.daten || null;
}
