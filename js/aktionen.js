// Aktionen: Was passiert, wenn getippt, eingegeben oder abgeschickt wird.
// Knöpfe tragen data-action="…", Felder speichern sich über data-save="…" selbst.
import * as db from './db.js';
import { esc, toast, showOverlay } from './util.js';
import * as M from './modell.js';
import { z, einreihen, allesGespeichert, nachPos, anzahl, statsText, folienText, istSpruch, platzhalter } from './zustand.js';
import { copyText, shareText, dateiTeilen, herunterladen, drehtagDatei, exportBackup, importDatei, slug } from './dateien.js';
import { sucheHtml, zeitplanBlatt } from './ansichten.js';
import { openSketch } from './sketch.js';
import { openPrompter } from './prompter.js';
import { sprachnotizAufnehmen } from './aufnahme.js';
import { istNativ, sprache } from './nativ.js';
import { gekoppelt, koppelnZeigen, textSenden, steuerungZeigen } from './kopplung.js';

let render = async () => {};
const app = () => document.getElementById('app');

// ---------- Speichern ----------

// Teile des Drehtags ändern. Jeder Teil (Grunddaten, Briefing, Zeitplan, Packliste)
// bekommt einen eigenen Zeitstempel, damit beim Abgleich mit dem PC nichts verloren geht.
const LEER = {
  briefing: () => ({ fragen: [] }), zeitplan: () => ({ bloecke: [] }), packliste: () => ({ posten: [] }),
  faden: () => ({ reihenfolge: 'video', fertig: [], aktiv: '' }),
  settings: () => ({ liste: [] }),
  bereit: () => ({ ignoriert: [] }),
};
function aendereTag(id, teil, fn) {
  return einreihen(async () => {
    const tag = await db.get('drehtage', id);
    if (!tag) return;
    if (teil === 'basis') {
      fn(tag);
      tag.basisGeaendert = Date.now();
    } else {
      tag[teil] ??= LEER[teil]();
      fn(tag[teil], tag);
      tag[teil].geaendert = Date.now();
    }
    await db.put('drehtage', tag);
  });
}

function aendereZeile(store, id, fn) {
  return einreihen(async () => {
    const o = await db.get(store, id);
    if (!o) return;
    fn(o);
    await db.put(store, o);
  });
}

// ---------- Rückgängig statt Nachfragen ----------
// Vor einer Änderung den ganzen Drehtag merken, die Änderung sofort ausführen und im Hinweis
// „Rückgängig“ anbieten. Zurückgeholte Einträge bekommen einen frischen Stempel, damit sie
// beim Abgleich mit dem PC nicht wieder verschwinden.
async function standZurueck(vorher) {
  const jetzt = Date.now();
  const tagId = vorher.drehtag.id;
  const t = { ...vorher.drehtag, basisGeaendert: jetzt, geaendert: jetzt };
  for (const teil of Object.keys(LEER)) if (t[teil]) t[teil] = { ...t[teil], geaendert: jetzt };
  await db.putRoh('drehtage', t);
  for (const name of ['locations', 'videos', 'shots', 'medien']) {
    const alt = new Set(vorher[name].map((r) => r.id));
    for (const r of await db.byIndex(name, 'drehtagId', tagId)) if (!alt.has(r.id)) await db.del(name, r.id);
    for (const r of vorher[name]) await db.putRoh(name, { ...r, geaendert: jetzt });
  }
  const behalten = new Set(vorher.geloescht.map((g) => g.id));
  for (const g of await db.byIndex('geloescht', 'drehtagId', tagId)) if (!behalten.has(g.id)) await db.del('geloescht', g.id);
  for (const g of vorher.geloescht) await db.putRoh('geloescht', g);
}

async function mitRueckgaengig(tagId, text, tun, { zurueckNach = null } = {}) {
  await allesGespeichert();
  const vorher = await db.buendel(tagId);
  if (!vorher) return;
  await tun();
  render();
  toast(text, {
    knopf: 'Rückgängig',
    beiKnopf: () => einreihen(async () => {
      await standZurueck(vorher);
      toast('Wiederhergestellt');
      if (zurueckNach && location.hash !== zurueckNach) location.hash = zurueckNach; else render();
    }),
  });
}

const STORES = { shot: 'shots', ort: 'locations', video: 'videos' };

function speichern(el) {
  const box = el.closest('[data-save]');
  if (!box || !el.name) return allesGespeichert();
  if (el.type === 'radio' && !el.checked) return allesGespeichert();
  if (el.value === '__neu') return allesGespeichert(); // "+ Neu …" ist kein Wert, sondern ein Befehl
  const wert = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(0, Number(el.value) || 0) : el.value;
  const { save: art, id, tag } = box.dataset;
  switch (art) {
    case 'shot': case 'ort': case 'video':
      return aendereZeile(STORES[art], id, (o) => {
        o[el.name] = wert;
        if (el.name === 'erledigt') o.erledigtUm = wert ? Date.now() : 0; // Uhrzeit hilft später beim Zuordnen der Clips
        if (el.name === 'locationId' && o.auchAn) o.auchAn = o.auchAn.filter((x) => x !== wert); // Hauptort ist kein „auch“
      });
    case 'tagfeld':
      return aendereTag(id, 'basis', (t) => { t[el.name] = wert; });
    case 'frage':
      return aendereTag(tag, 'briefing', (b) => { const f = b.fragen.find((x) => x.id === id); if (f) f[el.name] = wert; });
    case 'block':
      return aendereTag(tag, 'zeitplan', (p) => {
        const x = p.bloecke.find((b) => b.id === id);
        if (!x) return;
        x[el.name] = wert;
        // Location gewählt und noch kein Titel: Name der Location übernehmen
        if (el.name === 'locationId' && wert && !(x.titel || '').trim()) x.titel = el.selectedOptions[0]?.textContent || '';
      });
    case 'plan':
      return aendereTag(id, 'zeitplan', (p) => { p[el.name] = wert; });
    case 'posten':
      return aendereTag(tag, 'packliste', (p) => { const x = p.posten.find((q) => q.id === id); if (x) x[el.name] = wert; });
    case 'setting':
      return aendereTag(tag, 'settings', (s) => { const x = s.liste.find((y) => y.id === id); if (x) x[el.name] = wert; });
    case 'meta':
      return einreihen(() => db.setMeta(id, wert));
  }
  return allesGespeichert();
}

// ---------- Helfer ----------

// Textfeld so hoch machen wie sein Inhalt, damit man nicht im Feld scrollen muss
export function wachsen(t) {
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 2 + 'px';
}

let sucheNr = 0;
export async function sucheFuellen() {
  const nr = ++sucheNr;
  const html = await sucheHtml(z.suche);
  if (nr !== sucheNr) return;
  const treffer = document.getElementById('suchtreffer');
  const liste = document.getElementById('liste');
  if (treffer) treffer.innerHTML = html;
  if (liste) liste.hidden = !!z.suche.trim();
}

// Eingaben in Formularen merken, damit ein Neuaufbau der Seite sie nicht löscht
function entwurfMerken() {
  const e = {};
  for (const f of app().querySelectorAll('form[data-form]')) e[f.dataset.form] = Object.fromEntries(new FormData(f));
  return e;
}
function entwurfZurueck(e) {
  for (const f of app().querySelectorAll('form[data-form]')) {
    const werte = e[f.dataset.form];
    if (!werte) continue;
    for (const [k, v] of Object.entries(werte)) {
      const el = f.elements[k];
      if (el && el.type !== 'hidden' && v !== '__neu') el.value = v;
    }
    if (f.elements.eingabe && f.elements.typ) f.elements.eingabe.placeholder = platzhalter(f.elements.typ.value);
  }
}

async function neuAnlegen(store, drehtagId) {
  const frage = store === 'locations' ? 'Name der neuen Location, z. B. Wohnzimmer:' : 'Name des neuen Videos, z. B. Reel 1 – Küche:';
  const name = prompt(frage)?.trim();
  if (!name) return null;
  const neu = { id: db.uid(), drehtagId, name, notiz: '', pos: Date.now() };
  await db.put(store, neu);
  return neu;
}

// ---------- Sprachnotiz auswerten (nur in der Android-App) ----------
// 1. Whisper transkribiert auf dem Handy, offline.  2. Auf Wunsch sortiert Claude das Transkript ein.

function auswertungAnzeigen(titel) {
  const o = showOverlay(`
    <div class="sheet-wrap"><div class="sheet auswertung" role="dialog" aria-label="${esc(titel)}">
      <h2>${esc(titel)}</h2>
      <p class="aw-schritt">Wird vorbereitet …</p>
      <div class="bar"><i style="width:0%"></i></div>
      <p class="mute">Du kannst das Fenster schließen; das Ergebnis wird trotzdem gespeichert.</p>
      <button class="btn big" data-aw="zu">Schließen</button>
    </div></div>`);
  o.el.querySelector('[data-aw="zu"]').addEventListener('click', () => o.close());
  return {
    schritt(text, prozent) {
      if (o.closed) return;
      o.el.querySelector('.aw-schritt').textContent = text;
      if (prozent != null) o.el.querySelector('.bar i').style.width = `${prozent}%`;
    },
    fertig() { o.close(); },
  };
}

async function sortierungAnwenden(tagId, e) {
  const b = await db.buendel(tagId);
  const zahl = { antworten: 0, fragen: 0, videos: 0, shots: 0 };
  await aendereTag(tagId, 'briefing', (br) => {
    for (const a of e.antworten || []) {
      const f = br.fragen.find((x) => x.id === a.frage_id);
      const t = String(a.antwort || '').trim();
      if (!f || !t) continue;
      const alt = (f.antwort || '').trim();
      if (alt.includes(t)) continue;
      f.antwort = alt ? `${alt}\n${t}` : t; // Vorhandenes bleibt stehen, Neues kommt dazu
      zahl.antworten += 1;
    }
    for (const w of e.weitere_infos || []) {
      const frage = String(w.frage || '').trim();
      const antwort = String(w.antwort || '').trim();
      if (!frage || !antwort) continue;
      br.fragen.push({ id: db.uid(), set: 'eigene', frage, antwort });
      zahl.fragen += 1;
    }
  });
  // Video oder Location über den Namen finden, sonst anlegen
  const holen = async (store, liste, name) => {
    const n = String(name || '').trim();
    if (!n) return '';
    let x = liste.find((v) => v.name.toLowerCase() === n.toLowerCase());
    if (!x) {
      x = { id: db.uid(), drehtagId: tagId, name: n, notiz: '', pos: Date.now() + liste.length };
      liste.push(x);
      await db.put(store, x);
      if (store === 'videos') zahl.videos += 1;
    }
    return x;
  };
  for (const v of e.videos || []) {
    const x = await holen('videos', b.videos, v.name);
    if (x && !(x.notiz || '').trim() && (v.notiz || '').trim()) { x.notiz = v.notiz.trim(); await db.put('videos', x); }
  }
  const typen = M.SORTIER_SCHEMA.properties.shots.items.properties.typ.enum; // nur, was das Schema erlaubt
  const schonDa = new Set(b.shots.map((s) => `${s.typ}|${(s.text || s.titel || '').trim().toLowerCase()}`));
  let pos = Date.now();
  for (const s of e.shots || []) {
    const text = String(s.text || '').trim();
    const titel = String(s.titel || '').trim();
    if (!typen.includes(s.typ) || (!text && !titel)) continue;
    if (schonDa.has(`${s.typ}|${(text || titel).toLowerCase()}`)) continue;
    const video = await holen('videos', b.videos, s.video);
    const ort = await holen('locations', b.locations, s.location);
    await db.put('shots', {
      id: db.uid(), drehtagId: tagId, typ: s.typ, titel, text,
      videoId: video?.id || '', locationId: ort?.id || '', settingId: '',
      format: 'hochkant', erledigt: false, favorit: false, take: '', notiz: String(s.notiz || '').trim(), pos: pos++,
    });
    zahl.shots += 1;
  }
  return zahl;
}

async function auswerten(medienId, { sortieren }) {
  const m = await db.get('medien', medienId);
  if (!m) return;
  const st = await sprache.status();
  const modell = (await db.getMeta('whisperModell')) || 'schnell';
  if (!m.transkript && !st[modell]) {
    toast('Erst das Whisper-Modell laden: „Sicherung“ › Sprachnotizen');
    return;
  }
  if (sortieren && !st.claude) {
    toast('Zum Einsortieren fehlt der Claude-Schlüssel („Sicherung“). Ich transkribiere nur.');
    sortieren = false;
  }
  const anzeige = auswertungAnzeigen(sortieren ? 'Sprachnotiz auswerten' : 'Sprachnotiz transkribieren');
  try {
    let b = await db.buendel(m.drehtagId);
    if (!m.transkript) {
      anzeige.schritt('Aufnahme wird vorbereitet …', 0);
      const t0 = Date.now();
      const r = await sprache.transkribieren(m.blob, {
        modell, hinweis: M.whisperHinweis(b),
        beiFortschritt: (p) => anzeige.schritt(`Whisper hört zu … ${p} %`, p),
      });
      m.transkript = r.text;
      m.transkribiertMit = `Whisper ${modell === 'genau' ? 'large-v3-turbo' : 'small'} auf dem Handy, ${Math.round((Date.now() - t0) / 1000)} s`;
      await db.put('medien', m);
      render();
    }
    if (!m.transkript.trim()) { toast('In der Aufnahme wurde nichts erkannt'); return; }
    if (sortieren) {
      anzeige.schritt('Claude sortiert ein …', 100);
      b = await db.buendel(m.drehtagId);
      const e = await sprache.einsortieren({ system: M.SORTIER_SYSTEM, inhalt: M.sortierInhalt(b, m.transkript), schema: M.SORTIER_SCHEMA });
      const zahl = await sortierungAnwenden(m.drehtagId, e);
      const frisch = await db.get('medien', medienId);
      frisch.offenePunkte = (e.offene_punkte || []).map((p) => String(p).trim()).filter(Boolean);
      frisch.eingeordnet = Date.now();
      frisch.einordnung = zahl;
      await db.put('medien', frisch);
      toast(`Einsortiert: ${anzahl(zahl.antworten + zahl.fragen, 'Antwort', 'Antworten')}, ${anzahl(zahl.videos, 'neues Video', 'neue Videos')}, ${anzahl(zahl.shots, 'Shot', 'Shots')}`);
    } else {
      toast('Transkript gespeichert');
    }
  } catch (err) {
    toast(err?.message || 'Auswertung fehlgeschlagen');
  } finally {
    anzeige.fertig();
    render();
  }
}

// Ist ein Teleprompter-Gerät gekoppelt, bekommt es den Sprechtext des nächsten Shots von selbst.
// Liegt dort gerade der Location-Prompter (alle Texte der Station), bleibt der stehen.
let sammelAufGeraet = false;
async function prompterNachziehen(shot) {
  if (!gekoppelt() || sammelAufGeraet || !['hook', 'oton', 'cta'].includes(shot.typ) || !(shot.text || '').trim()) return;
  if (await textSenden(M.shotName(shot), shot.text)) toast('Text liegt auf dem Teleprompter');
}

// Fotos vor dem Speichern verkleinern, sonst läuft der Speicher schnell voll
async function verkleinern(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * f);
    c.height = Math.round(bmp.height * f);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return blob || file;
  } catch {
    return file; // unbekanntes Format: Original behalten
  }
}

// Ein Bild gehört zu einem Shot, zu einer Location oder liegt unsortiert beim Drehtag
async function besitzer(owner, id) {
  if (owner === 'korb') return { ziel: null, felder: { drehtagId: id, shotId: '', locationId: '' } };
  // Setting: id ist "Drehtag~Setting", weil Settings im Drehtag liegen und keinen eigenen Speicher haben
  if (owner === 'setting') {
    const [drehtagId, settingId] = id.split('~');
    return { ziel: null, felder: { drehtagId, shotId: '', locationId: '', settingId } };
  }
  const ziel = await db.get(owner === 'ort' ? 'locations' : 'shots', id);
  return {
    ziel,
    felder: { drehtagId: ziel.drehtagId, shotId: owner === 'ort' ? '' : id, locationId: owner === 'ort' ? id : '' },
  };
}

async function shotHolen(id) {
  await allesGespeichert(); // letzte Eingaben erst fertig speichern
  return db.get('shots', id);
}
async function buendelHolen(id) {
  await allesGespeichert();
  return db.buendel(id);
}

// Location-Prompter: alle Sprechtexte einer Station (Faden: data-key, Location-Seite: data-ort)
async function stationText(tagId, el) {
  const b = await buendelHolen(tagId);
  const st = M.fadenStationen(b).find((x) => (el.dataset.key ? x.key === el.dataset.key : x.locationId === el.dataset.ort));
  const shots = st ? M.stationSprechtexte(st) : [];
  if (!shots.length) { toast('Hier gibt es keine Sprechtexte'); return null; }
  return { titel: `${st.titel} · ${anzahl(shots.length, 'Text', 'Texte')}`, text: M.prompterBlock(shots, b.videos) };
}

// Tauscht den Platz mit dem Nachbarn in der Liste
async function tauschen(store, liste, id, richtung) {
  const i = liste.findIndex((x) => x.id === id);
  const ich = liste[i];
  const nachbar = liste[i + richtung];
  if (!ich || !nachbar) return;
  [ich.pos, nachbar.pos] = [nachbar.pos, ich.pos];
  await db.put(store, ich);
  await db.put(store, nachbar);
}
const verschieben = (liste, id, richtung) => {
  const i = liste.findIndex((x) => x.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
};

// Aus eingefügtem Text (zum Beispiel einer Antwort von Claude) einzelne Hooks machen
export function hooksAusText(text) {
  return String(text).split(/\r?\n/)
    .map((l) => l.trim()
      .replace(/^(\d+\s*[.)]|[-*•–])\s*/, '')
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/^hook\s*\d*\s*[:.–-]\s*/i, '')
      .replace(/^["„“”'»«‚](.*)["“”'»«‘]$/, '$1')
      .trim())
    .filter((l) => l && !l.startsWith('#') && !l.endsWith(':'));
}

function teilenMeldung(r, was) {
  if (r === 'kopiert') toast(`${was} ist kopiert`);
  if (r === 'gespeichert') toast(`${was} liegt im Download-Ordner`);
}

// Kalender-Zeiten aus Datum, Drehbeginn und Zeitplan
function kalenderZeiten(tag) {
  const d = tag.datum.replace(/-/g, '');
  if (!/^\d{1,2}:\d{2}$/.test(tag.uhrzeit || '')) {
    const n = new Date(tag.datum + 'T00:00');
    n.setDate(n.getDate() + 1);
    return `${d}/${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
  }
  const [h, m] = tag.uhrzeit.split(':').map(Number);
  const start = h * 60 + m;
  const ende = Math.min(start + (M.zeitplanMinuten(tag.zeitplan?.bloecke) || 60), 1439);
  const t = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}${String(x % 60).padStart(2, '0')}00`;
  return `${d}T${t(start)}/${d}T${t(ende)}`;
}

async function openMedia(id) {
  const m = await db.get('medien', id);
  if (!m) return;
  // Unsortierte Fotos und Location-Fotos lassen sich einer Location zuordnen
  const locations = m.shotId || m.settingId ? [] : (await db.byIndex('locations', 'drehtagId', m.drehtagId)).sort(nachPos);
  const u = URL.createObjectURL(m.blob);
  let danach = null;
  const o = showOverlay(`
    <div class="viewer">
      <div class="s-bar">
        <button data-v="close">Schließen</button>
        <button data-v="draw">${m.art === 'skizze' ? 'Weiterzeichnen' : 'Zeichnen'}</button>
        ${m.original ? '<button data-v="orig">Original</button>' : ''}
        <button data-v="del" class="rot">Löschen</button>
      </div>
      <div class="v-stage"><img src="${u}" alt=""></div>
      ${m.shotId || m.settingId ? '' : `
      <div class="s-bar">
        <select data-v="zuordnen" aria-label="Location zuordnen">
          <option value="">Unsortiert</option>
          ${locations.map((l) => `<option value="${l.id}" ${l.id === m.locationId ? 'selected' : ''}>${l.name.replace(/</g, '&lt;')}</option>`).join('')}
        </select>
      </div>`}
    </div>`, { onClose: () => { URL.revokeObjectURL(u); danach?.(); } });
  const root = o.el.querySelector('.viewer');
  root.querySelector('[data-v="zuordnen"]')?.addEventListener('change', async (e) => {
    await db.put('medien', { ...m, locationId: e.target.value });
    toast(e.target.value ? 'Zugeordnet' : 'Wieder unsortiert');
    o.close();
    render();
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    if (b.dataset.v === 'close') o.close();
    if (b.dataset.v === 'del') {
      o.close();
      await mitRueckgaengig(m.drehtagId, 'Bild gelöscht', () => db.entfernen('medien', id));
    }
    if (b.dataset.v === 'orig') {
      const { original, strokes, ...rest } = m;
      o.close();
      await mitRueckgaengig(m.drehtagId, 'Zeichnung entfernt', () => db.put('medien', { ...rest, blob: original }));
    }
    if (b.dataset.v === 'draw') {
      // Erst die Bildansicht schließen, dann die Zeichenfläche öffnen
      danach = async () => {
        if (m.art === 'skizze') {
          const res = await openSketch({ format: m.format, strokes: m.strokes || [], symbole: !m.shotId });
          if (res) await db.put('medien', { ...m, blob: res.blob, strokes: res.strokes });
        } else {
          const basis = m.original || m.blob;
          const res = await openSketch({ hintergrund: basis, strokes: m.strokes || [], symbole: !m.shotId });
          if (res) await db.put('medien', { ...m, original: basis, blob: res.blob, strokes: res.strokes });
        }
        render();
      };
      o.close();
    }
  });
}

export async function einlesen(file) {
  const buendel = await importDatei(file);
  toast(`${anzahl(buendel.length, 'Drehtag', 'Drehtage')} eingelesen und zusammengeführt`);
  const ziel = buendel.length === 1 ? `#/tag/${buendel[0].drehtag.id}` : '#/';
  if (location.hash === ziel) render(); else location.hash = ziel;
}

// Auswahl hinter dem Plus auf der Startseite
async function neuMenu() {
  const vorlagen = (await db.getAll('drehtage')).filter((t) => t.vorlage).sort((a, b) => a.kunde.localeCompare(b.kunde));
  let danach = null;
  const o = showOverlay(`
    <div class="sheet-wrap">
      <div class="sheet" role="dialog" aria-label="Neu anlegen">
        <h2>Was möchtest du anlegen?</h2>
        <button class="sheet-opt" data-n="#/neu/erstgespraech"><b>Erstgespräch</b><span>Kunde anlegen und die Fragen durchgehen</span></button>
        <button class="sheet-opt" data-n="#/neu"><b>Drehtag planen</b><span>Mit Datum, Ort, Shotliste und Zeitplan</span></button>
        ${vorlagen.map((v) => `<button class="sheet-opt" data-vorlage="${v.id}"><b>Aus Vorlage: ${esc(v.kunde)}</b><span>Shots, Videos, Locations und Ablauf übernehmen</span></button>`).join('')}
        <label class="sheet-opt"><b>Datei einlesen</b><span>Drehtag-Datei, zum Beispiel zurück von Claude, oder Backup</span><input type="file" hidden data-n-datei></label>
        <button class="btn big" data-n="close">Abbrechen</button>
      </div>
    </div>`, { onClose: () => danach?.() });
  const wrap = o.el.querySelector('.sheet-wrap');
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) { o.close(); return; } // Tippen neben das Menü schließt es
    const b = e.target.closest('[data-n], [data-vorlage]');
    if (!b) return;
    if (b.dataset.vorlage) danach = () => aktionen['aus-vorlage'](b.dataset.vorlage);
    else if (b.dataset.n !== 'close') danach = () => { location.hash = b.dataset.n; };
    o.close();
  });
  wrap.querySelector('[data-n-datei]').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    danach = () => einlesen(file).catch((err) => toast('Fehler: ' + err.message));
    o.close();
  });
}

function zeitplanDrucken(b, absender) {
  const o = showOverlay(zeitplanBlatt(b, absender));
  o.el.querySelector('.druck').addEventListener('click', (e) => {
    const k = e.target.closest('[data-d]');
    if (k?.dataset.d === 'close') o.close();
    if (k?.dataset.d === 'print') window.print();
  });
}

// ---------- Aktionen (Knöpfe mit data-action) ----------

const aktionen = {
  // Drehtag als Ganzes
  async 'del-tag'(id) {
    const t = await db.get('drehtage', id);
    location.replace('#/');
    await mitRueckgaengig(id, `${t?.vorlage ? 'Vorlage' : 'Drehtag'} „${t?.kunde || ''}“ gelöscht`, () => db.deleteDrehtag(id), { zurueckNach: '#/tag/' + id });
  },
  async 'dup-tag'(id) {
    const b = await buendelHolen(id);
    const kopie = M.kopieAlsNeu(b);
    kopie.drehtag.vorlage = !!b.drehtag.vorlage;
    await db.buendelSchreiben(kopie);
    toast('Kopie angelegt. Bilder bleiben beim Original.');
    location.hash = `#/tag/${kopie.drehtag.id}/bearbeiten`;
  },
  async 'vorlage-tag'(id) {
    const b = await buendelHolen(id);
    const name = prompt('Name der Vorlage, z. B. Objekttour Makler:', b.drehtag.kunde)?.trim();
    if (!name) return;
    const kopie = M.kopieAlsNeu(b);
    Object.assign(kopie.drehtag, { vorlage: true, kunde: name });
    await db.buendelSchreiben(kopie);
    toast('Vorlage gespeichert. Sie steht auf der Startseite.');
  },
  async 'aus-vorlage'(id) {
    const b = await buendelHolen(id);
    const kunde = prompt('Für welchen Kunden ist der neue Drehtag?')?.trim();
    if (!kunde) return;
    const kopie = M.kopieAlsNeu(b);
    kopie.drehtag.kunde = kunde;
    await db.buendelSchreiben(kopie);
    location.hash = `#/tag/${kopie.drehtag.id}/bearbeiten`;
  },

  'neu-menu': () => neuMenu(),

  // Sprachnotiz
  async sprachnotiz(tagId) {
    await allesGespeichert();
    const tag = await db.get('drehtage', tagId);
    const offen = (tag.briefing?.fragen || []).filter((f) => !(f.antwort || '').trim()).map((f) => f.frage);
    const res = await sprachnotizAufnehmen({ fragen: offen });
    if (!res) return;
    if (res.dauer < 1 || !res.blob.size) { toast('Aufnahme war leer'); return; }
    const id = db.uid();
    await db.put('medien', {
      id, drehtagId: tagId, shotId: '', locationId: '', art: 'audio',
      blob: res.blob, typ: res.typ, dauer: res.dauer, transkript: '', erstellt: Date.now(),
    });
    render();
    if (!istNativ) { toast('Gespeichert. Zum Auswerten „Datei für Claude“ teilen.'); return; }
    // In der App gleich auswerten, so wie unter „Sicherung“ eingestellt
    await auswerten(id, { sortieren: ((await db.getMeta('sprachModus')) || 'sortieren') === 'sortieren' });
  },
  'notiz-transkribieren': (id) => auswerten(id, { sortieren: false }),
  'notiz-einsortieren': (id) => auswerten(id, { sortieren: true }),
  async 'notiz-neu'(id) {
    if (!confirm('Transkript verwerfen und neu transkribieren?')) return;
    const m = await db.get('medien', id);
    m.transkript = '';
    await db.put('medien', m);
    await auswerten(id, { sortieren: false });
  },

  // Einstellungen für Sprachnotizen (unter „Sicherung“)
  async 'sprach-modell'(name) {
    await db.setMeta('whisperModell', name);
    const st = await sprache.status();
    if (!st[name]) {
      const groesse = name === 'genau' ? '550 MB' : '190 MB';
      if (!confirm(`Whisper-Modell „${name === 'genau' ? 'Genau' : 'Schnell'}“ laden (${groesse})? Am besten im WLAN.`)) { render(); return; }
      const anzeige = auswertungAnzeigen('Whisper-Modell laden');
      try {
        await sprache.modellLaden(name, (p) => anzeige.schritt(`${p} % geladen`, p));
        toast('Modell geladen und geprüft');
      } catch (e) {
        toast(e?.message || 'Laden fehlgeschlagen');
      } finally {
        anzeige.fertig();
      }
    }
    render();
  },
  async 'sprach-modell-weg'(name) {
    if (!confirm('Modell vom Handy löschen? Es lässt sich jederzeit neu laden.')) return;
    await sprache.modellLoeschen(name);
    render();
  },
  async 'sprach-modus'(wert) {
    await db.setMeta('sprachModus', wert);
    render();
  },
  async 'claude-schluessel'() {
    const feld = app().querySelector('#claude-schluessel');
    const wert = feld?.value.trim() || '';
    if (wert && !wert.startsWith('sk-ant-')) { toast('Das sieht nicht wie ein Claude-API-Schlüssel aus (sk-ant-…)'); return; }
    try {
      await sprache.claudeSchluessel(wert);
      toast(wert ? 'Schlüssel sicher gespeichert' : 'Schlüssel entfernt');
    } catch (e) {
      toast(e?.message || 'Speichern fehlgeschlagen');
    }
    render();
  },
  async 'del-audio'(id) {
    const m = await db.get('medien', id);
    if (m) await mitRueckgaengig(m.drehtagId, 'Sprachnotiz gelöscht', () => db.entfernen('medien', id));
  },

  // Settings
  async 'add-setting'(tagId, b) {
    const name = prompt('Name des Settings, z. B. Position A – sitzend am Tisch:')?.trim();
    if (!name) return;
    const x = M.neuesSetting(name, b.dataset.ort || '');
    await aendereTag(tagId, 'settings', (s) => { s.liste.push(x); });
    location.hash = `#/setting/${tagId}/${x.id}`;
  },
  async 'del-setting'(id, b) {
    const tagId = b.dataset.tag;
    const shots = (await db.byIndex('shots', 'drehtagId', tagId)).filter((s) => s.settingId === id);
    location.replace(`#/tag/${tagId}/plan`);
    await mitRueckgaengig(tagId, `Setting gelöscht${shots.length ? `, ${anzahl(shots.length, 'Shot', 'Shots')} jetzt ohne Setting` : ''}`, async () => {
      for (const s of shots) await aendereZeile('shots', s.id, (x) => { x.settingId = ''; });
      for (const m of (await db.byIndex('medien', 'drehtagId', tagId)).filter((x) => x.settingId === id)) await db.entfernen('medien', m.id);
      await aendereTag(tagId, 'settings', (s) => { s.liste = s.liste.filter((x) => x.id !== id); });
    }, { zurueckNach: `#/setting/${tagId}/${id}` });
  },
  async 'move-setting'(id, b) {
    await aendereTag(b.dataset.tag, 'settings', (s) => {
      const liste = [...s.liste].sort((x, y) => (x.pos || 0) - (y.pos || 0));
      verschieben(liste, id, Number(b.dataset.dir));
      liste.forEach((x, i) => { x.pos = i + 1; });
      s.liste = liste;
    });
    render();
  },
  async 'setting-zuordnen'(shotId, b) {
    const sid = b.dataset.setting;
    await aendereZeile('shots', shotId, (s) => { s.settingId = s.settingId === sid ? '' : sid; });
    render();
  },
  async 'setting-alle'(sid, b) {
    const tagId = b.dataset.tag;
    const tag = await db.get('drehtage', tagId);
    const x = M.settingVon(tag, sid);
    const frei = (await db.byIndex('shots', 'drehtagId', tagId)).filter((s) => !s.settingId && (!x.locationId || s.locationId === x.locationId));
    for (const s of frei) await aendereZeile('shots', s.id, (y) => { y.settingId = sid; });
    toast(`${anzahl(frei.length, 'Shot', 'Shots')} zugeordnet`);
    render();
  },
  async 'setting-merken'(sid, b) {
    await allesGespeichert();
    const x = M.settingVon(await db.get('drehtage', b.dataset.tag), sid);
    const { id, locationId, pos, ...vorlage } = x;
    const bib = (await db.getMeta('settingBibliothek')) || [];
    const i = bib.findIndex((y) => y.name.trim().toLowerCase() === x.name.trim().toLowerCase());
    if (i >= 0) bib[i] = vorlage; else bib.push(vorlage);
    await db.setMeta('settingBibliothek', bib);
    toast(i >= 0 ? `„${x.name}“ in der Bibliothek aktualisiert` : `„${x.name}“ in der Bibliothek gemerkt`);
  },
  async 'setting-bibliothek'(tagId) {
    const bib = (await db.getMeta('settingBibliothek')) || [];
    if (!bib.length) { toast('Die Bibliothek ist noch leer. Auf einer Setting-Seite „In Bibliothek merken“ tippen.'); return; }
    let danach = null;
    const o = showOverlay(`
      <div class="sheet-wrap">
        <div class="sheet" role="dialog" aria-label="Setting aus der Bibliothek">
          <h2>Setting aus der Bibliothek</h2>
          ${bib.map((x, i) => `<button class="sheet-opt" data-nr="${i}"><b>${esc(x.name)}</b><span>${esc(M.settingKurz(x) || 'ohne Technik-Angaben')}</span></button>`).join('')}
          <button class="btn big" data-zu>Abbrechen</button>
        </div>
      </div>`, { onClose: () => danach?.() });
    const wrap = o.el.querySelector('.sheet-wrap');
    wrap.addEventListener('click', (e) => {
      const k = e.target.closest('[data-nr]');
      if (k) {
        const x = M.neuesSetting(bib[k.dataset.nr].name, '', { ...bib[k.dataset.nr] });
        danach = async () => {
          await aendereTag(tagId, 'settings', (s) => { s.liste.push(x); });
          location.hash = `#/setting/${tagId}/${x.id}`;
        };
        o.close();
      } else if (e.target === wrap || e.target.closest('[data-zu]')) o.close();
    });
  },
  async 'pack-aus-settings'(tagId) {
    const tag = await db.get('drehtage', tagId);
    const neu = M.packAusSettings(M.settingsVon(tag), tag.packliste?.posten || []);
    if (!neu.length) { toast('Alles aus den Settings steht schon auf der Packliste'); return; }
    await aendereTag(tagId, 'packliste', (p) => { p.posten.push(...neu); });
    toast(`${anzahl(neu.length, 'Posten', 'Posten')} aus den Settings ergänzt`);
    render();
  },

  // Roter Faden
  async 'faden-erledigt'(id) {
    const shot = await db.get('shots', id);
    const vorher = M.fadenStand(await db.buendel(shot.drehtagId));
    await aendereZeile('shots', id, (s) => { s.erledigt = true; s.spaeter = false; s.erledigtUm = Date.now(); });
    z.fadenZuletzt = id;
    z.fadenShot = '';
    const nachher = M.fadenStand(await db.buendel(shot.drehtagId));
    // Station gerade fertig geworden? Kurz Bescheid geben, der Faden springt von selbst weiter.
    const st = vorher.stationen[vorher.idx];
    if (st && !vorher.stationen[vorher.idx].fertig && nachher.stationen.find((x) => x.key === st.key)?.fertig) {
      toast(`${st.titel} fertig`);
    }
    if (z.fadenModus === 'nachholen' && !nachher.nachholen.length) z.fadenModus = '';
    await render();
    window.scrollTo(0, 0);
    const naechster = (nachher.stationen[nachher.idx]?.offen || nachher.nachholen)[0];
    if (naechster) await prompterNachziehen(naechster);
  },
  async 'faden-spaeter'(id) {
    await aendereZeile('shots', id, (s) => { s.spaeter = true; });
    z.fadenShot = '';
    toast('Zurückgestellt, kommt unter „Nachholen“');
    await render();
    window.scrollTo(0, 0);
  },
  async 'faden-undo'(id) {
    await aendereZeile('shots', id, (s) => { s.erledigt = false; s.erledigtUm = 0; });
    z.fadenZuletzt = '';
    z.fadenShot = id;
    render();
  },
  // Ampel "Bereit für den Dreh?"
  'ampel-auf'(id) {
    z.ampelOffen = z.ampelOffen === id ? '' : id;
    render();
  },
  async 'bereit-ignorieren'(id, b) {
    const punkt = b.dataset.punkt;
    await aendereTag(id, 'bereit', (x) => {
      const liste = new Set(x.ignoriert || []);
      if (liste.has(punkt)) liste.delete(punkt); else liste.add(punkt);
      x.ignoriert = [...liste];
    });
    render();
  },
  async 'posten-ignorieren'(id, b) {
    await aendereTag(b.dataset.tag, 'packliste', (p) => { const x = p.posten.find((q) => q.id === id); if (x) x.ignoriert = true; });
    toast('Posten wird nicht mehr angemahnt');
    render();
  },
  // Automatisches Öffnen des Fadens für heute abschalten (gilt nur für diesen Tag)
  async 'faden-auto-aus'(id) {
    const alt = (await db.getMeta('fadenAutoAus')) || {};
    const tage = alt.datum === M.heute() ? alt.tage || [] : [];
    await db.setMeta('fadenAutoAus', { datum: M.heute(), tage: [...new Set([...tage, id])] });
    z.fadenAuto = '';
    toast('Heute öffnet die App wieder auf der Startseite');
    location.hash = '#/';
  },
  async 'faden-waehle'(id) {
    z.fadenShot = id;
    await render();
    window.scrollTo(0, 0);
    const s = await db.get('shots', id);
    if (s) await prompterNachziehen(s);
  },
  async 'faden-station'(tagId, b) {
    z.fadenShot = '';
    if (b.dataset.key === 'nachholen') {
      z.fadenModus = 'nachholen';
    } else {
      const st = M.fadenStationen(await buendelHolen(tagId)).find((x) => x.key === b.dataset.key);
      if (st?.fertig) { toast(`„${st.titel}“ ist schon fertig. Abgehakte Shots stehen in der Shotliste.`); return; }
      z.fadenModus = '';
      await aendereTag(tagId, 'faden', (f) => { f.aktiv = b.dataset.key; });
    }
    render();
  },
  async 'faden-station-fertig'(tagId, b) {
    await aendereTag(tagId, 'faden', (f) => {
      f.fertig = [...new Set([...(f.fertig || []), b.dataset.key])];
      if (f.aktiv === b.dataset.key) f.aktiv = '';
    });
    render();
  },
  async 'faden-rest-spaeter'(tagId, b) {
    const st = M.fadenStationen(await buendelHolen(tagId)).find((x) => x.key === b.dataset.key);
    if (!st) return;
    z.fadenShot = '';
    await mitRueckgaengig(tagId, `${anzahl(st.offen.length, 'Shot', 'Shots')} aus „${st.titel}“ zurückgestellt`, async () => {
      for (const s of st.offen) await aendereZeile('shots', s.id, (x) => { x.spaeter = true; });
      await aendereTag(tagId, 'faden', (f) => { if (f.aktiv === st.key) f.aktiv = ''; });
    });
  },
  // Im Drehtag-Formular: Koordinaten vom GPS des Handys übernehmen (fragt einmal um Erlaubnis)
  'standort-hier'() {
    const feld = app().querySelector('input[name="koordinaten"]');
    if (!feld || !navigator.geolocation) { toast('Standort ist hier nicht verfügbar'); return; }
    toast('Standort wird ermittelt …');
    navigator.geolocation.getCurrentPosition(
      (p) => { feld.value = `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`; toast('Standort übernommen – noch speichern'); },
      () => toast('Kein Standort – Freigabe oder GPS prüfen'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  },
  async 'faden-klappe'(id) {
    const shot = await db.get('shots', id);
    const [video, tag] = await Promise.all([shot.videoId ? db.get('videos', shot.videoId) : null, db.get('drehtage', shot.drehtagId)]);
    const o = showOverlay(`
      <div class="klappe" role="button" aria-label="Klappe schließen">
        <p class="klappe-klein">${esc(tag.kunde)}${tag.datum ? ' · ' + esc(M.fmtDatum(tag.datum)) : ''}</p>
        <p class="klappe-gross">${esc(video ? video.name : 'Ohne Video')}</p>
        <p class="klappe-mittel">${esc(M.typVon(shot.typ).kurz)}${shot.titel ? ' · ' + esc(shot.titel) : ''}</p>
        <p class="klappe-klein">Antippen schließt</p>
      </div>`);
    o.el.querySelector('.klappe').addEventListener('click', () => o.close());
  },
  async 'faden-reihenfolge'(tagId, b) {
    await aendereTag(tagId, 'faden', (f) => { f.reihenfolge = b.dataset.wert; });
    render();
  },
  async 'ablauf-vorschlagen'(tagId) {
    const b = await buendelHolen(tagId);
    if (!b.shots.length) { toast('Erst Shots anlegen, dann daraus den Ablauf vorschlagen'); return; }
    const bloecke = M.ablaufVorschlag(b);
    const ohne = b.shots.filter((s) => !b.locations.some((l) => l.id === s.locationId)).length;
    await mitRueckgaengig(tagId, ohne ? `${anzahl(bloecke.length, 'Block', 'Blöcke')} vorgeschlagen, ${anzahl(ohne, 'Shot', 'Shots')} ohne Location am Ende` : `${anzahl(bloecke.length, 'Block', 'Blöcke')} vorgeschlagen. Dauer bitte prüfen.`,
      () => aendereTag(tagId, 'zeitplan', (p) => { p.bloecke = bloecke; }));
  },

  // Umschalter der Oberfläche
  'toggle-info'() { z.infoOffen = !z.infoOffen; render(); },
  'toggle-ort'(id) { if (z.orteOffen.has(id)) z.orteOffen.delete(id); else z.orteOffen.add(id); render(); },
  'toggle-sort'() { z.sortieren = !z.sortieren; render(); },
  'toggle-bearbeiten'() { z.bearbeiten = !z.bearbeiten; render(); },
  'set-gruppe'(modus) { z.gruppierung = modus; localStorage.setItem('gruppierung', modus); render(); },
  'toggle-text'(id) { if (z.aufgeklappt.has(id)) z.aufgeklappt.delete(id); else z.aufgeklappt.add(id); render(); },

  // Reihenfolge
  async 'move-shot'(id, b) {
    const shot = await db.get('shots', id);
    const bd = await db.buendel(shot.drehtagId);
    // Verschoben wird innerhalb der Gruppe, die gerade angezeigt wird
    const gruppe = M.gruppieren(bd.shots, bd.locations, bd.videos, z.gruppierung).find((g) => g.shots.some((s) => s.id === id));
    await tauschen('shots', gruppe.shots, id, Number(b.dataset.dir));
    render();
  },
  async 'move-ort'(id, b) {
    const ort = await db.get('locations', id);
    const alle = (await db.byIndex('locations', 'drehtagId', ort.drehtagId)).sort(nachPos);
    await tauschen('locations', alle, id, Number(b.dataset.dir));
    render();
  },

  // Löschen
  async 'del-shot'(id) {
    const shot = await db.get('shots', id);
    location.replace('#/tag/' + shot.drehtagId);
    await mitRueckgaengig(shot.drehtagId, 'Shot gelöscht', () => db.deleteShot(id), { zurueckNach: '#/shot/' + id });
  },
  async 'del-ort'(id) {
    const ort = await db.get('locations', id);
    if (z.letzteLocation === id) z.letzteLocation = '';
    location.replace('#/tag/' + ort.drehtagId + '/orte');
    await mitRueckgaengig(ort.drehtagId, `Location „${ort.name}“ gelöscht, Shots bleiben`, () => db.deleteLocation(id), { zurueckNach: '#/ort/' + id });
  },
  async 'del-video'(id) {
    const video = await db.get('videos', id);
    if (z.letztesVideo === id) z.letztesVideo = '';
    location.replace('#/tag/' + video.drehtagId);
    await mitRueckgaengig(video.drehtagId, `Video „${video.name}“ gelöscht, Shots bleiben`, () => db.deleteVideo(id), { zurueckNach: '#/video/' + id });
  },

  // Bilder
  async 'add-sketch'(id, b) {
    await allesGespeichert();
    const owner = b.dataset.owner;
    const { ziel, felder } = await besitzer(owner, id);
    // Setting: Aufbau von oben, dafür passt quer besser
    const res = await openSketch({ format: owner === 'shot' ? ziel.format : owner === 'setting' ? 'quer' : 'hochkant', symbole: owner === 'setting' || owner === 'ort' });
    if (!res) return;
    await db.put('medien', {
      id: db.uid(), ...felder, art: 'skizze',
      blob: res.blob, strokes: res.strokes, format: res.format, erstellt: Date.now(),
    });
    render();
  },
  'open-media': (id) => openMedia(id),

  // Sprechtext eines Shots
  async 'share-text'(id) {
    const s = await shotHolen(id);
    if (!(s.text || '').trim()) { toast('Hier steht noch kein Text'); return; }
    teilenMeldung(await shareText(M.shotName(s), s.text), 'Text');
  },
  async 'copy-text'(id) {
    const s = await shotHolen(id);
    await copyText(s.text || '');
    toast('Text kopiert');
  },
  async 'prompt-text'(id) {
    const s = await shotHolen(id);
    // Gekoppeltes Teleprompter-Gerät? Dann dorthin, und hier die Fernsteuerung zeigen
    if (gekoppelt()) {
      if (await textSenden(M.shotName(s), s.text)) { sammelAufGeraet = false; steuerungZeigen(); return; }
      toast('Teleprompter-Gerät nicht erreichbar, zeige den Text hier');
    }
    openPrompter(M.shotName(s), s.text);
  },
  // Location-Prompter: alle Sprechtexte der Station am Stück
  async 'prompt-station'(tagId, el) {
    const t = await stationText(tagId, el);
    if (!t) return;
    if (gekoppelt()) {
      if (await textSenden(t.titel, t.text)) { sammelAufGeraet = true; steuerungZeigen(); return; }
      toast('Teleprompter-Gerät nicht erreichbar, zeige den Text hier');
    }
    openPrompter(t.titel, t.text);
  },
  async 'share-station'(tagId, el) {
    const t = await stationText(tagId, el);
    if (t) teilenMeldung(await shareText(t.titel, t.text), 'Der Text');
  },
  koppeln: () => koppelnZeigen(render),

  // Teilen und Export
  async 'share-shotlist'(id) {
    const b = await buendelHolen(id);
    teilenMeldung(await shareText(`Shotliste ${b.drehtag.kunde}`, M.shotlistText(b, z.gruppierung)), 'Shotliste');
  },
  async 'share-zeitplan'(id) {
    const b = await buendelHolen(id);
    if (!b.drehtag.zeitplan?.bloecke?.length) { toast('Erst im Reiter „Plan“ den Ablauf anlegen'); return; }
    const absender = await db.getMeta('absender');
    teilenMeldung(await shareText(`Drehplan ${b.drehtag.kunde}`, M.zeitplanText(b, absender)), 'Zeitplan');
  },
  async 'print-zeitplan'(id) {
    const b = await buendelHolen(id);
    zeitplanDrucken(b, await db.getMeta('absender'));
  },
  async 'share-schnitt'(id) {
    const b = await buendelHolen(id);
    teilenMeldung(await shareText(`Schnitt-Übergabe ${b.drehtag.kunde}`, M.schnittText(b)), 'Schnitt-Übergabe');
  },
  async 'share-briefing'(id) {
    const b = await buendelHolen(id);
    teilenMeldung(await shareText(`Briefing ${b.drehtag.kunde}`, M.briefingText(b)), 'Briefing');
  },
  async 'share-datei'(id) {
    await allesGespeichert();
    const { name, text } = await drehtagDatei(id);
    teilenMeldung(await dateiTeilen(name, text), 'Die Datei');
  },
  async 'kalender-google'(id) {
    const b = await buendelHolen(id);
    const t = b.drehtag;
    const details = [t.ansprechpartner ? `Kontakt: ${t.ansprechpartner}${t.telefon ? ' (' + t.telefon + ')' : ''}` : '', t.notizen].filter(Boolean).join('\n');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: 'Dreh: ' + t.kunde, dates: kalenderZeiten(t), location: t.ort || '', details });
    window.open('https://calendar.google.com/calendar/render?' + q.toString(), '_blank', 'noopener');
  },
  async 'kalender-ics'(id) {
    const b = await buendelHolen(id);
    herunterladen(`dreh-${slug(b.drehtag.kunde)}.ics`, new Blob([M.icsText(b)], { type: 'text/calendar' }));
    if (!istNativ) toast('Kalender-Datei liegt im Download-Ordner. Öffnen trägt den Termin mit Erinnerungen ein.');
  },

  // Drehtag abschließen: Überblick, was liegen blieb, dann Status „Gedreht“ und Übergabe an Claude
  async 'tag-abschliessen'(id) {
    await allesGespeichert();
    const b = await buendelHolen(id);
    const s = M.abschlussStand(b);
    const name = (x) => esc(M.shotName(x));
    const liste = (titel, xs) => (xs.length ? `<p class="abschnitt">${titel} · ${xs.length}</p><ul class="abschluss-liste">${xs.slice(0, 8).map((x) => `<li>${esc(M.typVon(x.typ).kurz)}: ${name(x)}</li>`).join('')}${xs.length > 8 ? `<li class="mute">und ${xs.length - 8} weitere</li>` : ''}</ul>` : '');
    let wahl = null;
    const o = showOverlay(`
      <div class="sheet-wrap"><div class="sheet" role="dialog" aria-label="Drehtag abschließen">
        <h2>Drehtag abschließen</h2>
        <p><b>${s.gedreht} von ${s.gesamt} Shots gedreht.</b>${!s.offen.length ? ' Nichts liegen geblieben.' : ''}</p>
        ${liste('Nicht gedreht', s.offen)}
        ${liste('Optional, nicht gedreht', s.optionalOffen)}
        <p class="mute">Der Status wird „Gedreht“. Nicht Gedrehtes bleibt in der Shotliste offen.</p>
        <button class="sheet-opt" data-w="claude"><b>Abschließen und an Claude geben</b><span>„Datei für Claude“ teilen: Clips zuordnen, Schnitt-Übergabe</span></button>
        <button class="sheet-opt" data-w="nur"><b>Nur abschließen</b><span>Später weitergeben</span></button>
        <button class="btn big" data-w="zu">Abbrechen</button>
      </div></div>`, { onClose: () => danach() });
    const danach = async () => {
      if (!wahl) return;
      await mitRueckgaengig(id, 'Drehtag abgeschlossen', () => aendereTag(id, 'basis', (t) => { t.status = 'gedreht'; t.abgeschlossen = Date.now(); }));
      if (location.hash !== '#/tag/' + id) location.hash = '#/tag/' + id;
      if (wahl === 'claude') await aktionen['share-datei'](id);
    };
    o.el.querySelector('.sheet').addEventListener('click', (e) => {
      const b2 = e.target.closest('[data-w]');
      if (!b2) return;
      wahl = b2.dataset.w === 'zu' ? null : b2.dataset.w;
      o.close();
    });
  },
  async 'tag-oeffnen'(id) {
    await mitRueckgaengig(id, 'Drehtag wieder geöffnet', () => aendereTag(id, 'basis', (t) => { t.abgeschlossen = 0; if (t.status === 'gedreht') t.status = 'drehbereit'; }));
  },

  // Briefing
  async 'set-dazu'(id, b) {
    let neu = 0;
    await aendereTag(id, 'briefing', (br) => { neu = M.frageSetDazu(br.fragen, b.dataset.set); });
    toast(`${anzahl(neu, 'Frage', 'Fragen')} dazu`);
    render();
  },
  async 'del-frage'(id, b) {
    const tag = await db.get('drehtage', b.dataset.tag);
    if (!tag) return;
    await mitRueckgaengig(tag.id, 'Frage gelöscht', () => aendereTag(tag.id, 'briefing', (br) => { br.fragen = br.fragen.filter((x) => x.id !== id); }));
  },
  async 'fragen-standard'(id) {
    const tag = await buendelHolen(id);
    const fragen = (tag.drehtag.briefing?.fragen || []).map((f) => ({ set: f.set, frage: f.frage }));
    await db.setMeta('fragenVorlage', fragen);
    toast(`Neue Drehtage starten mit diesen ${fragen.length} Fragen`);
  },

  // Zeitplan
  async 'add-block'(id) {
    await aendereTag(id, 'zeitplan', (p) => { p.bloecke.push({ id: db.uid(), titel: '', dauer: 30, locationId: '', hinweis: '' }); });
    await render();
    const felder = app().querySelectorAll('.block input[name="titel"]');
    felder[felder.length - 1]?.focus();
  },
  async 'del-block'(id, b) {
    await aendereTag(b.dataset.tag, 'zeitplan', (p) => { p.bloecke = p.bloecke.filter((x) => x.id !== id); });
    render();
  },
  async 'move-block'(id, b) {
    await aendereTag(b.dataset.tag, 'zeitplan', (p) => verschieben(p.bloecke, id, Number(b.dataset.dir)));
    render();
  },
  async 'bloecke-aus-orten'(id) {
    const orte = (await db.byIndex('locations', 'drehtagId', id)).sort(nachPos);
    let neu = 0;
    await aendereTag(id, 'zeitplan', (p) => {
      const leer = !p.bloecke.length;
      const fehlend = orte.filter((l) => !p.bloecke.some((x) => x.locationId === l.id));
      if (leer) p.bloecke.push({ id: db.uid(), titel: 'Ankommen und Aufbau', dauer: 30, locationId: '', hinweis: '' });
      for (const l of fehlend) p.bloecke.push({ id: db.uid(), titel: l.name, dauer: 30, locationId: l.id, hinweis: '' });
      if (leer) p.bloecke.push({ id: db.uid(), titel: 'Abbau', dauer: 15, locationId: '', hinweis: '' });
      neu = fehlend.length;
    });
    toast(neu ? `${anzahl(neu, 'Block', 'Blöcke')} aus Locations. Dauer bitte anpassen.` : 'Alle Locations sind schon im Plan');
    render();
  },

  // Packliste
  async 'del-posten'(id, b) {
    await aendereTag(b.dataset.tag, 'packliste', (p) => { p.posten = p.posten.filter((x) => x.id !== id); });
    render();
  },
  async 'pack-standard'(id) {
    const tag = await db.get('drehtage', id);
    const namen = (tag.packliste?.posten || []).map((p) => p.name);
    await db.setMeta('packVorlage', namen);
    toast(`Neue Drehtage starten mit diesen ${namen.length} Posten`);
  },
  async 'pack-reset'(id) {
    await aendereTag(id, 'packliste', (p) => { for (const x of p.posten) x.ok = false; });
    render();
  },

  async 'backup-export'() {
    const n = await exportBackup();
    toast(`Backup mit ${anzahl(n, 'Drehtag', 'Drehtagen')} gespeichert`);
    render();
  },
};

// ---------- Ereignisse ----------

async function beiKlick(e) {
  const b = e.target.closest('[data-action]');
  if (!b || !app().contains(b)) return;
  try {
    await aktionen[b.dataset.action]?.(b.dataset.id, b);
  } catch (err) {
    console.error(err);
    toast('Fehler: ' + err.message);
  }
}

function beiEingabe(e) {
  const el = e.target;
  if (el.id === 'suche') { z.suche = el.value; sucheFuellen(); return; }
  if (el.matches('textarea.auto')) wachsen(el);
  if (!el.closest('[data-save]')) return;
  speichern(el);
  // Wortzahl und Teleprompter-Knöpfe gleich mitführen
  if (el.name === 'text') {
    const leer = !el.value.trim();
    const stats = document.getElementById('text-stats');
    const knoepfe = document.getElementById('text-knoepfe');
    if (stats) { stats.textContent = stats.dataset.art === 'folien' ? folienText(el.value) : statsText(el.value); stats.hidden = leer; }
    if (knoepfe) knoepfe.hidden = leer;
  }
}

async function beiAenderung(e) {
  const el = e.target;
  if (!app().contains(el)) return;
  const form = el.closest('form[data-form]');
  try {
    if (el.dataset.change === 'toggle-shot') {
      await aendereZeile('shots', el.dataset.id, (s) => { s.erledigt = el.checked; s.erledigtUm = el.checked ? Date.now() : 0; });
      render();
    } else if (el.dataset.change === 'auch-an') {
      // Optionaler Shot: weitere mögliche Orte an- oder abwählen
      await allesGespeichert();
      await aendereZeile('shots', el.dataset.id, (s) => {
        const liste = new Set(s.auchAn || []);
        if (el.checked) liste.add(el.value); else liste.delete(el.value);
        s.auchAn = [...liste];
      });
      render();
    } else if (el.dataset.change === 'toggle-posten') {
      await aendereTag(el.dataset.tag, 'packliste', (p) => { const x = p.posten.find((q) => q.id === el.dataset.id); if (x) x.ok = el.checked; });
      render();
    } else if (el.dataset.change === 'add-photo') {
      const { felder } = await besitzer(el.dataset.owner, el.dataset.id);
      const dateien = [...el.files];
      for (const file of dateien) {
        await db.put('medien', { id: db.uid(), ...felder, art: 'foto', blob: await verkleinern(file), erstellt: Date.now() });
      }
      if (dateien.length > 1) toast(`${dateien.length} Fotos eingelesen`);
      render();
    } else if (el.dataset.change === 'import-datei') {
      const file = el.files[0];
      el.value = '';
      if (file) await einlesen(file);
    } else if (el.name === 'settingId' && el.value === '__neu') {
      // "+ Neues Setting …" auf der Shot-Seite: anlegen, zuordnen, Seite bleibt
      await allesGespeichert();
      const shot = await db.get('shots', el.closest('[data-save]').dataset.id);
      const name = prompt('Name des Settings, z. B. Position A – sitzend am Tisch:')?.trim();
      if (name) {
        const x = M.neuesSetting(name, shot.locationId || '');
        await aendereTag(shot.drehtagId, 'settings', (s) => { s.liste.push(x); });
        await aendereZeile('shots', shot.id, (s) => { s.settingId = x.id; });
      }
      render();
    } else if ((el.name === 'locationId' || el.name === 'videoId') && el.value === '__neu') {
      // "+ Neue Location …" oder "+ Neues Video …": Namen abfragen, anlegen und gleich auswählen
      const istOrt = el.name === 'locationId';
      const box = el.closest('[data-save="shot"]');
      await allesGespeichert();
      const shot = box ? await db.get('shots', box.dataset.id) : null;
      const entwurf = entwurfMerken();
      const neu = await neuAnlegen(istOrt ? 'locations' : 'videos', shot ? shot.drehtagId : form.dataset.id);
      if (neu && shot) await aendereZeile('shots', shot.id, (s) => { s[el.name] = neu.id; });
      if (form) {
        if (neu) { if (istOrt) z.letzteLocation = neu.id; else z.letztesVideo = neu.id; }
        entwurf[form.dataset.form][el.name] = istOrt ? z.letzteLocation : z.letztesVideo;
      }
      await render();
      entwurfZurueck(entwurf);
    } else if (form && !el.closest('[data-save]')) {
      // Auswahl in den Schnell-Formularen merken
      if (el.name === 'locationId') z.letzteLocation = el.value;
      if (el.name === 'videoId') z.letztesVideo = el.value;
      if (el.name === 'typ') {
        z.letzterTyp = el.value;
        if (form.elements.eingabe) form.elements.eingabe.placeholder = platzhalter(el.value);
      }
    } else if (el.closest('[data-save]')) {
      await speichern(el);
      if (el.hasAttribute('data-rerender')) render();
    }
  } catch (err) {
    console.error(err);
    toast('Fehler: ' + err.message);
  }
}

async function beiAbschicken(e) {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  const neuId = (v) => (v === '__neu' ? '' : v || '');
  try {
    if (f.dataset.form === 'tag') {
      const jetzt = Date.now();
      // Häkchen "set_makler" usw. sind keine Felder des Drehtags, sondern zusätzliche Fragen-Sets
      const sets = Object.keys(d).filter((k) => k.startsWith('set_')).map((k) => k.slice(4));
      for (const k of Object.keys(d)) if (k.startsWith('set_')) delete d[k];
      let tag;
      if (f.dataset.id) {
        tag = { ...(await db.get('drehtage', f.dataset.id)), ...d };
      } else {
        const [fragen, pack] = await Promise.all([db.getMeta('fragenVorlage'), db.getMeta('packVorlage')]);
        tag = {
          ...d, id: db.uid(), erstellt: jetzt,
          briefing: { geaendert: jetzt, fragen: M.neueFragen(fragen) },
          packliste: { geaendert: jetzt, posten: M.neuePosten(pack) },
          zeitplan: { geaendert: jetzt, bloecke: [], kundenhinweis: '' },
        };
        for (const s of sets) M.frageSetDazu(tag.briefing.fragen, s);
      }
      tag.kunde = d.kunde.trim();
      tag.basisGeaendert = jetzt;
      await db.put('drehtage', tag);
      // Den Browser bitten, die Daten nicht von sich aus wegzuräumen
      navigator.storage?.persist?.().catch(() => {});
      location.replace('#/tag/' + tag.id + (f.dataset.ziel ? '/' + f.dataset.ziel : ''));
    } else if (f.dataset.form === 'quick') {
      const eingabe = d.eingabe.trim();
      if (!eingabe) return;
      z.letzterTyp = d.typ;
      z.letzteLocation = neuId(d.locationId);
      if (f.elements.videoId?.type !== 'hidden') z.letztesVideo = neuId(d.videoId);
      // Bei Hook und CTA ist das Eingetippte der Sprechtext, sonst der Titel
      await db.put('shots', {
        id: db.uid(), drehtagId: f.dataset.id, typ: d.typ,
        titel: istSpruch(d.typ) ? '' : eingabe, text: istSpruch(d.typ) ? eingabe : '',
        locationId: neuId(d.locationId), videoId: neuId(d.videoId),
        format: 'hochkant', erledigt: false, favorit: false, take: '', notiz: '', pos: Date.now(),
      });
      await render();
      app().querySelector('.quick input[name="eingabe"]')?.focus();
    } else if (f.dataset.form === 'ort') {
      const name = d.name.trim();
      if (!name) return;
      await db.put('locations', { id: db.uid(), drehtagId: f.dataset.id, name, notiz: '', pos: Date.now() });
      await render();
      app().querySelector('.quick-ort input[name="name"]')?.focus();
    } else if (f.dataset.form === 'frage') {
      const frage = d.frage.trim();
      if (!frage) return;
      await aendereTag(f.dataset.id, 'briefing', (b) => { b.fragen.push({ id: db.uid(), set: 'eigene', frage, antwort: '' }); });
      await render();
      app().querySelector('form[data-form="frage"] input')?.focus();
    } else if (f.dataset.form === 'posten') {
      const name = d.name.trim();
      if (!name) return;
      await aendereTag(f.dataset.id, 'packliste', (p) => { p.posten.push({ id: db.uid(), name, ok: false }); });
      await render();
      app().querySelector('form[data-form="posten"] input')?.focus();
    } else if (f.dataset.form === 'hooks') {
      const hooks = hooksAusText(d.text);
      if (!hooks.length) { toast('Kein Hook erkannt. Eine Zeile pro Hook.'); return; }
      z.letztesVideo = neuId(d.videoId);
      z.letzteLocation = neuId(d.locationId);
      const basis = Date.now();
      for (const [i, text] of hooks.entries()) {
        await db.put('shots', {
          id: db.uid(), drehtagId: f.dataset.id, typ: 'hook', titel: '', text,
          locationId: z.letzteLocation, videoId: z.letztesVideo,
          format: 'hochkant', erledigt: false, favorit: false, take: '', notiz: '', pos: basis + i,
        });
      }
      toast(`${anzahl(hooks.length, 'Hook', 'Hooks')} angelegt`);
      location.hash = '#/tag/' + f.dataset.id;
    }
  } catch (err) {
    console.error(err);
    toast('Fehler: ' + err.message);
  }
}

export function init(r) {
  render = r;
  document.addEventListener('click', beiKlick);
  document.addEventListener('input', beiEingabe);
  document.addEventListener('change', beiAenderung);
  document.addEventListener('submit', beiAbschicken);
}
