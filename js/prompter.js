// Eigener Teleprompter: Text läuft im Vollbild von unten nach oben.
import { esc, showOverlay } from './util.js';

const KEY = 'prompter-einstellungen';
const laden = () => ({ tempo: 60, groesse: 40, spiegeln: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') });

export function openPrompter(titel, text) {
  const s = laden();
  let laeuft = false;
  let pos = 0;         // Scroll-Position in Pixeln, mit Nachkommastellen
  let zuletzt = 0;     // Zeitstempel des letzten Bildes
  let raf = 0;
  let countdown = 0;
  let wachhalter = null;

  const o = showOverlay(`
    <div class="prompter">
      <div class="p-scroll"><div class="p-text">${esc(text || 'Dieses Skript ist noch leer.')}</div></div>
      <div class="p-line"></div>
      <div class="p-count" hidden></div>
      <div class="p-bar">
        <div class="p-row">
          <button data-p="close" aria-label="Schließen">✕</button>
          <button data-p="top">Anfang</button>
          <button data-p="mirror">Spiegeln</button>
          <button data-p="play" class="p-play">Start</button>
        </div>
        <div class="p-row">
          <button data-p="slower">Tempo −</button>
          <span class="p-val" data-v="tempo"></span>
          <button data-p="faster">Tempo +</button>
          <button data-p="smaller">A −</button>
          <span class="p-val" data-v="groesse"></span>
          <button data-p="bigger">A +</button>
        </div>
      </div>
    </div>`, { onClose: aufraeumen });

  const root = o.el.querySelector('.prompter');
  const sc = root.querySelector('.p-scroll');
  const txt = root.querySelector('.p-text');
  const count = root.querySelector('.p-count');
  const play = root.querySelector('[data-p="play"]');

  function anwenden() {
    txt.style.fontSize = s.groesse + 'px';
    txt.classList.toggle('gespiegelt', s.spiegeln);
    root.querySelector('[data-v="tempo"]').textContent = s.tempo;
    root.querySelector('[data-v="groesse"]').textContent = s.groesse;
    root.querySelector('[data-p="mirror"]').classList.toggle('an', s.spiegeln);
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  // Wird für jedes Bild aufgerufen und schiebt den Text ein Stück weiter
  function bild(t) {
    if (!laeuft) return;
    const dt = Math.min((t - zuletzt) / 1000, 0.1);
    zuletzt = t;
    // Hat jemand von Hand gescrollt? Dann von dort weitermachen.
    if (Math.abs(sc.scrollTop - pos) > 3) pos = sc.scrollTop;
    pos += s.tempo * dt;
    sc.scrollTop = pos;
    if (sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1) { stopp(); return; }
    raf = requestAnimationFrame(bild);
  }

  async function los() {
    laeuft = true;
    play.textContent = 'Pause';
    root.classList.add('laeuft');
    try { wachhalter = await navigator.wakeLock?.request('screen'); } catch { /* nicht überall erlaubt */ }
    pos = sc.scrollTop;
    zuletzt = performance.now();
    raf = requestAnimationFrame(bild);
  }

  function stopp() {
    laeuft = false;
    clearInterval(countdown);
    countdown = 0;
    count.hidden = true;
    cancelAnimationFrame(raf);
    play.textContent = 'Start';
    root.classList.remove('laeuft');
    wachhalter?.release().catch(() => {});
    wachhalter = null;
  }

  function umschalten() {
    if (laeuft || countdown) { stopp(); return; }
    // Am Anfang erst 3-2-1 zählen, damit man sich hinstellen kann
    if (sc.scrollTop < 5) {
      let n = 3;
      count.textContent = n;
      count.hidden = false;
      play.textContent = 'Abbrechen';
      countdown = setInterval(() => {
        n -= 1;
        if (n > 0) { count.textContent = n; return; }
        clearInterval(countdown);
        countdown = 0;
        count.hidden = true;
        los();
      }, 1000);
    } else {
      los();
    }
  }

  function aufraeumen() {
    stopp();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) {
      // Tippen auf den Text: Start/Pause
      if (e.target.closest('.p-scroll')) umschalten();
      return;
    }
    switch (b.dataset.p) {
      case 'close': o.close(); break;
      case 'play': umschalten(); break;
      case 'top': stopp(); sc.scrollTop = 0; pos = 0; break;
      case 'mirror': s.spiegeln = !s.spiegeln; break;
      case 'slower': s.tempo = Math.max(10, s.tempo - 10); break;
      case 'faster': s.tempo = Math.min(300, s.tempo + 10); break;
      case 'smaller': s.groesse = Math.max(20, s.groesse - 4); break;
      case 'bigger': s.groesse = Math.min(120, s.groesse + 4); break;
    }
    anwenden();
  });

  anwenden();
  // Am Handy echtes Vollbild, damit die Leisten verschwinden
  if ('ontouchstart' in window) root.requestFullscreen?.().catch(() => {});
}
