// Teleprompter auf dem zweiten Gerät (Seite geraet/index.html).
// Das Hauptgerät (Android-App) ist im selben WLAN oder Hotspot ein kleiner Server und schickt
// Befehle über eine dauerhafte Verbindung (Server-Sent Events). Diese Seite zeigt nur den Text.
//
// Befehle (JSON): { typ: 'text', titel, text } · { typ: 'einstellung', tempo, groesse, spiegeln }
//                 { typ: 'umschalten' | 'start' | 'pause' | 'anfang' | 'zurueck' | 'vor' }

const $ = (s) => document.querySelector(s);
const schluessel = new URLSearchParams(location.search).get('k') || '';
const prompter = $('#prompter');
const sc = $('.scroll');
const txt = $('.text');
const zaehler = $('.zaehler');
const status = $('.status');

const e = { tempo: 60, groesse: 44, spiegeln: false };
let laeuft = false;
let pos = 0;
let zuletzt = 0;
let raf = 0;
let countdown = 0;

function anwenden() {
  txt.style.fontSize = `${e.groesse}px`;
  txt.classList.toggle('gespiegelt', !!e.spiegeln);
}

function bild(t) {
  if (!laeuft) return;
  const dt = Math.min((t - zuletzt) / 1000, 0.1);
  zuletzt = t;
  if (Math.abs(sc.scrollTop - pos) > 3) pos = sc.scrollTop; // von Hand gescrollt
  pos += e.tempo * dt;
  sc.scrollTop = pos;
  if (sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1) { stopp(); return; }
  raf = requestAnimationFrame(bild);
}

function los() {
  laeuft = true;
  pos = sc.scrollTop;
  zuletzt = performance.now();
  raf = requestAnimationFrame(bild);
}

function stopp() {
  laeuft = false;
  clearInterval(countdown);
  countdown = 0;
  zaehler.hidden = true;
  cancelAnimationFrame(raf);
}

function starten() {
  if (laeuft || countdown) return;
  // Am Anfang 3-2-1, damit man sich hinstellen kann
  if (sc.scrollTop < 5) {
    let n = 3;
    zaehler.textContent = n;
    zaehler.hidden = false;
    countdown = setInterval(() => {
      n -= 1;
      if (n > 0) { zaehler.textContent = n; return; }
      clearInterval(countdown);
      countdown = 0;
      zaehler.hidden = true;
      los();
    }, 1000);
  } else {
    los();
  }
}

const umschalten = () => (laeuft || countdown ? stopp() : starten());

function befehl(b) {
  switch (b.typ) {
    case 'text':
      stopp();
      txt.textContent = b.text || '';
      sc.scrollTop = 0;
      pos = 0;
      break;
    case 'einstellung':
      Object.assign(e, { tempo: b.tempo ?? e.tempo, groesse: b.groesse ?? e.groesse, spiegeln: b.spiegeln ?? e.spiegeln });
      anwenden();
      break;
    case 'umschalten': umschalten(); break;
    case 'start': starten(); break;
    case 'pause': stopp(); break;
    case 'anfang': stopp(); sc.scrollTop = 0; pos = 0; break;
    case 'zurueck': sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight / 3); pos = sc.scrollTop; break;
    case 'vor': sc.scrollTop += sc.clientHeight / 3; pos = sc.scrollTop; break;
  }
}

// Verbindung zum Hauptgerät. EventSource verbindet sich bei Abbruch von selbst neu.
function verbinden() {
  if (!schluessel) { $('#verbindung').textContent = 'Kein Schlüssel – bitte den QR-Code am Hauptgerät neu scannen.'; return; }
  const q = new EventSource(`/ereignisse?k=${encodeURIComponent(schluessel)}`);
  q.onopen = () => {
    $('#verbindung').textContent = 'Verbunden.';
    $('#verbindung').classList.add('ok');
    status.textContent = 'verbunden';
    status.classList.remove('weg');
  };
  q.onerror = () => {
    $('#verbindung').textContent = 'Verbindung unterbrochen, verbinde neu …';
    $('#verbindung').classList.remove('ok');
    status.textContent = 'getrennt';
    status.classList.add('weg');
  };
  q.onmessage = (m) => {
    try { befehl(JSON.parse(m.data)); } catch { /* unbekannter Befehl */ }
  };
}

// Antippen startet: Vollbild (wo möglich) und Video, das den Bildschirm anlässt
$('#los').addEventListener('click', () => {
  $('#start').hidden = true;
  prompter.hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  $('#wach').play().catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
});

// Tippen auf den Text: Start/Pause. Bluetooth-Fernbedienung am zweiten Gerät geht auch.
sc.addEventListener('click', umschalten);
document.addEventListener('keydown', (k) => {
  if (prompter.hidden || k.repeat) return;
  if ([' ', 'Enter', 'PageDown', 'ArrowDown', 'ArrowRight', 'MediaPlayPause'].includes(k.key)) { k.preventDefault(); umschalten(); }
  if (['PageUp', 'ArrowUp', 'ArrowLeft'].includes(k.key)) { k.preventDefault(); befehl({ typ: 'zurueck' }); }
});

anwenden();
txt.textContent = 'Warte auf Text vom Hauptgerät …';
verbinden();
