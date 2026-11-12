// Nur in der Android-App (Capacitor-Hülle, Ordner android-app/). Im Browser tut diese Datei nichts.
//
// Im Android-WebView fehlen ein paar Browser-Funktionen. Sie werden hier über das native Plugin
// "Drehtag" (DrehtagPlugin.java) nachgerüstet, damit der Rest der App unverändert bleibt:
//   navigator.share / canShare  → Teilen-Menü von Android (Text und Dateien)
//   window.print                → Drucken / als PDF speichern
//   navigator.wakeLock          → Bildschirm anlassen
// Dazu: Dateien empfangen ("Teilen an" / "Öffnen mit"), Lautstärke- und Medientasten der
// Fernbedienung, Hinweis auf eine neuere App-Fassung.

const C = window.Capacitor;
export const istNativ = !!C?.isNativePlatform?.();
const rufe = (methode, daten = {}) => C.nativePromise('Drehtag', methode, daten);

const ONLINE_VERSION = 'https://ulfi4000-ai.github.io/drehtag-begleiter/apk.json';
export const appFassung = { hier: null, online: null };

async function alsBase64(datei) {
  const puffer = new Uint8Array(await datei.arrayBuffer());
  let s = '';
  for (let i = 0; i < puffer.length; i += 0x8000) s += String.fromCharCode(...puffer.subarray(i, i + 0x8000));
  return btoa(s);
}

function browserErsetzen() {
  navigator.canShare = (d) => !!(d && (d.text || d.url || d.files?.length));
  navigator.share = async (d = {}) => {
    const datei = d.files?.[0];
    if (!datei) return rufe('teilen', { text: d.text || d.url || '', titel: d.title });
    const typ = datei.type || 'application/octet-stream';
    const alsText = /^text\/|json/.test(typ);
    return rufe('teilen', {
      name: datei.name, typ, titel: d.title,
      ...(alsText ? { text: await datei.text() } : { base64: await alsBase64(datei) }),
    });
  };
  window.print = () => { rufe('drucken', { titel: document.title }).catch(() => {}); };

  // Bildschirm anlassen: mitzählen, wer ihn gerade braucht (Roter Faden, Teleprompter, Aufnahme)
  let halter = 0;
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      async request() {
        halter += 1;
        if (halter === 1) await rufe('wach', { an: true });
        const s = new EventTarget();
        s.released = false;
        s.release = async () => {
          if (s.released) return;
          s.released = true;
          halter = Math.max(0, halter - 1);
          if (!halter) await rufe('wach', { an: false });
          s.dispatchEvent(new Event('release'));
        };
        return s;
      },
    },
  });
}

// Lautstärke-/Medientasten nur abfangen, wo die Fernbedienung gebraucht wird; sonst regeln sie die Lautstärke
function tastenSteuern() {
  let zuletzt = null;
  const pruefen = () => {
    const overlay = document.getElementById('overlay');
    const an = location.hash.startsWith('#/faden/') || location.hash.startsWith('#/sicherung')
      || (!overlay.hidden && !!overlay.querySelector('.prompter'));
    if (an !== zuletzt) { zuletzt = an; rufe('abfangen', { an }).catch(() => {}); }
  };
  window.addEventListener('hashchange', pruefen);
  new MutationObserver(pruefen).observe(document.getElementById('overlay'), { attributes: true, attributeFilter: ['hidden'], childList: true });
  pruefen();
  C.addListener('Drehtag', 'taste', (d) => {
    const ziel = document.activeElement || document.body;
    ziel.dispatchEvent(new KeyboardEvent('keydown', { key: d.key, bubbles: true, cancelable: true }));
  });
}

function empfangSteuern(einlesen, toast) {
  const holen = async () => {
    const d = await rufe('datei');
    if (!d?.text) return;
    try {
      await einlesen(new File([d.text], d.name || 'datei.txt', { type: 'text/plain' }));
    } catch (e) {
      toast(e.message || 'Datei ließ sich nicht einlesen');
    }
  };
  C.addListener('Drehtag', 'datei', holen);
  C.addListener('Drehtag', 'dateiFehler', (d) => toast(`Datei ließ sich nicht öffnen: ${d.fehler || ''}`));
  holen();
}

async function updatePruefen(toast) {
  try {
    appFassung.hier = await (await fetch('apk-version.json')).json();
    appFassung.online = await (await fetch(ONLINE_VERSION, { cache: 'no-store' })).json();
    if (appFassung.online.code > appFassung.hier.code) {
      setTimeout(() => toast(`Neue App-Fassung vom ${appFassung.online.name} liegt auf dem NAS (Drehtage › App)`), 1500);
    }
  } catch { /* ohne Netz kein Hinweis */ }
}

export function initNativ({ einlesen, toast }) {
  if (!istNativ) return;
  document.documentElement.classList.add('nativ');
  browserErsetzen();
  tastenSteuern();
  empfangSteuern(einlesen, toast);
  updatePruefen(toast);
}
