// Ansichten: Jede Funktion liefert das HTML für eine Seite der App.
// Hier wird nur angezeigt. Was beim Tippen passiert, steht in aktionen.js.
import * as db from './db.js';
import { esc, fmtDatum, heute } from './util.js';
import {
  TYPEN, STATUS, FRAGEN_SETS, typVon, statusVon, gruppieren, shotName,
  videoStand, videoStandText, zeitplanMitZeiten, zeitplanMinuten,
  fadenStand, fadenZeit, SCHAETZUNG, SETTING_FELDER, settingsVon, settingVon, settingKurz,
  sonnenText, sonneVon, sonnenHinweis, uhrAusMin,
} from './modell.js';
import { z, bildUrl, nachPos, anzahl, statsText, folienText, istLang, platzhalter, woerter } from './zustand.js';
import { fernbedienungKarte } from './fernbedienung.js';
import { istNativ, appFassung } from './nativ.js';

// ---------- Bausteine ----------

const zurueck = (href) => `<a class="back" href="${href}" aria-label="Zurück">‹</a>`;

function auswahl(liste, gewaehlt, ohne, neu) {
  return `
    <option value="">${ohne}</option>
    ${[...liste].sort(nachPos).map((x) => `<option value="${x.id}" ${x.id === gewaehlt ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
    ${neu ? `<option value="__neu">${neu}</option>` : ''}`;
}
const ortOptionen = (locations, gewaehlt, neu = true) => auswahl(locations, gewaehlt, 'Ohne Location', neu && '+ Neue Location …');
const videoOptionen = (videos, gewaehlt, neu = true) => auswahl(videos, gewaehlt, 'Ohne Video', neu && '+ Neues Video …');
const typOptionen = (gewaehlt) =>
  TYPEN.map((t) => `<option value="${t.id}" ${t.id === gewaehlt ? 'selected' : ''}>${t.label}</option>`).join('');

const statusBadge = (id) => `<span class="status st-${statusVon(id).id}">${statusVon(id).label}</span>`;

// Bilder-Raster mit den Knöpfen "+ Foto" und "+ Skizze"
function medienBlock(medien, owner, id, { skizze = true, mehrere = true } = {}) {
  const sortiert = [...medien].sort((a, b) => a.erstellt - b.erstellt);
  return `
    ${sortiert.length
      ? `<div class="grid">${sortiert.map((m) =>
          `<button class="thumb" data-action="open-media" data-id="${m.id}" aria-label="${m.art === 'skizze' ? 'Skizze' : 'Foto'} öffnen"><img src="${bildUrl(m.blob)}" alt="">${m.strokes?.length && m.art === 'foto' ? '<i class="bemalt">✎</i>' : ''}</button>`).join('')}</div>`
      : '<p class="mute">Noch nichts angehängt.</p>'}
    <div class="btn-row">
      <label class="btn">+ Foto<input type="file" accept="image/*" ${mehrere ? 'multiple' : ''} hidden data-change="add-photo" data-owner="${owner}" data-id="${id}"></label>
      ${skizze ? `<button class="btn" data-action="add-sketch" data-owner="${owner}" data-id="${id}">+ Skizze</button>` : ''}
    </div>`;
}

// ---------- Startseite ----------

export async function viewHome() {
  const [tage, shots, videos, backup] = await Promise.all([
    db.getAll('drehtage'), db.getAll('shots'), db.getAll('videos'), db.getMeta('letztesBackup'),
  ]);
  const h = heute();
  const echte = tage.filter((t) => !t.vorlage);
  const vorlagen = tage.filter((t) => t.vorlage).sort((a, b) => a.kunde.localeCompare(b.kunde));
  const kommend = echte
    .filter((t) => !t.datum || t.datum >= h)
    .sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999') || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''));
  const vorbei = echte.filter((t) => t.datum && t.datum < h).sort((a, b) => b.datum.localeCompare(a.datum));

  const karte = (t) => {
    const ss = shots.filter((s) => s.drehtagId === t.id);
    const vv = videos.filter((v) => v.drehtagId === t.id);
    const fertig = ss.filter((s) => s.erledigt).length;
    const meta = [fmtDatum(t.datum), t.uhrzeit ? t.uhrzeit + ' Uhr' : '', t.ort].filter(Boolean).join(' · ');
    return `
      <a class="card" href="#/tag/${t.id}">
        <div class="tag-kunde">${esc(t.kunde)}${t.datum === h ? '<span class="badge">Heute</span>' : ''}</div>
        <div class="tag-meta">${esc(meta)}</div>
        <div class="tag-zeile">${statusBadge(t.status)}<span class="mute">${vv.length ? anzahl(vv.length, 'Video', 'Videos') + ' · ' : ''}${ss.length ? `${fertig}/${ss.length} Shots` : 'Noch keine Shots'}</span></div>
        <div class="bar"><i style="width:${ss.length ? (fertig / ss.length) * 100 : 0}%"></i></div>
      </a>`;
  };
  const vorlageKarte = (t) => `
    <div class="card vorlage">
      <div><b>${esc(t.kunde)}</b><br><span class="mute">${anzahl(shots.filter((s) => s.drehtagId === t.id).length, 'Shot', 'Shots')}</span></div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn primary" data-action="aus-vorlage" data-id="${t.id}">Neuer Drehtag daraus</button>
        <a class="btn" href="#/tag/${t.id}">Bearbeiten</a>
      </div>
    </div>`;

  return `
    <header class="top"><h1>Drehtage</h1><a class="top-btn" href="#/sicherung">Sicherung</a></header>
    <main>
      <a class="btn primary big start-btn" href="#/neu/erstgespraech">+ Neues Erstgespräch</a>
      ${tage.length ? `<input type="search" id="suche" class="suche" placeholder="Suchen: Kunde, Hook, Notiz …" value="${esc(z.suche)}" autocomplete="off">` : ''}
      <div id="suchtreffer"></div>
      <div id="liste" ${z.suche ? 'hidden' : ''}>
        ${echte.length ? '' : '<p class="leer">Noch kein Drehtag angelegt.<br>Oben mit dem Erstgespräch anfangen oder unten rechts „+ Neu“.</p>'}
        ${echte.filter((t) => t.datum === h).map((t) => `<a class="btn primary big faden-start" href="#/faden/${t.id}">▶ Drehtag starten: ${esc(t.kunde)}</a>`).join('')}
        ${kommend.map(karte).join('')}
        ${vorbei.length ? `<p class="abschnitt">Vergangene</p>${vorbei.map(karte).join('')}` : ''}
        ${vorlagen.length ? `<p class="abschnitt">Vorlagen</p>${vorlagen.map(vorlageKarte).join('')}` : ''}
        ${tage.length ? `<p class="mute" style="text-align:center;margin-top:18px">${backup ? 'Letztes Backup: ' + new Date(backup).toLocaleDateString('de-DE') : 'Noch kein Backup gemacht'}</p>` : ''}
      </div>
    </main>
    <button class="fab" data-action="neu-menu">+ Neu</button>`;
}

// Suchergebnisse über alle Drehtage. Wird beim Tippen neu gefüllt, ohne die Seite neu aufzubauen.
export async function sucheHtml(q) {
  const s = q.trim().toLowerCase();
  if (!s) return '';
  const passt = (...felder) => felder.some((f) => String(f || '').toLowerCase().includes(s));
  const [tage, shots, locations, videos] = await Promise.all(['drehtage', 'shots', 'locations', 'videos'].map((n) => db.getAll(n)));
  const tagVon = (id) => tage.find((t) => t.id === id);
  const treffTage = tage.filter((t) => passt(t.kunde, t.ort, t.notizen, t.ansprechpartner,
    ...(t.briefing?.fragen || []).map((f) => f.antwort),
    ...locations.filter((l) => l.drehtagId === t.id).flatMap((l) => [l.name, l.notiz]),
    ...videos.filter((v) => v.drehtagId === t.id).flatMap((v) => [v.name, v.notiz])));
  const treffShots = shots.filter((x) => tagVon(x.drehtagId) && passt(x.titel, x.text, x.notiz, x.take)).slice(0, 40);
  if (!treffTage.length && !treffShots.length) return '<p class="leer">Nichts gefunden.</p>';
  return `
    ${treffTage.length ? `<p class="abschnitt">Drehtage</p>${treffTage.map((t) => `
      <a class="card treffer" href="#/tag/${t.id}"><b>${esc(t.kunde)}</b><span class="mute">${esc(fmtDatum(t.datum))}${t.vorlage ? ' · Vorlage' : ''}</span></a>`).join('')}` : ''}
    ${treffShots.length ? `<p class="abschnitt">Shots</p>${treffShots.map((x) => `
      <a class="card treffer" href="#/shot/${x.id}">
        <span class="tag tag-${typVon(x.typ).id}">${typVon(x.typ).kurz}</span>
        <b>${esc(shotName(x))}</b>
        ${x.titel && x.text ? `<span class="treffer-text">${esc(x.text.slice(0, 140))}</span>` : ''}
        <span class="mute">${esc(tagVon(x.drehtagId).kunde)}</span>
      </a>`).join('')}` : ''}`;
}

// ---------- Drehtag anlegen und bearbeiten ----------

// Kurzform für den Anfang: Kunde und Kontakt, danach direkt ins Briefing
function viewErstgespraechForm() {
  return `
    <header class="top">
      ${zurueck('#/')}
      <h1>Neues Erstgespräch</h1>
    </header>
    <main>
      <form class="card form" data-form="tag" data-id="" data-ziel="briefing">
        <input type="hidden" name="status" value="erstgespraech">
        <label>Kunde <input name="kunde" required autocomplete="off" placeholder="Firma oder Name"></label>
        <label>Ansprechpartner <input name="ansprechpartner" autocomplete="off"></label>
        <label>Telefon <input type="tel" name="telefon" autocomplete="off"></label>
        <label>Ort / Adresse (optional) <input name="ort" autocomplete="off"></label>
        <div class="field">Zusätzliche Fragen
          ${FRAGEN_SETS.slice(1).map((s) => `<label class="check-row"><input type="checkbox" class="chk" name="set_${s.id}"> ${s.label}</label>`).join('')}
        </div>
        <p class="mute">Datum und Drehbeginn trägst du später ein, wenn der Dreh feststeht.</p>
        <button class="btn primary big" type="submit">Weiter zu den Fragen</button>
      </form>
    </main>`;
}

export function viewTagForm(tag, art) {
  if (!tag && art === 'erstgespraech') return viewErstgespraechForm();
  const v = (k) => esc(tag?.[k] || '');
  return `
    <header class="top">
      ${zurueck(tag ? '#/tag/' + tag.id : '#/')}
      <h1>${tag ? (tag.vorlage ? 'Vorlage bearbeiten' : 'Drehtag bearbeiten') : 'Neuer Drehtag'}</h1>
    </header>
    <main>
      <form class="card form" data-form="tag" data-id="${tag?.id || ''}">
        <label>${tag?.vorlage ? 'Name der Vorlage' : 'Kunde'} <input name="kunde" required value="${v('kunde')}" autocomplete="off"></label>
        ${tag?.vorlage ? '' : `
        <div class="row2">
          <label>Datum <input type="date" name="datum" value="${v('datum')}"></label>
          <label>Drehbeginn <input type="time" name="uhrzeit" value="${v('uhrzeit')}"></label>
        </div>`}
        <label>Ort / Adresse <input name="ort" value="${v('ort')}" autocomplete="off"></label>
        <label>Koordinaten für den Sonnenstand
          <input name="koordinaten" value="${v('koordinaten')}" placeholder="z. B. 51.0504, 6.2214 oder Maps-Link" autocomplete="off" inputmode="text">
        </label>
        <p class="mute" style="margin-top:-6px">In Google Maps lange auf den Ort drücken, die Zahlen oben kopieren und hier einfügen. Vor Ort geht auch:</p>
        <button class="btn" type="button" data-action="standort-hier">📍 Aktuellen Standort nehmen</button>
        <label>Ansprechpartner <input name="ansprechpartner" value="${v('ansprechpartner')}" autocomplete="off"></label>
        <label>Telefon <input type="tel" name="telefon" value="${v('telefon')}" autocomplete="off"></label>
        ${tag?.vorlage ? '' : `<label>Status <select name="status">${STATUS.map((s) => `<option value="${s.id}" ${s.id === statusVon(tag?.status).id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>`}
        <label>Notizen <textarea name="notizen" rows="4">${v('notizen')}</textarea></label>
        <button class="btn primary big" type="submit">Speichern</button>
        ${tag ? `<button class="btn danger big" type="button" data-action="del-tag" data-id="${tag.id}">${tag.vorlage ? 'Vorlage' : 'Drehtag'} löschen</button>` : ''}
      </form>
    </main>`;
}

// ---------- Drehtag ----------

function infoKarte(tag) {
  const wann = [tag.datum ? fmtDatum(tag.datum) : '', tag.uhrzeit ? tag.uhrzeit + ' Uhr' : ''].filter(Boolean).join(', ');
  const leer = !wann && !tag.ort && !tag.ansprechpartner && !tag.telefon && !tag.notizen;
  const knopf = (action, text, extra = '') => `<button class="btn" data-action="${action}" data-id="${tag.id}" ${extra}>${text}</button>`;
  return `
    <section class="card">
      ${tag.vorlage ? '<p class="hinweis">Das ist eine Vorlage. Auf der Startseite wird daraus ein neuer Drehtag.</p>' : ''}
      ${wann ? `<div class="info-row"><span>Wann</span><b>${esc(wann)}</b></div>` : ''}
      ${tag.ort ? `<div class="info-row"><span>Ort</span><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tag.ort)}" target="_blank" rel="noopener">${esc(tag.ort)}</a></div>` : ''}
      ${sonnenText(tag) ? `<div class="info-row"><span>Sonne</span><div>${esc(sonnenText(tag))}</div></div>` : ''}
      ${tag.ansprechpartner || tag.telefon ? `<div class="info-row"><span>Kontakt</span><div>${esc(tag.ansprechpartner || '')} ${tag.telefon ? `<a href="tel:${esc(tag.telefon.replace(/[^\d+]/g, ''))}">${esc(tag.telefon)}</a>` : ''}</div></div>` : ''}
      ${tag.notizen ? `<p class="notiz">${esc(tag.notizen)}</p>` : ''}
      ${leer ? '<p class="mute">Noch keine Angaben. Oben auf „Bearbeiten“ tippen.</p>' : ''}
      ${tag.vorlage ? '' : `
      <label class="status-zeile" data-save="tagfeld" data-id="${tag.id}">Status
        <select name="status">${STATUS.map((s) => `<option value="${s.id}" ${s.id === statusVon(tag.status).id ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      </label>`}
      <button class="aufklapp" data-action="toggle-info">${z.infoOffen ? 'Teilen und Export ▴' : 'Teilen und Export ▾'}</button>
      ${z.infoOffen ? `
      <div class="export">
        ${knopf('share-shotlist', 'Shotliste teilen')}
        ${knopf('share-zeitplan', 'Zeitplan an Kunden')}
        ${knopf('print-zeitplan', 'Zeitplan als PDF')}
        ${knopf('share-schnitt', 'Schnitt-Übergabe')}
        ${knopf('share-briefing', 'Briefing als Text')}
        ${knopf('share-datei', 'Datei für Claude')}
        ${tag.datum ? knopf('kalender-google', 'Google Kalender') + knopf('kalender-ics', 'Kalender-Datei') : ''}
        ${knopf('dup-tag', 'Duplizieren')}
        ${tag.vorlage ? '' : knopf('vorlage-tag', 'Als Vorlage sichern')}
      </div>` : ''}
    </section>`;
}

// Sprachnotizen: nach dem Telefonat einsprechen, Claude transkribiert am PC
const minSek = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`;
function sprachnotizKarte(tag, medien) {
  const notizen = medien.filter((m) => m.art === 'audio').sort((a, b) => b.erstellt - a.erstellt);
  return `
    <section class="card">
      <h2>Sprachnotiz nach dem Gespräch</h2>
      <p class="mute" style="margin-bottom:10px">Nach dem Telefonat alles Wichtige einsprechen. Die offenen Fragen stehen dabei auf dem Bildschirm. Am PC transkribiert Whisper die Aufnahme, und Claude füllt daraus das Briefing.</p>
      <button class="btn primary big" data-action="sprachnotiz" data-id="${tag.id}">● Sprachnotiz aufnehmen</button>
      ${notizen.map((m) => `
        <div class="audio-notiz">
          <div class="kopfzeile">
            <b>${new Date(m.erstellt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</b>
            <span class="mute">${minSek(m.dauer)} Min.</span>
          </div>
          <audio controls preload="metadata" src="${bildUrl(m.blob)}"></audio>
          ${m.transkript
            ? `<details><summary>Transkript</summary><p class="transkript">${esc(m.transkript)}</p></details>`
            : '<p class="mute">Noch nicht transkribiert. Mit „Datei für Claude“ an den PC geben.</p>'}
          <button class="mini" data-action="del-audio" data-id="${m.id}">Löschen</button>
        </div>`).join('')}
    </section>`;
}

// Reiter "Briefing": Erstgespräch, Weg zu Claude, Hooks einfügen
function tabBriefing(tag, locations, videos, medien = []) {
  const fragen = tag.briefing?.fragen || [];
  const beantwortet = fragen.filter((f) => (f.antwort || '').trim()).length;
  const fehlende = FRAGEN_SETS.filter((s) => s.fragen.some((fr) => !fragen.some((f) => f.frage === fr)));
  const frageZeile = (f) => z.bearbeiten
    ? `<div class="frage-edit" data-save="frage" data-tag="${tag.id}" data-id="${f.id}">
         <input name="frage" value="${esc(f.frage)}" aria-label="Frage">
         <button class="move" data-action="del-frage" data-tag="${tag.id}" data-id="${f.id}" aria-label="Frage löschen">✕</button>
       </div>`
    : `<label class="frage" data-save="frage" data-tag="${tag.id}" data-id="${f.id}">${esc(f.frage)}
         <textarea name="antwort" class="auto" rows="1">${esc(f.antwort)}</textarea>
       </label>`;
  return `
    ${sprachnotizKarte(tag, medien)}
    <section class="card form">
      <div class="kopfzeile"><h2>Erstgespräch</h2><span class="mute">${beantwortet}/${fragen.length} beantwortet</span></div>
      ${fragen.length ? fragen.map(frageZeile).join('') : '<p class="mute">Noch keine Fragen. Unten ein Fragen-Set dazunehmen.</p>'}
      ${z.bearbeiten ? `
        <form class="quick quick-ort" data-form="frage" data-id="${tag.id}">
          <input name="frage" placeholder="Neue Frage …" required autocomplete="off" enterkeyhint="done">
          <button class="btn primary" type="submit" aria-label="Frage hinzufügen">+</button>
        </form>
        <button class="btn" data-action="fragen-standard" data-id="${tag.id}">Diese Fragen für neue Drehtage nehmen</button>` : ''}
      <div class="btn-row" style="margin-top:4px">
        ${fehlende.map((s) => `<button class="btn" data-action="set-dazu" data-id="${tag.id}" data-set="${s.id}">+ ${s.label}</button>`).join('')}
        <button class="btn ${z.bearbeiten ? 'an' : ''}" data-action="toggle-bearbeiten">${z.bearbeiten ? 'Fertig' : 'Fragen bearbeiten'}</button>
      </div>
    </section>
    <section class="card">
      <h2>Hooks und Skripte mit Claude</h2>
      <ol class="schritte">
        <li><b>Datei für Claude</b> teilen und in den Drehtag-Ordner am PC legen (zum Beispiel über Google Drive).</li>
        <li>In Claude am PC: „Lies den Drehtag ${esc(tag.kunde)} und schreib Hooks“. Claude trägt sie direkt in die Datei ein.</li>
        <li>Die Datei hier wieder <b>einlesen</b>. Neue Hooks und Skripte landen in der Shotliste.</li>
      </ol>
      <div class="btn-row">
        <button class="btn primary" data-action="share-datei" data-id="${tag.id}">Datei für Claude</button>
        <label class="btn">Datei einlesen<input type="file" hidden data-change="import-datei"></label>
        <button class="btn" data-action="share-briefing" data-id="${tag.id}">Briefing als Text</button>
      </div>
    </section>
    <section class="card">
      <h2>Hooks einfügen</h2>
      <form class="form" data-form="hooks" data-id="${tag.id}">
        <textarea name="text" rows="5" placeholder="Eine Zeile pro Hook. Nummern, Spiegelstriche und Anführungszeichen werden entfernt."></textarea>
        <div class="row2">
          <select name="videoId" aria-label="Video">${videoOptionen(videos, z.letztesVideo)}</select>
          <select name="locationId" aria-label="Location">${ortOptionen(locations, z.letzteLocation)}</select>
        </div>
        <button class="btn primary big" type="submit">Als Hooks anlegen</button>
      </form>
    </section>`;
}

// Eine Shot-Zeile zum Abhaken. Wird in der Shotliste, bei den Orten und auf der Location-Seite benutzt.
// modus sagt, wonach gerade gruppiert ist; diese Angabe steht dann nicht noch einmal in der Zeile.
function shotZeile(s, i, gruppe, { locations = [], videos = [], medien = [], settings = [], modus = "art", sortierbar = false }) {
  const bilder = medien.filter((m) => m.shotId === s.id).sort((a, b) => a.erstellt - b.erstellt);
  const ort = locations.find((l) => l.id === s.locationId);
  const video = videos.find((v) => v.id === s.videoId);
  const typ = typVon(s.typ);
  // modus 'beides': gruppiert nach Location und Video, beides steht schon in den Überschriften
  const meta = [
    modus === 'location' || modus === 'beides' ? '' : ort?.name,
    modus === 'video' || modus === 'beides' ? '' : video?.name,
    settings.find((x) => x.id === s.settingId)?.name,
    s.format,
    bilder.length ? anzahl(bilder.length, 'Bild', 'Bilder') : '',
  ].filter(Boolean).join(' · ');
  const lang = istLang(s.text);
  const offen = z.aufgeklappt.has(s.id);
  return `
    <li class="shot typ-${typ.id} ${s.erledigt ? 'fertig' : ''}">
      <div class="shot-kopf">
        <input type="checkbox" class="chk" data-change="toggle-shot" data-id="${s.id}" ${s.erledigt ? 'checked' : ''} aria-label="Erledigt">
        <a class="shot-main" href="#/shot/${s.id}">
          ${modus !== 'art' || s.favorit ? `<span class="schilder">${modus !== 'art' ? `<span class="tag tag-${typ.id}">${typ.kurz}</span>` : ''}${s.favorit ? '<span class="fav">★ Favorit</span>' : ''}</span>` : ''}
          ${s.titel ? `<span class="shot-titel">${esc(s.titel)}</span>` : ''}
          ${s.text ? `<span class="shot-text ${!s.titel && !lang ? 'solo' : ''} ${lang && !offen ? 'gekuerzt' : ''}">${esc(s.text)}</span>` : ''}
          ${!s.titel && !s.text ? '<span class="shot-titel">Ohne Titel</span>' : ''}
          ${s.take ? `<span class="shot-take">Take: ${esc(s.take)}</span>` : ''}
          ${s.clips?.length ? `<span class="shot-take">Clips: ${esc(s.clips.join(', '))}</span>` : ''}
          ${meta ? `<span class="shot-meta">${esc(meta)}</span>` : ''}
        </a>
        ${sortierbar && z.sortieren
          ? `<button class="move" data-action="move-shot" data-id="${s.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button>
             <button class="move" data-action="move-shot" data-id="${s.id}" data-dir="1" ${i === gruppe.length - 1 ? 'disabled' : ''} aria-label="Nach unten">▼</button>`
          : bilder.length ? `<img class="shot-thumb" src="${bildUrl(bilder[0].blob)}" alt="">` : ''}
      </div>
      ${lang
        ? `<div class="shot-aktionen">
             <button class="mini" data-action="toggle-text" data-id="${s.id}">${offen ? 'Weniger' : 'Ganzer Text'}</button>
             ${s.typ === 'karussell' ? '' : `<button class="mini" data-action="prompt-text" data-id="${s.id}">▶ Prompter</button>`}
           </div>`
        : ''}
    </li>`;
}

// Reiter "Shots": Fortschritt, Schnell-Anlegen und die Liste in Gruppen
function tabShots(tag, shots, locations, videos, medien) {
  const id = tag.id;
  const fertig = shots.filter((s) => s.erledigt).length;
  const modus = z.gruppierung;

  const zeile = (s, i, gruppe) => shotZeile(s, i, gruppe, { locations, videos, medien, settings: settingsVon(tag), modus, sortierbar: true });

  const kopf = (g) => {
    if (modus === 'location' && g.id) return `<a href="#/ort/${g.id}">${esc(g.label)} ›</a>`;
    if (modus === 'video' && g.id) return `<a href="#/video/${g.id}">${esc(g.label)} ›</a>`;
    return `<span>${esc(g.label)}</span>`;
  };

  return `
    <div class="card">
      <div class="bar"><i style="width:${shots.length ? (fertig / shots.length) * 100 : 0}%"></i></div>
      <div class="bar-text">${fertig}/${shots.length} Shots erledigt</div>
      <div class="seg seg3" style="margin-top:12px" role="group" aria-label="Aufteilung der Liste">
        ${[['art', 'Art'], ['location', 'Location'], ['video', 'Video']].map(([m, l]) =>
          `<button data-action="set-gruppe" data-id="${m}" class="${modus === m ? 'an' : ''}">${l}</button>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn" data-action="share-shotlist" data-id="${id}">Shotliste teilen</button>
        <button class="btn ${z.sortieren ? 'an' : ''}" data-action="toggle-sort">Sortieren</button>
      </div>
    </div>
    <form class="quick quick3" data-form="quick" data-id="${id}">
      <select name="typ" aria-label="Art">${typOptionen(z.letzterTyp)}</select>
      <select name="videoId" aria-label="Video">${videoOptionen(videos, z.letztesVideo)}</select>
      <select name="locationId" aria-label="Location">${ortOptionen(locations, z.letzteLocation)}</select>
      <input name="eingabe" placeholder="${platzhalter(z.letzterTyp)}" required autocomplete="off" enterkeyhint="done">
      <button class="btn primary" type="submit" aria-label="Shot hinzufügen">+</button>
    </form>
    ${shots.length ? '' : '<p class="leer">Noch keine Shots.<br>Art, Video und Location wählen, Text eintippen, auf + tippen.</p>'}
    ${gruppieren(shots, locations, videos, modus).map((g) => `
      <h2 class="grp ${modus === 'art' ? 'typ-' + g.id : ''}">${kopf(g)}<small>${g.shots.filter((s) => s.erledigt).length}/${g.shots.length}</small></h2>
      ${modus === 'video' && g.id ? `<p class="grp-stand">${esc(videoStandText(g.shots))}</p>` : ''}
      <ul class="shots">${g.shots.map(zeile).join('')}</ul>`).join('')}`;
}

// Shots einer Location, nach Video gruppiert, zum Abhaken
function ortShots(ss, { locations, videos, medien, settings = [] }) {
  return gruppieren(ss, [], videos, 'video').map((g) => `
    <p class="ort-video">
      ${g.id ? `<a href="#/video/${g.id}">${esc(g.label)} ›</a>` : `<span>${esc(g.label)}</span>`}
      <small>${g.shots.filter((s) => s.erledigt).length}/${g.shots.length}</small>
    </p>
    <ul class="shots shots-flach">${g.shots.map((s, j) => shotZeile(s, j, g.shots, { locations, videos, medien, settings, modus: 'beides' })).join('')}</ul>`).join('');
}

// Reiter "Orte": Exposé- und Scouting-Fotos, Locations mit Notizen, Bildern und ihren Shots zum Abhaken
function tabOrte(tag, shots, locations, videos, medien) {
  const id = tag.id;
  const korb = medien.filter((m) => !m.shotId && !m.locationId && m.art !== 'audio');
  const karte = (l, i) => {
    const ss = shots.filter((s) => s.locationId === l.id);
    const fertig = ss.filter((s) => s.erledigt).length;
    const bilder = medien.filter((m) => m.locationId === l.id).sort((a, b) => a.erstellt - b.erstellt);
    const offen = z.orteOffen.has(l.id);
    const info = [ss.length ? `${fertig}/${ss.length} Shots erledigt` : 'Noch keine Shots', bilder.length ? anzahl(bilder.length, 'Bild', 'Bilder') : '']
      .filter(Boolean).join(' · ');
    return `
      <div class="ort-wrap">
        <section class="card ort-card ${ss.length && fertig === ss.length ? 'ort-fertig' : ''}">
          <a class="ort-kopf" href="#/ort/${l.id}"><b>${esc(l.name)} ›</b>${ss.length && fertig === ss.length ? '<span class="ok">✓ fertig</span>' : ''}</a>
          ${ss.length ? `<div class="bar" style="margin-top:6px"><i style="width:${(fertig / ss.length) * 100}%"></i></div>` : ''}
          ${l.notiz ? `<span class="ort-notiz">${esc(l.notiz)}</span>` : ''}
          ${bilder.length ? `<span class="strip">${bilder.slice(0, 4).map((m) => `<img src="${bildUrl(m.blob)}" alt="">`).join('')}</span>` : ''}
          <small>${info}</small>
          ${ss.length ? `<button class="aufklapp" data-action="toggle-ort" data-id="${l.id}">${offen ? 'Shots ausblenden ▴' : `Shots abhaken · ${ss.length - fertig} offen ▾`}</button>` : ''}
          ${offen ? ortShots(ss, { locations, videos, medien, settings: settingsVon(tag) }) : ''}
        </section>
        ${z.sortieren
          ? `<div class="ort-move">
               <button class="move" data-action="move-ort" data-id="${l.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button>
               <button class="move" data-action="move-ort" data-id="${l.id}" data-dir="1" ${i === locations.length - 1 ? 'disabled' : ''} aria-label="Nach unten">▼</button>
             </div>`
          : ''}
      </div>`;
  };
  return `
    <section class="card">
      <h2>Exposé- und Scouting-Fotos</h2>
      <p class="mute" style="margin-bottom:10px">Viele Fotos auf einmal einlesen. Danach ein Foto antippen und einer Location zuordnen oder darauf zeichnen.</p>
      ${korb.length ? `<div class="grid">${korb.sort((a, b) => a.erstellt - b.erstellt).map((m) =>
        `<button class="thumb" data-action="open-media" data-id="${m.id}" aria-label="Foto öffnen"><img src="${bildUrl(m.blob)}" alt="">${m.strokes?.length ? '<i class="bemalt">✎</i>' : ''}</button>`).join('')}</div>` : ''}
      <div class="btn-row">
        <label class="btn primary">Fotos einlesen<input type="file" accept="image/*" multiple hidden data-change="add-photo" data-owner="korb" data-id="${id}"></label>
      </div>
    </section>
    <form class="quick quick-ort" data-form="ort" data-id="${id}">
      <input name="name" placeholder="Neue Location … z. B. Wohnzimmer" required autocomplete="off" enterkeyhint="done">
      <button class="btn primary" type="submit" aria-label="Location hinzufügen">+</button>
    </form>
    ${locations.length > 1
      ? `<div class="btn-row" style="margin-top:0"><button class="btn ${z.sortieren ? 'an' : ''}" data-action="toggle-sort">Reihenfolge ändern</button></div>
         <p class="mute" style="margin:8px 4px 0">Die Reihenfolge hier ist die Reihenfolge in der Shotliste.</p>`
      : ''}
    ${locations.length ? '' : '<p class="leer">Noch keine Location.<br>Leg die Räume oder Orte an, in denen gedreht wird.</p>'}
    ${locations.map(karte).join('')}`;
}

// Reiter "Plan": Zeitplan für den Kunden und Packliste
function tabPlan(tag, locations, absender, shots = []) {
  const plan = tag.zeitplan || { bloecke: [] };
  const bloecke = zeitplanMitZeiten(tag.uhrzeit, plan.bloecke);
  const ende = bloecke.length && bloecke[0].von ? bloecke[bloecke.length - 1].bis : '';
  const min = zeitplanMinuten(plan.bloecke);
  const posten = tag.packliste?.posten || [];
  const gepackt = posten.filter((p) => p.ok).length;
  const sonne = sonneVon(tag);
  // Nur bei Außen-Locations: liegt der Block im Hellen, in der Goldenen Stunde oder schon im Dunkeln?
  const sonnenZeile = (b) => {
    if (!locations.find((l) => l.id === b.locationId)?.aussen) return '';
    const h = sonnenHinweis(sonne, b.von, b.bis);
    return h ? `<p class="sonne-hinweis ${/dunkel|mittendrin/.test(h) ? 'warn' : ''}">☀ Außen: ${esc(h)}</p>` : '';
  };

  const block = (b, i) => `
    <div class="block" data-save="block" data-tag="${tag.id}" data-id="${b.id}">
      <div class="block-kopf">
        <span class="block-zeit">${b.von ? `${b.von}<br>${b.bis}` : `${b.dauer}′`}</span>
        <input name="titel" value="${esc(b.titel)}" placeholder="Was passiert?" aria-label="Ablauf">
        <button class="move" data-action="del-block" data-tag="${tag.id}" data-id="${b.id}" aria-label="Block löschen">✕</button>
      </div>
      <div class="block-zeile">
        <label class="dauer"><input type="number" name="dauer" value="${b.dauer}" min="0" step="5" inputmode="numeric" aria-label="Dauer in Minuten" data-rerender>′</label>
        <select name="locationId" aria-label="Location" data-rerender>${ortOptionen(locations, b.locationId, false)}</select>
        <button class="move" data-action="move-block" data-tag="${tag.id}" data-id="${b.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button>
        <button class="move" data-action="move-block" data-tag="${tag.id}" data-id="${b.id}" data-dir="1" ${i === bloecke.length - 1 ? 'disabled' : ''} aria-label="Nach unten">▼</button>
      </div>
      <input name="hinweis" value="${esc(b.hinweis)}" placeholder="Hinweis für den Kunden (optional)" aria-label="Hinweis">
      ${sonnenZeile(b)}
    </div>`;

  const postenZeile = (p) => z.bearbeiten
    ? `<div class="frage-edit" data-save="posten" data-tag="${tag.id}" data-id="${p.id}">
         <input name="name" value="${esc(p.name)}" aria-label="Posten">
         <button class="move" data-action="del-posten" data-tag="${tag.id}" data-id="${p.id}" aria-label="Posten löschen">✕</button>
       </div>`
    : `<label class="check-row posten ${p.ok ? 'fertig' : ''}">
         <input type="checkbox" class="chk" data-change="toggle-posten" data-tag="${tag.id}" data-id="${p.id}" ${p.ok ? 'checked' : ''}> ${esc(p.name)}
       </label>`;

  const reihe = tag.faden?.reihenfolge || 'video';
  const s = SCHAETZUNG;
  return `
    <section class="card form">
      <div class="kopfzeile"><h2>Ablauf am Set</h2></div>
      <p class="mute">Der Rote Faden führt Station für Station durch den Zeitplan unten. Ohne Zeitplan nimmt er die Reihenfolge der Locations.</p>
      <div class="field">Reihenfolge in jeder Station
        <div class="seg" role="group" aria-label="Reihenfolge in jeder Station">
          <button data-action="faden-reihenfolge" data-id="${tag.id}" data-wert="video" class="${reihe === 'video' ? 'an' : ''}">Video für Video</button>
          <button data-action="faden-reihenfolge" data-id="${tag.id}" data-wert="hooks" class="${reihe === 'hooks' ? 'an' : ''}">Erst alle Hooks</button>
        </div>
      </div>
      <button class="btn" data-action="ablauf-vorschlagen" data-id="${tag.id}">Zeitplan aus den Shots vorschlagen</button>
      <p class="mute">Schätzung je Shot: Hook ${s.hook} Min. · Skript/O-Ton ${s.oton} · CTA ${s.cta} · B-Roll ${s.broll} · Karussell ${s.karussell}, jeder Umbau ${s.umbau}. Danach frei anpassbar.</p>
      <a class="btn primary" href="#/faden/${tag.id}">▶ Roter Faden</a>
    </section>
    ${settingsKarte(tag, locations, shots)}
    <section class="card form">
      <div class="kopfzeile"><h2>Zeitplan</h2><span class="mute">${min ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std` : ''}</span></div>
      <div class="row2">
        <label data-save="tagfeld" data-id="${tag.id}">Drehbeginn <input type="time" name="uhrzeit" value="${esc(tag.uhrzeit || '')}" data-rerender></label>
        <div class="field">Ende <span class="plan-ende">${ende ? ende + ' Uhr' : '–'}</span></div>
      </div>
      ${sonne && sonne.untergang != null ? `<p class="sonne-hinweis">☀ Goldene Stunde ${uhrAusMin(sonne.goldAbend[0])}–${uhrAusMin(sonne.goldAbend[1])} · Sonnenuntergang ${uhrAusMin(sonne.untergang)}</p>`
        : tag.datum && !tag.koordinaten ? '<p class="mute">Für Sonnenzeiten Koordinaten unter „Bearbeiten“ eintragen.</p>' : ''}
      ${bloecke.length ? bloecke.map(block).join('') : '<p class="mute">Noch kein Ablauf. Tipp: „Aus Locations“ legt für jede Location einen Block an.</p>'}
      <div class="btn-row" style="margin-top:0">
        <button class="btn" data-action="add-block" data-id="${tag.id}">+ Block</button>
        ${locations.length ? `<button class="btn" data-action="bloecke-aus-orten" data-id="${tag.id}">Aus Locations</button>` : ''}
      </div>
      <label data-save="plan" data-id="${tag.id}">Bitte vorbereiten (steht für den Kunden im Zeitplan)
        <textarea name="kundenhinweis" class="auto" rows="2" placeholder="z. B. Räume aufgeräumt, Licht an, Haustiere woanders …">${esc(plan.kundenhinweis || '')}</textarea>
      </label>
      <label data-save="meta" data-id="absender">Absender unter dem Zeitplan
        <input name="absender" value="${esc(absender || '')}" placeholder="z. B. Ulf · LensMOGic · Telefon" autocomplete="off">
      </label>
      <div class="btn-row" style="margin-top:0">
        <button class="btn primary" data-action="share-zeitplan" data-id="${tag.id}">An Kunden senden</button>
        <button class="btn" data-action="print-zeitplan" data-id="${tag.id}">Als PDF</button>
      </div>
    </section>
    <section class="card">
      <div class="kopfzeile"><h2>Packliste</h2><span class="mute">${gepackt}/${posten.length} gepackt</span></div>
      ${posten.length ? posten.map(postenZeile).join('') : '<p class="mute">Noch leer.</p>'}
      ${z.bearbeiten ? `
        <form class="quick quick-ort" data-form="posten" data-id="${tag.id}">
          <input name="name" placeholder="Neuer Posten …" required autocomplete="off" enterkeyhint="done">
          <button class="btn primary" type="submit" aria-label="Posten hinzufügen">+</button>
        </form>
        <button class="btn" data-action="pack-standard" data-id="${tag.id}">Diese Liste für neue Drehtage nehmen</button>` : ''}
      <div class="btn-row">
        <button class="btn ${z.bearbeiten ? 'an' : ''}" data-action="toggle-bearbeiten">${z.bearbeiten ? 'Fertig' : 'Liste bearbeiten'}</button>
        ${gepackt ? `<button class="btn" data-action="pack-reset" data-id="${tag.id}">Haken entfernen</button>` : ''}
      </div>
    </section>`;
}

export async function viewTag(id, tab) {
  const b = await db.buendel(id);
  if (!b) return null;
  const { drehtag: tag, shots, locations, videos, medien } = b;
  locations.sort(nachPos);
  videos.sort(nachPos);
  const absender = tab === 'plan' ? await db.getMeta('absender') : '';
  const reiter = [['briefing', 'Briefing'], ['shots', `Shots (${shots.length})`], ['orte', `Orte (${locations.length})`], ['plan', 'Plan']];
  let inhalt;
  if (tab === 'briefing') inhalt = tabBriefing(tag, locations, videos, medien);
  else if (tab === 'orte') inhalt = tabOrte(tag, shots, locations, videos, medien);
  else if (tab === 'plan') inhalt = tabPlan(tag, locations, absender, shots);
  else inhalt = tabShots(tag, shots, locations, videos, medien);
  return `
    <header class="top">
      ${zurueck('#/')}
      <h1>${esc(tag.kunde)}</h1>
      <a class="top-btn" href="#/tag/${id}/bearbeiten">Bearbeiten</a>
    </header>
    <main>
      ${tag.vorlage ? '' : `<a class="btn primary big faden-start" href="#/faden/${id}">▶ Roter Faden</a>`}
      ${infoKarte(tag)}
      <nav class="tabs tabs4">
        ${reiter.map(([r, l]) => `<a class="${tab === r ? 'an' : ''}" href="#/tag/${id}${r === 'shots' ? '' : '/' + r}">${l}</a>`).join('')}
      </nav>
      ${inhalt}
    </main>`;
}

// ---------- Shot ----------

export async function viewShot(id) {
  const shot = await db.get('shots', id);
  if (!shot) return null;
  const [locations, videos, medien, tag] = await Promise.all([
    db.byIndex('locations', 'drehtagId', shot.drehtagId),
    db.byIndex('videos', 'drehtagId', shot.drehtagId),
    db.byIndex('medien', 'shotId', id),
    db.get('drehtage', shot.drehtagId),
  ]);
  const istHook = shot.typ === 'hook';
  const sprech = istHook || shot.typ === 'oton' || shot.typ === 'cta'; // bei diesen Arten wird gesprochen
  const karussell = shot.typ === 'karussell';
  const hatText = !!(shot.text || '').trim();

  const titelFeld = `
    <label>${karussell ? 'Thema' : sprech && shot.typ !== 'oton' ? 'Kurzname (optional)' : 'Titel'}
      <input name="titel" value="${esc(shot.titel)}" autocomplete="off">
    </label>`;
  const textFeld = karussell
    ? `
    <label>Folientexte
      <textarea name="text" class="auto sprech" rows="6" placeholder="Eine Folie pro Zeile. Folie 1 ist der Hook.">${esc(shot.text)}</textarea>
    </label>
    <p class="mute" id="text-stats" data-art="folien" ${hatText ? '' : 'hidden'}>${folienText(shot.text)}</p>
    <div class="btn-row" id="text-knoepfe" style="margin-top:0" ${hatText ? '' : 'hidden'}>
      <button class="btn primary" data-action="share-text" data-id="${id}">Folientexte teilen</button>
      <button class="btn" data-action="copy-text" data-id="${id}">Kopieren</button>
    </div>`
    : `
    <label>${istHook ? 'Hook-Text' : shot.typ === 'cta' ? 'CTA-Text' : sprech ? 'Sprechtext' : 'Text (optional)'}
      <textarea name="text" class="auto ${sprech ? 'sprech' : ''}" rows="${sprech ? 3 : 2}"
        placeholder="${sprech ? 'Was wird gesagt?' : 'Falls dazu etwas gesagt wird …'}">${esc(shot.text)}</textarea>
    </label>
    <p class="mute" id="text-stats" ${hatText ? '' : 'hidden'}>${statsText(shot.text)}</p>
    <div class="btn-row" id="text-knoepfe" style="margin-top:0" ${hatText ? '' : 'hidden'}>
      <button class="btn primary" data-action="share-text" data-id="${id}">An Teleprompter</button>
      <button class="btn" data-action="prompt-text" data-id="${id}">Prompter</button>
      <button class="btn" data-action="copy-text" data-id="${id}">Kopieren</button>
    </div>`;

  return `
    <header class="top">
      ${zurueck('#/tag/' + shot.drehtagId)}
      <h1>Shot</h1>
      <button class="top-btn" data-action="del-shot" data-id="${id}">Löschen</button>
    </header>
    <main>
      <section class="card form" data-save="shot" data-id="${id}">
        <div class="row2">
          <label class="check-row"><input type="checkbox" class="chk" name="erledigt" ${shot.erledigt ? 'checked' : ''}> Erledigt</label>
          <label class="check-row fav-row"><input type="checkbox" class="chk chk-fav" name="favorit" ${shot.favorit ? 'checked' : ''}> ★ Favorit</label>
        </div>
        ${sprech && shot.typ !== 'oton' ? textFeld + titelFeld : titelFeld + textFeld}
        <div class="row2">
          <label>Art
            <select name="typ" data-rerender>${typOptionen(shot.typ)}</select>
          </label>
          <div class="field">Format
            <div class="seg">
              <label><input type="radio" name="format" value="hochkant" ${shot.format !== 'quer' ? 'checked' : ''}><span>Hochkant</span></label>
              <label><input type="radio" name="format" value="quer" ${shot.format === 'quer' ? 'checked' : ''}><span>Quer</span></label>
            </div>
          </div>
        </div>
        <div class="row2">
          <label>Video <select name="videoId">${videoOptionen(videos, shot.videoId)}</select></label>
          <label>Location <select name="locationId">${ortOptionen(locations, shot.locationId)}</select></label>
        </div>
        <label>Setting <select name="settingId">${auswahl(settingsVon(tag), shot.settingId, 'Ohne Setting', '+ Neues Setting …')}</select></label>
        <label>Take <input name="take" value="${esc(shot.take)}" placeholder="z. B. Clip 0042, Take 3 – der beste" autocomplete="off"></label>
        ${shot.clips?.length ? `<p class="mute">Clips (von Claude zugeordnet): ${esc(shot.clips.join(', '))}</p>` : ''}
        <label>Notiz <textarea name="notiz" class="auto" rows="2" placeholder="Bildidee, Licht, Ablauf …">${esc(shot.notiz)}</textarea></label>
      </section>
      <section class="card">
        <h2>Skizzen und Fotos</h2>
        ${medienBlock(medien, 'shot', id)}
      </section>
    </main>`;
}

// ---------- Settings ----------

// Eine Zeile mit Name, Technik in Kurzform und Zahl der Shots
function settingZeile(tagId, x, shots, { ortName = '', pfeile = null } = {}) {
  const n = shots.filter((s) => s.settingId === x.id);
  return `
    <div class="setting-wrap">
      <a class="setting-zeile" href="#/setting/${tagId}/${x.id}">
        <b>${esc(x.name)}</b>
        <span class="mute">${[ortName, n.length ? `${n.filter((s) => s.erledigt).length}/${n.length} Shots` : 'noch keine Shots'].filter(Boolean).join(' · ')}</span>
        ${settingKurz(x) ? `<small>${esc(settingKurz(x))}</small>` : ''}
      </a>
      ${pfeile || ''}
    </div>`;
}

function settingsKarte(tag, locations, shots) {
  const liste = settingsVon(tag);
  const ort = (id) => locations.find((l) => l.id === id)?.name || '';
  const pfeile = (x, i) => `
    <div class="ort-move">
      <button class="move" data-action="move-setting" data-tag="${tag.id}" data-id="${x.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button>
      <button class="move" data-action="move-setting" data-tag="${tag.id}" data-id="${x.id}" data-dir="1" ${i === liste.length - 1 ? 'disabled' : ''} aria-label="Nach unten">▼</button>
    </div>`;
  return `
    <section class="card">
      <div class="kopfzeile"><h2>Settings</h2><span class="mute">${liste.length}</span></div>
      <p class="mute" style="margin-bottom:8px">Aufbauten mit Kamera, Licht und Ton. Der Rote Faden bündelt die Shots danach und zeigt, wann umgebaut wird. Die Reihenfolge hier ist die Reihenfolge am Set.</p>
      ${liste.map((x, i) => settingZeile(tag.id, x, shots, { ortName: ort(x.locationId), pfeile: liste.length > 1 ? pfeile(x, i) : '' })).join('')}
      <div class="btn-row">
        <button class="btn" data-action="add-setting" data-id="${tag.id}">+ Setting</button>
        <button class="btn" data-action="setting-bibliothek" data-id="${tag.id}">Aus Bibliothek</button>
        ${liste.length ? `<button class="btn" data-action="pack-aus-settings" data-id="${tag.id}">Packliste ergänzen</button>` : ''}
      </div>
    </section>`;
}

export async function viewSetting(tagId, settingId) {
  const b = await db.buendel(tagId);
  const x = b && settingVon(b.drehtag, settingId);
  if (!x) return null;
  const locations = [...b.locations].sort(nachPos);
  const videoName = (s) => b.videos.find((v) => v.id === s.videoId)?.name || 'Ohne Video';
  // Zur Auswahl stehen die Shots der Location dieses Settings, ohne Location alle
  const kandidaten = b.shots.filter((s) => !x.locationId || s.locationId === x.locationId);
  const gruppen = gruppieren(kandidaten, [], b.videos, 'video');
  const zugeordnet = b.shots.filter((s) => s.settingId === x.id);
  const frei = kandidaten.filter((s) => !s.settingId);
  const zeile = (s) => {
    const an = s.settingId === x.id;
    const anderes = !an && s.settingId ? settingVon(b.drehtag, s.settingId)?.name : '';
    const typ = typVon(s.typ);
    return `
      <button class="zuordnung typ-${typ.id} ${an ? 'an' : ''}" data-action="setting-zuordnen" data-tag="${tagId}" data-setting="${x.id}" data-id="${s.id}" aria-pressed="${an}">
        <i>${an ? '✓' : ''}</i>
        <span><span class="tag tag-${typ.id}">${typ.kurz}</span> ${esc(shotName(s))}${anderes ? `<small> · jetzt in „${esc(anderes)}“</small>` : ''}</span>
      </button>`;
  };
  return `
    <header class="top">
      ${zurueck(`#/tag/${tagId}/plan`)}
      <h1>Setting</h1>
      <button class="top-btn" data-action="del-setting" data-tag="${tagId}" data-id="${x.id}">Löschen</button>
    </header>
    <main>
      <section class="card form" data-save="setting" data-tag="${tagId}" data-id="${x.id}">
        <label>Name <input name="name" value="${esc(x.name)}" placeholder="z. B. Position A – sitzend am Tisch" autocomplete="off"></label>
        <label>Location <select name="locationId" data-rerender>${ortOptionen(locations, x.locationId, false)}</select></label>
        ${SETTING_FELDER.map((f) => `<label>${f.label} <input name="${f.id}" value="${esc(x[f.id])}" placeholder="${esc(f.platz)}" autocomplete="off"></label>`).join('')}
        <label>Notiz <textarea name="notiz" class="auto" rows="2" placeholder="Bildausschnitt, Höhe, Abstand, Besonderheiten …">${esc(x.notiz)}</textarea></label>
        <button class="btn" type="button" data-action="setting-merken" data-tag="${tagId}" data-id="${x.id}">In Bibliothek merken</button>
      </section>
      <section class="card">
        <div class="kopfzeile"><h2>Shots zuordnen</h2><span class="mute">${zugeordnet.length} zugeordnet</span></div>
        <p class="mute" style="margin-bottom:8px">${x.locationId ? 'Shots dieser Location.' : 'Alle Shots, weil das Setting keine Location hat.'} Antippen ordnet zu oder hebt die Zuordnung auf.</p>
        ${frei.length ? `<button class="btn" style="width:100%;margin-bottom:8px" data-action="setting-alle" data-tag="${tagId}" data-id="${x.id}">Alle ohne Setting hierher (${frei.length})</button>` : ''}
        ${gruppen.length ? gruppen.map((g) => `
          <p class="ort-video"><span>${esc(g.id ? g.label : 'Ohne Video')}</span></p>
          <div class="zuordnungen">${g.shots.map(zeile).join('')}</div>`).join('') : '<p class="mute">Keine Shots.</p>'}
      </section>
    </main>`;
}

// ---------- Location ----------

export async function viewOrt(id) {
  const ort = await db.get('locations', id);
  if (!ort) return null;
  const [medien, alleShots, videos, tag] = await Promise.all([
    db.byIndex('medien', 'locationId', id),
    db.byIndex('shots', 'drehtagId', ort.drehtagId),
    db.byIndex('videos', 'drehtagId', ort.drehtagId),
    db.get('drehtage', ort.drehtagId),
  ]);
  const shots = alleShots.filter((s) => s.locationId === id).sort(nachPos);
  const settingsHier = settingsVon(tag).filter((x) => x.locationId === id);
  return `
    <header class="top">
      ${zurueck(`#/tag/${ort.drehtagId}/orte`)}
      <h1>Location</h1>
      <button class="top-btn" data-action="del-ort" data-id="${id}">Löschen</button>
    </header>
    <main>
      <section class="card form" data-save="ort" data-id="${id}">
        <label>Name <input name="name" value="${esc(ort.name)}" autocomplete="off"></label>
        <label>Notizen <textarea name="notiz" class="auto" rows="3" placeholder="Licht, Ton, Platz, Strom, Besonderheiten …">${esc(ort.notiz)}</textarea></label>
        <label class="check-row"><input type="checkbox" class="chk" name="aussen" ${ort.aussen ? 'checked' : ''}> Außen (Sonnenstand im Zeitplan beachten)</label>
      </section>
      <section class="card">
        <h2>Fotos und Skizzen</h2>
        <p class="mute" style="margin-bottom:10px">Foto antippen, dann „Zeichnen“: Kameraposition, Laufweg oder Ausschnitt einzeichnen.</p>
        ${medienBlock(medien, 'ort', id)}
      </section>
      <section class="card">
        <div class="kopfzeile"><h2>Settings hier</h2><span class="mute">${settingsHier.length}</span></div>
        ${settingsHier.map((x) => settingZeile(tag.id, x, alleShots)).join('') || '<p class="mute">Noch kein Setting an dieser Location.</p>'}
        <div class="btn-row"><button class="btn" data-action="add-setting" data-id="${tag.id}" data-ort="${id}">+ Setting hier</button></div>
      </section>
      <section class="card ort-card">
        <div class="kopfzeile"><h2>Shots an dieser Location</h2><span class="mute">${shots.filter((s) => s.erledigt).length}/${shots.length}</span></div>
        ${shots.length ? ortShots(shots, { locations: [ort], videos, medien: [], settings: settingsVon(tag) }) : '<p class="mute">Noch keine Shots. In der Shotliste beim Anlegen diese Location wählen.</p>'}
      </section>
    </main>`;
}

function listeShots(shots, videos = []) {
  return `<ul class="liste">${shots.map((s) => {
    const video = videos.find((v) => v.id === s.videoId);
    return `<li><a href="#/shot/${s.id}">
      <span class="tag tag-${typVon(s.typ).id}">${typVon(s.typ).kurz}</span>
      ${s.favorit ? '<span class="fav">★</span>' : ''} ${esc(shotName(s))}${s.erledigt ? ' <span class="ok">✓</span>' : ''}
      ${video ? `<small class="mute"> · ${esc(video.name)}</small>` : ''}
    </a></li>`;
  }).join('')}</ul>`;
}

// ---------- Video ----------

export async function viewVideo(id) {
  const video = await db.get('videos', id);
  if (!video) return null;
  const [alleShots, locations] = await Promise.all([
    db.byIndex('shots', 'drehtagId', video.drehtagId),
    db.byIndex('locations', 'drehtagId', video.drehtagId),
  ]);
  const shots = alleShots.filter((s) => s.videoId === id);
  const stand = videoStand(shots);
  const gruppen = gruppieren(shots, locations, [], 'art');
  const gesprochen = shots.filter((s) => ['hook', 'oton', 'cta'].includes(s.typ));
  const woerterGesamt = gesprochen.reduce((n, s) => n + woerter(s.text), 0);
  return `
    <header class="top">
      ${zurueck(`#/tag/${video.drehtagId}`)}
      <h1>Video</h1>
      <button class="top-btn" data-action="del-video" data-id="${id}">Löschen</button>
    </header>
    <main>
      <section class="card form" data-save="video" data-id="${id}">
        <label>Name <input name="name" value="${esc(video.name)}" autocomplete="off"></label>
        <label>Notiz <textarea name="notiz" class="auto" rows="2" placeholder="Ziel, Plattform, Länge, CTA …">${esc(video.notiz)}</textarea></label>
      </section>
      <section class="card">
        <h2>Stand</h2>
        <div class="stand">${stand.map((p) => `
          <div class="stand-teil typ-${p.id} ${p.gesamt && p.fertig === p.gesamt ? 'voll' : ''}">
            <b>${p.gesamt ? `${p.fertig}/${p.gesamt}` : '–'}</b><span>${p.kurz}</span>
          </div>`).join('')}</div>
        ${woerterGesamt ? `<p class="mute" style="margin-top:8px">Gesprochener Text: ${statsText(gesprochen.map((s) => s.text).join(' '))}</p>` : ''}
      </section>
      <form class="quick quick3" data-form="quick" data-id="${video.drehtagId}">
        <input type="hidden" name="videoId" value="${id}">
        <select name="typ" aria-label="Art">${typOptionen(z.letzterTyp)}</select>
        <select name="locationId" aria-label="Location" class="breit">${ortOptionen(locations, z.letzteLocation)}</select>
        <input name="eingabe" placeholder="${platzhalter(z.letzterTyp)}" required autocomplete="off" enterkeyhint="done">
        <button class="btn primary" type="submit" aria-label="Shot hinzufügen">+</button>
      </form>
      ${gruppen.length ? gruppen.map((g) => `
        <h2 class="grp typ-${g.id}"><span>${esc(g.label)}</span><small>${g.shots.filter((s) => s.erledigt).length}/${g.shots.length}</small></h2>
        <section class="card" style="margin-top:0">${listeShots(g.shots)}</section>`).join('')
        : '<p class="leer">Noch keine Shots in diesem Video.</p>'}
    </main>`;
}

// ---------- Roter Faden: der Drehtag Schritt für Schritt ----------

const kurz = (t, n = 22) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// Alle Shots der Station zum Abhaken: offene in Faden-Reihenfolge, dann zurückgestellte, dann erledigte.
// Häkchen = erledigt, Tipp auf den Text = diesen Shot als Nächstes drehen.
function fadenListe(shots, aktuell, videoVon, nachholModus, settingName = () => '') {
  const andere = shots.filter((s) => s.id !== aktuell?.id);
  const offen = andere.filter((s) => !s.erledigt && !s.spaeter);
  const spaeter = andere.filter((s) => !s.erledigt && s.spaeter);
  const fertig = andere.filter((s) => s.erledigt);
  if (!andere.length) return '';
  const zeile = (s) => {
    const typ = typVon(s.typ);
    return `
      <li class="shot typ-${typ.id} ${s.erledigt ? 'fertig' : ''}">
        <div class="shot-kopf">
          <input type="checkbox" class="chk" data-change="toggle-shot" data-id="${s.id}" ${s.erledigt ? 'checked' : ''} aria-label="Erledigt">
          <button class="shot-main faden-wahl" data-action="faden-waehle" data-id="${s.id}" ${s.erledigt ? 'disabled' : ''}>
            <span class="schilder"><span class="tag tag-${typ.id}">${typ.kurz}</span>${s.spaeter && !s.erledigt ? '<span class="fav">später</span>' : ''}</span>
            ${s.titel ? `<span class="shot-titel">${esc(s.titel)}</span>` : ''}
            ${s.text ? `<span class="shot-text ${!s.titel ? 'solo' : ''} gekuerzt2">${esc(s.text)}</span>` : ''}
            ${!s.titel && !s.text ? '<span class="shot-titel">Ohne Titel</span>' : ''}
            ${videoVon(s) || settingName(s) ? `<span class="shot-meta">${esc([videoVon(s)?.name, settingName(s)].filter(Boolean).join(' · '))}</span>` : ''}
          </button>
        </div>
      </li>`;
  };
  const block = (titel, liste) => (liste.length ? `
    <p class="abschnitt">${titel} · ${liste.length}</p>
    <ul class="shots">${liste.map(zeile).join('')}</ul>` : '');
  return block(nachholModus ? 'Ebenfalls nachholen' : 'Danach in dieser Station', offen)
    + block('Zurückgestellt', spaeter)
    + block('Erledigt', fertig);
}

export async function viewFaden(id) {
  const b = await db.buendel(id);
  if (!b) return null;
  const tag = b.drehtag;
  const { stationen, idx, nachholen, gesamt, erledigt } = fadenStand(b);
  const nachholModus = nachholen.length && (idx < 0 || z.fadenModus === 'nachholen');
  const st = nachholModus ? null : stationen[idx];
  const liste = nachholModus ? nachholen : st ? st.offen : [];
  const shot = liste.find((s) => s.id === z.fadenShot) || liste[0] || null;
  const zuletzt = z.fadenZuletzt ? b.shots.find((s) => s.id === z.fadenZuletzt && s.erledigt) : null;
  const videoVon = (s) => b.videos.find((v) => v.id === s.videoId);
  const ortVon = (s) => b.locations.find((l) => l.id === s.locationId);

  // Das Band oben: Stationen als Punkte auf dem roten Faden
  const band = `
    <div class="faden-band" id="faden-band">
      <div class="faden-linie">
        ${stationen.map((s, i) => `
          <button class="faden-punkt ${s.fertig ? 'fertig' : ''} ${!nachholModus && i === idx ? 'jetzt' : ''}" data-action="faden-station" data-id="${tag.id}" data-key="${esc(s.key)}">
            <i>${s.fertig ? '✓' : ''}</i>
            <span class="fp-titel">${esc(kurz(s.titel))}</span>
            <span class="fp-info">${[s.von, s.shots.length ? `${s.erledigt}/${s.shots.length}` : ''].filter(Boolean).join(' · ')}</span>
          </button>`).join('')}
        ${nachholen.length ? `
          <button class="faden-punkt nachholen ${nachholModus ? 'jetzt' : ''}" data-action="faden-station" data-id="${tag.id}" data-key="nachholen">
            <i>${nachholen.length}</i><span class="fp-titel">Nachholen</span><span class="fp-info">zurückgestellt</span>
          </button>` : ''}
      </div>
    </div>`;

  // Zeile darunter: wo wir stehen und ob wir in der Zeit liegen
  const zeit = st ? fadenZeit(b, st) : null;
  // Außen-Station am Drehtag selbst: Countdown bis Sonnenuntergang (ab 2 Stunden vorher)
  const sonnenUhr = (station) => {
    const s = sonneVon(b.drehtag);
    if (!s || s.untergang == null || b.drehtag.datum !== heute()) return '';
    if (!b.locations.find((l) => l.id === station.locationId)?.aussen) return '';
    const jetzt = new Date();
    const rest = Math.round(s.untergang - (jetzt.getHours() * 60 + jetzt.getMinutes()));
    if (rest > 120) return '';
    return rest > 0 ? ` · <b class="${rest <= 30 ? 'spaet' : ''}">☀ Untergang in ${rest} Min.</b>` : ' · <b class="spaet">☀ Sonne ist unter</b>';
  };
  const zeitText = !zeit ? '' : zeit.art === 'spaet' ? `<b class="spaet">${zeit.min} Min. hinter Plan</b>`
    : zeit.art === 'frueh' ? `<b class="frueh">${zeit.min} Min. vor Plan</b>` : `<b>noch ${zeit.min} Min.</b>`;
  const status = nachholModus
    ? `<b>Nachholen</b> · ${anzahl(nachholen.length, 'Shot', 'Shots')} zurückgestellt`
    : st ? `<b>${esc(st.titel)}</b>${st.von ? ` · ${st.von}–${st.bis}` : st.dauer ? ` · ${st.dauer} Min.` : ''}${zeitText ? ' · ' + zeitText : ''}${sonnenUhr(st)}` : '';

  let inhalt;
  if (!st && !nachholModus) {
    inhalt = `
      <section class="faden-karte faden-fertig">
        <h2 class="faden-titel">Alles im Kasten.</h2>
        <p>${erledigt} von ${gesamt} Shots erledigt, nichts zurückgestellt.</p>
        <a class="btn big" href="#/tag/${tag.id}">Zur Shotliste</a>
      </section>`;
  } else if (!shot) {
    // Station ohne Shots: Aufbau, Pause, Abbau
    inhalt = `
      <section class="faden-karte">
        <h2 class="faden-titel">${esc(st.titel)}</h2>
        ${st.dauer ? `<p class="mute">geplant ${st.dauer} Min.</p>` : ''}
        ${tag.zeitplan?.bloecke?.find((x) => 'b:' + x.id === st.key)?.hinweis ? `<p>${esc(tag.zeitplan.bloecke.find((x) => 'b:' + x.id === st.key).hinweis)}</p>` : ''}
      </section>
      <button class="btn primary faden-ok" data-action="faden-station-fertig" data-id="${tag.id}" data-key="${esc(st.key)}">✓ Erledigt, weiter</button>`;
  } else {
    const typ = typVon(shot.typ);
    const video = videoVon(shot);
    const sprech = ['hook', 'oton', 'cta'].includes(shot.typ) && (shot.text || '').trim();
    // Setting des Shots. Wechselt es gegenüber dem Shot davor in der Station, steht "Umbau" da.
    const setting = settingVon(tag, shot.settingId);
    const reihe = st ? st.shots : [];
    const vorher = reihe[reihe.findIndex((s) => s.id === shot.id) - 1];
    const umbau = setting && vorher && vorher.settingId !== shot.settingId;
    const settingBlock = setting ? `
      <a class="faden-setting ${umbau ? 'umbau' : ''}" href="#/setting/${tag.id}/${setting.id}">
        <b>${umbau ? 'Umbau auf: ' : 'Setting: '}${esc(setting.name)}</b>
        ${settingKurz(setting) ? `<span>${esc(settingKurz(setting))}</span>` : ''}
        ${umbau && (setting.kamera || setting.notiz) ? `<span>${esc([setting.kamera, setting.notiz].filter(Boolean).join(' · '))}</span>` : ''}
      </a>` : '';
    const danach = liste.filter((s) => s.id !== shot.id);
    inhalt = `
      ${settingBlock}
      <section class="faden-karte typ-${typ.id}">
        <button class="faden-label" data-action="faden-klappe" data-id="${shot.id}" aria-label="Klappe groß anzeigen">
          <span class="tag tag-${typ.id}">${typ.kurz}</span>
          <span>${esc(video ? video.name : 'Ohne Video')}</span>
        </button>
        ${shot.titel ? `<h2 class="faden-titel">${esc(shot.titel)}</h2>` : ''}
        ${shot.text ? `<div class="faden-text ${shot.titel ? '' : 'gross'}">${esc(shot.text)}</div>` : ''}
        ${shot.notiz ? `<p class="faden-notiz">${esc(shot.notiz)}</p>` : ''}
        ${nachholModus && ortVon(shot) ? `<p class="faden-notiz">Location: ${esc(ortVon(shot).name)}</p>` : ''}
        ${shot.format === 'quer' ? '<p class="faden-notiz"><b>Querformat</b></p>' : ''}
      </section>
      <button class="btn primary faden-ok" data-action="faden-erledigt" data-id="${shot.id}">✓ Erledigt</button>
      <div class="btn-row faden-neben">
        <button class="btn" data-action="faden-spaeter" data-id="${shot.id}">Später</button>
        ${sprech ? `<button class="btn" data-action="prompt-text" data-id="${shot.id}">▶ Prompter</button>` : ''}
        <a class="btn" href="#/shot/${shot.id}">Details</a>
      </div>
      ${fadenListe(nachholModus ? nachholen : st.shots, shot, videoVon, nachholModus, (s) => settingVon(tag, s.settingId)?.name || '')}
      ${!nachholModus && danach.length ? `<button class="btn faden-rest" data-action="faden-rest-spaeter" data-id="${tag.id}" data-key="${esc(st.key)}">Station verlassen, Rest später</button>` : ''}`;
  }

  return `
    <header class="top">
      <a class="back" href="#/tag/${tag.id}" aria-label="Zurück">‹</a>
      <h1>Roter Faden</h1>
      <span class="top-info">${erledigt}/${gesamt}</span>
    </header>
    <main class="faden">
      ${band}
      <div class="bar faden-bar"><i style="width:${gesamt ? (erledigt / gesamt) * 100 : 0}%"></i></div>
      <p class="faden-status">${status}</p>
      ${zuletzt ? `<p class="faden-zuletzt">✓ ${esc(kurz(shotName(zuletzt), 34))} <button data-action="faden-undo" data-id="${zuletzt.id}">Rückgängig</button></p>` : ''}
      ${inhalt}
    </main>`;
}

// ---------- Sicherung ----------

export async function viewSicherung() {
  const backup = await db.getMeta('letztesBackup');
  let speicher = '';
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage != null) speicher = `Belegter Speicher: ${(est.usage / 1048576).toFixed(1)} MB`;
  } catch { /* nicht überall verfügbar */ }
  return `
    <header class="top">${zurueck('#/')}<h1>Sicherung</h1></header>
    <main>
      <section class="card">
        <h2>Backup speichern</h2>
        <p>Alle Drehtage liegen nur auf diesem Gerät. Die Backup-Datei enthält alles, auch Skizzen und Fotos.</p>
        <p class="mute" style="margin:8px 0 12px">${backup ? 'Letztes Backup: ' + new Date(backup).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'Noch kein Backup gemacht.'}</p>
        <button class="btn primary big" data-action="backup-export">Backup-Datei speichern</button>
      </section>
      <section class="card">
        <h2>Datei einlesen</h2>
        <p class="mute" style="margin-bottom:12px">Backup oder Drehtag-Datei (zum Beispiel zurück von Claude). Beide Stände werden zusammengeführt: Pro Eintrag gilt die jüngere Fassung, nichts Neueres wird überschrieben.</p>
        <label class="btn big">Datei auswählen<input type="file" hidden data-change="import-datei"></label>
      </section>
      ${fernbedienungKarte()}
      <p class="mute" style="text-align:center">${speicher}</p>
      ${istNativ && appFassung.hier ? `<p class="mute" style="text-align:center">App-Fassung vom ${esc(appFassung.hier.name)}${appFassung.online?.code > appFassung.hier.code ? ` · <b>neue Fassung vom ${esc(appFassung.online.name)} liegt auf dem NAS (Drehtage › App)</b>` : ''}</p>` : ''}
    </main>`;
}

// ---------- Zeitplan zum Drucken ----------

export function zeitplanBlatt(b, absender) {
  const tag = b.drehtag;
  const plan = tag.zeitplan || { bloecke: [] };
  const bloecke = zeitplanMitZeiten(tag.uhrzeit, plan.bloecke);
  const ort = (id) => b.locations.find((l) => l.id === id)?.name || '';
  return `
    <div class="druck">
      <div class="s-bar no-print">
        <button data-d="close">Schließen</button>
        <button data-d="print" class="s-save">Drucken / als PDF</button>
      </div>
      <article class="blatt">
        <p class="blatt-marke">Drehplan</p>
        <h1>${esc(tag.kunde)}</h1>
        <p class="blatt-kopf">${esc([tag.datum ? fmtDatum(tag.datum) : '', tag.uhrzeit ? 'ab ' + tag.uhrzeit + ' Uhr' : ''].filter(Boolean).join(', '))}${tag.ort ? '<br>' + esc(tag.ort) : ''}</p>
        ${bloecke.length ? `
        <table>
          <thead><tr><th>Zeit</th><th>Ablauf</th></tr></thead>
          <tbody>${bloecke.map((x) => `
            <tr>
              <td class="zeit">${x.von ? `${x.von}–${x.bis}` : `${x.dauer} Min`}</td>
              <td><b>${esc(x.titel || 'Ohne Titel')}</b>${ort(x.locationId) && ort(x.locationId) !== x.titel ? `<br><span class="grau">${esc(ort(x.locationId))}</span>` : ''}${x.hinweis ? `<br>${esc(x.hinweis)}` : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
        ${bloecke[0].von ? `<p>Ende gegen ${bloecke[bloecke.length - 1].bis} Uhr</p>` : ''}` : '<p>Der Ablauf folgt.</p>'}
        ${(plan.kundenhinweis || '').trim() ? `<h2>Bitte vorbereiten</h2><p class="vor">${esc(plan.kundenhinweis.trim())}</p>` : ''}
        ${(absender || '').trim() ? `<p class="absender">${esc(absender.trim())}</p>` : ''}
      </article>
    </div>`;
}
