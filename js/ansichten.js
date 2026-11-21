// Ansichten: Jede Funktion liefert das HTML für eine Seite der App.
// Hier wird nur angezeigt. Was beim Tippen passiert, steht in aktionen.js.
import * as db from './db.js';
import { esc, fmtDatum, heute } from './util.js';
import {
  TYPEN, STATUS, FRAGEN_SETS, typVon, statusVon, gruppieren, shotName,
  videoStand, videoStandText, zeitplanMitZeiten, zeitplanMinuten,
  fadenStand, fadenZeit, SCHAETZUNG, SETTING_FELDER, settingsVon, settingVon, settingKurz,
  sonnenText, sonneVon, sonnenHinweis, uhrAusMin, istOptional, moeglicheOrte, bereitschaft,
  istSprech, stationSprechtexte, naechsterFest, pflichtStand, markerVon, interviewFragen, bauchbinde,
  freigegeben, freigabeOffen, istSprechtext, fahrtVon, wetterKurz, stationIst, fadenStationen, uhrzeitVon, MITGELIEFERT,
} from './modell.js';
import { wetterVon } from './wetter.js';
import { sprachMoeglich, sprachGewuenscht } from './sprachbefehle.js';
import { z, bildUrl, nachPos, anzahl, statsText, folienText, istLang, platzhalter, woerter } from './zustand.js';
import { fernbedienungKarte } from './fernbedienung.js';
import { istNativ, appFassung, sprache } from './nativ.js';
import { gekoppelt } from './kopplung.js';

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
  const [tage, shots, videos, backup, orte] = await Promise.all([
    db.getAll('drehtage'), db.getAll('shots'), db.getAll('videos'), db.getMeta('letztesBackup'), db.getAll('locations'),
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
        <div class="tag-kunde">${!t.abgeschlossen && t.datum && t.datum >= h ? `<i class="ampel-licht ${bereitschaft({ drehtag: t, shots: ss, locations: orte.filter((l) => l.drehtagId === t.id) }).stufe}"></i>` : ''}${esc(t.kunde)}${t.datum === h ? '<span class="badge">Heute</span>' : ''}</div>
        <div class="tag-meta">${esc(meta)}</div>
        <div class="tag-zeile">${statusBadge(t.status)}<span class="mute">${vv.length ? anzahl(vv.length, 'Video', 'Videos') + ' · ' : ''}${ss.length ? `${fertig}/${ss.length} Shots` : 'Noch keine Shots'}</span></div>
        <div class="bar"><i style="width:${ss.length ? (fertig / ss.length) * 100 : 0}%"></i></div>
      </a>`;
  };
  // Vorlagen kompakt: eine Zeile je Vorlage, Name öffnet zum Bearbeiten
  const vorlageZeile = (t) => `
    <div class="vorlage-zeile">
      <a href="#/tag/${t.id}"><b>${esc(t.kunde)}</b><span class="mute">${anzahl(shots.filter((s) => s.drehtagId === t.id).length, 'Shot', 'Shots')} ›</span></a>
      <button class="btn primary" data-action="aus-vorlage" data-id="${t.id}">Neu daraus</button>
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
        ${vorlagen.length ? `<p class="abschnitt">Vorlagen</p><div class="card vorlage">${vorlagen.map(vorlageZeile).join('')}</div>` : ''}
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

const AMPEL = { rot: 'Fehlt noch etwas', orange: 'Fast bereit', gruen: 'Bereit für den Dreh' };

// Ampel "Bereit für den Dreh?": zugeklappt eine Zeile, aufgeklappt die Punkte mit „Ignorieren“
function ampelKarte(b) {
  const tag = b.drehtag;
  const a = bereitschaft(b);
  const offen = z.ampelOffen === tag.id;
  const ziel = (x) => (x.ziel === 'bearbeiten' ? `#/tag/${tag.id}/bearbeiten` : `#/tag/${tag.id}${x.ziel === 'shots' ? '' : '/' + x.ziel}`);
  const zeile = (x) => `
    <li class="ampel-punkt ${x.stufe} ${x.ignoriert ? 'ignoriert' : ''}">
      <a href="${ziel(x)}">${esc(x.text)}</a>
      ${x.id === 'datum' || x.id === 'shots' ? '' : `<button class="mini" data-action="bereit-ignorieren" data-id="${tag.id}" data-punkt="${x.id}">${x.ignoriert ? 'Wieder prüfen' : 'Ignorieren'}</button>`}
      ${x.posten && !x.ignoriert ? `<ul class="ampel-posten">${x.posten.map((p) => `<li>${esc(p.name)} <button class="mini" data-action="posten-ignorieren" data-tag="${tag.id}" data-id="${p.id}">brauche ich nicht</button></li>`).join('')}</ul>` : ''}
    </li>`;
  return `
    <section class="card ampel ${a.stufe}">
      <button class="ampel-kopf" data-action="ampel-auf" data-id="${tag.id}">
        <i class="ampel-licht"></i><b>${AMPEL[a.stufe]}</b>
        <span class="mute">${a.offen ? anzahl(a.offen, 'Punkt', 'Punkte') + (offen ? ' ▴' : ' ▾') : '✓'}</span>
      </button>
      ${offen ? `<ul class="ampel-liste">${a.punkte.map(zeile).join('') || '<li class="mute">Nichts offen.</li>'}</ul>` : ''}
    </section>`;
}

function infoKarte(tag, { fahrt = null, wetter = null } = {}) {
  const wann = [tag.datum ? fmtDatum(tag.datum) : '', tag.uhrzeit ? tag.uhrzeit + ' Uhr' : ''].filter(Boolean).join(', ');
  const leer = !wann && !tag.ort && !tag.ansprechpartner && !tag.telefon && !tag.notizen;
  const knopf = (action, text, extra = '') => `<button class="btn" data-action="${action}" data-id="${tag.id}" ${extra}>${text}</button>`;
  return `
    <section class="card">
      ${tag.vorlage ? '<p class="hinweis">Das ist eine Vorlage. Auf der Startseite wird daraus ein neuer Drehtag.</p>' : ''}
      ${wann ? `<div class="info-row"><span>Wann</span><b>${esc(wann)}</b></div>` : ''}
      ${tag.ort ? `<div class="info-row"><span>Ort</span><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tag.ort)}" target="_blank" rel="noopener">${esc(tag.ort)}</a></div>` : ''}
      ${sonnenText(tag) ? `<div class="info-row"><span>Sonne</span><div>${esc(sonnenText(tag))}</div></div>` : ''}
      ${wetterKurz(wetter) ? `<div class="info-row"><span>Wetter</span><div>${esc(wetterKurz(wetter))}</div></div>` : ''}
      ${fahrt ? `<div class="info-row"><span>Fahrt</span><div>ca. ${fahrt.min} Min.${fahrt.geschaetzt ? ' (grob geschätzt)' : ''}${fahrt.abfahrt ? ` · <b>Abfahrt ${fahrt.abfahrt}</b>` : ''}${fahrt.maps ? ` · <a href="${esc(fahrt.maps)}" target="_blank" rel="noopener">Route</a>` : ''}</div></div>` : ''}
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
        ${knopf('share-callsheet', 'Call Sheet (Crew)')}
        ${knopf('share-freigabe', 'Texte zur Freigabe')}
        ${tag.vorlage ? '' : knopf('share-zeiten', 'Zeiten (Abrechnung)')}
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
      <p class="mute" style="margin-bottom:10px">${istNativ
        ? 'Nach dem Telefonat alles Wichtige einsprechen. Die offenen Fragen stehen dabei auf dem Bildschirm. Whisper transkribiert auf dem Handy; auf Wunsch sortiert Claude das Briefing, die Videos und Hook-Vorschläge ein (Einstellung unter „Sicherung“).'
        : 'Nach dem Telefonat alles Wichtige einsprechen. Die offenen Fragen stehen dabei auf dem Bildschirm. Ausgewertet wird in der Android-App direkt auf dem Handy, sonst am PC über „Datei für Claude“.'}</p>
      <button class="btn primary big" data-action="sprachnotiz" data-id="${tag.id}">● Sprachnotiz aufnehmen</button>
      ${notizen.map((m) => `
        <div class="audio-notiz">
          <div class="kopfzeile">
            <b>${new Date(m.erstellt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</b>
            <span class="mute">${minSek(m.dauer)} Min.</span>
          </div>
          <audio controls preload="metadata" src="${bildUrl(m.blob)}"></audio>
          ${m.eingeordnet ? `<p class="hinweis">✓ Einsortiert: ${anzahl((m.einordnung?.antworten || 0) + (m.einordnung?.fragen || 0), 'Antwort', 'Antworten')}, ${anzahl(m.einordnung?.videos || 0, 'neues Video', 'neue Videos')}, ${anzahl(m.einordnung?.shots || 0, 'Shot', 'Shots')} – bitte durchsehen.</p>` : ''}
          ${m.offenePunkte?.length ? `<div class="offene-punkte"><b>Noch klären</b><ul>${m.offenePunkte.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
          ${m.transkript
            ? `<details${m.eingeordnet ? '' : ' open'}><summary>Transkript${m.transkribiertMit ? ` <span class="mute">(${esc(m.transkribiertMit)})</span>` : ''}</summary><p class="transkript">${esc(m.transkript)}</p></details>`
            : `<p class="mute">${istNativ ? 'Noch nicht transkribiert.' : 'Noch nicht transkribiert. In der Android-App oder mit „Datei für Claude“ am PC.'}</p>`}
          <div class="btn-row">
            ${istNativ && !m.transkript ? `<button class="mini" data-action="notiz-transkribieren" data-id="${m.id}">Transkribieren</button>` : ''}
            ${istNativ ? `<button class="mini" data-action="notiz-einsortieren" data-id="${m.id}">${m.eingeordnet ? 'Erneut einsortieren' : 'Einsortieren'}</button>` : ''}
            ${istNativ && m.transkript ? `<button class="mini" data-action="notiz-neu" data-id="${m.id}">Neu transkribieren</button>` : ''}
            <button class="mini" data-action="del-audio" data-id="${m.id}">Löschen</button>
          </div>
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
  const bilder = medien.filter((m) => m.shotId === s.id && m.art !== 'unterschrift' && m.art !== 'audio').sort((a, b) => a.erstellt - b.erstellt);
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
    istOptional(s) ? `optional, auch ${s.auchAn.map((o) => locations.find((l) => l.id === o)?.name).filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  const lang = istLang(s.text);
  const offen = z.aufgeklappt.has(s.id);
  const geaendert = !!s.freigabe && !freigegeben(s);
  return `
    <li class="shot typ-${typ.id} ${s.erledigt ? 'fertig' : ''}">
      <div class="shot-kopf">
        <input type="checkbox" class="chk" data-change="toggle-shot" data-id="${s.id}" ${s.erledigt ? 'checked' : ''} aria-label="Erledigt">
        <a class="shot-main" href="#/shot/${s.id}">
          ${modus !== 'art' || s.favorit || s.pflicht || geaendert ? `<span class="schilder">${modus !== 'art' ? `<span class="tag tag-${typ.id}">${typ.kurz}</span>` : ''}${s.pflicht ? '<span class="pflicht">Pflicht</span>' : ''}${s.favorit ? '<span class="fav">★ Favorit</span>' : ''}${geaendert ? '<span class="fav">nach Freigabe geändert</span>' : ''}</span>` : ''}
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
             ${s.typ === 'karussell' ? '' : `<button class="mini" data-action="prompt-text" data-id="${s.id}">▶ ${s.typ === 'interview' ? 'Fragen' : 'Prompter'}</button>`}
           </div>`
        : ''}
    </li>`;
}

// Reiter "Shots": Fortschritt, Schnell-Anlegen und die Liste in Gruppen
function tabShots(tag, shots, locations, videos, medien, b = null) {
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
      ${freigabeZeile(tag, shots)}
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

// Kundenfreigabe der Sprechtexte: Stand und die zwei Knöpfe
function freigabeZeile(tag, shots) {
  const texte = shots.filter(istSprechtext);
  if (!texte.length || tag.vorlage) return '';
  const offen = freigabeOffen({ shots }).length;
  return `
    <div class="freigabe-zeile">
      <span class="mute">Freigabe: ${texte.length - offen}/${texte.length} Texte${tag.freigabeAngefragt ? ` · angefragt ${new Date(tag.freigabeAngefragt).toLocaleDateString('de-DE')}` : ''}</span>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn" data-action="share-freigabe" data-id="${tag.id}">Zur Freigabe senden</button>
        ${offen ? `<button class="btn" data-action="alle-freigegeben" data-id="${tag.id}">Alle freigegeben</button>` : '<span class="ok" style="align-self:center">✓ alle freigegeben</span>'}
      </div>
    </div>`;
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
  const korb = medien.filter((m) => !m.shotId && !m.locationId && !m.settingId && m.art !== 'audio');
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
function tabPlan(tag, locations, absender, shots = [], b = null) {
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
        <span class="block-zeit ${b.fest ? 'fest' : ''}">${b.fest ? '📌 ' : ''}${b.von ? `${b.von}<br>${b.bis}` : `${b.dauer}′`}</span>
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
      <label class="fest-zeile"><span>Feste Startzeit${b.fest ? '' : ' (z. B. Programmpunkt)'}</span><input type="time" name="fest" value="${esc(b.fest || '')}" data-rerender aria-label="Feste Startzeit"></label>
      ${b.ueber ? `<p class="sonne-hinweis warn">Der Block davor endet ${b.ueber} Min. zu spät</p>` : ''}
      ${sonnenZeile(b)}
    </div>`;

  const postenZeile = (p) => z.bearbeiten
    ? `<div class="frage-edit" data-save="posten" data-tag="${tag.id}" data-id="${p.id}">
         <input name="name" value="${esc(p.name)}" aria-label="Posten">
         <button class="move" data-action="del-posten" data-tag="${tag.id}" data-id="${p.id}" aria-label="Posten löschen">✕</button>
       </div>`
    : `<label class="check-row posten ${p.ok ? 'fertig' : ''}">
         <input type="checkbox" class="chk" data-change="toggle-posten" data-tag="${tag.id}" data-id="${p.id}" ${p.ok ? 'checked' : ''}> ${esc(p.name)}${p.ignoriert && !p.ok ? ' <small class="mute">· nicht nötig</small>' : ''}
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
        <input name="absender" value="${esc(absender || '')}" placeholder="z. B. Name · Firma · Telefon" autocomplete="off">
      </label>
      <div class="btn-row" style="margin-top:0">
        <button class="btn primary" data-action="share-zeitplan" data-id="${tag.id}">An Kunden senden</button>
        <button class="btn" data-action="print-zeitplan" data-id="${tag.id}">Als PDF</button>
      </div>
    </section>
    ${tag.vorlage ? '' : zeitenKarte(tag, b)}
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
  b.wetter = tag.vorlage ? null : await wetterVon(tag);
  const fahrt = tag.vorlage ? null : fahrtVon(tag, await db.getMeta('startpunkt'));
  const reiter = [['briefing', 'Briefing'], ['shots', `Shots (${shots.length})`], ['orte', `Orte (${locations.length})`], ['plan', 'Plan']];
  let inhalt;
  if (tab === 'briefing') inhalt = tabBriefing(tag, locations, videos, medien);
  else if (tab === 'orte') inhalt = tabOrte(tag, shots, locations, videos, medien);
  else if (tab === 'plan') inhalt = tabPlan(tag, locations, absender, shots, b);
  else inhalt = tabShots(tag, shots, locations, videos, medien, b);
  return `
    <header class="top">
      ${zurueck('#/')}
      <h1>${esc(tag.kunde)}</h1>
      <a class="top-btn" href="#/tag/${id}/bearbeiten">Bearbeiten</a>
    </header>
    <main>
      ${tag.vorlage ? '' : `<a class="btn primary big faden-start" href="#/faden/${id}">▶ Roter Faden</a>`}
      ${tag.abgeschlossen
        ? `<p class="hinweis abgeschlossen">✓ Abgeschlossen am ${new Date(tag.abgeschlossen).toLocaleDateString('de-DE')} <button class="mini" data-action="tag-oeffnen" data-id="${id}">Wieder öffnen</button></p>`
        : !tag.vorlage && tag.datum && tag.datum <= heute() ? `<button class="btn big" data-action="tag-abschliessen" data-id="${id}">Drehtag abschließen</button>` : ''}
      ${tag.abgeschlossen && !tag.kartenGesichert ? `<p class="hinweis warn-hinweis">Speicherkarten noch nicht doppelt gesichert. Erst danach formatieren. <button class="mini" data-action="karten-gesichert" data-id="${id}">✓ Gesichert</button></p>` : ''}
      ${tag.vorlage || tag.abgeschlossen ? '' : ampelKarte(b)}
      ${infoKarte(tag, { fahrt, wetter: b.wetter })}
      <nav class="tabs tabs4">
        ${reiter.map(([r, l]) => `<a class="${tab === r ? 'an' : ''}" href="#/tag/${id}${r === 'shots' ? '' : '/' + r}">${l}</a>`).join('')}
      </nav>
      ${inhalt}
    </main>`;
}

// Zeiten für die Abrechnung: Abfahrt, Ankunft, Ende vor Ort, zurück. "Jetzt" trägt die Uhrzeit ein.
const ZEIT_FELDER = [['abfahrt', 'Abfahrt'], ['ankunft', 'Ankunft'], ['ende', 'Ende vor Ort'], ['zurueck', 'Zurück']];
function zeitenKarte(tag, b) {
  const zt = tag.zeiten || {};
  const haken = (b?.shots || []).map((s) => s.erledigtUm).filter(Boolean).sort((x, y) => x - y);
  const ist = b ? fadenStationen(b).map((st) => ({ st, ist: stationIst(st) })).filter((x) => x.ist) : [];
  return `
    <section class="card form">
      <div class="kopfzeile"><h2>Zeiten</h2><span class="mute">für die Abrechnung</span></div>
      <label data-save="tagfeld" data-id="${tag.id}">Fahrzeit in Minuten (leer = Schätzung aus Startpunkt und Koordinaten)
        <input type="number" name="fahrzeit" value="${esc(tag.fahrzeit || '')}" min="0" step="5" inputmode="numeric" data-rerender>
      </label>
      ${ZEIT_FELDER.map(([k, l]) => `
        <div class="zeit-zeile" data-save="zeiten" data-id="${tag.id}">
          <span>${l}</span>
          <input type="time" name="${k}" value="${esc(zt[k] || '')}" aria-label="${l}">
          <button class="mini" data-action="zeit-jetzt" data-id="${tag.id}" data-feld="${k}">Jetzt</button>
        </div>`).join('')}
      ${haken.length ? `<p class="mute">Gedreht (erster bis letzter Haken): ${uhrzeitVon(haken[0])}–${uhrzeitVon(haken[haken.length - 1])}</p>` : ''}
      ${ist.length ? `<p class="mute">${ist.map(({ st, ist: i }) => `${esc(st.titel)}: Plan ${st.von ? `${st.von}–${st.bis}` : `${st.dauer || '–'} Min.`}, Ist ${i.von}–${i.bis}`).join('<br>')}</p>` : ''}
      <button class="btn" data-action="share-zeiten" data-id="${tag.id}">Zeiten teilen</button>
    </section>`;
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
  if (shot.typ === 'interview') return viewInterview(shot, { locations, videos, medien, tag });
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
        ${haken(shot)}
        ${sprech && shot.typ !== 'oton' ? textFeld + titelFeld : titelFeld + textFeld}
        ${sprech && hatText ? `<label class="check-row"><input type="checkbox" class="chk" data-change="freigabe" data-id="${id}" ${freigegeben(shot) ? 'checked' : ''}> Vom Kunden freigegeben${shot.freigabe && !freigegeben(shot) ? ' <small class="warn-text">· Text danach geändert</small>' : ''}</label>` : ''}
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
        ${locations.length > 1 ? `
        <div class="field">Ort noch offen? Auch möglich an:
          <div class="chips">${locations.filter((l) => l.id !== shot.locationId).map((l) => `
            <label class="chip"><input type="checkbox" data-change="auch-an" data-id="${shot.id}" value="${l.id}" ${(shot.auchAn || []).includes(l.id) ? 'checked' : ''}><span>${esc(l.name)}</span></label>`).join('')}</div>
          <small class="mute">Dann steht der Shot im Roten Faden an allen gewählten Orten unter „Optional“ und blockiert dort nichts.</small>
        </div>` : ''}
        <label>Setting <select name="settingId">${auswahl(settingsVon(tag), shot.settingId, 'Ohne Setting', '+ Neues Setting …')}</select></label>
        <label>Take <input name="take" value="${esc(shot.take)}" placeholder="z. B. Clip 0042, Take 3 – der beste" autocomplete="off"></label>
        ${shot.clips?.length ? `<p class="mute">Clips (von Claude zugeordnet): ${esc(shot.clips.join(', '))}</p>` : ''}
        <label>Notiz <textarea name="notiz" class="auto" rows="2" placeholder="Bildidee, Licht, Ablauf …">${esc(shot.notiz)}</textarea></label>
      </section>
      <section class="card">
        <h2>Skizzen und Fotos</h2>
        ${medienBlock(medien.filter((m) => m.art !== 'unterschrift'), 'shot', id)}
      </section>
    </main>`;
}

// Die drei Häkchen oben auf der Shot-Seite
const haken = (shot) => `
  <div class="haken3">
    <label class="check-row"><input type="checkbox" class="chk" name="erledigt" ${shot.erledigt ? 'checked' : ''}> Erledigt</label>
    <label class="check-row"><input type="checkbox" class="chk chk-pflicht" name="pflicht" ${shot.pflicht ? 'checked' : ''}> Pflicht</label>
    <label class="check-row"><input type="checkbox" class="chk chk-fav" name="favorit" ${shot.favorit ? 'checked' : ''}> ★ Favorit</label>
  </div>`;

// Interview-Karte: Person (für die Bauchbinde), Visitenkarte, Fragen, Einverständnis mit Unterschrift
function viewInterview(shot, { locations, videos, medien, tag }) {
  const id = shot.id;
  const ein = shot.einverstaendnis;
  const unterschrift = ein ? medien.find((m) => m.id === ein.unterschriftId) : null;
  return `
    <header class="top">
      ${zurueck('#/tag/' + shot.drehtagId)}
      <h1>Interview</h1>
      <button class="top-btn" data-action="del-shot" data-id="${id}">Löschen</button>
    </header>
    <main>
      <section class="card form" data-save="shot" data-id="${id}">
        ${haken(shot)}
        <label>Name <input name="titel" value="${esc(shot.titel)}" autocomplete="off" placeholder="Vor- und Nachname"></label>
        <div class="row2">
          <label>Funktion <input name="funktion" value="${esc(shot.funktion || '')}" autocomplete="off" placeholder="z. B. Geschäftsführerin"></label>
          <label>Firma <input name="firma" value="${esc(shot.firma || '')}" autocomplete="off"></label>
        </div>
        <label>Kontakt <input name="kontakt" value="${esc(shot.kontakt || '')}" autocomplete="off" placeholder="Telefon oder E-Mail"></label>
        <label class="btn">📷 Visitenkarte oder Namensschild fotografieren<input type="file" accept="image/*" capture="environment" hidden data-change="add-photo" data-owner="shot" data-id="${id}"></label>
        <p class="mute" style="margin-top:-4px">Das Foto liegt unten bei den Bildern. Name und Funktion bitte abtippen, die Schreibweise geht so in die Bauchbinde.</p>
        <label>Fragen (eine pro Zeile)
          <textarea name="text" class="auto" rows="5" placeholder="Stellen Sie sich bitte kurz vor.">${esc(shot.text)}</textarea>
        </label>
        <div class="row2">
          <label>Video <select name="videoId">${videoOptionen(videos, shot.videoId)}</select></label>
          <label>Location <select name="locationId">${ortOptionen(locations, shot.locationId)}</select></label>
        </div>
        <label>Art <select name="typ" data-rerender>${typOptionen(shot.typ)}</select></label>
        <label>Setting <select name="settingId">${auswahl(settingsVon(tag), shot.settingId, 'Ohne Setting', '+ Neues Setting …')}</select></label>
        <label>Notiz <textarea name="notiz" class="auto" rows="2">${esc(shot.notiz)}</textarea></label>
        ${shot.clips?.length ? `<p class="mute">Clips (von Claude zugeordnet): ${esc(shot.clips.join(', '))}</p>` : ''}
      </section>
      <section class="card">
        <div class="kopfzeile"><h2>Einverständnis</h2>${ein ? '<span class="ok">✓ unterschrieben</span>' : '<span class="mute">fehlt</span>'}</div>
        ${ein ? `
          <p>${esc(ein.name || shot.titel || '')} · ${new Date(ein.zeit).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          ${unterschrift ? `<img class="unterschrift-bild" src="${bildUrl(unterschrift.blob)}" alt="Unterschrift">` : ''}
          <div class="btn-row">
            <button class="btn primary" data-action="einverstaendnis-pdf" data-id="${id}">Als PDF</button>
            <button class="btn" data-action="einverstaendnis-weg" data-id="${id}">Entfernen</button>
          </div>`
        : `<p class="mute" style="margin-bottom:10px">Die Person liest den Text und unterschreibt auf dem Handy. Den Text trägst du einmal unter „Sicherung“ ein.</p>
           <button class="btn primary big" data-action="einverstaendnis" data-id="${id}">✍ Unterschreiben lassen</button>`}
      </section>
      <section class="card">
        <h2>Fotos</h2>
        ${medienBlock(medien.filter((m) => m.art !== 'unterschrift'), 'shot', id, { skizze: false })}
      </section>
    </main>`;
}

// Einverständnis zum Drucken oder als PDF
export function einverstaendnisBlatt(shot, tag, bild) {
  const ein = shot.einverstaendnis;
  return `
    <div class="druck">
      <div class="s-bar no-print">
        <button data-d="close">Schließen</button>
        <button data-d="print" class="s-save">Drucken / als PDF</button>
      </div>
      <article class="blatt">
        <p class="blatt-marke">Einverständniserklärung</p>
        <h1>${esc(ein.name || shot.titel || '')}</h1>
        <p class="blatt-kopf">${esc([shot.funktion, shot.firma].filter(Boolean).join(', '))}${shot.kontakt ? '<br>' + esc(shot.kontakt) : ''}</p>
        <p class="vor">${esc(ein.text || '')}</p>
        <p>Produktion: ${esc(tag.kunde)}${tag.datum ? ', ' + esc(fmtDatum(tag.datum)) : ''}${tag.ort ? ', ' + esc(tag.ort) : ''}</p>
        <p>Unterschrieben am ${new Date(ein.zeit).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })} Uhr</p>
        ${bild ? `<img class="unterschrift-bild" src="${bild}" alt="Unterschrift">` : ''}
        <p class="grau">Unterschrift ${esc(ein.name || shot.titel || '')}</p>
      </article>
    </div>`;
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
        <h2>Bild vom Aufbau</h2>
        <p class="mute" style="margin-bottom:10px">Foto vom Set oder Skizze von oben. Beim Zeichnen unter „Symbole“ Licht, Kamera, Person und Mikro setzen; ziehen gibt die Richtung an.</p>
        ${medienBlock(b.medien.filter((m) => m.settingId === x.id), 'setting', `${tagId}~${x.id}`)}
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
        ${shots.some(istSprech) ? sammelKnoepfe(`data-id="${tag.id}" data-ort="${id}"`) : ''}
      </section>
    </main>`;
}

// Location-Prompter: alle Sprechtexte hier am Stück, eigener Prompter oder andere Teleprompter-App
function sammelKnoepfe(daten, anzahlTexte) {
  return `
    <div class="sammel">
      <p class="mute">Alle Sprechtexte hier am Stück${anzahlTexte ? ` (${anzahlTexte})` : ''}</p>
      <div class="btn-row">
        <button class="btn" data-action="prompt-station" ${daten}>${gekoppelt() ? '▶ Alle auf 2. Gerät' : '▶ Location-Prompter'}</button>
        <button class="btn" data-action="share-station" ${daten}>An Teleprompter-App</button>
      </div>
    </div>`;
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

// Optionale Shots einer Station: Ort war bei der Planung offen. Sie zählen nicht zum Fortschritt.
function optionalListe(liste, videoVon, anderswo) {
  if (!liste.length) return '';
  return `
    <p class="abschnitt">Optional hier · ${liste.length}</p>
    <ul class="shots optional">${liste.map((s) => {
      const typ = typVon(s.typ);
      const orte = anderswo(s);
      return `
      <li class="shot typ-${typ.id}">
        <div class="shot-kopf">
          <input type="checkbox" class="chk" data-change="toggle-shot" data-id="${s.id}" aria-label="Erledigt">
          <button class="shot-main faden-wahl" data-action="faden-waehle" data-id="${s.id}">
            <span class="schilder"><span class="tag tag-${typ.id}">${typ.kurz}</span><span class="fav">optional</span></span>
            ${s.titel ? `<span class="shot-titel">${esc(s.titel)}</span>` : ''}
            ${s.text ? `<span class="shot-text ${!s.titel ? 'solo' : ''} gekuerzt2">${esc(s.text)}</span>` : ''}
            <span class="shot-meta">${esc([videoVon(s)?.name, orte.length ? 'auch möglich: ' + orte.join(', ') : ''].filter(Boolean).join(' · '))}</span>
          </button>
        </div>
      </li>`;
    }).join('')}</ul>`;
}

// Pflicht-Shots über den ganzen Tag: eine Zeile, aufgeklappt die offenen zum Abhaken oder Auswählen
function pflichtLeiste(tag, p, aktuell, videoVon) {
  const offen = z.pflichtOffen === tag.id;
  return `
    <div class="pflicht-leiste ${p.offen.length ? '' : 'alle'}">
      <button class="pflicht-kopf" data-action="pflicht-auf" data-id="${tag.id}">
        <b>Pflicht ${p.erledigt}/${p.gesamt}</b>
        <span class="mute">${p.offen.length ? `${p.offen.length} offen ${offen ? '▴' : '▾'}` : '✓ alle im Kasten'}</span>
      </button>
      ${offen && p.offen.length ? `<ul class="shots">${p.offen.map((s) => {
        const typ = typVon(s.typ);
        return `
        <li class="shot typ-${typ.id}">
          <div class="shot-kopf">
            <input type="checkbox" class="chk" data-change="toggle-shot" data-id="${s.id}" aria-label="Erledigt">
            <button class="shot-main faden-wahl" data-action="faden-waehle" data-id="${s.id}" ${s.id === aktuell?.id ? 'disabled' : ''}>
              <span class="schilder"><span class="tag tag-${typ.id}">${typ.kurz}</span>${s.id === aktuell?.id ? '<span class="fav">gerade dran</span>' : ''}</span>
              <span class="shot-titel">${esc(shotName(s))}</span>
              ${videoVon(s) ? `<span class="shot-meta">${esc(videoVon(s).name)}</span>` : ''}
            </button>
          </div>
        </li>`;
      }).join('')}</ul>` : ''}
    </div>`;
}

// Interview im Faden: Bauchbinde, Fragen zum Abhaken, Einverständnis
function interviewImFaden(shot) {
  const ok = new Set(shot.fragenOk || []);
  const fragen = interviewFragen(shot);
  const bb = [shot.funktion, shot.firma].filter(Boolean).join(', ');
  return `
    ${bb ? `<p class="faden-notiz">${esc(bb)}</p>` : ''}
    ${fragen.length ? `<ol class="fragen-liste">${fragen.map((f, i) => `
      <li><button class="${ok.has(f) ? 'ok' : ''}" data-action="frage-ok" data-id="${shot.id}" data-nr="${i}">${esc(f)}</button></li>`).join('')}</ol>` : '<p class="mute">Noch keine Fragen.</p>'}
    <button class="btn ${shot.einverstaendnis ? 'an' : ''} einverstaendnis-knopf" data-action="${shot.einverstaendnis ? 'faden-nichts' : 'einverstaendnis'}" data-id="${shot.id}">${shot.einverstaendnis ? '✓ Einverständnis unterschrieben' : '✍ Einverständnis unterschreiben lassen'}</button>`;
}

export async function viewFaden(id) {
  const b = await db.buendel(id);
  if (!b) return null;
  const tag = b.drehtag;
  const { stationen, idx, nachholen, gesamt, erledigt } = fadenStand(b);
  const nachholModus = nachholen.length && (idx < 0 || z.fadenModus === 'nachholen');
  const st = nachholModus ? null : stationen[idx];
  const liste = nachholModus ? nachholen : st ? st.offen : [];
  const optionalHier = st ? st.optional : [];
  const pflicht = pflichtStand(b);
  const shot = liste.find((s) => s.id === z.fadenShot) || optionalHier.find((s) => s.id === z.fadenShot)
    || pflicht.offen.find((s) => s.id === z.fadenShot) || liste[0] || null;
  const shotOptional = shot && istOptional(shot);
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
  // Fester Programmpunkt in Kürze (Event): Hinweis mit Sprung zur Station
  const fest = naechsterFest(b);
  const gleich = fest ? { ...fest, key: 'b:' + fest.id } : null;
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
        <button class="btn primary big" data-action="tag-abschliessen" data-id="${tag.id}">Drehtag abschließen</button>
        <a class="btn big" href="#/tag/${tag.id}">Zur Shotliste</a>
      </section>`;
  } else if (!shot) {
    // Station ohne Shots: Aufbau, Pause, Abbau (optionale Shots stehen darunter)
    inhalt = `
      <section class="faden-karte">
        <h2 class="faden-titel">${esc(st.titel)}</h2>
        ${st.dauer ? `<p class="mute">geplant ${st.dauer} Min.</p>` : ''}
        ${tag.zeitplan?.bloecke?.find((x) => 'b:' + x.id === st.key)?.hinweis ? `<p>${esc(tag.zeitplan.bloecke.find((x) => 'b:' + x.id === st.key).hinweis)}</p>` : ''}
      </section>
      <button class="btn primary faden-ok" data-action="faden-station-fertig" data-id="${tag.id}" data-key="${esc(st.key)}">✓ Erledigt, weiter</button>
      ${optionalListe(st.optional, videoVon, () => [])}`;
  } else {
    const typ = typVon(shot.typ);
    const video = videoVon(shot);
    const sprech = ['hook', 'oton', 'cta', 'interview'].includes(shot.typ) && (shot.text || '').trim();
    // Setting des Shots. Wechselt es gegenüber dem Shot davor in der Station, steht "Umbau" da.
    const setting = settingVon(tag, shot.settingId);
    const reihe = st ? st.shots : [];
    const vorher = reihe[reihe.findIndex((s) => s.id === shot.id) - 1];
    const umbau = setting && vorher && vorher.settingId !== shot.settingId;
    const settingBild = setting && umbau ? b.medien.filter((m) => m.settingId === setting.id).sort((p, q) => q.erstellt - p.erstellt)[0] : null;
    const settingBlock = setting ? `
      <a class="faden-setting ${umbau ? 'umbau' : ''}" href="#/setting/${tag.id}/${setting.id}">
        <b>${umbau ? 'Umbau auf: ' : 'Setting: '}${esc(setting.name)}</b>
        ${settingKurz(setting) ? `<span>${esc(settingKurz(setting))}</span>` : ''}
        ${umbau && (setting.kamera || setting.notiz) ? `<span>${esc([setting.kamera, setting.notiz].filter(Boolean).join(' · '))}</span>` : ''}
        ${settingBild ? `<img class="faden-setting-bild" src="${bildUrl(settingBild.blob)}" alt="Aufbau">` : ''}
      </a>` : '';
    const danach = liste.filter((s) => s.id !== shot.id);
    inhalt = `
      ${settingBlock}
      <section class="faden-karte typ-${typ.id}">
        <button class="faden-label" data-action="faden-klappe" data-id="${shot.id}" aria-label="Klappe groß anzeigen">
          <span class="tag tag-${typ.id}">${typ.kurz}</span>
          <span>${esc(video ? video.name : 'Ohne Video')}</span>
          ${shotOptional ? '<span class="fav">optional</span>' : ''}
          ${shot.pflicht ? '<span class="pflicht">Pflicht</span>' : ''}
        </button>
        ${shot.titel ? `<h2 class="faden-titel">${esc(shot.titel)}</h2>` : ''}
        ${shot.typ === 'interview' ? interviewImFaden(shot) : shot.text ? `<div class="faden-text ${shot.titel ? '' : 'gross'}">${esc(shot.text)}</div>` : ''}
        ${shot.notiz ? `<p class="faden-notiz">${esc(shot.notiz)}</p>` : ''}
        ${nachholModus && ortVon(shot) ? `<p class="faden-notiz">Location: ${esc(ortVon(shot).name)}</p>` : ''}
        ${shot.format === 'quer' ? '<p class="faden-notiz"><b>Querformat</b></p>' : ''}
      </section>
      <button class="btn primary faden-ok" data-action="faden-erledigt" data-id="${shot.id}">✓ Erledigt</button>
      <div class="btn-row faden-neben">
        <button class="btn" data-action="faden-spaeter" data-id="${shot.id}">Später</button>
        ${sprech ? `<button class="btn" data-action="prompt-text" data-id="${shot.id}">${gekoppelt() ? '▶ Auf 2. Gerät' : shot.typ === 'interview' ? '▶ Fragen' : '▶ Prompter'}</button>` : ''}
        <a class="btn" href="#/shot/${shot.id}">Details</a>
        ${istNativ ? `<button class="btn ${gekoppelt() ? 'an' : ''}" data-action="koppeln">${gekoppelt() ? '📱 Verbunden' : '📱 2. Gerät'}</button>` : ''}
      </div>
      ${fadenListe(nachholModus ? nachholen : st.shots, shot, videoVon, nachholModus, (s) => settingVon(tag, s.settingId)?.name || '')}
      ${optionalListe(optionalHier.filter((s) => s.id !== shot.id), videoVon, (s) => moeglicheOrte(s).filter((o) => o !== st?.locationId).map((o) => b.locations.find((l) => l.id === o)?.name).filter(Boolean))}
      ${!nachholModus && stationSprechtexte(st).length > 1 ? sammelKnoepfe(`data-id="${tag.id}" data-key="${esc(st.key)}"`, stationSprechtexte(st).length) : ''}
      ${!nachholModus && danach.length ? `<button class="btn faden-rest" data-action="faden-rest-spaeter" data-id="${tag.id}" data-key="${esc(st.key)}">Station verlassen, Rest später</button>` : ''}`;
  }

  return `
    <header class="top">
      <a class="back" href="#/tag/${tag.id}" aria-label="Zurück">‹</a>
      <h1>Roter Faden</h1>
      ${sprachMoeglich ? `<button class="top-btn mikro-knopf ${sprachGewuenscht() ? 'an' : ''}" data-action="sprache" aria-label="Sprachbefehle ${sprachGewuenscht() ? 'aus' : 'an'}schalten">🎙</button>` : ''}
      <button class="top-btn marker-knopf" data-action="marker" data-id="${tag.id}" aria-label="Marker setzen">⚑${markerVon(tag).length ? ' ' + markerVon(tag).length : ''}</button>
      <span class="top-info">${erledigt}/${gesamt}</span>
    </header>
    <main class="faden">
      ${band}
      <div class="bar faden-bar"><i style="width:${gesamt ? (erledigt / gesamt) * 100 : 0}%"></i></div>
      <p class="faden-status">${status}</p>
      ${gleich && gleich.key !== st?.key ? `<p class="faden-gleich">📌 Gleich: <b>${esc(gleich.titel || 'Programmpunkt')}</b> um ${gleich.von} (${gleich.in ? `in ${gleich.in} Min.` : 'jetzt'}) <button data-action="faden-station" data-id="${tag.id}" data-key="${esc(gleich.key)}">Dorthin</button></p>` : ''}
      ${tag.datum === heute() && !tag.zeiten?.ankunft && !tag.abgeschlossen ? `<p class="faden-auto">Angekommen? <button data-action="zeit-jetzt" data-id="${tag.id}" data-feld="ankunft">Ankunft jetzt eintragen</button></p>` : ''}
      ${pflicht.gesamt ? pflichtLeiste(tag, pflicht, shot, videoVon) : ''}
      ${z.fadenAuto === tag.id ? `<p class="faden-auto">Automatisch geöffnet, weil heute Drehtag ist. <button data-action="faden-auto-aus" data-id="${tag.id}">Heute nicht mehr</button></p>` : ''}
      ${zuletzt ? `<p class="faden-zuletzt">✓ ${esc(kurz(shotName(zuletzt), 34))} <button data-action="faden-undo" data-id="${zuletzt.id}">Rückgängig</button></p>` : ''}
      ${inhalt}
      ${st || nachholModus ? `<button class="btn faden-ende" data-action="tag-abschliessen" data-id="${tag.id}">Drehtag abschließen</button>` : ''}
    </main>`;
}

// ---------- Sicherung ----------

// Einstellungen für die Sprachnotiz: Whisper-Modell, Modus, Claude-Schlüssel (nur in der Android-App)
async function sprachKarte() {
  if (!istNativ) {
    return `<section class="card"><h2>Sprachnotizen</h2><p class="mute">Transkribieren und Einsortieren direkt auf dem Handy gibt es in der Android-App. Hier im Browser geht die Aufnahme über „Datei für Claude“ an den PC.</p></section>`;
  }
  let st = {};
  try { st = await sprache.status(); } catch { /* ohne Plugin */ }
  const modell = (await db.getMeta('whisperModell')) || 'schnell';
  const modus = (await db.getMeta('sprachModus')) || 'sortieren';
  const mb = (n) => `${Math.round(n / 1048576)} MB`;
  const zeile = (id, name, info) => `
    <div class="info-row">
      <span>${name}<br><small class="mute">${info}</small></span>
      <div>${st[id] ? `<b>${modell === id ? '✓ aktiv' : 'geladen'}</b> · ${mb(st[id])}` : '<span class="mute">nicht geladen</span>'}
        <div class="btn-row" style="margin-top:4px">
          ${modell === id && st[id] ? '' : `<button class="mini" data-action="sprach-modell" data-id="${id}">${st[id] ? 'Verwenden' : 'Laden'}</button>`}
          ${st[id] ? `<button class="mini" data-action="sprach-modell-weg" data-id="${id}">Löschen</button>` : ''}
        </div>
      </div>
    </div>`;
  return `
    <section class="card">
      <h2>Sprachnotizen</h2>
      <p class="mute" style="margin-bottom:8px">Whisper erkennt die Sprache auf dem Handy, ohne Internet. Das Modell wird einmal geladen.</p>
      ${zeile('schnell', 'Schnell', 'Whisper small, ca. 190 MB')}
      ${zeile('genau', 'Genau', 'Whisper large-v3-turbo, ca. 550 MB, langsamer')}
      <div class="field" style="margin-top:12px">Nach dem Aufnehmen
        <div class="seg" role="group" aria-label="Nach dem Aufnehmen">
          <button data-action="sprach-modus" data-id="sortieren" class="${modus === 'sortieren' ? 'an' : ''}">Einsortieren</button>
          <button data-action="sprach-modus" data-id="text" class="${modus === 'text' ? 'an' : ''}">Nur Text</button>
        </div>
      </div>
      <p class="mute">Einsortieren: Claude verteilt das Transkript auf Briefing, Videos und Hook-Vorschläge. Dafür geht das Transkript (nicht die Aufnahme) übers Internet an Anthropic; ca. 5 Cent pro Notiz (Schätzung).</p>
      <label>Claude-API-Schlüssel ${st.claude ? '<b>✓ hinterlegt</b>' : ''}
        <input id="claude-schluessel" type="password" autocomplete="off" placeholder="${st.claude ? 'neuen Schlüssel eintragen oder leer lassen zum Entfernen' : 'sk-ant-…'}">
      </label>
      <p class="mute" style="margin-top:-6px">Wird verschlüsselt im Handy gespeichert und nur für diese Auswertung benutzt. Schlüssel gibt es unter console.anthropic.com.</p>
      <button class="btn" data-action="claude-schluessel">Schlüssel speichern</button>
    </section>`;
}

// Einstellungen: Erinnerungen, Startpunkt für die Fahrzeit, Wetter, Einverständnis-Text, Vorlagen
async function einstellungKarten() {
  const [stufe, startpunkt, wetterAn, text, tage] = await Promise.all([
    db.getMeta('erinnerungen'), db.getMeta('startpunkt'), db.getMeta('wetterAn'), db.getMeta('einverstaendnisText'), db.getAll('drehtage'),
  ]);
  const st = stufe || 'normal';
  const fehlend = MITGELIEFERT.filter((v) => !tage.some((t) => t.mitgeliefert === v.key));
  const seg = (aktion, wert, aktiv, label) => `<button data-action="${aktion}" data-id="${wert}" class="${aktiv ? 'an' : ''}">${label}</button>`;
  return `
    <section class="card">
      <h2>Erinnerungen</h2>
      <p class="mute" style="margin-bottom:8px">Kommen über die Kalender-Datei des Drehtags („Teilen und Export“ › „Kalender-Datei“), auch wenn die App zu ist.</p>
      <div class="seg seg3" role="group" aria-label="Erinnerungen">
        ${seg('erinnerung-stufe', 'aus', st === 'aus', 'Aus')}${seg('erinnerung-stufe', 'wenig', st === 'wenig', 'Wenig')}${seg('erinnerung-stufe', 'normal', st === 'normal', 'Normal')}
      </div>
      <p class="mute" style="margin-top:8px">${st === 'aus' ? 'Keine Erinnerungen, nur die Termine.'
        : st === 'wenig' ? 'Vorabend 18 Uhr und Abfahrt (ohne Startpunkt: 1 Stunde vor Drehbeginn).'
        : 'Vorabend, Abfahrt, 10 Min. vor jedem festen Programmpunkt (dicht beieinander zusammengefasst) und einmal 1 Stunde vor Ende, wenn es Pflicht-Shots gibt.'}</p>
    </section>
    ${sprachMoeglich ? `
    <section class="card">
      <h2>Sprachbefehle</h2>
      <p class="mute">Im Roten Faden oben auf 🎙 tippen. Dann reicht <b>„Faden“</b> zum Abhaken, dazu „Faden zurück“, „Faden später“ und „Faden Marker“. Im Teleprompter startet und stoppt „Faden“ den Text. Die Erkennung läuft über den Browser (Google bzw. Apple); die App speichert keinen Ton.</p>
    </section>` : ''}
    <section class="card form" data-save="meta-startpunkt">
      <h2>Startpunkt für die Fahrzeit</h2>
      <label>Koordinaten (z. B. Büro)
        <input name="koordinaten" value="${esc(startpunkt?.koordinaten || '')}" placeholder="z. B. 51.0504, 6.2214" autocomplete="off">
      </label>
      <button class="btn" data-action="startpunkt-hier">📍 Aktuellen Standort nehmen</button>
      <p class="mute">Bleibt nur auf diesem Gerät. Die Fahrzeit ist eine grobe Schätzung über die Luftlinie; am Drehtag lässt sie sich unter „Plan“ › „Zeiten“ genau eintragen.</p>
    </section>
    <section class="card">
      <h2>Wetter</h2>
      <p class="mute" style="margin-bottom:8px">Vorhersage für die Koordinaten des Drehorts (bis 16 Tage vorher) über Open-Meteo. Übertragen werden nur Koordinaten und Datum.</p>
      <div class="seg" role="group" aria-label="Wetter laden">
        ${seg('wetter-an', 'an', wetterAn !== false, 'Laden')}${seg('wetter-an', 'aus', wetterAn === false, 'Aus')}
      </div>
    </section>
    <section class="card form" data-save="meta" data-id="einverstaendnisText">
      <h2>Einverständnis bei Interviews</h2>
      <label>Text, den die Person unterschreibt
        <textarea name="einverstaendnisText" class="auto" rows="5" placeholder="Geprüften Text hier einfügen">${esc(text || '')}</textarea>
      </label>
      <p class="mute">Den Text bitte rechtlich prüfen lassen. Er wird beim Unterschreiben mit gespeichert.</p>
    </section>
    <section class="card">
      <h2>Mitgelieferte Vorlagen</h2>
      <p class="mute" style="margin-bottom:8px">${MITGELIEFERT.map((v) => esc(v.name)).join(' · ')}</p>
      ${fehlend.length ? `<button class="btn" data-action="vorlagen-zurueck">${anzahl(fehlend.length, 'gelöschte Vorlage', 'gelöschte Vorlagen')} wiederherstellen</button>` : '<p class="mute">Alle vorhanden.</p>'}
    </section>`;
}

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
      ${await einstellungKarten()}
      ${await sprachKarte()}
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
