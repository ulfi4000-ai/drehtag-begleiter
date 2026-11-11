// Reine Daten-Logik ohne Browser-Teile (kein Bildschirm, keine Datenbank).
// Die App im Browser und der MCP-Server am PC benutzen dieselbe Datei,
// damit beide gleich gruppieren, gleich rechnen und gleich zusammenführen.

export const TYPEN = [
  { id: 'hook', label: 'Hooks', kurz: 'Hook' },
  { id: 'oton', label: 'Skripte & O-Töne', kurz: 'Skript/O-Ton' },
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

// Aus Drehbeginn und den Dauern der Blöcke die Uhrzeiten ausrechnen
export function zeitplanMitZeiten(start, bloecke) {
  let t = istZeit(start) ? inMin(start) : null;
  return (bloecke || []).map((b) => {
    const dauer = Math.max(0, Number(b.dauer) || 0);
    const von = t;
    if (t != null) t += dauer;
    return { ...b, dauer, von: von == null ? '' : alsZeit(von), bis: von == null ? '' : alsZeit(von + dauer) };
  });
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
export const SCHAETZUNG = { hook: 3, oton: 5, cta: 2, broll: 3, karussell: 2, sonst: 3, umbau: 10 };
const RANG = { hook: 0, oton: 1, cta: 2, broll: 3, karussell: 4, sonst: 5 };

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
  const an = (locId) => alleShots.filter((s) => s.locationId === locId);

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
  const ohne = alleShots.filter((s) => !vergeben.has(s.locationId));
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
  const shots = b.shots || [];
  return {
    stationen, idx,
    nachholen: stationen.flatMap((s) => s.spaeter),
    gesamt: shots.length, erledigt: shots.filter((s) => s.erledigt).length,
  };
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
        if (s.notiz) z.push(`  - Notiz: ${eineZeile(s.notiz)}`);
      }
    }
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
export function icsText(b) {
  const tag = b.drehtag;
  if (!tag.datum) return null;
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const tagZahl = tag.datum.replace(/-/g, '');
  const stempelJetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const z = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Drehtag-Begleiter//DE', 'BEGIN:VEVENT',
    `UID:${tag.id}@drehtag-begleiter`, `DTSTAMP:${stempelJetzt}`];
  if (istZeit(tag.uhrzeit)) {
    const start = inMin(tag.uhrzeit);
    // Länge aus dem Zeitplan, ohne Zeitplan eine Stunde. Über Mitternacht wird nicht gerechnet.
    const ende = Math.min(start + (zeitplanMinuten(tag.zeitplan?.bloecke) || 60), 1439);
    z.push(`DTSTART:${tagZahl}T${alsZeit(start).replace(':', '')}00`, `DTEND:${tagZahl}T${alsZeit(ende).replace(':', '')}00`);
  } else {
    const d = new Date(tag.datum + 'T00:00');
    d.setDate(d.getDate() + 1);
    const morgen = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    z.push(`DTSTART;VALUE=DATE:${tagZahl}`, `DTEND;VALUE=DATE:${morgen}`);
  }
  z.push(`SUMMARY:${esc('Dreh: ' + tag.kunde)}`);
  if (tag.ort) z.push(`LOCATION:${esc(tag.ort)}`);
  const beschreibung = [
    tag.ansprechpartner ? `Kontakt: ${tag.ansprechpartner}${tag.telefon ? ' (' + tag.telefon + ')' : ''}` : '',
    tag.notizen,
  ].filter(Boolean).join('\n');
  if (beschreibung) z.push(`DESCRIPTION:${esc(beschreibung)}`);
  z.push('END:VEVENT', 'END:VCALENDAR');
  return z.join('\r\n');
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
    erledigt: false, favorit: false, take: '', spaeter: false, erledigtUm: 0, geaendert: jetzt,
  }));
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

// ---------- Zusammenführen ----------
// Handy und PC arbeiten getrennt an Kopien desselben Drehtags. Beim Zusammenführen
// gewinnt pro Eintrag die jüngere Fassung. Gelöschtes bleibt gelöscht.

export const stempel = (r) => r?.geaendert || r?.erstellt || 0;
const TEILE = ['briefing', 'zeitplan', 'packliste', 'faden', 'settings'];

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
