'use strict';
// ---------------------------------------------------------------------------
// Grafik-Bausteine: Einheiten-Symbole, Städte, Gelände
// Alle Symbole sind Vektorpfade (100×100-Raster) und werden je Zoomstufe
// einmal als Sprite vorgerendert.
// ---------------------------------------------------------------------------

const circ = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const ICON_SRC = {
  inf: {
    fill: ['M38 26 Q38 12 50 12 Q62 12 62 26 Z', circ(50, 27, 7.5),
      'M35 38 Q50 33 65 38 L70 64 L62 65 L59 52 L58 90 L52 90 L50 66 L48 90 L42 90 L41 52 L38 65 L30 64 Z',
      'M67 12 L71 11 L80 66 L76 67 Z'],
  },
  tank: {
    fill: ['M10 62 H90 A9 9 0 0 1 90 80 H10 A9 9 0 0 1 10 62 Z', 'M18 50 H82 L88 62 H12 Z',
      'M34 34 H62 Q70 34 70 42 V50 H30 V40 Q30 34 34 34 Z', 'M68 39 H96 V45 H68 Z'],
    cut: [circ(17, 71, 4.5), circ(31, 71, 4.5), circ(45, 71, 4.5), circ(59, 71, 4.5), circ(73, 71, 4.5), circ(85, 71, 3.5)],
  },
  ftr: {
    fill: ['M50 6 L56 28 L56 42 L90 60 L90 69 L56 62 L55 80 L67 88 L67 94 L50 90 L33 94 L33 88 L45 80 L44 62 L10 69 L10 60 L44 42 L44 28 Z'],
    cut: ['M47.5 22 L50 14 L52.5 22 L52.5 30 L47.5 30 Z'],
  },
  trn: {
    fill: ['M5 60 H95 L85 80 H15 Z', 'M70 36 H85 V60 H70 Z', 'M74 27 H80 V36 H74 Z',
      'M13 46 H28 V59 H13 Z', 'M30 46 H45 V59 H30 Z', 'M47 46 H62 V59 H47 Z', 'M21 33 H36 V45 H21 Z', 'M38 33 H53 V45 H38 Z'],
  },
  dst: {
    fill: ['M16 63 H86 L96 60 L86 73 H24 Z', 'M40 54 H58 V63 H40 Z', 'M60 47 L67 47 L65 63 L58 63 Z',
      'M46 40 H48.5 V54 H46 Z', 'M70 57.5 H78 V63 H70 Z', 'M78 59 H89 V61 H78 Z',
      'M4 66 Q10 63 16 66 L16 68 Q10 65.5 4 68 Z', 'M46.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z'],
  },
  sub: {
    fill: ['M6 62 Q6 51 26 51 H80 Q95 51 95 62 Q95 73 80 73 H26 Q6 73 6 62 Z', 'M40 36 H58 L63 51 H38 Z',
      'M49 22 H53 V36 H49 Z', 'M49 22 H60 V26 H49 Z'],
    cut: ['M14 61 H88 V63 H14 Z'],
  },
  crs: {
    fill: ['M5 60 H95 L86 75 H14 Z', 'M34 47 H64 V60 H34 Z', 'M38 36 H45 V47 H38 Z', 'M50 36 H57 V47 H50 Z',
      'M60 39 H62 V47 H60 Z', 'M70 52 H82 V60 H70 Z', 'M82 54.5 H95 V57 H82 Z',
      'M17 52 H29 V60 H17 Z', 'M5 54.5 H17 V57 H5 Z', 'M39.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z', 'M53.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z'],
  },
  car: {
    fill: ['M3 58 H97 L90 78 H10 Z', 'M1 51 H99 V58 H1 Z', 'M68 32 H80 V51 H68 Z', 'M72 22 H75 V32 H72 Z'],
    cut: ['M8 53.8 H18 V55.2 H8 Z', 'M22 53.8 H32 V55.2 H22 Z', 'M36 53.8 H46 V55.2 H36 Z', 'M50 53.8 H60 V55.2 H50 Z'],
  },
  bat: {
    fill: ['M1 57 H99 L90 79 H10 Z', 'M41 16 H55 V27 H59 V38 H63 V57 H33 V38 H37 V27 H41 Z',
      'M65 36 H72 V57 H65 Z', 'M75 48 H90 V57 H75 Z', 'M90 49.5 H99 V51.5 H90 Z', 'M90 53 H99 V55 H90 Z',
      'M10 48 H25 V57 H10 Z', 'M1 49.5 H10 V51.5 H1 Z', 'M1 53 H10 V55 H1 Z',
      'M21 41 H32 V48 H21 Z', 'M12 42 H21 V43.6 H12 Z', 'M12 45 H21 V46.6 H12 Z', 'M32.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z', 'M46.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z', 'M60.4 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z'],
    cut: ['M44 21 H52 V24 H44 Z'],
  },
};
const ICONS = {};
for (const [k, v] of Object.entries(ICON_SRC)) {
  ICONS[k] = { fill: v.fill.map(p => new Path2D(p)), cut: (v.cut || []).map(p => new Path2D(p)) };
}

const spriteCache = new Map();
function clearSprites() { spriteCache.clear(); }

// Rundes Abzeichen in Spielerfarbe mit weißem Symbol
function unitSprite(type, owner, size) {
  size = Math.max(8, Math.round(size));
  const key = `u|${type}|${owner}|${size}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const pad = Math.ceil(size * 0.1);
  c = document.createElement('canvas');
  c.width = c.height = size + pad * 2;
  const g = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2, r = size * 0.42;
  const pal = PLAYERS[owner];
  g.fillStyle = 'rgba(0,0,0,0.38)';
  g.beginPath(); g.ellipse(cx, cy + r * 0.16, r * 1.02, r * 1.02, 0, 0, 7); g.fill();
  const grd = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r);
  grd.addColorStop(0, pal.light); grd.addColorStop(0.5, pal.color); grd.addColorStop(1, pal.dark);
  g.fillStyle = grd;
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.lineWidth = Math.max(1, size * 0.045); g.strokeStyle = pal.dark; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(0.8, size * 0.025);
  g.beginPath(); g.arc(cx, cy, r * 0.86, 0, 7); g.stroke();
  const ic = ICONS[type], s = r * 1.5 / 100;
  g.save();
  g.translate(cx - 50 * s, cy - 50 * s); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowOffsetY = Math.max(0.5, size * 0.02); g.shadowBlur = Math.max(0.5, size * 0.03);
  g.fillStyle = '#fff';
  for (const p of ic.fill) g.fill(p);
  g.shadowColor = 'transparent';
  g.fillStyle = pal.dark;
  for (const p of ic.cut) g.fill(p);
  g.restore();
  c.pad = pad;
  spriteCache.set(key, c);
  return c;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Stadt: Platz, Häuser mit Dächern in Besitzerfarbe, Fahne
function citySprite(owner, size, variant) {
  size = Math.round(size);
  const key = `c|${owner}|${size}|${variant}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size;
  const pal = owner >= 0 ? PLAYERS[owner] : NEUTRAL;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(s * 0.5, s * 0.84, s * 0.42, s * 0.11, 0, 0, 7); g.fill();
  roundRectPath(g, s * 0.08, s * 0.2, s * 0.84, s * 0.68, s * 0.14);
  g.fillStyle = '#cdbf9c'; g.fill();
  g.lineWidth = Math.max(1, s * 0.035); g.strokeStyle = '#7f7254'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(s * 0.12, s * 0.52, s * 0.76, s * 0.06);
  const layouts = [
    [[0.30, 0.38, 0.26, 0.2], [0.14, 0.58, 0.26, 0.22], [0.48, 0.6, 0.3, 0.2]],
    [[0.16, 0.42, 0.24, 0.2], [0.46, 0.36, 0.24, 0.22], [0.28, 0.62, 0.32, 0.2]],
  ];
  const houses = layouts[variant % layouts.length].slice().sort((a, b) => a[1] - b[1]);
  for (const [x, y, w, h] of houses) {
    g.fillStyle = '#f2ead8'; g.strokeStyle = '#8d806a'; g.lineWidth = Math.max(0.8, s * 0.02);
    g.fillRect(s * x, s * y, s * w, s * h); g.strokeRect(s * x, s * y, s * w, s * h);
    g.fillStyle = '#5b6b80';
    g.fillRect(s * (x + w * 0.2), s * (y + h * 0.35), s * w * 0.18, s * h * 0.3);
    g.fillRect(s * (x + w * 0.6), s * (y + h * 0.35), s * w * 0.18, s * h * 0.3);
    g.beginPath();
    g.moveTo(s * (x - 0.03), s * y); g.lineTo(s * (x + w / 2), s * (y - 0.15)); g.lineTo(s * (x + w + 0.03), s * y); g.closePath();
    g.fillStyle = pal.color; g.fill();
    g.strokeStyle = pal.dark; g.lineWidth = Math.max(0.8, s * 0.025); g.stroke();
  }
  // Fahne
  g.strokeStyle = '#3b3b3b'; g.lineWidth = Math.max(1, s * 0.03);
  g.beginPath(); g.moveTo(s * 0.82, s * 0.06); g.lineTo(s * 0.82, s * 0.46); g.stroke();
  g.beginPath(); g.moveTo(s * 0.82, s * 0.07); g.lineTo(s * 0.98, s * 0.13); g.lineTo(s * 0.82, s * 0.2); g.closePath();
  g.fillStyle = pal.color; g.fill();
  g.strokeStyle = pal.dark; g.lineWidth = Math.max(0.6, s * 0.015); g.stroke();
  spriteCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------
// Gelände
// ---------------------------------------------------------------------------
const WATER_COL = [[96, 186, 208], [64, 150, 194], [46, 122, 174], [36, 100, 152], [28, 82, 132], [24, 70, 116]];
const SAND = [218, 204, 152];

function landColor(e) {
  const stops = [[0, [190, 196, 120]], [0.1, [118, 168, 82]], [0.42, [82, 138, 64]], [0.7, [104, 116, 76]], [1, [138, 128, 108]]];
  let k = 0;
  while (k < stops.length - 2 && e > stops[k + 1][0]) k++;
  const [e0, c0] = stops[k], [e1, c1] = stops[k + 1];
  const f = Math.min(1, Math.max(0, (e - e0) / (e1 - e0)));
  return c0.map((v, j) => v + (c1[j] - v) * f);
}

function buildTerrain(TS) {
  const W = S.W, H = S.H;
  const oc = document.createElement('canvas');
  oc.width = W * TS; oc.height = H * TS;
  const g = oc.getContext('2d');
  const r = mulberry32(4711);
  const isW = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !S.terrain[y * W + x];

  // 1) Wasser: weiche Tiefenverläufe
  const wc = document.createElement('canvas'); wc.width = W; wc.height = H;
  const wg = wc.getContext('2d'), wi = wg.createImageData(W, H);
  const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  const lg = lc.getContext('2d'), li = lg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const wcol = S.terrain[i] ? WATER_COL[0] : WATER_COL[Math.min(WATER_COL.length - 1, S.depth[i] - 1)];
    const lcol = S.terrain[i] ? landColor(S.elev[i]) : SAND;
    for (let j = 0; j < 3; j++) { wi.data[i * 4 + j] = wcol[j]; li.data[i * 4 + j] = lcol[j]; }
    wi.data[i * 4 + 3] = 255; li.data[i * 4 + 3] = 255;
  }
  wg.putImageData(wi, 0, 0); lg.putImageData(li, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(wc, 0, 0, W * TS, H * TS);

  // Wellen
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = Math.max(1, TS / 18); g.lineCap = 'round';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (S.terrain[y * W + x] || S.depth[y * W + x] < 2 || r() > 0.22) continue;
    const cx = (x + 0.2 + r() * 0.6) * TS, cy = (y + 0.2 + r() * 0.6) * TS, w = TS * 0.18;
    g.beginPath(); g.moveTo(cx - w, cy); g.quadraticCurveTo(cx - w / 2, cy - w * 0.6, cx, cy); g.quadraticCurveTo(cx + w / 2, cy - w * 0.6, cx + w, cy); g.stroke();
  }

  // 2) Landmasse mit abgerundeten Küstenecken
  const land = new Path2D();
  const rr = TS * 0.48, e = 0.6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isW(x, y)) continue;
    const L = isW(x - 1, y), R = isW(x + 1, y), U = isW(x, y - 1), D = isW(x, y + 1);
    const tl = L && U && isW(x - 1, y - 1) ? rr : 0, tr = R && U && isW(x + 1, y - 1) ? rr : 0;
    const br = R && D && isW(x + 1, y + 1) ? rr : 0, bl = L && D && isW(x - 1, y + 1) ? rr : 0;
    const x0 = x * TS - (L ? 0 : e), x1 = (x + 1) * TS + (R ? 0 : e), y0 = y * TS - (U ? 0 : e), y1 = (y + 1) * TS + (D ? 0 : e);
    land.moveTo(x0 + tl, y0);
    land.lineTo(x1 - tr, y0); if (tr) land.arcTo(x1, y0, x1, y0 + tr, tr);
    land.lineTo(x1, y1 - br); if (br) land.arcTo(x1, y1, x1 - br, y1, br);
    land.lineTo(x0 + bl, y1); if (bl) land.arcTo(x0, y1, x0, y1 - bl, bl);
    land.lineTo(x0, y0 + tl); if (tl) land.arcTo(x0, y0, x0 + tl, y0, tl);
    land.closePath();
  }
  // Brandung / Flachwasser-Schimmer
  g.save();
  g.shadowColor = 'rgba(215,240,250,0.85)'; g.shadowBlur = TS * 0.45;
  g.fillStyle = 'rgb(150,205,220)';
  g.fill(land); g.fill(land);
  g.restore();
  g.save();
  g.clip(land);
  g.drawImage(lc, 0, 0, W * TS, H * TS);

  // Bodenstruktur
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isW(x, y)) continue;
    for (let k = 0; k < 4; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
      g.beginPath(); g.arc((x + r()) * TS, (y + r()) * TS, TS * (0.04 + r() * 0.05), 0, 7); g.fill();
    }
  }
  // Wälder, Hügel, Berge
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (isW(x, y) || S.cityGrid[i] >= 0) continue;
    const el = S.elev[i];
    const X = x * TS, Y = y * TS;
    if (el > 0.68) {
      const peaks = el > 0.82 ? 2 : 1;
      for (let k = 0; k < peaks; k++) {
        const cx = X + TS * (peaks === 1 ? 0.5 : 0.32 + k * 0.38) + (r() - 0.5) * TS * 0.1;
        const by = Y + TS * (0.8 - k * 0.06), h = TS * (0.5 + r() * 0.15), w = TS * (peaks === 1 ? 0.42 : 0.32);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath(); g.ellipse(cx + w * 0.2, by, w * 1.05, TS * 0.07, 0, 0, 7); g.fill();
        g.fillStyle = '#a39780';
        g.beginPath(); g.moveTo(cx - w, by); g.lineTo(cx, by - h); g.lineTo(cx, by); g.closePath(); g.fill();
        g.fillStyle = '#756a57';
        g.beginPath(); g.moveTo(cx, by - h); g.lineTo(cx + w, by); g.lineTo(cx, by); g.closePath(); g.fill();
        if (el > 0.8) {
          g.fillStyle = '#f4f6f8';
          g.beginPath(); g.moveTo(cx - w * 0.32, by - h * 0.68); g.lineTo(cx, by - h); g.lineTo(cx + w * 0.32, by - h * 0.68);
          g.lineTo(cx + w * 0.1, by - h * 0.74); g.lineTo(cx - w * 0.05, by - h * 0.64); g.closePath(); g.fill();
        }
      }
    } else if (el > 0.56 && r() < 0.6) {
      const cx = X + TS * (0.35 + r() * 0.3), by = Y + TS * (0.62 + r() * 0.15);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.ellipse(cx + TS * 0.04, by + TS * 0.02, TS * 0.3, TS * 0.08, 0, 0, 7); g.fill();
      g.fillStyle = '#7d8c55';
      g.beginPath(); g.ellipse(cx, by, TS * 0.28, TS * 0.2, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.ellipse(cx - TS * 0.06, by - TS * 0.05, TS * 0.12, TS * 0.07, 0, Math.PI, 0); g.fill();
    } else if (el > 0.14 && el < 0.56 && r() < 0.42) {
      const n = 3 + Math.floor(r() * 3);
      const trees = [];
      for (let k = 0; k < n; k++) trees.push([X + TS * (0.2 + r() * 0.6), Y + TS * (0.25 + r() * 0.55)]);
      trees.sort((a, b) => a[1] - b[1]);
      for (const [tx, ty] of trees) {
        const tr = TS * (0.1 + r() * 0.05);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(tx + tr * 0.3, ty + tr * 0.8, tr, tr * 0.45, 0, 0, 7); g.fill();
        g.fillStyle = '#2c6230';
        g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill();
        g.fillStyle = '#4a8c42';
        g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.3, tr * 0.5, 0, 7); g.fill();
      }
    }
  }
  g.restore();

  // feines Raster zur Orientierung
  g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 1; x < W; x++) { g.moveTo(x * TS + 0.5, 0); g.lineTo(x * TS + 0.5, H * TS); }
  for (let y = 1; y < H; y++) { g.moveTo(0, y * TS + 0.5); g.lineTo(W * TS, y * TS + 0.5); }
  g.stroke();
  return oc;
}
