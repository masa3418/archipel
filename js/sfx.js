'use strict';
// ---------------------------------------------------------------------------
// Soundeffekte – komplett per Web Audio synthetisiert, keine Audiodateien.
// Der Browser erlaubt Ton erst nach der ersten Benutzeraktion (Klick/Taste).
// ---------------------------------------------------------------------------

const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false, vol = 0.6;
  const last = {};
  try {
    muted = localStorage.getItem('archipel-muted') === '1';
    const v = parseFloat(localStorage.getItem('archipel-vol'));
    if (v >= 0 && v <= 1) vol = v;
  } catch (e) {}

  function ensure() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        master = ac.createGain();
        master.gain.value = muted ? 0 : vol;
        master.connect(comp); comp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { return null; }
    return ac;
  }

  // Hüllkurve: kurzer Anstieg, exponentielles Ausklingen
  function env(g, t, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.2, gain = 0.2, attack = 0.005, at = 0 }) {
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, gain, attack, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.3, filter = 'lowpass', f = 800, f2 = null, q = 1, gain = 0.3, attack = 0.005, at = 0 }) {
    const t = ac.currentTime + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    env(g, t, gain, attack, dur);
    s.connect(fl); fl.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const notes = (list, type, gain, step, len) =>
    list.forEach((f, i) => tone({ f, type, gain, dur: len, at: i * step, attack: 0.01 }));

  // ---- Bausteine für die längeren Stücke (Sieg, Niederlage) ----
  // Gehaltene Stimme: zwei leicht verstimmte Oszillatoren durch einen Tiefpass, Hüllkurve mit Anstieg, Halten, Ausklingen,
  // auf Wunsch Vibrato. cutoff/cutEnd: Klangfarbe (Blech öffnet sich beim Anblasen), detune in Cent.
  function voice({ f, at = 0, dur = 0.4, gain = 0.06, type = 'sawtooth', cutoff = 1800, cutEnd = null, q = 0.7,
    attack = 0.03, release = 0.25, detune = 7, vib = 0 }) {
    const t = ac.currentTime + at, end = t + dur;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q;
    fl.frequency.setValueAtTime(cutoff * 0.35, t);
    fl.frequency.exponentialRampToValueAtTime(cutoff, t + Math.max(0.02, attack * 1.5));
    if (cutEnd) fl.frequency.exponentialRampToValueAtTime(cutEnd, end + release);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + release);
    fl.connect(g); g.connect(master);
    let lfo = null;
    if (vib) {
      lfo = ac.createOscillator(); lfo.frequency.value = 5.2;
      const lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(0.4, dur));
      lfo.connect(lg); lfo.start(t); lfo.stop(end + release + 0.05);
      lfo.gainNode = lg;
    }
    for (const d of detune ? [-detune, detune] : [0]) {
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f, t); o.detune.setValueAtTime(d, t);
      if (lfo) lfo.gainNode.connect(o.detune);
      o.connect(fl); o.start(t); o.stop(end + release + 0.05);
    }
  }
  const chord = (fs, opts) => fs.forEach(f => voice({ ...opts, f }));
  // Pauke: tiefer Ton mit leicht fallender Tonhöhe plus gedämpfter Schlag
  function timp(f, at, gain = 0.35, dur = 1.1) {
    tone({ f, f2: f * 0.94, type: 'sine', dur, gain, attack: 0.004, at });
    tone({ f: f * 1.5, f2: f * 1.42, type: 'sine', dur: dur * 0.5, gain: gain * 0.25, attack: 0.004, at });
    noise({ dur: 0.12, f: 500, gain: gain * 0.5, attack: 0.002, at });
  }
  // Wirbel: immer dichtere, lautere Schläge bis zum Zielzeitpunkt
  function roll(f, at, len, g0, g1) {
    const n = Math.round(len / 0.055);
    for (let i = 0; i < n; i++) timp(f, at + i * 0.055, g0 + (g1 - g0) * i / n, 0.35);
  }
  // Becken: Rauschen im Höhenbereich, anschwellend (swell) oder als Schlag
  const cymbal = (at, dur, gain = 0.12, swell = 0.005) => noise({ dur, filter: 'highpass', f: 5200, f2: 3800, q: 0.5, gain, attack: swell, at });

  const SOUNDS = {
    select: () => tone({ f: 880, f2: 990, type: 'sine', dur: 0.07, gain: 0.07 }),
    tick: () => tone({ f: 520, type: 'triangle', dur: 0.05, gain: 0.05 }),
    error: () => { tone({ f: 150, type: 'square', dur: 0.09, gain: 0.05 }); tone({ f: 120, type: 'square', dur: 0.12, gain: 0.05, at: 0.11 }); },
    boom: () => {
      noise({ dur: 0.9, f: 1600, f2: 90, gain: 0.8, attack: 0.004 });
      tone({ f: 90, f2: 32, type: 'sine', dur: 0.7, gain: 0.6, attack: 0.004 });
      noise({ dur: 0.15, filter: 'highpass', f: 2500, gain: 0.25, attack: 0.002 });
    },
    // Salve eines Schlachtschiffs: drei dumpfe Abschüsse kurz hintereinander
    salvo: () => {
      for (let k = 0; k < 3; k++) {
        noise({ dur: 0.38, f: 1000, f2: 70, gain: 0.55, attack: 0.003, at: k * 0.1 });
        tone({ f: 72, f2: 28, type: 'sine', dur: 0.5, gain: 0.5, attack: 0.004, at: k * 0.1 });
      }
    },
    lost: () => notes([392, 330, 262], 'triangle', 0.09, 0.12, 0.2),
    capture: () => { notes([523, 659, 784, 1047], 'triangle', 0.12, 0.09, 0.22); tone({ f: 1047, type: 'sine', dur: 0.6, gain: 0.06, at: 0.36 }); },
    cityLost: () => { for (let k = 0; k < 2; k++) { tone({ f: 466, type: 'square', dur: 0.16, gain: 0.05, at: k * 0.36 }); tone({ f: 349, type: 'square', dur: 0.16, gain: 0.05, at: k * 0.36 + 0.18 }); } },
    built: () => { tone({ f: 988, type: 'sine', dur: 0.5, gain: 0.08 }); tone({ f: 1480, type: 'sine', dur: 0.35, gain: 0.04, at: 0.01 }); },
    clank: () => { noise({ dur: 0.08, filter: 'bandpass', f: 2200, q: 4, gain: 0.25 }); tone({ f: 310, f2: 260, type: 'triangle', dur: 0.15, gain: 0.08 }); },
    endTurn: () => { tone({ f: 140, f2: 55, type: 'sine', dur: 0.35, gain: 0.35 }); noise({ dur: 0.12, f: 900, gain: 0.12 }); },
    alarm: () => notes([660, 880, 660], 'square', 0.04, 0.12, 0.1),
    // Spielstart (ca. 5 s): Anfang der „Morgenstimmung“ aus Peer Gynt von Edvard Grieg (1875; gemeinfrei, Grieg † 1907) –
    // Flötenmelodie in E-Dur über gehaltenen Streichern, dazu leises Meeresrauschen. Nur die Noten, eigene Klangerzeugung.
    start: () => {
      const m = k => 440 * Math.pow(2, (k - 69) / 12);
      const e8 = 0.18;   // Achtel
      noise({ dur: 5.2, f: 700, f2: 380, gain: 0.035, attack: 1.2 });   // Brandung
      noise({ dur: 2.2, f: 520, gain: 0.025, attack: 0.9, at: 2.4 });
      // sol mi re do re mi | sol mi re do re mi re mi | sol mi sol la mi la | sol mi re do
      const SO = 83, MI = 80, RE = 78, DO = 76, LA = 85, h = e8 / 2;
      const mel = [[SO, e8], [MI, e8], [RE, e8], [DO, e8], [RE, e8], [MI, e8],
        [SO, e8], [MI, e8], [RE, e8], [DO, e8], [RE, h], [MI, h], [RE, h], [MI, h],
        [SO, e8], [MI, e8], [SO, e8], [LA, e8], [MI, e8], [LA, e8],
        [SO, e8], [MI, e8], [RE, e8], [DO, e8 * 5]];
      let t = 0.35;
      for (const [k, d] of mel) {
        voice({ f: m(k), at: t, dur: d * 0.92, gain: 0.07, type: 'triangle', cutoff: 2600, attack: 0.035, release: d > e8 ? 0.9 : 0.09, detune: 3, vib: d > e8 ? 9 : 0 });
        noise({ dur: 0.06, filter: 'bandpass', f: m(k) * 2, q: 2, gain: 0.012, attack: 0.01, at: t });   // Anblasgeräusch
        t += d;
      }
      // Streicher: E-Dur, im dritten Takt A-Dur, zum Schluss wieder E-Dur
      const bar = e8 * 6, t0 = 0.35;
      const pad = (ks, at, dur, rel = 0.3) => chord(ks.map(m), { at, dur, gain: 0.018, cutoff: 1100, attack: 0.35, release: rel, detune: 9 });
      pad([52, 59, 64, 68], t0 - 0.2, bar * 2 + 0.2);
      pad([45, 57, 61, 64], t0 + bar * 2, bar);
      pad([40, 52, 59, 64, 68], t0 + bar * 3, bar + 0.5, 1.4);
    },
    // Siegesfanfare (ca. 8 s): Paukenwirbel, Blechbläser-Melodie über C – F – G – G7 – C, Beckenschlag, langer Schlussakkord
    victory: () => {
      const m = k => 440 * Math.pow(2, (k - 69) / 12);   // MIDI-Notennummer → Hz (60 = C4)
      roll(m(43), 0, 0.8, 0.05, 0.3);
      cymbal(0.05, 0.85, 0.06, 0.75);
      const lead = (k, at, dur, vib = 0) => voice({ f: m(k), at, dur, gain: 0.075, cutoff: 2800, attack: 0.025, release: 0.12, detune: 5, vib });
      [[67, 0.80, 0.13], [72, 0.95, 0.13], [76, 1.10, 0.13], [79, 1.25, 0.5, 9],
       [76, 1.80, 0.13], [79, 1.95, 0.13], [81, 2.10, 0.45, 9],
       [79, 2.60, 0.24], [77, 2.85, 0.13], [76, 3.00, 0.13], [74, 3.15, 0.45, 9],
       [67, 3.65, 0.13], [71, 3.80, 0.13], [74, 3.95, 0.13], [77, 4.10, 0.3],
       [76, 4.45, 0.13], [74, 4.60, 0.13], [79, 4.75, 0.13]].forEach(([k, at, d, v]) => lead(k, at, d, v));
      voice({ f: m(84), at: 4.9, dur: 2.0, gain: 0.08, cutoff: 3000, cutEnd: 1200, attack: 0.03, release: 1.0, detune: 5, vib: 12 });
      const pad = (ks, at, dur, rel = 0.15) => chord(ks.map(m), { at, dur, gain: 0.026, cutoff: 1500, attack: 0.04, release: rel, detune: 8 });
      pad([48, 55, 60, 64], 0.8, 0.95);
      pad([41, 57, 60, 65], 1.8, 0.75);
      pad([43, 55, 59, 62], 2.6, 1.0);
      pad([43, 53, 59, 62], 3.65, 1.05);
      pad([36, 48, 55, 60, 64, 67], 4.9, 2.0, 1.4);
      timp(m(48), 0.8); timp(m(41), 1.8, 0.3); timp(m(43), 2.6, 0.3); timp(m(43), 3.65, 0.28);
      roll(m(43), 4.4, 0.5, 0.06, 0.25);
      timp(m(36), 4.9, 0.5, 1.8);
      cymbal(4.9, 2.6, 0.14);
      [84, 88, 91, 96].forEach((k, i) => tone({ f: m(k), type: 'triangle', dur: 0.5, gain: 0.03, at: 5.0 + i * 0.07 }));
    },
    // Niederlage (ca. 8 s): getragene Streicherakkorde a-Moll – F – d-Moll – E – a-Moll, einsames Horn, gedämpfte Trauertrommel
    defeat: () => {
      const m = k => 440 * Math.pow(2, (k - 69) / 12);
      noise({ dur: 7.5, f: 260, gain: 0.05, attack: 1.5 });   // dunkler Wind im Hintergrund
      const pad = (ks, at, dur, rel = 0.5) => chord(ks.map(m), { at, dur, gain: 0.024, cutoff: 850, attack: 0.5, release: rel, detune: 10 });
      pad([45, 52, 57, 60], 0.0, 1.9);
      pad([41, 48, 53, 57], 1.9, 1.2);
      pad([38, 50, 53, 57], 3.1, 1.2);
      pad([40, 47, 52, 56], 4.3, 1.1);
      pad([33, 45, 52, 57, 60], 5.4, 1.6, 2.2);
      const horn = (k, at, dur) => voice({ f: m(k), at, dur, gain: 0.07, type: 'triangle', cutoff: 1400, attack: 0.09, release: 0.35, detune: 3, vib: 10 });
      [[64, 0.3, 0.85], [62, 1.2, 0.45], [60, 1.7, 0.6], [57, 2.4, 0.6],
       [62, 3.1, 0.45], [60, 3.6, 0.35], [59, 4.0, 0.25], [56, 4.3, 0.95], [57, 5.4, 1.9]].forEach(([k, at, d]) => horn(k, at, d));
      for (const [at, g] of [[0, 0.22], [1.9, 0.2], [3.1, 0.2], [4.3, 0.22], [5.4, 0.3]]) timp(m(33), at, g, 1.4);
    },
  };

  function play(name, minGap = 0) {
    if (muted || !SOUNDS[name]) return;
    if (!ensure()) return;
    const now = performance.now();
    if (minGap && last[name] && now - last[name] < minGap) return;
    last[name] = now;
    try { SOUNDS[name](); } catch (e) { console.warn('Sfx', name, e); }
  }

  // -------------------------------------------------------------------------
  // Klangteppiche je Einheitentyp: einmal als nahtlos schleifbarer Puffer
  // berechnet. Periodische Anteile passen exakt in die Pufferlänge, Rauschen
  // wird am Ende in den Anfang überblendet.
  // -------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  const lpA = (fc, sr) => 1 - Math.exp(-TAU * fc / sr);
  function lowpass(a, fc, sr) { const k = lpA(fc, sr); let y = 0; for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); a[i] = y; } return a; }
  function highpass(a, fc, sr) { const k = lpA(fc, sr); let y = 0; for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); a[i] = a[i] - y; } return a; }
  function white(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }
  function brown(n) { const a = new Float32Array(n); let b = 0; for (let i = 0; i < n; i++) { b = 0.985 * b + 0.06 * (Math.random() * 2 - 1); a[i] = b; } return a; }
  // kurzer Impuls (Schritt, Klacken, Blubbern) an Zeitpunkt ts
  function burst(out, sr, ts, len, decay, src, amp) {
    const s = Math.floor(ts * sr), n = Math.floor(len * sr);
    for (let i = 0; i < n && s + i < out.length; i++) out[s + i] += src(i, i / sr) * Math.exp(-i / sr * decay) * amp;
  }

  const GEN = {
    // Marschierender Trupp: schwere Stiefel im ruhigen Gleichschritt (100 Schritte/min),
    // dumpfer Aufprall + Knirschen im Schotter, mehrere Soldaten leicht versetzt
    march: { len: 4.8, gen(o, sr) {
      const n = o.length, air = lowpass(brown(n), 300, sr);
      const thud = new Float32Array(n), crunch = new Float32Array(n);
      const men = [[0, 1], [0.028, 0.75], [0.055, 0.6], [0.085, 0.5]];
      let r = Math.random;
      const rnd = (a, b) => a + r() * (b - a);
      const seed = Math.floor(Math.random() * 1e6);
      // tiefer Schlag mit fallender Tonhöhe (f -> f/2)
      const drop = f => (i, t) => Math.sin(TAU * (f / 2 * t + f / 2 * (1 - Math.exp(-30 * t)) / 30));
      for (let k = 0; k * 0.6 < 5.15; k++) {
        const foot = k % 2 ? 0.85 : 1;
        // Schritt 8 = Schritt 0, damit die Schleife nahtlos weiterläuft
        r = mulberry32(seed + (k % 8));
        // jeder Schritt etwas anders: Tonhöhe, Abstand Ferse–Sohle, Stärke
        const f1 = rnd(82, 100), f2 = f1 * rnd(0.78, 0.9), gap = rnd(0.06, 0.1), a2 = rnd(0.55, 0.75);
        for (const [off, amp] of men) {
          const ts = k * 0.6 + off + r() * 0.012;
          const a = amp * foot * rnd(0.85, 1.1);
          // doppelter Aufprall: erst die Ferse, kurz danach die Sohle
          burst(thud, sr, ts, 0.22, 20, drop(f1 * rnd(0.96, 1.04)), a);
          burst(thud, sr, ts + gap + rnd(-0.006, 0.006), 0.2, 24, drop(f2 * rnd(0.96, 1.04)), a * a2);
          // Sohle im Schotter: weiches, gedämpftes Knirschen
          const w = white(Math.floor(0.3 * sr));
          burst(crunch, sr, ts + 0.01, 0.3, 13, (i, t) => w[i] * (1 - Math.exp(-t * 110)), a * 0.8);
        }
      }
      lowpass(crunch, 750, sr); lowpass(crunch, 1100, sr);
      for (let i = 0; i < n; i++) o[i] = thud[i] * 1.1 + crunch[i] * 1.6 + air[i] * 0.5;
    } },
    // Panzer: langsames, tiefes, unregelmäßiges Wummern eines schweren Motors.
    // Lautstärke und Drehzahl schwanken nach einer zufälligen, aber periodischen
    // Kurve (Summe von Sinuswellen mit Perioden von 0,6 bis 3 s), daher
    // unregelmäßig und trotzdem nahtlos schleifbar.
    tank: { len: 6, gen(o, sr) {
      const n = o.length, L = 6, f0 = 30;
      const deep = lowpass(lowpass(brown(n), 70, sr), 70, sr);
      const ground = lowpass(brown(n), 160, sr);
      const eng = new Float32Array(n), sub = new Float32Array(n), envA = new Float32Array(n);
      const am = [], pm = [], ph = [];
      for (let m = 2; m <= 10; m++) am.push([m, (0.3 + Math.random() * 0.7) / Math.pow(m, 0.3), Math.random() * TAU]);
      for (let m = 1; m <= 4; m++) pm.push([m, Math.random() * TAU]);
      for (let h = 1; h <= 10; h++) ph.push(Math.random() * TAU);
      const amSum = am.reduce((x, [, w]) => x + w, 0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let wob = 0;
        for (const [m, w, p] of am) wob += w * Math.sin(TAU * m * t / L + p);
        wob /= amSum;                                        // etwa -1 .. 1
        const env = 0.3 + 0.7 * Math.pow((wob + 1) / 2, 1.6);  // tiefe Täler, weiche Spitzen
        let dp = 0;
        for (const [m, p] of pm) dp += Math.sin(TAU * m * t / L + p) / m;
        const base = TAU * f0 * t + 0.9 * dp;                 // leicht schwankende Drehzahl
        let v = 0;
        for (let h = 1; h <= 10; h++) v += Math.sin(h * base + ph[h - 1]) / Math.pow(h, 0.55);
        eng[i] = v * env;
        sub[i] = Math.sin(base) * env;
        envA[i] = env;
      }
      lowpass(eng, 340, sr); lowpass(eng, 340, sr);
      for (let i = 0; i < n; i++) o[i] = eng[i] * 0.7 + sub[i] * 0.55 + deep[i] * 2.0 * (0.6 + 0.4 * envA[i]) + ground[i] * 0.6;
    } },
    // Propellerflugzeug: brummender Motor mit Propellerschlag, Fahrtwind
    plane: { len: 2, gen(o, sr) {
      const n = o.length, wind = lowpass(highpass(white(n), 700, sr), 3400, sr), eng = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sr, ph = TAU * 140 * t + 1.2 * Math.sin(TAU * 0.5 * t);
        let s = 0;
        for (let h = 1; h <= 7; h++) s += Math.sin(h * ph) / h;
        eng[i] = s * (0.62 + 0.38 * Math.sin(TAU * 33 * t));
      }
      lowpass(eng, 2100, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        o[i] = eng[i] * 0.55 + wind[i] * (0.35 + 0.1 * Math.sin(TAU * 0.5 * t));
      }
    } },
    // Schiff: Maschinenbrummen und rollende Wellen
    ship: { len: 4, gen(o, sr) {
      const n = o.length, waves = lowpass(brown(n), 650, sr), spray = highpass(white(n), 2500, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let hum = 0;
        for (let h = 1; h <= 5; h++) hum += Math.sin(TAU * 44 * h * t + h) / Math.pow(h, 1.2);
        const swell = 0.35 + 0.65 * Math.pow(Math.sin(TAU * 0.25 * t), 2);
        o[i] = hum * 0.22 * (0.85 + 0.15 * Math.sin(TAU * 2 * t)) + waves[i] * 1.6 * swell + spray[i] * 0.06 * swell;
      }
    } },
    // U-Boot: tiefes Brummen, Sonar-Ping mit Echo, Blubbern
    sub: { len: 4, gen(o, sr) {
      const n = o.length, water = lowpass(brown(n), 260, sr), bub = new Float32Array(n), ping = new Float32Array(n);
      for (let k = 0; k < 9; k++) {
        const f0 = 350 + Math.random() * 500;
        burst(bub, sr, Math.random() * 3.8, 0.05, 70, (i, t) => Math.sin(TAU * (f0 + 9000 * t) * t), 0.25);
      }
      burst(ping, sr, 0.3, 1.6, 3.2, (i, t) => Math.sin(TAU * 1150 * t), 0.6);
      burst(ping, sr, 1.25, 1.4, 3.6, (i, t) => Math.sin(TAU * 1150 * t), 0.2);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let hum = 0;
        for (let h = 1; h <= 3; h++) hum += Math.sin(TAU * 40 * h * t) / h;
        o[i] = hum * 0.35 + water[i] * 1.5 + bub[i] + ping[i];
      }
    } },
  };
  const KIND = { inf: 'march', tank: 'tank', ftr: 'plane', sub: 'sub', trn: 'ship', dst: 'ship', crs: 'ship', car: 'ship', bat: 'ship' };
  const RATE = { dst: 1.12, crs: 0.96, car: 0.9, bat: 0.84 };
  const LOOP_LEVEL = { march: 0.22, tank: 0.2, plane: 0.16, ship: 0.24, sub: 0.26 };
  const MOVE_LEVEL = { march: 0.95, tank: 0.85, plane: 0.75, ship: 0.95, sub: 0.9 };
  const KIND_NAME = { march: tt('Infanterie', 'Infantry'), tank: tt('Panzer', 'Tank'), plane: tt('Jäger', 'Fighter'), ship: tt('Schiffe', 'Ships'), sub: tt('U-Boot', 'Submarine') };
  const bufs = {};
  let levels = { march: 1, tank: 1, plane: 1, ship: 1, sub: 1 };
  try { Object.assign(levels, JSON.parse(localStorage.getItem('archipel-levels') || '{}')); } catch (e) {}

  // Rohdaten (Float32Array, Länge N+F) -> nahtlos schleifbarer, normierter Puffer
  function seamless(tmp, N, F, sr) {
    for (let i = 0; i < F; i++) { const a = i / F; tmp[i] = tmp[i] * a + tmp[N + i] * (1 - a); }
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(tmp[i]));
    const b = ac.createBuffer(1, N, sr), d = b.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = tmp[i] / (peak || 1) * 0.9;
    return b;
  }

  function getBuf(kind) {
    if (bufs[kind]) return bufs[kind];
    const sr = ac.sampleRate, G = GEN[kind];
    const N = Math.round(G.len * sr), F = Math.round(0.3 * sr);
    const tmp = new Float32Array(N + F);
    G.gen(tmp, sr);
    bufs[kind] = seamless(tmp, N, F, sr);
    return bufs[kind];
  }

  // Endlosschleife: ausgewählte Einheit oder Vorhören im Klangtest
  let wantType = null, previewKind = null, loopKey = null, loopNode = null;
  function desired() {
    if (previewKind) return { kind: previewKind, rate: 1 };
    if (wantType) return { kind: KIND[wantType], rate: RATE[wantType] || 1 };
    return null;
  }
  function applyLoop() {
    if (!ac) return;
    const want = desired();
    const key = want ? `${want.kind}|${want.rate}` : null;
    if (key === loopKey) return;
    loopKey = key;
    const now = ac.currentTime;
    if (loopNode) {
      const old = loopNode;
      old.g.gain.cancelScheduledValues(now);
      old.g.gain.setTargetAtTime(0, now, 0.15);
      old.src.stop(now + 1);
      loopNode = null;
    }
    if (!want) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = getBuf(want.kind); src.loop = true; src.playbackRate.value = want.rate;
    g.gain.setValueAtTime(0, now);
    g.gain.setTargetAtTime(LOOP_LEVEL[want.kind] * levels[want.kind], now, 0.3);
    src.connect(g); g.connect(master);
    src.start(now, Math.random() * src.buffer.duration);
    loopNode = { src, g, kind: want.kind };
  }
  function setLoop(type) { wantType = type || null; applyLoop(); }

  // Zuggeräusch: Ausschnitt des Klangteppichs, laut, so lang wie die Bewegung
  let voices = 0, warmed = false;
  function moveKind(kind, rate, dur, gainMul) {
    if (muted || !ensure() || voices >= 3) return;
    const now = ac.currentTime, src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = getBuf(kind); src.loop = true; src.playbackRate.value = rate;
    const peak = Math.max(0.0002, MOVE_LEVEL[kind] * levels[kind] * gainMul);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.08);
    g.gain.setValueAtTime(peak, now + Math.max(0.1, dur - 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.1);
    src.connect(g); g.connect(master);
    src.start(now, Math.random() * src.buffer.duration);
    src.stop(now + dur + 0.2);
    voices++;
    src.onended = () => { voices--; };
  }
  function move(type, dur, gainMul = 1) { moveKind(KIND[type], RATE[type] || 1, dur, gainMul); }

  // im Hintergrund-Tab pausieren
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  function save() {
    try {
      localStorage.setItem('archipel-muted', muted ? '1' : '0');
      localStorage.setItem('archipel-vol', String(vol));
      localStorage.setItem('archipel-levels', JSON.stringify(levels));
    } catch (e) {}
  }
  function apply() { if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.02); }

  return {
    play, move, setLoop,
    unlock() {
      const r = ensure(); applyLoop();
      // alle Klangteppiche nacheinander im Hintergrund vorberechnen
      if (r && !warmed) { warmed = true; Object.keys(GEN).forEach((k, i) => setTimeout(() => getBuf(k), 400 + i * 150)); }
      return r;
    },
    isMuted: () => muted,
    volume: () => vol,
    toggle() { muted = !muted; apply(); save(); if (!muted) play('tick'); return muted; },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (vol > 0 && muted) muted = false; apply(); save(); },
    // Klangtest
    kinds: () => Object.keys(GEN).map(k => ({ kind: k, name: KIND_NAME[k], level: levels[k] })),
    effects: () => Object.keys(SOUNDS),
    preview(kind) { ensure(); previewKind = kind || null; applyLoop(); },
    previewing: () => previewKind,
    previewMove(kind) { moveKind(kind, 1, 1.6, 1); },
    setLevel(kind, v) {
      levels[kind] = Math.max(0, Math.min(2, v)); save();
      if (loopNode && loopNode.kind === kind) loopNode.g.gain.setTargetAtTime(LOOP_LEVEL[kind] * levels[kind], ac.currentTime, 0.05);
    },
  };
})();
