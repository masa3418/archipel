// Aufnahme von Erklärvideos im Browser (nur Entwicklung, nicht im Release, nicht im Service Worker).
// Laden im Spiel (http://localhost:8765, Empfänger tools/video/recv.js läuft):
//   (0, eval)(await fetch('/tools/video/rec.js').then(r => r.text()));
// Danach eine Szene aus tools/video/scenes.js. Die Seite wird beim Aufnehmen umgebaut (eigene Uhr, kein Autosave) –
// nach dem Ende neu laden.
//
// Prinzip: Die Uhr des Spiels (performance.now, requestAnimationFrame, setTimeout) läuft nur, wenn Rec ein Bild aufnimmt –
// 30 Bilder je Sekunde Spielzeit, unabhängig vom Tempo des Rechners. Jedes Bild: sichtbarer Kartenausschnitt plus Textleiste,
// per POST an den Empfänger. Klänge werden mit Zeitpunkt protokolliert und am Ende mit derselben Klangerzeugung (sfx.js)
// in einem OfflineAudioContext taktgenau berechnet.
window.Rec = (() => {
  const RECV = 'http://localhost:8766';
  const FRAME = 1000 / 30;
  let V = null;

  function install() {
    if (window.__recInstalled) return;
    window.__recInstalled = true;
    window.__rec = { t: performance.now(), q: [] };
    const R = window.__rec;
    performance.now = () => R.t;
    window.requestAnimationFrame = () => 0;
    window.setTimeout = (fn, ms = 0, ...a) => { R.q.push([R.t + (+ms || 0), fn, a]); return 1; };
    try { localStorage.setItem = () => {}; } catch (e) {}   // Aufnahme-Szenen nicht als Spielstand sichern
    Sfx.setLoop = () => {};
  }

  // Szene beginnen: Ansicht, Wiedergabetempo, Klangprotokoll
  async function start(name) {
    install();
    const R = window.__rec;
    replay = 'slow';
    closeModals(); captureQueue.length = 0;
    // Kartenausschnitt fest auf 944×710 – unabhängig von der Fenstergröße (die Vorschau kann sie jederzeit ändern)
    if (wrap.clientWidth !== 944 || wrap.clientHeight !== 710) {
      // Mittelpunkt der Szene merken – nach dem Ändern der Größe wieder dorthin (sonst verrutscht der Ausschnitt)
      const mx = (wrap.scrollLeft + wrap.clientWidth / 2) / TS, my = (wrap.scrollTop + wrap.clientHeight / 2) / TS;
      Object.assign(wrap.style, { flex: 'none', width: '944px', height: '710px', minWidth: '944px', minHeight: '710px' });
      const sx = wrap.offsetWidth - wrap.clientWidth, sy = wrap.offsetHeight - wrap.clientHeight;   // Bildlaufleisten
      Object.assign(wrap.style, { width: 944 + sx + 'px', height: 710 + sy + 'px', minWidth: 944 + sx + 'px', minHeight: 710 + sy + 'px' });
      resizeCanvas();
      wrap.scrollLeft = mx * TS - 472; wrap.scrollTop = my * TS - 355;
      refresh();
    }
    const W = wrap.clientWidth & ~1, H = wrap.clientHeight & ~1;
    if (W !== 944 || H !== 710) throw new Error(`Kartenausschnitt ${W}×${H} statt 944×710`);
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    V = { name, W, H, off, octx: off.getContext('2d'), n: 0, t0: R.t, log: [], last: {}, cap: null };
    Sfx.play = (k, gap = 0) => { if (gap && V.last[k] != null && R.t - V.last[k] < gap) return; V.last[k] = R.t; V.log.push([R.t - V.t0, 'play', k]); };
    Sfx.move = (type, dur, g = 1) => { V.log.push([R.t - V.t0, 'move', type, dur, g]); };
    await fetch(`${RECV}/start/${name}`, { method: 'POST' });
  }

  // Textleiste: oben Deutsch, darunter kleiner Englisch. opts.big: große Titeltafel in der Bildmitte (Karte abgedunkelt,
  // Schriftzug ARCHIPEL darüber) – für Vor- und Abspann. Eine Titeltafel blendet beim Wechsel weich aus.
  function caption(de, en, opts = {}) {
    const now = window.__rec.t;
    if (V.cap && V.cap.big) V.fade = { cap: V.cap, t1: now };
    V.cap = de ? { de, en, t0: now, big: !!opts.big } : null;
  }
  function drawBig(cap, a) {
    const c = V.octx, cx = V.W / 2;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = 'rgba(6,10,18,0.78)'; c.fillRect(0, 0, V.W, V.H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // Schriftzug wie im Spielkopf: ARCHI weiß, PEL blau
    c.font = '800 64px system-ui, "Segoe UI", sans-serif';
    const w1 = c.measureText('ARCHI').width, w2 = c.measureText('PEL').width, x0 = cx - (w1 + w2) / 2, y0 = V.H * 0.36;
    c.textAlign = 'left';
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 12;
    c.fillStyle = '#ffffff'; c.fillText('ARCHI', x0, y0);
    c.fillStyle = '#2f7de1'; c.fillText('PEL', x0 + w1, y0);
    c.textAlign = 'center';
    c.font = '700 30px system-ui, "Segoe UI", sans-serif'; c.fillStyle = '#ffffff';
    const de = wrapText(c, cap.de, V.W - 120);
    de.forEach((l, i) => c.fillText(l, cx, y0 + 78 + i * 38));
    c.font = '20px system-ui, "Segoe UI", sans-serif'; c.fillStyle = '#b9c6da';
    const en = cap.en ? wrapText(c, cap.en, V.W - 120) : [];
    en.forEach((l, i) => c.fillText(l, cx, y0 + 78 + de.length * 38 + 14 + i * 28));
    c.restore();
  }
  function wrapText(c, text, max) {
    const words = text.replace(/ %/g, ' %').split(' '), lines = [];   // nie vor „%“ umbrechen
    let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  function drawCaption() {
    const now = window.__rec.t;
    if (V.fade) { const a = 1 - (now - V.fade.t1) / 600; if (a > 0) drawBig(V.fade.cap, a); else V.fade = null; }
    if (!V.cap) return;
    if (V.cap.big) { drawBig(V.cap, Math.min(1, (now - V.cap.t0) / 600)); return; }
    const c = V.octx, a = Math.min(1, (now - V.cap.t0) / 300), pad = 16, max = V.W - 2 * pad - 24;
    c.save();
    c.font = '700 21px system-ui, "Segoe UI", sans-serif';
    const de = wrapText(c, V.cap.de, max);
    c.font = '15px system-ui, "Segoe UI", sans-serif';
    const en = V.cap.en ? wrapText(c, V.cap.en, max) : [];
    const h = 18 + de.length * 27 + (en.length ? 6 + en.length * 20 : 0);
    const y = V.H - pad - h;
    c.globalAlpha = a;
    c.fillStyle = 'rgba(8,14,26,0.82)';
    c.beginPath(); c.roundRect(pad, y, V.W - 2 * pad, h, 10); c.fill();
    c.textBaseline = 'top';
    c.fillStyle = '#ffffff'; c.font = '700 21px system-ui, "Segoe UI", sans-serif';
    de.forEach((l, i) => c.fillText(l, pad + 12, y + 10 + i * 27));
    c.fillStyle = '#b9c6da'; c.font = '15px system-ui, "Segoe UI", sans-serif';
    en.forEach((l, i) => c.fillText(l, pad + 12, y + 14 + de.length * 27 + i * 20));
    c.restore();
  }

  async function frame() {
    const R = window.__rec;
    R.t += FRAME;
    R.q.sort((a, b) => a[0] - b[0]);
    while (R.q.length && R.q[0][0] <= R.t) { const [, fn, a] = R.q.shift(); try { fn(...a); } catch (e) {} }
    dirty = true; loop(R.t);
    V.octx.drawImage(cv, wrap.scrollLeft, wrap.scrollTop, V.W, V.H, 0, 0, V.W, V.H);
    drawCaption();
    // toDataURL statt toBlob: toBlob wird im Hintergrund auf ein Bild je Sekunde gedrosselt, toDataURL läuft sofort
    const bin = atob(V.off.toDataURL('image/png').split(',')[1]), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    await fetch(`${RECV}/frame/${V.name}/${V.n++}`, { method: 'POST', body: arr });
  }
  async function hold(ms) { const n = Math.round(ms / FRAME); for (let i = 0; i < n; i++) await frame(); }
  async function playAnim() { while (animActive(window.__rec.t)) await frame(); }

  const byId = i => S.units.find(u => u.id === i);
  // Ein Spielschritt mit Animation. fn führt Regeln aus (moveStep …). want(): gewünschter Ausgang – sonst Zustand
  // zurücksetzen und erneut würfeln, bevor ein Bild entsteht (rng ist fest Math.random).
  async function act(fn, want) {
    const snap = want ? serialize() : null;
    for (let k = 0; k < 200; k++) {
      animBegin(V.speed || 120); fn(); computeVision(0); computeVision(1); animEnd(); refresh();   // Sicht wie nach einem normalen Zug
      if (!want || want()) break;
      if (k === 199) throw new Error('Gewünschter Ausgang nicht erreicht');
      deserialize(snap); computeVision(0); computeVision(1);
    }
    await playAnim();
  }
  // Einheit (per id) Feld für Feld ziehen; want gilt für den letzten Schritt (Angriff)
  async function walk(id, cells, want) {
    for (let i = 0; i < cells.length; i++) {
      const [x, y] = cells[i];
      await act(() => moveStep(byId(id), x, y), i === cells.length - 1 ? want : null);
    }
  }

  // Ton berechnen, WAV senden, Video bauen lassen
  async function finish() {
    const R = window.__rec, total = (R.t - V.t0) / 1000, sr = 44100;
    let src = await fetch('/js/sfx.js?' + Date.now()).then(r => r.text());
    const rep = (a, b) => { if (!src.includes(a)) throw new Error('sfx.js geändert, Ersetzung fehlt: ' + a); src = src.replace(a, b); };
    rep('const Sfx = (() => {', 'window.__SfxOff = (() => {');
    rep("const AC = window.AudioContext || window.webkitAudioContext;\n        if (!AC) return null;\n        ac = new AC();", 'ac = window.__OAC;');
    rep("if (ac.state === 'suspended') ac.resume();", '');
    rep("muted = localStorage.getItem('archipel-muted') === '1';", 'muted = false;');
    rep("document.addEventListener('visibilitychange'", "(() => {})('visibilitychange'");
    window.__OAC = new OfflineAudioContext(2, Math.ceil((total + 1) * sr), sr);
    (0, eval)(src);
    const S2 = window.__SfxOff; S2.setVolume(0.75);
    const q = 128 / sr, groups = new Map();
    for (const e of V.log) { const t = Math.max(q, Math.round(e[0] / 1000 / q) * q); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(e); }
    for (const t of [...groups.keys()].sort((a, b) => a - b)) {
      window.__OAC.suspend(t).then(() => { for (const e of groups.get(t)) { if (e[1] === 'play') S2.play(e[2]); else S2.move(e[2], e[3], e[4]); } window.__OAC.resume(); });
    }
    const buf = await window.__OAC.startRendering();
    const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const wav = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true);
    wav.setUint16(22, 2, true); wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true);
    str(36, 'data'); wav.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++) for (const c of ch) { wav.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 32767, true); o += 2; }
    await fetch(`${RECV}/audio/${V.name}`, { method: 'POST', body: new Blob([wav.buffer]) });
    await fetch(`${RECV}/done/${V.name}`, { method: 'POST', body: JSON.stringify({ seconds: +total.toFixed(2) }) });
    return { name: V.name, seconds: +total.toFixed(1), frames: V.n, sounds: V.log.length };
  }

  // Zugtempo der Aufnahme (Grundwert wie im Spiel 120 ms je Schritt, mal Wiedergabe „langsam“); größer = gemächlicher
  const speed = ms => { V.speed = ms; };
  return { start, caption, hold, act, walk, finish, byId, frame, speed };
})();
