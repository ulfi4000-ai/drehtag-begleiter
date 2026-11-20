// Reine Daten-Logik ohne Browser-Teile (kein Bildschirm, keine Datenbank).
// Die App im Browser und der MCP-Server am PC benutzen dieselbe Datei,
// damit beide gleich gruppieren, gleich rechnen und gleich zusammenführen.

export const TYPEN = [
  { id: 'hook', label: 'Hooks', kurz: 'Hook' },
  { id: 'oton', label: 'Skripte & O-Töne', kurz: 'Skript/O-Ton' },
  { id: 'interview', label: 'Interviews', kurz: 'Interview' },
  { id: 'broll', label: 'B-Roll', kurz: 'B-Roll' },
  { id: 'cta', label: 'CTA', kurz: 'CTA' },
  { id: 'karussell', label: 'Karussells', kurz: 'Karussell' },
  { id: 'sonst', label: 'Sonstiges', kurz: 'Sonstiges' },
];

export const STATUS = [
  { id: 'erstgespraech', label: 'Erstgespräch' },
  { id: 'skripte', label: 'Skripte' },
  { id: 'drehbereit', label: 'Drehbereit' },
  { id: 'gedreht', label: 'Gedreht' },
  { id: 'schnitt', label: 'Im Schnitt' },
  { id: 'geliefert', label: 'Geliefert' },
];

// Fragen fürs Erstgespräch. Das erste Set kommt automatisch, die anderen auf Knopfdruck.
export const FRAGEN_SETS = [
  { id: 'allgemein', label: 'Allgemein', fragen: [
    'Was soll das Video erreichen?',
    'Wen soll es ansprechen?',
    'Die drei wichtigsten Aussagen',
    'Wo wird es gezeigt (Reel, Story, Website, Anzeige)?',
    'Wie viele Videos, in welcher Länge?',
    'Stil und Vorbilder',
    'Was darf nicht gesagt oder gezeigt werden?',
    'Wer steht vor der Kamera?',
    'Wer gibt frei, und bis wann?',
    'Termine: Dreh, Lieferung, Veröffentlichung',
  ] },
  { id: 'makler', label: 'Makler-Objekt', fragen: [
    'Objektart und Lage',
    'Eckdaten, die genannt werden dürfen (Fläche, Zimmer, Preis)',
    'Highlights des Objekts',
    'Schwächen und wie wir damit umgehen',
    'Wer ist der typische Käufer oder Mieter?',
    'Was darf nicht ins Bild (Privates, Nachbarn, Adresse)?',
    'Bewohnt oder leer? Zugang und Schlüssel',
  ] },
  { id: 'interview', label: 'Interview', fragen: [
    'Wer wird interviewt (Name, Rolle)?',
    'Thema und Kernbotschaft',
    'Welche Fragen werden gestellt?',
    'Was soll nicht vorkommen?',
    'Was ist der Aufruf am Ende (CTA)?',
  ] },
  { id: 'event', label: 'Event', fragen: [
    'Programm mit festen Uhrzeiten',
    'Wichtige Personen (Name, Funktion), die ins Bild sollen',
    'Interviewpartner und wann sie Zeit haben',
    'Branding vor Ort (Logo-Wand, Aufsteller, Merch)',
    'Was oder wer darf nicht gefilmt werden?',
    'Ansprechpartner vor Ort (Handy)',
    'Akkreditierung, Parken, Lager- und Ladeplatz fürs Equipment',
    'Was wird geliefert (Aftermovie, Reels, Fotos) und bis wann?',
  ] },
];

// Startliste fürs Packen. Gedacht zum Anpassen.
export const PACK_START = ['Kamera', 'Objektive', 'Akkus (geladen)', 'Speicherkarten (leer)', 'Stativ', 'Mikrofon', 'Licht', 'Ladegeräte'];

// Kopf jeder Drehtag-Datei, die zwischen Handy und PC wandert
export const DATEI_KOPF = { app: 'drehtag-begleiter', art: 'drehtag', version: 3 };

// ---------- Kleine Helfer ----------

export const neueId = () =>
  (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const nachPos = (a, b) => (a.pos || 0) - (b.pos || 0);
export const typVon = (id) => TYPEN.find((t) => t.id === id) || TYPEN[TYPEN.length - 1];
export const statusVon = (id) => STATUS.find((s) => s.id === id) || STATUS[0];

export function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-11-12" -> "Do., 12.11.2026"
export function fmtDatum(iso) {
  if (!iso) return 'ohne Datum';
  return new Date(iso + 'T00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const wannText = (tag) =>
  [tag.datum ? fmtDatum(tag.datum) : '', tag.uhrzeit ? tag.uhrzeit + ' Uhr' : ''].filter(Boolean).join(', ');
const einruecken = (t, mit = '    ') => String(t).trim().replace(/\n/g, '\n' + mit);
const eineZeile = (t) => String(t).trim().replace(/\s*\n\s*/g, ' / ');

// Kurzer Name eines Shots: Titel, sonst der Anfang des Sprechtexts
export function shotName(s) {
  if (s.titel) return s.titel;
  const t = (s.text || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Ohne Titel';
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

// ---------- Gruppieren ----------

// Shots in Gruppen aufteilen: nach Art, nach Location oder nach Video.
// Shotliste, Text-Export und MCP-Server benutzen dieselbe Funktion.
export function gruppieren(shots, locations, videos, modus) {
  const sortiert = [...shots].sort(nachPos);
  const nachListe = (liste, feld, ohne) => {
    const g = [...liste].sort(nachPos)
      .map((x) => ({ id: x.id, label: x.name, shots: sortiert.filter((s) => s[feld] === x.id) }));
    g.push({ id: '', label: ohne, shots: sortiert.filter((s) => !liste.some((x) => x.id === s[feld])) });
    return g;
  };
  let gruppen;
  if (modus === 'location') {
    gruppen = nachListe(locations || [], 'locationId', 'Ohne Location');
  } else if (modus === 'video') {
    gruppen = nachListe(videos || [], 'videoId', 'Ohne Video');
    // Innerhalb eines Videos in Ablauf-Reihenfolge: Hook, Skript, B-Roll, CTA
    const rang = (s) => TYPEN.indexOf(typVon(s.typ));
    for (const g of gruppen) g.shots.sort((a, b) => rang(a) - rang(b) || nachPos(a, b));
  } else {
    gruppen = TYPEN.map((t) => ({ id: t.id, label: t.label, shots: sortiert.filter((s) => typVon(s.typ).id === t.id) }));
  }
  return gruppen.filter((g) => g.shots.length);
}

// Stand eines Videos: wie viele Hooks, Skripte, B-Roll-Shots und CTAs sind im Kasten.
// Karussells zählen nur mit, wenn das Video welche hat.
export function videoStand(shots) {
  const arten = ['hook', 'oton', 'broll', 'cta'];
  if (shots.some((s) => s.typ === 'karussell')) arten.push('karussell');
  return arten.map((id) => {
    const liste = shots.filter((s) => s.typ === id);
    return { id, kurz: typVon(id).kurz, gesamt: liste.length, fertig: liste.filter((s) => s.erledigt).length };
  });
}
export const videoStandText = (shots) =>
  videoStand(shots).map((p) => `${p.kurz} ${p.gesamt ? `${p.fertig}/${p.gesamt}` : '–'}`).join(' · ');

// ---------- Zeitplan ----------

const inMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const alsZeit = (min) => {
  const x = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
const istZeit = (t) => /^\d{1,2}:\d{2}$/.test(t || '');

// Aus Drehbeginn und den Dauern der Blöcke die Uhrzeiten ausrechnen.
// Ein Block mit fester Startzeit (block.fest = "HH:MM", z. B. Programmpunkt beim Event) beginnt immer dann.
// Läuft der Block davor zu lang, steht die Überschneidung in "ueber" (Minuten).
export function zeitplanMitZeiten(start, bloecke) {
  let t = istZeit(start) ? inMin(start) : null;
  return (bloecke || []).map((b) => {
    const dauer = Math.max(0, Number(b.dauer) || 0);
    let ueber = 0;
    if (istZeit(b.fest)) {
      const f = inMin(b.fest);
      if (t != null && t > f) ueber = t - f;
      t = f;
    }
    const von = t;
    if (t != null) t += dauer;
    return { ...b, dauer, ueber, von: von == null ? '' : alsZeit(von), bis: von == null ? '' : alsZeit(von + dauer) };
  });
}

// Nächster fester Programmpunkt in den nächsten 45 Minuten (nur am Drehtag selbst)
export function naechsterFest(b, jetzt = new Date()) {
  if (b.drehtag.datum !== heute()) return null;
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  return zeitplanMitZeiten(b.drehtag.uhrzeit, b.drehtag.zeitplan?.bloecke)
    .filter((x) => istZeit(x.fest))
    .map((x) => ({ ...x, in: inMin(x.von) - min }))
    .find((x) => x.in >= 0 && x.in <= 45) || null;
}
export const zeitplanMinuten = (bloecke) => (bloecke || []).reduce((s, b) => s + Math.max(0, Number(b.dauer) || 0), 0);
export function zeitplanEnde(start, bloecke) {
  const z = zeitplanMitZeiten(start, bloecke);
  return z.length ? z[z.length - 1].bis : '';
}

// ---------- Settings (Aufbauten) ----------
// Ein Setting ist ein Aufbau: Kamera, Objektiv, Licht, Ton an einem Ort, zum Beispiel
// "Position A – sitzend am Campingtisch". Shots gehören zu einem Setting (shot.settingId).
// Die Liste liegt im Drehtag unter drehtag.settings.liste und hat einen eigenen Zeitstempel.
export const SETTING_FELDER = [
  { id: 'kamera', label: 'Kamera', platz: 'z. B. A7 V auf Tribex' },
  { id: 'objektiv', label: 'Objektiv', platz: 'z. B. 35 mm GM' },
  { id: 'licht', label: 'Licht', platz: 'z. B. STORM 400x mit 90er Softbox seitlich-vorn' },
  { id: 'ton', label: 'Ton', platz: 'z. B. DJI Mic 1 + Sanken' },
];

export const settingsVon = (tag) => [...(tag?.settings?.liste || [])].sort(nachPos);
export const settingVon = (tag, id) => (tag?.settings?.liste || []).find((x) => x.id === id) || null;
export const neuesSetting = (name, locationId = '', felder = {}) => ({
  id: neueId(), name, locationId, kamera: '', objektiv: '', licht: '', ton: '', notiz: '', pos: Date.now(), ...felder,
});
// Kurzbeschreibung für eine Zeile: "35 mm GM · STORM Softbox · Sanken"
export const settingKurz = (x) => [x.objektiv, x.licht, x.ton].map((t) => (t || '').trim()).filter(Boolean).join(' · ');

export function settingsText(b) {
  const liste = settingsVon(b.drehtag);
  if (!liste.length) return '';
  const ort = (id) => (b.locations || []).find((l) => l.id === id)?.name;
  const z = ['SETTINGS'];
  for (const x of liste) {
    const n = (b.shots || []).filter((s) => s.settingId === x.id).length;
    z.push(`${x.name}${ort(x.locationId) ? ` (${ort(x.locationId)})` : ''} · ${n} ${n === 1 ? 'Shot' : 'Shots'}`);
    for (const f of SETTING_FELDER) if ((x[f.id] || '').trim()) z.push(`    ${f.label}: ${x[f.id].trim()}`);
    if ((x.notiz || '').trim()) z.push(`    Notiz: ${einruecken(x.notiz, '    ')}`);
  }
  return z.join('\n');
}

// Technik aller Settings als Posten für die Packliste. Kommas trennen einzelne Teile,
// was schon auf der Liste steht (gleicher Name), kommt nicht doppelt.
export function packAusSettings(settings, posten) {
  const vorhanden = new Set(posten.map((p) => p.name.trim().toLowerCase()));
  const neu = [];
  for (const x of settings) {
    for (const f of SETTING_FELDER) {
      for (const teil of String(x[f.id] || '').split(/[,;]|\s\+\s/)) {
        const name = teil.trim();
        if (!name || vorhanden.has(name.toLowerCase())) continue;
        vorhanden.add(name.toLowerCase());
        neu.push({ id: neueId(), name, ok: false });
      }
    }
  }
  return neu;
}

// ---------- Roter Faden ----------
// Der Faden führt durch den Drehtag: Station für Station (in der Reihenfolge des Zeitplans),
// in jeder Station Shot für Shot. Abgehakt wird, der Faden rückt von selbst weiter.

// Minuten pro Shot für den Ablauf-Vorschlag. Annahmen, keine Messwerte; danach frei anpassbar.
// umbau: zusätzliche Minuten für jedes weitere Setting an derselben Location.
export const SCHAETZUNG = { hook: 3, oton: 5, interview: 15, cta: 2, broll: 3, karussell: 2, sonst: 3, umbau: 10 };
const RANG = { hook: 0, oton: 1, interview: 1, cta: 2, broll: 3, karussell: 4, sonst: 5 };

// Shots einer Station in Drehreihenfolge.
// Zuerst nach Setting gebündelt (damit selten umgebaut wird; Shots ohne Setting zuletzt),
// darin 'video': Video für Video, Hook → Skript → CTA → B-Roll.  'hooks': erst alle Hooks, dann der Rest.
export function fadenOrdnen(shots, videos = [], reihenfolge = 'video', settings = []) {
  const vpos = (s) => videos.find((v) => v.id === s.videoId)?.pos ?? Number.MAX_SAFE_INTEGER;
  const rang = (s) => RANG[typVon(s.typ).id] ?? 9;
  const spos = (s) => { const i = settings.findIndex((x) => x.id === s.settingId); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  return [...shots].sort((a, b) => {
    const ds = spos(a) - spos(b);
    if (ds) return ds;
    if (reihenfolge === 'hooks') {
      const d = (a.typ === 'hook' ? 0 : 1) - (b.typ === 'hook' ? 0 : 1);
      if (d) return d;
    }
    return vpos(a) - vpos(b) || rang(a) - rang(b) || nachPos(a, b);
  });
}

// Stationen des Fadens. Grundlage ist der Zeitplan; Locations mit Shots, die dort fehlen,
// und Shots ohne Location kommen hinten dran. So geht nichts verloren, auch ohne Planung.
// Optionaler Shot: Es ist noch offen, an welchem Ort er entsteht (shot.auchAn = weitere mögliche Locations)
export const istOptional = (s) => (s.auchAn || []).length > 0;
export const moeglicheOrte = (s) => [s.locationId, ...(s.auchAn || [])].filter(Boolean);

export function fadenStationen(b) {
  const tag = b.drehtag;
  const faden = tag.faden || {};
  const reihe = faden.reihenfolge || 'video';
  const settings = settingsVon(tag);
  const videos = b.videos || [];
  const alleShots = b.shots || [];
  const locs = [...(b.locations || [])].sort(nachPos);
  const vergeben = new Set();
  const stationen = [];
  // Optionale Shots (Ort noch offen) gehören zu keiner Station fest, sie tauchen unten in jeder passenden auf
  const an = (locId) => alleShots.filter((s) => s.locationId === locId && !istOptional(s));
  const optionale = alleShots.filter(istOptional);

  for (const x of zeitplanMitZeiten(tag.uhrzeit, tag.zeitplan?.bloecke)) {
    let ss = [];
    if (x.locationId && !vergeben.has(x.locationId)) { ss = an(x.locationId); vergeben.add(x.locationId); }
    const ort = locs.find((l) => l.id === x.locationId);
    stationen.push({
      key: 'b:' + x.id, titel: x.titel || ort?.name || 'Ohne Titel', von: x.von, bis: x.bis,
      dauer: x.dauer, locationId: x.locationId || '', shots: fadenOrdnen(ss, videos, reihe, settings),
    });
  }
  const extra = [];
  for (const l of locs) {
    if (vergeben.has(l.id)) continue;
    const ss = an(l.id);
    if (!ss.length) continue;
    vergeben.add(l.id);
    extra.push({ key: 'l:' + l.id, titel: l.name, locationId: l.id, shots: fadenOrdnen(ss, videos, reihe, settings) });
  }
  const ohne = alleShots.filter((s) => !istOptional(s) && !vergeben.has(s.locationId));
  if (ohne.length) extra.push({ key: 'ohne', titel: 'Ohne Location', locationId: '', shots: fadenOrdnen(ohne, videos, reihe, settings) });
  // Zusätzliche Stationen vor die leeren Blöcke am Ende (Abbau usw.), nicht dahinter
  let ende = stationen.length;
  while (ende > 0 && !stationen[ende - 1].shots.length) ende -= 1;
  if (ende === 0) ende = stationen.length && !stationen[0].shots.length ? Math.min(1, stationen.length) : 0;
  stationen.splice(ende, 0, ...extra);

  const fertigMarkiert = new Set(faden.fertig || []);
  for (const st of stationen) {
    st.offen = st.shots.filter((s) => !s.erledigt && !s.spaeter);
    st.spaeter = st.shots.filter((s) => !s.erledigt && s.spaeter);
    st.erledigt = st.shots.filter((s) => s.erledigt).length;
    st.optional = st.locationId ? fadenOrdnen(optionale.filter((s) => !s.erledigt && moeglicheOrte(s).includes(st.locationId)), videos, reihe, settings) : [];
    // Station ohne Shots (Aufbau, Pause, Abbau) ist fertig, wenn sie abgehakt wurde
    st.fertig = st.shots.length ? st.offen.length === 0 : fertigMarkiert.has(st.key);
  }
  return stationen;
}

// Wo stehen wir? Aktuelle Station, zurückgestellte Shots, Gesamtfortschritt
export function fadenStand(b) {
  const stationen = fadenStationen(b);
  const aktiv = b.drehtag.faden?.aktiv;
  let idx = stationen.findIndex((s) => s.key === aktiv && !s.fertig);
  if (idx < 0) idx = stationen.findIndex((s) => !s.fertig);
  // Offene optionale Shots zählen nicht mit: Sie blockieren nichts
  const shots = (b.shots || []).filter((s) => !istOptional(s) || s.erledigt);
  return {
    stationen, idx,
    nachholen: stationen.flatMap((s) => s.spaeter),
    gesamt: shots.length, erledigt: shots.filter((s) => s.erledigt).length,
    optionalOffen: (b.shots || []).filter((s) => istOptional(s) && !s.erledigt),
  };
}

// ---------- Bereit für den Dreh? ----------
// Ampel vor dem Dreh: rot = so fehlt etwas Wichtiges, orange = besser klären, grün = alles da.
// Einzelne Punkte lassen sich ignorieren (drehtag.bereit.ignoriert), Packlisten-Posten einzeln (posten.ignoriert).
export function bereitschaft(b) {
  const t = b.drehtag;
  const ignoriert = new Set(t.bereit?.ignoriert || []);
  const shots = (b.shots || []).filter((s) => !istOptional(s));
  const punkte = [];
  const p = (id, stufe, text, ziel, extra = {}) => punkte.push({ id, stufe, text, ziel, ignoriert: ignoriert.has(id), ...extra });

  if (!t.datum) p('datum', 'rot', 'Kein Drehdatum', 'bearbeiten');
  if (!shots.length) p('shots', 'rot', 'Noch keine Shots', 'shots');
  const ohneText = shots.filter((s) => ['hook', 'oton', 'cta'].includes(s.typ) && !(s.text || '').trim());
  if (ohneText.length) p('text', 'rot', `${ohneText.length} ${ohneText.length === 1 ? 'Sprech-Shot' : 'Sprech-Shots'} ohne Text`, 'shots');
  if (t.datum && !t.uhrzeit) p('uhrzeit', 'orange', 'Kein Drehbeginn', 'plan');
  if ((b.locations || []).length) {
    const ohneOrt = shots.filter((s) => !s.locationId);
    if (ohneOrt.length) p('ort', 'orange', `${ohneOrt.length} ${ohneOrt.length === 1 ? 'Shot' : 'Shots'} ohne Location`, 'shots');
  }
  if (shots.length && !(t.zeitplan?.bloecke || []).length) p('zeitplan', 'orange', 'Noch kein Zeitplan', 'plan');
  const zuLang = zeitplanMitZeiten(t.uhrzeit, t.zeitplan?.bloecke).filter((x) => x.ueber > 0);
  if (zuLang.length) p('fest', 'orange', `Zeitplan zu voll vor: ${zuLang.map((x) => `${x.titel || 'Block'} (fest ${x.fest}, ${x.ueber} Min. zu spät)`).join(', ')}`, 'plan');
  const nichtFrei = freigabeOffen(b);
  if (t.freigabeAngefragt && nichtFrei.length) p('freigabe', 'orange', `${nichtFrei.length} ${nichtFrei.length === 1 ? 'Sprechtext' : 'Sprechtexte'} noch nicht vom Kunden freigegeben`, 'shots');
  const offenFragen = (t.briefing?.fragen || []).filter((f) => !(f.antwort || '').trim());
  if (offenFragen.length) p('briefing', 'orange', `${offenFragen.length} ${offenFragen.length === 1 ? 'Frage' : 'Fragen'} im Briefing offen`, 'briefing');
  const pack = (t.packliste?.posten || []).filter((x) => !x.ok && !x.ignoriert);
  if (pack.length) p('pack', 'orange', `${pack.length} ${pack.length === 1 ? 'Posten' : 'Posten'} noch nicht gepackt`, 'plan', { posten: pack });
  const sonne = sonneVon(t);
  if (sonne) {
    const aussen = new Set((b.locations || []).filter((l) => l.aussen).map((l) => l.id));
    const dunkel = zeitplanMitZeiten(t.uhrzeit, t.zeitplan?.bloecke).filter((x) => aussen.has(x.locationId) && /dunkel|mittendrin/.test(sonnenHinweis(sonne, x.von, x.bis)));
    if (dunkel.length) p('sonne', 'orange', `Außen nach Sonnenuntergang: ${dunkel.map((x) => x.titel).join(', ')}`, 'plan');
  }
  const nass = regenAussen(b);
  if (nass.length) p('wetter', 'orange', `Regen erwartet bei Außen: ${nass.map((x) => `${x.titel} (${x.prozent} %)`).join(', ')}`, 'plan');
  const aktiv = punkte.filter((x) => !x.ignoriert);
  const stufe = aktiv.some((x) => x.stufe === 'rot') ? 'rot' : aktiv.length ? 'orange' : 'gruen';
  return { stufe, punkte, offen: aktiv.length };
}

// Was beim Abschließen eines Drehtags liegen geblieben ist
export function abschlussStand(b) {
  const shots = b.shots || [];
  const pflicht = shots.filter((s) => !istOptional(s));
  return {
    gedreht: shots.filter((s) => s.erledigt).length,
    gesamt: pflicht.length + shots.filter((s) => istOptional(s) && s.erledigt).length,
    offen: pflicht.filter((s) => !s.erledigt),
    optionalOffen: shots.filter((s) => istOptional(s) && !s.erledigt),
    pflichtOffen: shots.filter((s) => s.pflicht && !s.erledigt),
    ohneEinverstaendnis: shots.filter((s) => s.typ === 'interview' && s.erledigt && !s.einverstaendnis),
  };
}

// Pflicht-Shots (z. B. Branding beim Event): Stand über den ganzen Drehtag, egal an welcher Station
export function pflichtStand(b) {
  const p = (b.shots || []).filter((s) => s.pflicht);
  return { gesamt: p.length, erledigt: p.filter((s) => s.erledigt).length, offen: p.filter((s) => !s.erledigt).sort(nachPos) };
}

// Am Drehtag öffnet die App gleich den Roten Faden: ab einer Stunde vor Drehbeginn bis Mitternacht
// (ohne Drehbeginn den ganzen Tag). Nicht bei Vorlagen, abgeschlossenen oder heute abgewählten Drehtagen.
export function fadenAutoTag(tage, { jetzt = new Date(), aus = [] } = {}) {
  const h = heute();
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  return tage
    .filter((t) => !t.vorlage && t.datum === h && !t.abgeschlossen && !aus.includes(t.id))
    .filter((t) => !istZeit(t.uhrzeit) || min >= inMin(t.uhrzeit) - 60)
    .sort((a, b) => (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))[0] || null;
}

// Liegen wir in der Zeit? Nur am Drehtag selbst und nur mit Uhrzeiten im Zeitplan.
export function fadenZeit(b, st, jetzt = new Date()) {
  if (!st?.von || b.drehtag.datum !== heute()) return null;
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  const von = inMin(st.von);
  let bis = inMin(st.bis);
  if (bis < von) bis += 1440;
  if (min > bis) return { art: 'spaet', min: min - bis };
  if (min < von) return { art: 'frueh', min: von - min };
  return { art: 'im', min: bis - min };
}

// Ablauf-Vorschlag aus den Shots: Aufbau, eine Station pro Location mit Shots, Abbau.
// Die Dauer je Station ist eine Schätzung aus SCHAETZUNG, auf 5 Minuten aufgerundet.
export function ablaufVorschlag(b) {
  const runden = (m) => Math.max(10, Math.ceil(m / 5) * 5);
  const bloecke = [{ id: neueId(), titel: 'Ankommen und Aufbau', dauer: 30, locationId: '', hinweis: '' }];
  for (const l of [...(b.locations || [])].sort(nachPos)) {
    const ss = (b.shots || []).filter((s) => s.locationId === l.id);
    if (!ss.length) continue;
    // Jedes weitere Setting an dieser Location kostet einen Umbau
    const aufbauten = new Set(ss.map((s) => s.settingId).filter(Boolean)).size;
    const min = ss.reduce((n, s) => n + (SCHAETZUNG[typVon(s.typ).id] ?? 3), 0) + Math.max(0, aufbauten - 1) * SCHAETZUNG.umbau;
    bloecke.push({ id: neueId(), titel: l.name, dauer: runden(min), locationId: l.id, hinweis: '' });
  }
  bloecke.push({ id: neueId(), titel: 'Abbau', dauer: 15, locationId: '', hinweis: '' });
  return bloecke;
}

// ---------- Sprachnotiz einsortieren (Claude) ----------
// Das Transkript der Sprachnotiz nach dem Erstgespräch wird von Claude in Briefing-Antworten,
// Videos und Shot-Vorschläge verteilt. Hier nur Anfrage und Schema; den Aufruf macht die App.

export const SORTIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['antworten', 'weitere_infos', 'videos', 'shots', 'offene_punkte'],
  properties: {
    antworten: {
      type: 'array', description: 'Antworten auf vorhandene Fragen, nur wenn in der Notiz etwas dazu gesagt wurde',
      items: { type: 'object', additionalProperties: false, required: ['frage_id', 'antwort'],
        properties: { frage_id: { type: 'string' }, antwort: { type: 'string' } } },
    },
    weitere_infos: {
      type: 'array', description: 'Wichtiges, das zu keiner vorhandenen Frage passt, als kurze Frage mit Antwort',
      items: { type: 'object', additionalProperties: false, required: ['frage', 'antwort'],
        properties: { frage: { type: 'string' }, antwort: { type: 'string' } } },
    },
    videos: {
      type: 'array', description: 'Reels, die in der Notiz besprochen werden (neu oder vorhandene mit gleichem Namen)',
      items: { type: 'object', additionalProperties: false, required: ['name', 'notiz'],
        properties: { name: { type: 'string' }, notiz: { type: 'string', description: 'Ziel, Plattform, Länge, CTA – soweit gesagt' } } },
    },
    shots: {
      type: 'array', description: 'Shot-Vorschläge je Video',
      items: { type: 'object', additionalProperties: false, required: ['typ', 'text', 'titel', 'video', 'location', 'notiz'],
        properties: {
          typ: { type: 'string', enum: ['hook', 'oton', 'broll', 'cta', 'sonst'] },
          text: { type: 'string', description: 'Sprechtext bei Hook, O-Ton/Skript (auch Leitfragen), CTA; sonst leer' },
          titel: { type: 'string', description: 'Kurzname; bei B-Roll die Bildbeschreibung' },
          video: { type: 'string', description: 'Name des Videos aus "videos"' },
          location: { type: 'string', description: 'Raum oder Ort, wenn bekannt, sonst leer' },
          notiz: { type: 'string', description: 'Regie oder Bildidee, sonst leer' },
        } },
    },
    offene_punkte: { type: 'array', description: 'Was fehlt, unklar ist oder geklärt werden muss', items: { type: 'string' } },
  },
};

export const SORTIER_SYSTEM = `Du hilfst einem Filmer (Video- und Fotoproduktion, oft Reels für Immobilienmakler), einen Drehtag vorzubereiten.
Er hat nach dem Telefonat mit dem Kunden eine Sprachnotiz eingesprochen. Du bekommst das automatische Transkript (Whisper, kann Hörfehler bei Namen, Straßen und Zahlen enthalten), die Fragen des Erstgesprächs mit ihren Kennungen und was im Drehtag schon angelegt ist.

Aufgabe: Verteile den Inhalt der Notiz.
- antworten: zu jeder Frage, zu der in der Notiz etwas gesagt wird, die Antwort knapp in seinen Worten. Fragen ohne Aussage weglassen.
- weitere_infos: Wichtiges, das zu keiner Frage passt.
- videos und shots: Reel-Ideen und Shot-Vorschläge, soweit die Notiz sie hergibt. Hooks in 2–3 Varianten pro Video, wenn das Material genug hergibt; die Formulierung darf zugespitzt sein, jede Tatsache darin muss aus der Notiz stammen. B-Roll nur mit Bildern, die es laut Notiz gibt. CTA nur, wenn ein Ziel genannt wird. Vorhandene Videos und Locations mit genau ihrem Namen ansprechen.
- offene_punkte: was fehlt oder unklar ist und geklärt werden sollte, auch unsichere Hörstellen.

Regeln:
- Nichts erfinden: keine Zahlen, Preise, Flächen, Namen, Ausstattung oder Abläufe, die nicht gesagt wurden. Lieber ein offener Punkt als eine Vermutung.
- Hörfehler nicht stillschweigend korrigieren, wenn das richtige Wort nicht sicher ist; dann als offenen Punkt nennen.
- Wenn der Kunde gebeten hat, etwas wegzulassen, kommt es nirgends vor. Heikle Aussagen über Dritte nicht in Hooks oder Shots.
- Alles auf Deutsch. Leere Listen sind in Ordnung.`;

// Inhalt der Anfrage: Drehtag, Fragen mit Kennung, Vorhandenes, Transkript
export function sortierInhalt(b, transkript) {
  const t = b.drehtag;
  const z = [`Drehtag: ${t.kunde}${t.datum ? `, ${fmtDatum(t.datum)}` : ''}${t.ort ? `, ${t.ort}` : ''}`];
  if (t.notizen) z.push(`Notizen: ${eineZeile(t.notizen)}`);
  z.push('', 'Fragen des Erstgesprächs (Kennung | Frage | bisherige Antwort):');
  for (const f of t.briefing?.fragen || []) z.push(`- ${f.id} | ${f.frage} | ${eineZeile(f.antwort || '') || '–'}`);
  const namen = (liste) => (liste || []).map((x) => x.name).filter(Boolean).join(', ') || '–';
  z.push('', `Vorhandene Videos: ${namen(b.videos)}`, `Vorhandene Locations: ${namen(b.locations)}`);
  const vorhanden = (b.shots || []).filter((s) => s.text || s.titel).slice(0, 60);
  if (vorhanden.length) {
    z.push('', 'Schon angelegte Shots (nicht doppelt vorschlagen):');
    for (const s of vorhanden) z.push(`- ${typVon(s.typ).kurz}: ${eineZeile(shotName(s))}`);
  }
  z.push('', 'Transkript der Sprachnotiz:', transkript.trim());
  return z.join('\n');
}

// Hilfswörter für Whisper: Namen und Orte aus dem Drehtag verbessern die Erkennung
export const whisperHinweis = (b) =>
  [b.drehtag.kunde, b.drehtag.ort, b.drehtag.ansprechpartner, ...(b.locations || []).map((l) => l.name), 'Reel, Hook, B-Roll, Makler']
    .filter(Boolean).join(', ').slice(0, 400);

// ---------- Sonnenstand ----------
// Rechnet ohne Internet aus Koordinaten und Datum: Aufgang, Untergang, Goldene und Blaue Stunde.
// Genauigkeit etwa eine Minute (vereinfachte Sonnenbahn, ohne Berge und Häuser am Horizont).
// Goldene Stunde: Sonne zwischen 6° über und 4° unter dem Horizont. Blaue Stunde: 4° bis 6° darunter.

// Akzeptiert "51.05, 6.22", "51,05 6,22" und Google-Maps-Links (…@51.05,6.22… oder …q=51.05,6.22…)
export function koordinatenAus(text) {
  const t = String(text || '');
  const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t)
    || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) || /^\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(t);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lon = Number(m[2].replace(',', '.'));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

const RAD = Math.PI / 180;
export function sonnenPosition(datum, lat, lon) {
  const d = datum.getTime() / 86400000 - 10957.5; // Tage seit 1.1.2000, 12 Uhr UTC
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const l = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const dek = Math.asin(Math.sin(e) * Math.sin(l));
  const sternzeit = ((280.46061837 + 360.98564736629 * d + lon) % 360) * RAD;
  const h = sternzeit - ra;
  const phi = lat * RAD;
  const hoehe = Math.asin(Math.sin(phi) * Math.sin(dek) + Math.cos(phi) * Math.cos(dek) * Math.cos(h)) / RAD;
  const richtung = (Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dek) * Math.cos(phi)) / RAD + 180 + 360) % 360;
  return { hoehe, richtung };
}

export const himmelsrichtung = (grad) =>
  ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'][Math.round(((grad % 360) + 360) % 360 / 45) % 8];

// Minuten des Tages (Ortszeit des Geräts), an denen die Sonnenhöhe eine Grenze kreuzt
export function sonnenTag(datumIso, lat, lon) {
  const [j, mo, ta] = String(datumIso || '').split('-').map(Number);
  if (!j || !mo || !ta) return null;
  const hoehen = [];
  for (let i = 0; i <= 1440; i++) hoehen.push(sonnenPosition(new Date(j, mo - 1, ta, 0, i), lat, lon).hoehe);
  const kreuzt = (grad, steigend) => {
    for (let i = 0; i < 1440; i++) {
      const [a, b] = [hoehen[i], hoehen[i + 1]];
      if (steigend ? a < grad && b >= grad : a >= grad && b < grad) return i + (grad - a) / (b - a);
    }
    return null;
  };
  const aufgang = kreuzt(-0.833, true);
  const untergang = kreuzt(-0.833, false);
  return {
    aufgang, untergang,
    goldMorgen: [kreuzt(-4, true), kreuzt(6, true)],
    goldAbend: [kreuzt(6, false), kreuzt(-4, false)],
    blauAbend: [kreuzt(-4, false), kreuzt(-6, false)],
    richtungAufgang: aufgang == null ? null : sonnenPosition(new Date(j, mo - 1, ta, 0, aufgang), lat, lon).richtung,
    richtungUntergang: untergang == null ? null : sonnenPosition(new Date(j, mo - 1, ta, 0, untergang), lat, lon).richtung,
    hoechste: Math.max(...hoehen),
  };
}

export const uhrAusMin = (m) => (m == null ? '–' : alsZeit(Math.round(m)));

// Sonne für einen Drehtag (braucht Datum und Koordinaten), sonst null
export function sonneVon(tag) {
  const k = koordinatenAus(tag?.koordinaten);
  return k && tag?.datum ? sonnenTag(tag.datum, k.lat, k.lon) : null;
}

export function sonnenText(tag) {
  const s = sonneVon(tag);
  if (!s) return '';
  if (s.aufgang == null || s.untergang == null) return s.hoechste > 0 ? 'Sonne geht nicht unter' : 'Sonne geht nicht auf';
  return `Aufgang ${uhrAusMin(s.aufgang)} (${himmelsrichtung(s.richtungAufgang)}) · Untergang ${uhrAusMin(s.untergang)} (${himmelsrichtung(s.richtungUntergang)})`
    + ` · Goldene Stunde ${uhrAusMin(s.goldMorgen[0])}–${uhrAusMin(s.goldMorgen[1])} und ${uhrAusMin(s.goldAbend[0])}–${uhrAusMin(s.goldAbend[1])}`
    + ` · Blaue Stunde bis ${uhrAusMin(s.blauAbend[1])}`;
}

// Hinweis für einen Zeitplan-Block an einer Außen-Location (von/bis als "HH:MM")
export function sonnenHinweis(s, von, bis) {
  if (!s || !istZeit(von) || !istZeit(bis) || s.untergang == null) return '';
  const [a, b] = [inMin(von), inMin(bis)];
  if (a >= s.untergang || b <= s.aufgang) return 'dunkel (nach Sonnenuntergang)';
  if (b > s.untergang) return `Sonnenuntergang ${uhrAusMin(s.untergang)}, mittendrin`;
  if (a < s.goldAbend[1] && b > s.goldAbend[0]) return 'in der Goldenen Stunde';
  if (a < s.goldMorgen[1] && b > s.goldMorgen[0]) return 'in der Goldenen Stunde (Morgen)';
  return '';
}

// ---------- Location-Prompter ----------
// Alle Sprechtexte einer Station als ein Text: für den eigenen Teleprompter, das zweite Gerät
// oder eine andere Teleprompter-App. Abgehakte fallen weg; ist schon alles erledigt, kommen alle.
export const istSprech = (s) => ['hook', 'oton', 'cta'].includes(s.typ) && !!(s.text || '').trim();

export function stationSprechtexte(st) {
  const alle = [...st.shots, ...(st.optional || [])].filter(istSprech);
  const offen = alle.filter((s) => !s.erledigt);
  return offen.length ? offen : alle;
}

export function prompterBlock(shots, videos = []) {
  return shots.map((s, i) => {
    const video = videos.find((v) => v.id === s.videoId);
    const kopf = [`[${i + 1}/${shots.length}] ${typVon(s.typ).kurz}`, video?.name, istOptional(s) ? 'optional' : ''].filter(Boolean).join(' · ');
    return `${kopf}\n${s.text.trim()}`;
  }).join('\n\n\n');
}

// ---------- Texte zum Teilen ----------
// "b" ist immer ein Bündel: { drehtag, locations, videos, shots }

function shotZeilen(s, b, modus) {
  const ort = (b.locations || []).find((l) => l.id === s.locationId);
  const video = (b.videos || []).find((v) => v.id === s.videoId);
  const infos = [
    modus === 'location' || modus === 'video' ? typVon(s.typ).kurz : '',
    modus === 'location' ? '' : ort?.name,
    modus === 'video' ? '' : video?.name,
    settingVon(b.drehtag, s.settingId)?.name,
    s.format,
  ].filter(Boolean).join(', ');
  const kopf = s.titel || (s.text ? `„${einruecken(s.text)}“` : 'Ohne Titel');
  const z = [`${s.erledigt ? '[x]' : '[ ]'} ${s.favorit ? '★ ' : ''}${kopf} (${infos})`];
  if (s.titel && s.text) z.push(`    „${einruecken(s.text)}“`);
  if (s.take) z.push(`    Take: ${einruecken(s.take)}`);
  if (s.notiz) z.push(`    Notiz: ${einruecken(s.notiz)}`);
  return z;
}

export function shotlistText(b, modus) {
  const { drehtag: tag, shots = [], locations = [], videos = [] } = b;
  const zeilen = [`Drehtag: ${tag.kunde}`];
  const wann = wannText(tag);
  if (wann) zeilen.push(`Wann: ${wann}`);
  if (tag.ort) zeilen.push(`Ort: ${tag.ort}`);
  if (tag.ansprechpartner) zeilen.push(`Kontakt: ${tag.ansprechpartner}${tag.telefon ? ' (' + tag.telefon + ')' : ''}`);
  zeilen.push(`Stand: ${shots.filter((s) => s.erledigt).length}/${shots.length} erledigt`);
  for (const g of gruppieren(shots, locations, videos, modus)) {
    zeilen.push('', g.label.toUpperCase());
    for (const s of g.shots) zeilen.push(...shotZeilen(s, b, modus));
  }
  if (tag.notizen) zeilen.push('', 'NOTIZEN', tag.notizen);
  return zeilen.join('\n');
}

// Der Zeitplan, wie ihn der Kunde bekommt: nur Zeiten, Ablauf und Hinweise
export function zeitplanText(b, absender) {
  const tag = b.drehtag;
  const plan = tag.zeitplan || { bloecke: [] };
  const zeilen = [`Drehplan: ${tag.kunde}`];
  if (tag.datum) zeilen.push(fmtDatum(tag.datum) + (tag.uhrzeit ? `, ab ${tag.uhrzeit} Uhr` : ''));
  if (tag.ort) zeilen.push(`Ort: ${tag.ort}`);
  const bloecke = zeitplanMitZeiten(tag.uhrzeit, plan.bloecke);
  if (bloecke.length) zeilen.push('');
  for (const x of bloecke) {
    const zeit = x.von ? `${x.von}–${x.bis}` : `${x.dauer} Min`;
    zeilen.push(`${zeit}  ${x.titel || 'Ohne Titel'}`);
    if (x.hinweis) zeilen.push(`${' '.repeat(zeit.length + 2)}${einruecken(x.hinweis, ' '.repeat(zeit.length + 2))}`);
  }
  if (bloecke.length && bloecke[0].von) zeilen.push('', `Ende gegen ${bloecke[bloecke.length - 1].bis} Uhr`);
  if ((plan.kundenhinweis || '').trim()) zeilen.push('', 'Bitte vorbereiten:', plan.kundenhinweis.trim());
  if ((absender || '').trim()) zeilen.push('', absender.trim());
  return zeilen.join('\n');
}

// Übergabe an den Schnitt als Markdown, sortiert nach Video
export function schnittText(b) {
  const { drehtag: tag, shots = [], locations = [], videos = [] } = b;
  const z = [`# Schnitt-Übergabe: ${tag.kunde}`, ''];
  const wann = wannText(tag);
  if (wann) z.push(`- Dreh: ${wann}`);
  if (tag.ort) z.push(`- Ort: ${tag.ort}`);
  z.push(`- Stand: ${shots.filter((s) => s.erledigt).length} von ${shots.length} Shots gedreht`);
  if (tag.notizen) z.push(`- Notizen: ${eineZeile(tag.notizen)}`);

  const antworten = (tag.briefing?.fragen || []).filter((f) => (f.antwort || '').trim());
  if (antworten.length) {
    z.push('', '## Briefing', '');
    for (const f of antworten) z.push(`- **${f.frage}** ${eineZeile(f.antwort)}`);
  }

  for (const g of gruppieren(shots, locations, videos, 'video')) {
    const video = videos.find((v) => v.id === g.id);
    z.push('', `## ${g.id ? 'Video: ' + g.label : 'Ohne Video'}`);
    if ((video?.notiz || '').trim()) z.push('', video.notiz.trim());
    for (const t of TYPEN) {
      const liste = g.shots.filter((s) => typVon(s.typ).id === t.id);
      if (!liste.length) continue;
      z.push('', `### ${t.label}`, '');
      for (const s of liste) {
        const ort = locations.find((l) => l.id === s.locationId);
        const infos = [ort?.name, s.format].filter(Boolean).join(', ');
        // Kurze Texte ohne Titel (typisch für Hooks) stehen direkt in der Zeile
        const inZeile = !s.titel && s.text && !s.text.trim().includes('\n') && s.text.length <= 160;
        const kopf = s.titel ? `**${s.titel}**` : inZeile ? `„${s.text.trim()}“` : '';
        z.push(`- [${s.erledigt ? 'x' : ' '}] ${s.favorit ? '★ ' : ''}${kopf ? kopf + ' ' : ''}(${infos})`);
        if (s.text && !inZeile) z.push(`  > ${einruecken(s.text, '  > ')}`);
        if (s.take) z.push(`  - Take: ${eineZeile(s.take)}`);
        if (s.clips?.length) z.push(`  - Clips: ${s.clips.join(', ')}`);
        if (s.typ === 'interview') {
          const bb = bauchbinde(s);
          if (bb) z.push(`  - Bauchbinde: ${bb}`);
          z.push(`  - Einverständnis: ${s.einverstaendnis ? `unterschrieben ${new Date(s.einverstaendnis.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : 'fehlt'}`);
        }
        if (s.erledigtUm) z.push(`  - Abgehakt: ${uhrzeitVon(s.erledigtUm)}`);
        if (s.notiz) z.push(`  - Notiz: ${eineZeile(s.notiz)}`);
      }
    }
  }
  const marker = markerVon(tag);
  if (marker.length) {
    z.push('', '## Marker', '', 'Am Set gesetzt („Das war gut“). Uhrzeit des Handys; Clips über die Aufnahmezeit zuordnen.', '');
    for (const m of marker) z.push(`- ${uhrzeitVon(m.zeit, true)}${m.station ? ` · ${m.station}` : ''}${m.shot ? ` · bei „${m.shot}“` : ''}`);
  }
  return z.join('\n') + '\n';
}

// Alles aus Erstgespräch und Scouting als Text, zum Beispiel für die Arbeit an Hooks
export function briefingText(b) {
  const { drehtag: tag, locations = [], videos = [], medien = [] } = b;
  const z = [`Briefing: ${tag.kunde}`];
  const kopf = [wannText(tag), tag.ort].filter(Boolean).join(' · ');
  if (kopf) z.push(kopf);
  const fragen = tag.briefing?.fragen || [];
  const beantwortet = fragen.filter((f) => (f.antwort || '').trim());
  if (beantwortet.length) {
    z.push('', 'ERSTGESPRÄCH');
    for (const f of beantwortet) z.push(f.frage, `    ${einruecken(f.antwort)}`);
  }
  const offen = fragen.filter((f) => !(f.antwort || '').trim());
  if (offen.length) z.push('', `Noch offen: ${offen.map((f) => f.frage).join(' | ')}`);
  if (locations.length) {
    z.push('', 'LOCATIONS');
    for (const l of [...locations].sort(nachPos)) {
      const fotos = medien.filter((m) => m.locationId === l.id).length;
      z.push(`${l.name}${fotos ? ` (${fotos} ${fotos === 1 ? 'Bild' : 'Bilder'})` : ''}${(l.notiz || '').trim() ? ': ' + eineZeile(l.notiz) : ''}`);
    }
  }
  if (videos.length) {
    z.push('', 'VIDEOS');
    for (const v of [...videos].sort(nachPos)) z.push(`${v.name}${(v.notiz || '').trim() ? ': ' + eineZeile(v.notiz) : ''}`);
  }
  if ((tag.notizen || '').trim()) z.push('', 'NOTIZEN', tag.notizen.trim());
  // Sprachnotizen nach dem Gespräch: das Transkript ist die Quelle für Antworten im Briefing
  const audio = medien.filter((m) => m.art === 'audio').sort((x, y) => (x.erstellt || 0) - (y.erstellt || 0));
  if (audio.length) {
    z.push('', 'SPRACHNOTIZEN');
    for (const m of audio) {
      const wann = new Date(m.erstellt || 0).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      z.push(`${wann} (${Math.round(m.dauer || 0)} s): ${(m.transkript || '').trim() ? m.transkript.trim() : '[noch nicht transkribiert]'}`);
    }
  }
  return z.join('\n');
}

// Kalendereintrag im iCalendar-Format. Ohne Datum gibt es keinen Eintrag.
// Erinnerungen je nach Stufe (Einstellung unter „Sicherung“), damit nichts nervt:
//   aus:    keine Erinnerungen
//   wenig:  Vorabend 18 Uhr, Abfahrt (oder 1 Stunde vor Drehbeginn)
//   normal: dazu 10 Min. vor jedem festen Programmpunkt (dicht beieinander zusammengefasst)
//           und einmal 1 Stunde vor Ende, falls Pflicht-Shots geplant sind
// Feste Programmpunkte stehen außerdem als eigene Termine im Kalender.
export function icsText(b, { stufe = 'normal', startpunkt = null } = {}) {
  const tag = b.drehtag;
  if (!tag.datum) return null;
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const tagZahl = tag.datum.replace(/-/g, '');
  const stempelJetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const um = (min) => `${tagZahl}T${alsZeit(Math.min(min, 1439)).replace(':', '')}00`;
  const alarm = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', trigger, `DESCRIPTION:${esc(text)}`, 'END:VALARM'];
  const bloecke = zeitplanMitZeiten(tag.uhrzeit, tag.zeitplan?.bloecke);
  const z = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Drehtag-Begleiter//DE', 'BEGIN:VEVENT',
    `UID:${tag.id}@drehtag-begleiter`, `DTSTAMP:${stempelJetzt}`];
  let start = null;
  let ende = null;
  if (istZeit(tag.uhrzeit)) {
    start = inMin(tag.uhrzeit);
    // Ende aus dem Zeitplan, ohne Zeitplan eine Stunde. Über Mitternacht wird nicht gerechnet.
    const bis = bloecke.length && bloecke[bloecke.length - 1].bis ? inMin(bloecke[bloecke.length - 1].bis) : start + 60;
    ende = Math.min(Math.max(bis, start + 15), 1439);
    z.push(`DTSTART:${um(start)}`, `DTEND:${um(ende)}`);
  } else {
    const d = new Date(tag.datum + 'T00:00');
    d.setDate(d.getDate() + 1);
    const morgen = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    z.push(`DTSTART;VALUE=DATE:${tagZahl}`, `DTEND;VALUE=DATE:${morgen}`);
  }
  z.push(`SUMMARY:${esc('Dreh: ' + tag.kunde)}`);
  if (tag.ort) z.push(`LOCATION:${esc(tag.ort)}`);
  const offenPack = (tag.packliste?.posten || []).filter((p) => !p.ok && !p.ignoriert).map((p) => p.name);
  const fahrt = fahrtVon(tag, startpunkt);
  const beschreibung = [
    tag.ansprechpartner ? `Kontakt: ${tag.ansprechpartner}${tag.telefon ? ' (' + tag.telefon + ')' : ''}` : '',
    fahrt?.abfahrt ? `Abfahrt spätestens ${fahrt.abfahrt} (Fahrt ca. ${fahrt.min} Min.)` : '',
    tag.notizen,
    offenPack.length ? `Noch packen: ${offenPack.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  if (beschreibung) z.push(`DESCRIPTION:${esc(beschreibung)}`);
  if (stufe !== 'aus') {
    const vorabend = new Date(tag.datum + 'T18:00');
    vorabend.setDate(vorabend.getDate() - 1);
    const utc = vorabend.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    z.push(...alarm(`TRIGGER;VALUE=DATE-TIME:${utc}`, `Morgen Dreh: ${tag.kunde}. Akkus laden, Karten leeren${offenPack.length ? ', Packliste prüfen' : ''}.`));
    if (start != null) {
      if (fahrt?.abfahrt) z.push(...alarm(`TRIGGER:-PT${fahrt.min + fahrt.puffer + 10}M`, `In 10 Min. losfahren: Dreh ${tag.kunde} (Abfahrt ${fahrt.abfahrt})`));
      else z.push(...alarm('TRIGGER:-PT1H', `In einer Stunde: Dreh ${tag.kunde}`));
      if (stufe === 'normal' && (b.shots || []).some((s) => s.pflicht) && ende - start > 90) {
        z.push(...alarm('TRIGGER;RELATED=END:-PT1H', 'Noch 1 Stunde: Pflicht-Shots im Roten Faden prüfen'));
      }
    }
  }
  z.push('END:VEVENT');
  // Feste Programmpunkte als eigene Termine. Erinnerungen, die weniger als 15 Min. auseinanderliegen, werden eine.
  let letzteErinnerung = -999;
  let letzterTermin = null;
  const termine = [];
  for (const x of bloecke.filter((y) => istZeit(y.fest) && y.von)) {
    const von = inMin(x.von);
    const termin = ['BEGIN:VEVENT', `UID:${tag.id}-${x.id}@drehtag-begleiter`, `DTSTAMP:${stempelJetzt}`,
      `DTSTART:${um(von)}`, `DTEND:${um(von + Math.max(x.dauer, 5))}`, `SUMMARY:${esc(`${x.titel || 'Programmpunkt'} (${tag.kunde})`)}`];
    if (x.hinweis) termin.push(`DESCRIPTION:${esc(x.hinweis)}`);
    if (stufe === 'normal') {
      if (von - letzteErinnerung >= 15) {
        termin.push(...alarm('TRIGGER:-PT10M', `In 10 Min.: ${x.titel || 'Programmpunkt'} (${x.von} Uhr)`));
        letzteErinnerung = von;
        letzterTermin = termin;
      } else if (letzterTermin) {
        // an die vorige Erinnerung anhängen statt eine weitere zu schicken
        const i = letzterTermin.findLastIndex((l) => l.startsWith('DESCRIPTION:In 10 Min.'));
        if (i >= 0) letzterTermin[i] += esc(`, danach ${x.titel || 'Programmpunkt'} (${x.von})`);
      }
    }
    termin.push('END:VEVENT');
    termine.push(termin);
  }
  for (const t of termine) z.push(...t);
  z.push('END:VCALENDAR');
  return z.join('\r\n');
}

// ---------- Fahrt zum Drehort ----------
// Ohne Internet nur grob: Luftlinie × 1,3 als Straßenweg, Tempo je nach Strecke.
// Wer die Fahrzeit kennt, trägt sie am Drehtag ein (drehtag.fahrzeit in Minuten), dann gilt die.
export function luftlinieKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
export function fahrtSchaetzung(km) {
  const strasse = km * 1.3;
  const tempo = strasse < 15 ? 30 : strasse < 60 ? 55 : 85;
  return Math.max(5, Math.round((strasse / tempo) * 60 / 5) * 5);
}
const FAHRT_PUFFER = 15; // Parken, Ausladen, Ankommen
export function fahrtVon(tag, startpunkt) {
  const ziel = koordinatenAus(tag?.koordinaten);
  const start = koordinatenAus(startpunkt?.koordinaten);
  const manuell = Number(tag?.fahrzeit) || 0;
  if (!manuell && (!ziel || !start)) return null;
  const km = ziel && start ? luftlinieKm(start, ziel) : null;
  const min = manuell || fahrtSchaetzung(km);
  return {
    km, min, geschaetzt: !manuell, puffer: FAHRT_PUFFER,
    abfahrt: istZeit(tag.uhrzeit) ? alsZeit(inMin(tag.uhrzeit) - min - FAHRT_PUFFER) : '',
    maps: start && ziel ? `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${ziel.lat},${ziel.lon}&travelmode=driving` : '',
  };
}

// ---------- Wetter ----------
// b.wetter = { stunden: [{ h: 0–23, temp, regen (Wahrscheinlichkeit in %), mm }] }, von js/wetter.js geladen.
export function wetterKurz(w) {
  const st = w?.stunden || [];
  if (!st.length) return '';
  const tag = st.filter((x) => x.h >= 7 && x.h <= 21);
  const temps = tag.map((x) => x.temp).filter((x) => x != null);
  const nass = tag.filter((x) => x.regen >= 50);
  const t = temps.length ? `${Math.round(Math.min(...temps))}–${Math.round(Math.max(...temps))} °C` : '';
  const r = nass.length ? `Regen wahrscheinlich ${nass[0].h}–${nass[nass.length - 1].h + 1} Uhr (bis ${Math.max(...nass.map((x) => x.regen))} %)` : 'kaum Regen';
  return [t, r].filter(Boolean).join(' · ');
}
// Außen-Blöcke im Zeitplan, in deren Stunden Regen wahrscheinlich ist (ab 50 %)
export function regenAussen(b) {
  const st = b.wetter?.stunden || [];
  if (!st.length) return [];
  const aussen = new Set((b.locations || []).filter((l) => l.aussen).map((l) => l.id));
  const t = b.drehtag;
  return zeitplanMitZeiten(t.uhrzeit, t.zeitplan?.bloecke)
    .filter((x) => aussen.has(x.locationId) && x.von)
    .map((x) => {
      const [a, e] = [inMin(x.von), inMin(x.bis)];
      const stunden = st.filter((y) => y.h * 60 < e && (y.h + 1) * 60 > a);
      return { titel: x.titel, prozent: Math.max(0, ...stunden.map((y) => y.regen || 0)) };
    })
    .filter((x) => x.prozent >= 50);
}

// ---------- Kundenfreigabe der Sprechtexte ----------
// shot.freigabe = { zeit, text }. Ändert sich der Text danach, gilt er wieder als offen.
export const istSprechtext = (s) => ['hook', 'oton', 'cta'].includes(s.typ) && !!(s.text || '').trim();
export const freigegeben = (s) => !!s.freigabe && s.freigabe.text === s.text;
export const freigabeOffen = (b) => (b.shots || []).filter((s) => istSprechtext(s) && !freigegeben(s));

export function freigabeText(b, absender) {
  const { drehtag: tag, shots = [], locations = [], videos = [] } = b;
  const z = [`Sprechtexte zur Freigabe: ${tag.kunde}`];
  if (tag.datum) z.push(`Dreh: ${fmtDatum(tag.datum)}`);
  z.push('', 'Bitte die Texte prüfen und kurz bestätigen oder Änderungen schicken.');
  let nr = 0;
  for (const g of gruppieren(shots.filter(istSprechtext), locations, videos, 'video')) {
    z.push('', g.label.toUpperCase());
    for (const s of g.shots) {
      nr += 1;
      z.push(`${nr}. ${typVon(s.typ).kurz}${s.titel ? ` – ${s.titel}` : ''}`, `   „${einruecken(s.text, '    ')}“`);
    }
  }
  if ((absender || '').trim()) z.push('', absender.trim());
  return z.join('\n');
}

// ---------- Interviews ----------
export const bauchbinde = (s) => [s.titel, s.funktion, s.firma].map((x) => (x || '').trim()).filter(Boolean).join(', ');
export const interviewFragen = (s) => String(s.text || '').split('\n').map((x) => x.trim()).filter(Boolean);

// ---------- Marker und Zeiten ----------
// Marker: am Set per Knopf oder Fernbedienung gesetzt, drehtag.marker.liste = [{ id, zeit, station, shot }]
export const markerVon = (tag) => [...(tag?.marker?.liste || [])].sort((a, b) => a.zeit - b.zeit);
export function uhrzeitVon(ms, sekunden = false) {
  const d = new Date(ms);
  const zz = (n) => String(n).padStart(2, '0');
  return `${zz(d.getHours())}:${zz(d.getMinutes())}${sekunden ? ':' + zz(d.getSeconds()) : ''}`;
}
const dauerText = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std.`;
const spanne = (von, bis) => (istZeit(von) && istZeit(bis) ? ((inMin(bis) - inMin(von)) + 1440) % 1440 : null);

// Erster und letzter Haken einer Station: grob, wie lange dort wirklich gedreht wurde
export function stationIst(st) {
  const zeiten = (st.shots || []).map((s) => s.erledigtUm).filter(Boolean).sort((a, b) => a - b);
  if (!zeiten.length) return null;
  return { von: uhrzeitVon(zeiten[0]), bis: uhrzeitVon(zeiten[zeiten.length - 1]), haken: zeiten.length };
}

// Zeiten für die Abrechnung: drehtag.zeiten = { abfahrt, ankunft, ende, zurueck } als "HH:MM".
// Gedreht = erster bis letzter Haken. Dazu Plan gegen Ist je Station.
export function zeitenText(b) {
  const tag = b.drehtag;
  const zt = tag.zeiten || {};
  const haken = (b.shots || []).map((s) => s.erledigtUm).filter(Boolean).sort((a, c) => a - c);
  const z = [`Zeiten: ${tag.kunde}${tag.datum ? ', ' + fmtDatum(tag.datum) : ''}`, ''];
  const zeile = (text, von, bis) => {
    const m = spanne(von, bis);
    if (m != null) z.push(`${text}: ${von}–${bis} (${dauerText(m)})`);
  };
  zeile('Fahrt hin', zt.abfahrt, zt.ankunft);
  zeile('Vor Ort', zt.ankunft, zt.ende);
  if (haken.length) z.push(`Davon gedreht (erster bis letzter Haken): ${uhrzeitVon(haken[0])}–${uhrzeitVon(haken[haken.length - 1])}`);
  zeile('Rückfahrt', zt.ende, zt.zurueck);
  const anfang = zt.abfahrt || zt.ankunft;
  const schluss = zt.zurueck || zt.ende;
  if (anfang && schluss) zeile('Gesamt', anfang, schluss);
  if (z.length === 2) z.push('Noch keine Zeiten erfasst.');
  const stationen = fadenStationen(b).map((st) => ({ st, ist: stationIst(st) })).filter((x) => x.ist || x.st.von);
  if (stationen.length) {
    z.push('', 'Stationen (Plan → Ist):');
    for (const { st, ist } of stationen) {
      const plan = st.von ? `${st.von}–${st.bis}` : st.dauer ? `${st.dauer} Min.` : '–';
      z.push(`  ${st.titel}: ${plan} → ${ist ? `${ist.von}–${ist.bis}` : 'kein Haken'}`);
    }
  }
  return z.join('\n');
}

// ---------- Call Sheet für die Crew ----------
export function callSheetText(b, { wetter = '' } = {}) {
  const { drehtag: tag, shots = [], locations = [] } = b;
  const z = [`CALL SHEET: ${tag.kunde}`];
  const wann = wannText(tag);
  if (wann) z.push(`Wann: ${wann}`);
  if (tag.ort) z.push(`Wo: ${tag.ort}`, `Karte: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tag.ort)}`);
  if (tag.ansprechpartner) z.push(`Kontakt vor Ort: ${tag.ansprechpartner}${tag.telefon ? ' (' + tag.telefon + ')' : ''}`);
  if (wetter) z.push(`Wetter: ${wetter}`);
  if (sonnenText(tag)) z.push(`Sonne: ${sonnenText(tag)}`);
  const bloecke = zeitplanMitZeiten(tag.uhrzeit, tag.zeitplan?.bloecke);
  if (bloecke.length) {
    z.push('', 'ABLAUF');
    const ort = (id) => locations.find((l) => l.id === id)?.name;
    for (const x of bloecke) {
      const zeit = x.von ? `${x.von}–${x.bis}` : `${x.dauer} Min`;
      z.push(`${zeit}  ${x.titel || 'Ohne Titel'}${istZeit(x.fest) ? ' (fest)' : ''}${ort(x.locationId) && ort(x.locationId) !== x.titel ? ` · ${ort(x.locationId)}` : ''}`);
      if (x.hinweis) z.push(`       ${x.hinweis}`);
    }
  }
  const mitNotiz = [...locations].sort(nachPos).filter((l) => (l.notiz || '').trim());
  if (mitNotiz.length) {
    z.push('', 'LOCATIONS');
    for (const l of mitNotiz) z.push(`${l.name}: ${eineZeile(l.notiz)}`);
  }
  const interviews = shots.filter((s) => s.typ === 'interview');
  if (interviews.length) {
    z.push('', 'INTERVIEWS');
    for (const s of interviews) z.push(`${bauchbinde(s) || 'Name offen'}${interviewFragen(s).length ? ` (${interviewFragen(s).length} Fragen)` : ''}`);
  }
  const pflicht = shots.filter((s) => s.pflicht);
  if (pflicht.length) {
    z.push('', 'PFLICHT-SHOTS');
    for (const s of pflicht) z.push(`[ ] ${shotName(s)}`);
  }
  const pack = (tag.packliste?.posten || []).filter((p) => !p.ignoriert);
  if (pack.length) z.push('', 'PACKLISTE', ...pack.map((p) => `[ ] ${p.name}`));
  if ((tag.notizen || '').trim()) z.push('', 'NOTIZEN', tag.notizen.trim());
  return z.join('\n');
}

// ---------- Vorlagen ----------

// Fragenliste für einen neuen Drehtag: eigene Vorlage oder das Set "Allgemein"
export function neueFragen(vorlage) {
  const basis = vorlage?.length ? vorlage : FRAGEN_SETS[0].fragen.map((frage) => ({ set: FRAGEN_SETS[0].id, frage }));
  return basis.map((v) => ({ id: neueId(), set: v.set || 'eigene', frage: v.frage, antwort: '' }));
}

// Ein Fragen-Set ergänzen. Fragen, die schon da sind, kommen nicht doppelt.
export function frageSetDazu(fragen, setId) {
  const set = FRAGEN_SETS.find((s) => s.id === setId);
  if (!set) return 0;
  let neu = 0;
  for (const frage of set.fragen) {
    if (fragen.some((f) => f.frage === frage)) continue;
    fragen.push({ id: neueId(), set: set.id, frage, antwort: '' });
    neu += 1;
  }
  return neu;
}

export const neuePosten = (vorlage) =>
  (vorlage?.length ? vorlage : PACK_START).map((name) => ({ id: neueId(), name, ok: false }));

// Einen Drehtag als frische Kopie anlegen: neue Kennungen, nichts abgehakt,
// Antworten und Takes geleert, Bilder bleiben beim Original.
export function kopieAlsNeu(b) {
  const jetzt = Date.now();
  const ids = new Map();
  const neu = (alt) => { ids.set(alt, neueId()); return ids.get(alt); };
  const um = (alt) => ids.get(alt) || '';
  const tag = JSON.parse(JSON.stringify(b.drehtag));
  Object.assign(tag, {
    id: neueId(), erstellt: jetzt, geaendert: jetzt, basisGeaendert: jetzt,
    kunde: tag.kunde + ' (Kopie)', datum: '', status: STATUS[0].id, vorlage: false,
  });
  const locations = (b.locations || []).map((l) => ({ ...l, id: neu(l.id), drehtagId: tag.id, geaendert: jetzt }));
  const videos = (b.videos || []).map((v) => ({ ...v, id: neu(v.id), drehtagId: tag.id, geaendert: jetzt }));
  const shots = (b.shots || []).map((s) => ({
    ...s, id: neueId(), drehtagId: tag.id, locationId: um(s.locationId), videoId: um(s.videoId),
    auchAn: (s.auchAn || []).map(um).filter(Boolean),
    erledigt: false, favorit: false, take: '', clips: [], spaeter: false, erledigtUm: 0, geaendert: jetzt,
    fragenOk: [], einverstaendnis: null, freigabe: null,
  }));
  // Fortschritt, Zeiten und Marker gehören zum alten Drehtag
  for (const k of ['marker', 'zeiten', 'mitgeliefert']) delete tag[k];
  Object.assign(tag, { abgeschlossen: 0, freigabeAngefragt: 0, kartenGesichert: 0 });
  if (tag.briefing) tag.briefing = { geaendert: jetzt, fragen: tag.briefing.fragen.map((f) => ({ ...f, id: neueId(), antwort: '' })) };
  if (tag.zeitplan) {
    tag.zeitplan = {
      ...tag.zeitplan, geaendert: jetzt,
      bloecke: tag.zeitplan.bloecke.map((x) => ({ ...x, id: neueId(), locationId: um(x.locationId) })),
    };
  }
  if (tag.packliste) tag.packliste = { geaendert: jetzt, posten: tag.packliste.posten.map((p) => ({ ...p, id: neueId(), ok: false })) };
  if (tag.settings) {
    tag.settings = {
      geaendert: jetzt,
      liste: tag.settings.liste.map((x) => ({ ...x, id: neu(x.id), locationId: um(x.locationId) })),
    };
    for (const s of shots) s.settingId = um(s.settingId);
  }
  // Vom Faden bleibt nur die gewählte Reihenfolge, nicht der Fortschritt
  tag.faden = { geaendert: jetzt, reihenfolge: tag.faden?.reihenfolge || 'video', fertig: [], aktiv: '' };
  return { drehtag: tag, locations, videos, shots, medien: [], geloescht: [] };
}

// ---------- Mitgelieferte Vorlagen ----------
// Gerüste zum Anpassen: Locations, Shotliste (ohne erfundene Hooks oder Skripte), Ablauf, Fragen, Packliste.
// Sprech-Shots sind leere Platzhalter; die Ampel erinnert daran, sie zu füllen.
// Gelöschte Vorlagen lassen sich unter „Sicherung“ zurückholen.
const AUFBAU = { titel: 'Ankommen und Aufbau', dauer: 30 };
const ABBAU = { titel: 'Abbau', dauer: 15 };
export const MITGELIEFERT = [
  {
    key: 'immobilie', name: 'Immobilien-Reel (Makler)', fragen: ['allgemein', 'makler'],
    orte: [{ name: 'Außen', aussen: true }, { name: 'Eingang' }, { name: 'Wohnbereich' }, { name: 'Küche' }, { name: 'Bad' }, { name: 'Schlafzimmer' }, { name: 'Garten / Balkon', aussen: true }],
    videos: ['Objekt-Reel'],
    shots: [
      { typ: 'hook', ort: 'Außen', video: 'Objekt-Reel' },
      { typ: 'oton', titel: 'Moderation Rundgang', ort: 'Wohnbereich', video: 'Objekt-Reel' },
      { typ: 'cta', ort: 'Außen', video: 'Objekt-Reel' },
      { typ: 'broll', titel: 'Fassade total', ort: 'Außen', pflicht: true },
      { typ: 'broll', titel: 'Lage und Umgebung', ort: 'Außen' },
      { typ: 'broll', titel: 'Eingangstür, Detail', ort: 'Eingang' },
      { typ: 'broll', titel: 'Wohnbereich total, langsamer Schwenk', ort: 'Wohnbereich', pflicht: true },
      { typ: 'broll', titel: 'Blick aus dem Fenster', ort: 'Wohnbereich' },
      { typ: 'broll', titel: 'Küche, Details', ort: 'Küche' },
      { typ: 'broll', titel: 'Bad total', ort: 'Bad' },
      { typ: 'broll', titel: 'Schlafzimmer total', ort: 'Schlafzimmer' },
      { typ: 'broll', titel: 'Garten / Balkon', ort: 'Garten / Balkon' },
    ],
    ablauf: [AUFBAU, ...['Außen', 'Eingang', 'Wohnbereich', 'Küche', 'Bad', 'Schlafzimmer', 'Garten / Balkon'].map((o) => ({ titel: o, ort: o, dauer: o === 'Wohnbereich' || o === 'Außen' ? 20 : 10 })), ABBAU],
    pack: [...PACK_START, 'Gimbal', 'Weitwinkel'],
  },
  {
    key: 'personal', name: 'Personal Branding', fragen: ['allgemein'],
    orte: [{ name: 'Büro / Arbeitsplatz' }, { name: 'Außen', aussen: true }],
    videos: ['Reel 1'],
    shots: [
      { typ: 'hook', ort: 'Büro / Arbeitsplatz', video: 'Reel 1' },
      { typ: 'hook', ort: 'Außen', video: 'Reel 1' },
      { typ: 'oton', titel: 'Über mich', ort: 'Büro / Arbeitsplatz', video: 'Reel 1' },
      { typ: 'cta', ort: 'Büro / Arbeitsplatz', video: 'Reel 1' },
      { typ: 'broll', titel: 'Porträt, Blick in die Kamera', ort: 'Büro / Arbeitsplatz', pflicht: true },
      { typ: 'broll', titel: 'Arbeiten am Schreibtisch', ort: 'Büro / Arbeitsplatz' },
      { typ: 'broll', titel: 'Gespräch mit Kunde (gestellt)', ort: 'Büro / Arbeitsplatz' },
      { typ: 'broll', titel: 'Hände und Details', ort: 'Büro / Arbeitsplatz' },
      { typ: 'broll', titel: 'Ankommen / Gehen', ort: 'Außen' },
    ],
    ablauf: [AUFBAU, { titel: 'Büro / Arbeitsplatz', ort: 'Büro / Arbeitsplatz', dauer: 60 }, { titel: 'Außen', ort: 'Außen', dauer: 30 }, ABBAU],
    pack: [...PACK_START, 'Teleprompter', 'Ansteckmikro'],
  },
  {
    key: 'event', name: 'Event', fragen: ['allgemein', 'event'],
    orte: [{ name: 'Eingang / Foyer' }, { name: 'Saal / Bühne' }, { name: 'Lounge / Catering' }, { name: 'Interview-Ecke' }],
    videos: ['Aftermovie', 'Reel'],
    shots: [
      { typ: 'broll', titel: 'Logo- / Markenwand', ort: 'Eingang / Foyer', pflicht: true },
      { typ: 'broll', titel: 'Eingang mit Beschilderung', ort: 'Eingang / Foyer', pflicht: true },
      { typ: 'broll', titel: 'Branding-Details (Aufsteller, Merch)', ort: 'Eingang / Foyer', pflicht: true },
      { typ: 'broll', titel: 'Gäste kommen an', ort: 'Eingang / Foyer' },
      { typ: 'broll', titel: 'Bühne total', ort: 'Saal / Bühne', pflicht: true },
      { typ: 'broll', titel: 'Redner auf der Bühne', ort: 'Saal / Bühne', pflicht: true },
      { typ: 'broll', titel: 'Publikum, Reaktion und Applaus', ort: 'Saal / Bühne', pflicht: true },
      { typ: 'broll', titel: 'Gastgeber in Aktion', ort: 'Lounge / Catering', pflicht: true },
      { typ: 'broll', titel: 'Gäste im Gespräch', ort: 'Lounge / Catering' },
      { typ: 'broll', titel: 'Catering, Details', ort: 'Lounge / Catering' },
      { typ: 'interview', titel: 'Gastgeber', ort: 'Interview-Ecke', video: 'Aftermovie', pflicht: true,
        text: 'Wer sind Sie und was ist das heute für ein Event?\nWarum gibt es dieses Event?\nWas soll den Gästen in Erinnerung bleiben?\nIn einem Satz: Wie war der Tag?' },
      { typ: 'interview', titel: 'Gast-Stimmen', ort: 'Interview-Ecke', video: 'Aftermovie',
        text: 'Wie gefällt Ihnen das Event?\nWas nehmen Sie heute mit?\nIn einem Wort: …?' },
    ],
    ablauf: [{ titel: 'Ankommen und Aufbau', dauer: 45 },
      { titel: 'Einlass', ort: 'Eingang / Foyer', dauer: 30 },
      { titel: 'Begrüßung', ort: 'Saal / Bühne', dauer: 15 },
      { titel: 'Programm', ort: 'Saal / Bühne', dauer: 60 },
      { titel: 'Interviews', ort: 'Interview-Ecke', dauer: 30 },
      { titel: 'Networking', ort: 'Lounge / Catering', dauer: 45 },
      { titel: 'Abbau', dauer: 30 }],
    pack: [...PACK_START, 'Funkstrecke / Ansteckmikros', 'Interview-Licht', 'Ersatzakkus', 'Gaffa', 'Ausweis / Akkreditierung'],
  },
  {
    key: 'interview', name: 'Interview / Testimonial', fragen: ['allgemein', 'interview'],
    orte: [{ name: 'Interview-Ort' }, { name: 'Arbeitsumfeld' }],
    videos: ['Testimonial'],
    shots: [
      { typ: 'interview', titel: 'Name offen', ort: 'Interview-Ort', video: 'Testimonial', pflicht: true,
        text: 'Stellen Sie sich bitte kurz vor.\nWie war die Situation vorher?\nWarum haben Sie sich dafür entschieden?\nWas hat sich seitdem verändert?\nWem würden Sie es empfehlen?' },
      { typ: 'broll', titel: 'Person bei der Arbeit', ort: 'Arbeitsumfeld', video: 'Testimonial', pflicht: true },
      { typ: 'broll', titel: 'Hände und Details', ort: 'Arbeitsumfeld', video: 'Testimonial' },
      { typ: 'broll', titel: 'Porträt, Blick in die Kamera', ort: 'Interview-Ort', video: 'Testimonial' },
      { typ: 'broll', titel: 'Umgebung außen', ort: 'Arbeitsumfeld', video: 'Testimonial' },
    ],
    ablauf: [AUFBAU, { titel: 'Interview', ort: 'Interview-Ort', dauer: 30 }, { titel: 'B-Roll', ort: 'Arbeitsumfeld', dauer: 30 }, ABBAU],
    pack: [...PACK_START, 'Funkstrecke / Ansteckmikro', 'Interview-Licht', 'Zweite Kamera'],
  },
  {
    key: 'foto', name: 'Fotoshooting', fragen: ['allgemein'],
    orte: [{ name: 'Innen' }, { name: 'Außen', aussen: true }],
    videos: [],
    shots: [
      { typ: 'sonst', titel: 'Porträt hochkant', ort: 'Innen', pflicht: true },
      { typ: 'sonst', titel: 'Porträt quer (Website-Header)', ort: 'Innen', format: 'quer', pflicht: true },
      { typ: 'sonst', titel: 'Halbtotale bei der Arbeit', ort: 'Innen' },
      { typ: 'sonst', titel: 'Team / Gruppe', ort: 'Innen' },
      { typ: 'sonst', titel: 'Details', ort: 'Innen' },
      { typ: 'sonst', titel: 'Porträt außen', ort: 'Außen' },
      { typ: 'sonst', titel: 'Location ohne Person', ort: 'Außen' },
    ],
    ablauf: [AUFBAU, { titel: 'Innen', ort: 'Innen', dauer: 60 }, { titel: 'Außen', ort: 'Außen', dauer: 30 }, ABBAU],
    pack: ['Kamera', 'Objektive (35 mm, 85 mm)', 'Blitz oder Dauerlicht', 'Softbox', 'Reflektor', 'Hintergrund', 'Akkus (geladen)', 'Speicherkarten (leer)', 'Stativ'],
  },
];

// Aus einer mitgelieferten Vorlage ein Bündel bauen (Vorlage, also ohne Datum)
export function vorlageBuendel(def, jetzt = Date.now()) {
  const tagId = neueId();
  const locations = def.orte.map((o, i) => ({ id: neueId(), drehtagId: tagId, name: o.name, notiz: '', aussen: !!o.aussen, pos: i + 1, geaendert: jetzt }));
  const videos = def.videos.map((n, i) => ({ id: neueId(), drehtagId: tagId, name: n, notiz: '', pos: i + 1, geaendert: jetzt }));
  const ortId = (n) => locations.find((l) => l.name === n)?.id || '';
  const videoId = (n) => videos.find((v) => v.name === n)?.id || '';
  const shots = def.shots.map((x, i) => ({
    id: neueId(), drehtagId: tagId, typ: x.typ, titel: x.titel || '', text: x.text || '',
    locationId: ortId(x.ort), videoId: videoId(x.video), settingId: '', format: x.format || 'hochkant',
    erledigt: false, favorit: false, pflicht: !!x.pflicht, take: '', notiz: '', pos: i + 1, geaendert: jetzt,
  }));
  const fragen = [];
  for (const id of def.fragen) frageSetDazu(fragen, id);
  const drehtag = {
    id: tagId, kunde: def.name, vorlage: true, mitgeliefert: def.key, erstellt: jetzt, geaendert: jetzt, basisGeaendert: jetzt,
    datum: '', uhrzeit: '', ort: '', notizen: '', status: STATUS[0].id,
    briefing: { geaendert: jetzt, fragen },
    packliste: { geaendert: jetzt, posten: def.pack.map((name) => ({ id: neueId(), name, ok: false })) },
    zeitplan: { geaendert: jetzt, kundenhinweis: '', bloecke: def.ablauf.map((x) => ({ id: neueId(), titel: x.titel, dauer: x.dauer, locationId: ortId(x.ort), hinweis: x.hinweis || '', fest: '' })) },
    faden: { geaendert: jetzt, reihenfolge: 'video', fertig: [], aktiv: '' },
  };
  return { drehtag, locations, videos, shots, medien: [], geloescht: [] };
}

// ---------- Zusammenführen ----------
// Handy und PC arbeiten getrennt an Kopien desselben Drehtags. Beim Zusammenführen
// gewinnt pro Eintrag die jüngere Fassung. Gelöschtes bleibt gelöscht.

export const stempel = (r) => r?.geaendert || r?.erstellt || 0;
const TEILE = ['briefing', 'zeitplan', 'packliste', 'faden', 'settings', 'bereit', 'marker', 'zeiten'];

// Der Drehtag selbst hat vier Teile mit eigenem Zeitstempel: die Grunddaten,
// das Briefing, den Zeitplan und die Packliste. Jeder Teil wird einzeln verglichen.
export function drehtagMischen(a, b) {
  if (!a) return b;
  if (!b) return a;
  const basis = (t) => t.basisGeaendert || t.erstellt || 0;
  const erg = { ...(basis(b) > basis(a) ? b : a) };
  for (const teil of TEILE) {
    const [x, y] = [a[teil], b[teil]];
    const wahl = !x ? y : !y ? x : (y.geaendert || 0) > (x.geaendert || 0) ? y : x;
    if (wahl) erg[teil] = wahl; else delete erg[teil];
  }
  erg.geaendert = Math.max(stempel(a), stempel(b));
  return erg;
}

export function buendelMischen(a, b) {
  // Lösch-Vermerke beider Seiten sammeln
  const weg = new Map();
  for (const t of [...(a.geloescht || []), ...(b.geloescht || [])]) {
    const alt = weg.get(t.id);
    if (!alt || t.zeit > alt.zeit) weg.set(t.id, t);
  }
  const mische = (name) => {
    const map = new Map();
    for (const r of a[name] || []) map.set(r.id, r);
    for (const r of b[name] || []) {
      const lokal = map.get(r.id);
      if (!lokal || stempel(r) > stempel(lokal)) map.set(r.id, r);
    }
    // Wurde ein Eintrag gelöscht und danach nicht mehr geändert, bleibt er weg
    return [...map.values()].filter((r) => !(weg.has(r.id) && weg.get(r.id).zeit >= stempel(r)));
  };
  const erg = {
    ...DATEI_KOPF,
    drehtag: drehtagMischen(a.drehtag, b.drehtag),
    locations: mische('locations'), videos: mische('videos'), shots: mische('shots'), medien: mische('medien'),
  };
  const lebt = new Set([...erg.locations, ...erg.videos, ...erg.shots, ...erg.medien].map((r) => r.id));
  erg.geloescht = [...weg.values()].filter((t) => !lebt.has(t.id));
  return erg;
}
