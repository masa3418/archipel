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

// Zeichen „besetzt“ für fremde Städte: Schild mit Fragezeichen (unitSprite('garrison', besitzer, größe); wer die Stadt verteidigt,
// zeigt sich erst im Kampf – garrisonHidden in ui-karte.js). Keine Einheit, deshalb nicht in ICON_SRC (dort stehen nur die Einheitentypen).
ICONS.garrison = {
  fill: [new Path2D('M50 9 L85 21 L85 47 C85 70 70 85 50 94 C30 85 15 70 15 47 L15 21 Z')],
  cut: [new Path2D('M36.5 40 C36.5 28.5 43 23 51 23 C59.5 23 65 29 65 36.5 C65 44.5 59.5 47.5 56 51 C54 53 54 55.5 54 60 L46.5 60 C46.5 53.5 47.5 50.5 51 47 C55 43 57.5 41 57.5 37 C57.5 32.5 55 30 51 30 C46.5 30 44 33.5 44 40 Z'),
    new Path2D('M46.5 65.5 h7.5 v7.5 h-7.5 Z')],
};

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

// SVG-Code eines Einheiten-Abzeichens (Grafik-Übersicht): dieselben Pfade und Maße wie unitSprite bei Größe 100.
// badge = false: nur das Symbol im 100×100-Raster (Aussparungen als Maske, Farbe currentColor – schwarz, wenn nichts anderes gilt).
function unitSvg(type, owner, badge = true, title = '') {
  const src = ICON_SRC[type], pal = PLAYERS[owner], cut = src.cut || [];
  const xml = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = v => String(+v.toFixed(2));
  const paths = (list, ind, attr = '') => list.map(d => `${ind}<path d="${d}"${attr}/>`).join('\n');
  const head = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`
    + (title ? `  <title>${xml(title)}</title>\n` : '');
  if (!badge) {
    return head(100, 100)
      + (cut.length ? `  <mask id="${type}-cut">\n    <rect width="100" height="100" fill="#fff"/>\n${paths(cut, '    ', ' fill="#000"')}\n  </mask>\n` : '')
      + `  <g fill="currentColor"${cut.length ? ` mask="url(#${type}-cut)"` : ''}>\n${paths(src.fill, '    ')}\n  </g>\n</svg>\n`;
  }
  // wie unitSprite: Rand 10 %, Radius 0,42 · Größe, Symbol auf 1,5 · Radius skaliert, Schatten 2 px tief und 3 px weich
  const size = 100, pad = Math.ceil(size * 0.1), w = size + pad * 2, c = w / 2, r = size * 0.42, s = r * 1.5 / 100;
  return head(w, w)
    + `  <defs>\n`
    + `    <radialGradient id="${type}-badge" gradientUnits="userSpaceOnUse" cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fx="${n(c - r * 0.35)}" fy="${n(c - r * 0.45)}" fr="${n(r * 0.1)}">\n`
    + `      <stop offset="0" stop-color="${pal.light}"/>\n      <stop offset="0.5" stop-color="${pal.color}"/>\n      <stop offset="1" stop-color="${pal.dark}"/>\n`
    + `    </radialGradient>\n`
    + `    <filter id="${type}-shadow" x="-20%" y="-20%" width="140%" height="150%">\n`
    + `      <feDropShadow dx="0" dy="${n(size * 0.02 / s)}" stdDeviation="${n(size * 0.03 / 2 / s)}" flood-color="#000" flood-opacity="0.5"/>\n`
    + `    </filter>\n  </defs>\n`
    + `  <circle cx="${n(c)}" cy="${n(c + r * 0.16)}" r="${n(r * 1.02)}" fill="#000" fill-opacity="0.38"/>\n`
    + `  <circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="url(#${type}-badge)" stroke="${pal.dark}" stroke-width="${n(size * 0.045)}"/>\n`
    + `  <circle cx="${n(c)}" cy="${n(c)}" r="${n(r * 0.86)}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="${n(size * 0.025)}"/>\n`
    + `  <g transform="translate(${n(c - 50 * s)} ${n(c - 50 * s)}) scale(${n(s)})">\n`
    + `    <g fill="#fff" filter="url(#${type}-shadow)">\n${paths(src.fill, '      ')}\n    </g>\n`
    + (cut.length ? `    <g fill="${pal.dark}">\n${paths(cut, '      ')}\n    </g>\n` : '')
    + `  </g>\n</svg>\n`;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Stadt: Platz, Häuser mit Dächern in Besitzerfarbe, Fahne. Auch der Platz trägt die Farbe des Besitzers
// (Wunsch des Nutzers: Mit Dächern und Fähnchen allein sahen die Städte aller Parteien fast gleich aus – der beige Platz überwog).
// Neutrale Städte behalten den beigen Platz mit schmalem Rand und heben sich so von allen Parteien ab.
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
  if (owner >= 0) {
    g.fillStyle = pal.light; g.fill();
    g.lineWidth = Math.max(1, s * 0.035); g.strokeStyle = pal.dark; g.stroke();     // schmaler Rand wie bei neutralen Städten (ein kräftiger farbiger war dem Nutzer zu viel)
  } else {
    // Neutral: heller Platz mit dunklem Rand – auf Wüste und Schnee trägt der Rand, auf Lava der helle Platz (Farbprüfung aller Landschaften:
    // vorher verschwand die beige Stadt auf Sand und Schnee fast, Farbabstand 10–25)
    g.fillStyle = '#cdbf9c'; g.fill();
    g.lineWidth = Math.max(1.2, s * 0.045); g.strokeStyle = '#4a4f57'; g.stroke();
  }
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
// Landschaften (Wunsch des Nutzers): dieselbe Karte, anders eingefärbt. Die Landschaft gehört zur Partie (S.land, Schlüssel LAND_KEYS in data.js;
// neue Partie: zufällig Grün, Wüste oder Schnee), ist in den Einstellungen jederzeit umschaltbar und ändert keine Regel. Je Landschaft ein Farbsatz:
//  water (flach → tief), sand (Strand), stops (Landfarbe nach Höhe), surf/glow (Brandung), wave, mount (Berg hell/dunkel), cap (Gipfel, null = keiner),
//  hill, tree (dunkel/hell – in der Lava glühende Tümpel), treeP (Anteil der Felder mit „Wald“), mini (Land, Wasser auf Übersichtskarte und Zeitraffer).
// Neue Landschaft: hier und in LAND_KEYS eintragen, in LAND_NAMES (ui-schau.js) benennen und auf allen Zoomstufen ansehen – Farben der Parteien müssen sich abheben.
const LANDSCAPES = {
  gruen: {
    water: [[96, 186, 208], [64, 150, 194], [46, 122, 174], [36, 100, 152], [28, 82, 132], [24, 70, 116]], sand: [218, 204, 152],
    stops: [[0, [190, 196, 120]], [0.1, [118, 168, 82]], [0.42, [82, 138, 64]], [0.7, [104, 116, 76]], [1, [138, 128, 108]]],
    surf: 'rgb(150,205,220)', glow: 'rgba(215,240,250,0.85)', wave: 'rgba(255,255,255,0.13)',
    mount: ['#a39780', '#756a57'], cap: '#f4f6f8', hill: '#7d8c55', tree: ['#2c6230', '#4a8c42'], treeP: 0.42, mini: [[86, 140, 70], [34, 92, 146]],
  },
  wueste: {
    water: [[122, 214, 206], [74, 182, 194], [46, 150, 180], [34, 122, 160], [26, 100, 140], [20, 82, 122]], sand: [240, 222, 170],
    stops: [[0, [236, 212, 152]], [0.1, [226, 194, 126]], [0.42, [210, 170, 102]], [0.7, [190, 144, 92]], [1, [164, 122, 88]]],
    surf: 'rgb(170,226,220)', glow: 'rgba(225,250,245,0.85)', wave: 'rgba(255,255,255,0.15)',
    mount: ['#c99c6c', '#8c6746'], cap: null, hill: '#cba268', tree: ['#3a7436', '#6aa64e'], treeP: 0.1, mini: [[214, 178, 110], [40, 140, 170]],
  },
  schnee: {
    water: [[112, 152, 178], [72, 114, 148], [50, 90, 126], [38, 72, 108], [30, 58, 92], [24, 48, 78]], sand: [196, 206, 214],
    stops: [[0, [214, 224, 232]], [0.1, [238, 243, 248]], [0.42, [228, 235, 242]], [0.7, [206, 214, 224]], [1, [178, 186, 198]]],
    surf: 'rgb(196,224,238)', glow: 'rgba(235,246,252,0.9)', wave: 'rgba(255,255,255,0.16)',
    mount: ['#b8c1cb', '#7a8592'], cap: '#ffffff', hill: '#d2dae4', tree: ['#1f4a3a', '#3f7862'], treeP: 0.36, mini: [[226, 232, 240], [40, 74, 110]],
  },
  lava: {
    water: [[58, 80, 96], [42, 62, 78], [32, 50, 66], [26, 40, 54], [20, 32, 44], [16, 26, 36]], sand: [150, 128, 110],
    stops: [[0, [138, 116, 102]], [0.1, [118, 100, 92]], [0.42, [100, 84, 80]], [0.7, [86, 70, 68]], [1, [70, 56, 56]]],
    surf: 'rgb(150,112,92)', glow: 'rgba(255,150,70,0.6)', wave: 'rgba(255,255,255,0.07)',
    mount: ['#6a544c', '#3a2c2a'], cap: '#ff7a2a', hill: '#7a655c', tree: ['#a82c0c', '#ff8c2a'], treeP: 0.24, mini: [[124, 100, 90], [30, 46, 60]],
  },
  // Fremder Planet: türkises Land, dunkelviolettes Meer, rosa leuchtende Küste, magentafarbene Gewächse, Kristallgipfel
  alien: {
    water: [[98, 86, 152], [72, 62, 126], [54, 46, 102], [42, 36, 82], [32, 28, 64], [24, 22, 50]], sand: [156, 218, 198],
    stops: [[0, [124, 204, 184]], [0.1, [72, 164, 152]], [0.42, [48, 134, 132]], [0.7, [46, 106, 114]], [1, [54, 86, 102]]],
    surf: 'rgb(192,152,222)', glow: 'rgba(240,170,255,0.8)', wave: 'rgba(255,255,255,0.1)',
    mount: ['#7193aa', '#3c5568'], cap: '#ff7ad9', hill: '#62b29e', tree: ['#a81f88', '#ff6fd0'], treeP: 0.4, mini: [[60, 150, 140], [50, 42, 96]],
  },
};
LANDSCAPES.zonen = Object.assign({}, LANDSCAPES.gruen, { zones: true, mini: [[150, 170, 120], [34, 92, 146]] });
function landscape() { return LANDSCAPES[typeof S !== 'undefined' && S && S.land] || LANDSCAPES.gruen; }

// Klimazonen (Landschaft „zonen“, Wunsch des Nutzers): je Feld eine der Landschaften Grün, Wüste, Schnee, Lava – nach der Lage wie auf einer
// Weltkarte: oben und unten Schnee, in der Mitte Wüste, dazwischen Grün, mit welligen Grenzen; vereinzelt Lava. Kleinere Inseln bekommen
// einheitlich die Zone ihrer Mitte (sonst wirkten sie gestreift), große Landmassen (Festland, Binnenmeer, Kontinente) wechseln Feld für Feld.
// Wasser bleibt überall blau; ein Strand nimmt die Farbe des Landes daneben. Nur Aussehen – aus der Kartennummer, gleiche Nummer = gleiches Bild.
const ZONE_KEYS = ['gruen', 'wueste', 'schnee', 'lava'];
// Grenzen der Zonen (Abstand zur Mitte 0…1, mit Rauschen): darüber Schnee, darunter Wüste. Grün übergewichtet (Wunsch des Nutzers):
// vorher 0,62 / 0,28 – Grün 34 %, Wüste 27 %, Schnee 36 % des Landes (mittel, alle Welten)
let ZONE_SNOW = 0.78, ZONE_DESERT = 0.17;
const ISL_SNOW = 0.1, ISL_DESERT = 0.15;   // Inseln: je 10 % im Norden und Süden Schnee, die mittleren 15 % Wüste
let zoneCache = null;
function zoneMap() {
  const W = S.W, H = S.H, key = [S.gameId, W, H, S.seed].join();
  if (zoneCache && zoneCache.key === key) return zoneCache.z;
  const seed = (S.seed || 7) >>> 0;
  const hash = (a, b, k) => mulberry32((Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(k, 83492791) ^ seed) >>> 0)();
  const noise = (x, y, cell, k) => {   // weiches Rauschen 0…1 auf einem Gitter der Weite cell
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash(ix, iy, k), b = hash(ix + 1, iy, k), c = hash(ix, iy + 1, k), d = hash(ix + 1, iy + 1, k);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const climate = (x, y) => {
    const lat = Math.abs((y + 0.5) / H - 0.5) * 2 + (noise(x, y, 7, 1) - 0.5) * 0.32;
    return lat > ZONE_SNOW ? 2 : lat < ZONE_DESERT ? 1 : 0;
  };
  const z = new Uint8Array(W * H), cont = S.cont, land = i => S.terrain[i] === 1;
  // Inseln: Größe und Mitte je Landmasse
  const size = new Map(), sx = new Map(), sy = new Map(); let total = 0;
  for (let i = 0; i < W * H; i++) if (land(i)) {
    total++; const k = cont ? cont[i] : -1; if (k < 0) continue;
    size.set(k, (size.get(k) || 0) + 1); sx.set(k, (sx.get(k) || 0) + (i % W)); sy.set(k, (sy.get(k) || 0) + ((i / W) | 0));
  }
  // Kleinere Inseln nach ihrer Rangfolge von Nord nach Süd (Wunsch des Nutzers): die nördlichsten und südlichsten je ISL_SNOW werden Schnee-,
  // die mittleren ISL_DESERT Wüsteninseln, der Rest grün, vereinzelt Lava. So hat jede Inselkarte ein paar Schnee- und Wüsteninseln, auch wenn
  // am Kartenrand nur Wasser liegt – nach der absoluten Lage gab es mit dem schmalen Schneegürtel im Inselreich oft keine einzige.
  const islandZone = new Map();
  const isl = [...size].filter(([, n]) => n < total * 0.15).map(([k, n]) => ({ k, cx: sx.get(k) / n, cy: sy.get(k) / n }))
    .sort((p, q) => p.cy - q.cy || p.cx - q.cx);
  isl.forEach((o, j) => {
    const d = isl.length > 1 ? Math.abs(j / (isl.length - 1) - 0.5) * 2 : 0;   // 0 = Mitte der Rangfolge, 1 = nördlichste/südlichste
    let zz = d > 1 - 2 * ISL_SNOW ? 2 : d < ISL_DESERT ? 1 : 0;
    if (zz !== 2 && hash(o.k, 0, 9) < 0.12) zz = 3;   // vereinzelt eine Lavainsel
    islandZone.set(o.k, zz);
  });
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, k = cont && land(i) ? cont[i] : -1;
    if (islandZone.has(k)) { z[i] = islandZone.get(k); continue; }
    let zz = climate(x, y);
    if (land(i) && zz !== 2 && noise(x, y, 9, 2) > 0.8) zz = 3;   // auf großen Landmassen: Lavafelder
    z[i] = zz;
  }
  // Wasser am Ufer nimmt die Zone des Landes daneben (Strandfarbe)
  const out = z.slice();
  for (let i = 0; i < W * H; i++) {
    if (land(i)) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && land(ny * W + nx)) { out[i] = z[ny * W + nx]; break; } }
  }
  zoneCache = { key, z: out };
  return out;
}
// Farbsatz für ein Feld der laufenden Partie (Übersichtskarte)
function tileLandscape(i) {
  const L = landscape();
  return L.zones ? LANDSCAPES[ZONE_KEYS[zoneMap()[i]]] : L;
}

function landColor(e, stops = landscape().stops) {
  let k = 0;
  while (k < stops.length - 2 && e > stops[k + 1][0]) k++;
  const [e0, c0] = stops[k], [e1, c1] = stops[k + 1];
  const f = Math.min(1, Math.max(0, (e - e0) / (e1 - e0)));
  return c0.map((v, j) => v + (c1[j] - v) * f);
}

function buildTerrain(TS, st = S) {   // st: Kartenstück der Grafik-Übersicht, sonst die laufende Partie
  const W = st.W, H = st.H;
  const oc = document.createElement('canvas');
  oc.width = W * TS; oc.height = H * TS;
  const g = oc.getContext('2d');
  // Wellen, Bodenstruktur, Bäume und Berge würfeln je Feld mit eigenem Startwert (aus der Lage des Feldes), nicht mehr der Reihe nach über
  // die ganze Karte: So sieht ein Ausschnitt (Lupe, st.ox/st.oy = seine Lage auf der Karte) genauso aus wie dieselbe Stelle der ganzen Karte.
  let r = mulberry32(4711);
  const ox = st.ox | 0, oy = st.oy | 0;
  const seedAt = (x, y, k) => { r = mulberry32((Math.imul(x + ox + 1, 73856093) ^ Math.imul(y + oy + 1, 19349663) ^ Math.imul(k, 83492791)) >>> 0); };
  const L = landscape(), WATER_COL = L.water, SAND = L.sand;
  // Klimazonen: Farbsatz je Feld aus der Zonenkarte der Partie (auch für den Ausschnitt der Lupe); Kartenstücke der Grafik-Übersicht: grün
  const Z = L.zones && (st === S || st.ox != null) && typeof S !== 'undefined' && S ? zoneMap() : null;
  const pal = (x, y) => (Z ? LANDSCAPES[ZONE_KEYS[Z[(y + oy) * S.W + x + ox]]] : L);
  const isW = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !st.terrain[y * W + x];

  // 1) Wasser: weiche Tiefenverläufe
  const wc = document.createElement('canvas'); wc.width = W; wc.height = H;
  const wg = wc.getContext('2d'), wi = wg.createImageData(W, H);
  const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  const lg = lc.getContext('2d'), li = lg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const wcol = st.terrain[i] ? WATER_COL[0] : WATER_COL[Math.min(WATER_COL.length - 1, st.depth[i] - 1)];
    const P = pal(i % W, (i / W) | 0), lcol = st.terrain[i] ? landColor(st.elev[i], P.stops) : (Z ? P.sand : SAND);
    for (let j = 0; j < 3; j++) { wi.data[i * 4 + j] = wcol[j]; li.data[i * 4 + j] = lcol[j]; }
    wi.data[i * 4 + 3] = 255; li.data[i * 4 + 3] = 255;
  }
  wg.putImageData(wi, 0, 0); lg.putImageData(li, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(wc, 0, 0, W * TS, H * TS);

  // Wellen
  g.strokeStyle = L.wave; g.lineWidth = Math.max(1, TS / 18); g.lineCap = 'round';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    seedAt(x, y, 1);
    if (st.terrain[y * W + x] || st.depth[y * W + x] < 2 || r() > 0.22) continue;
    const cx = (x + 0.2 + r() * 0.6) * TS, cy = (y + 0.2 + r() * 0.6) * TS, w = TS * 0.18;
    g.beginPath(); g.moveTo(cx - w, cy); g.quadraticCurveTo(cx - w / 2, cy - w * 0.6, cx, cy); g.quadraticCurveTo(cx + w / 2, cy - w * 0.6, cx + w, cy); g.stroke();
  }

  // 2) Landmasse mit abgerundeten Küstenecken
  const land = new Path2D();
  // Berühren sich zwei Landfelder nur an einer Ecke (selten, etwa einmal je Karte), kommen Bodentruppen diagonal hinüber und
  // Schiffe diagonal hindurch. Damit man das sieht, werden dort beide Landecken leicht abgerundet (rp) – das Wasser fließt
  // sichtbar durch – und ein kleiner Steg verbindet sie (siehe „Stege“ weiter unten).
  const rr = TS * 0.48, rp = TS * 0.3, e = 0.6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isW(x, y)) continue;
    const L = isW(x - 1, y), R = isW(x + 1, y), U = isW(x, y - 1), D = isW(x, y + 1);
    const tl = L && U ? (isW(x - 1, y - 1) ? rr : rp) : 0, tr = R && U ? (isW(x + 1, y - 1) ? rr : rp) : 0;
    const br = R && D ? (isW(x + 1, y + 1) ? rr : rp) : 0, bl = L && D ? (isW(x - 1, y + 1) ? rr : rp) : 0;
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
  g.shadowColor = L.glow; g.shadowBlur = TS * 0.45;
  g.fillStyle = L.surf;
  g.fill(land); g.fill(land);
  g.restore();
  g.save();
  g.clip(land);
  g.drawImage(lc, 0, 0, W * TS, H * TS);

  // Bodenstruktur
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isW(x, y)) continue;
    seedAt(x, y, 2);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
      g.beginPath(); g.arc((x + r()) * TS, (y + r()) * TS, TS * (0.04 + r() * 0.05), 0, 7); g.fill();
    }
  }
  // Wälder, Hügel, Berge
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (isW(x, y) || st.cityGrid[i] >= 0) continue;
    const el = st.elev[i];
    const X = x * TS, Y = y * TS;
    seedAt(x, y, 3);
    const Q = pal(x, y);
    if (el > 0.68) {
      const peaks = el > 0.82 ? 2 : 1;
      for (let k = 0; k < peaks; k++) {
        const cx = X + TS * (peaks === 1 ? 0.5 : 0.32 + k * 0.38) + (r() - 0.5) * TS * 0.1;
        const by = Y + TS * (0.8 - k * 0.06), h = TS * (0.5 + r() * 0.15), w = TS * (peaks === 1 ? 0.42 : 0.32);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath(); g.ellipse(cx + w * 0.2, by, w * 1.05, TS * 0.07, 0, 0, 7); g.fill();
        g.fillStyle = Q.mount[0];
        g.beginPath(); g.moveTo(cx - w, by); g.lineTo(cx, by - h); g.lineTo(cx, by); g.closePath(); g.fill();
        g.fillStyle = Q.mount[1];
        g.beginPath(); g.moveTo(cx, by - h); g.lineTo(cx + w, by); g.lineTo(cx, by); g.closePath(); g.fill();
        if (el > 0.8 && Q.cap) {
          g.fillStyle = Q.cap;
          g.beginPath(); g.moveTo(cx - w * 0.32, by - h * 0.68); g.lineTo(cx, by - h); g.lineTo(cx + w * 0.32, by - h * 0.68);
          g.lineTo(cx + w * 0.1, by - h * 0.74); g.lineTo(cx - w * 0.05, by - h * 0.64); g.closePath(); g.fill();
        }
      }
    } else if (el > 0.56 && r() < 0.6) {
      const cx = X + TS * (0.35 + r() * 0.3), by = Y + TS * (0.62 + r() * 0.15);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.ellipse(cx + TS * 0.04, by + TS * 0.02, TS * 0.3, TS * 0.08, 0, 0, 7); g.fill();
      g.fillStyle = Q.hill;
      g.beginPath(); g.ellipse(cx, by, TS * 0.28, TS * 0.2, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.ellipse(cx - TS * 0.06, by - TS * 0.05, TS * 0.12, TS * 0.07, 0, Math.PI, 0); g.fill();
    } else if (el > 0.14 && el < 0.56 && r() < Q.treeP) {
      const n = 3 + Math.floor(r() * 3);
      const trees = [];
      for (let k = 0; k < n; k++) trees.push([X + TS * (0.2 + r() * 0.6), Y + TS * (0.25 + r() * 0.55)]);
      trees.sort((a, b) => a[1] - b[1]);
      for (const [tx, ty] of trees) {
        const tr = TS * (0.1 + r() * 0.05);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(tx + tr * 0.3, ty + tr * 0.8, tr, tr * 0.45, 0, 0, 7); g.fill();
        g.fillStyle = Q.tree[0];
        g.beginPath(); g.arc(tx, ty, tr, 0, 7); g.fill();
        g.fillStyle = Q.tree[1];
        g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.3, tr * 0.5, 0, 7); g.fill();
      }
    }
  }
  g.restore();

  // Stege über Eck: Land, das sich nur diagonal berührt, ist für Bodentruppen verbunden; Schiffe fahren darunter durch
  const steg = (cx, cy, dir) => {
    const hl = TS * 0.36, hw = TS * 0.105, lw = Math.max(1, TS / 30);
    g.save();
    g.translate(cx, cy); g.rotate(dir * Math.PI / 4);   // Längsachse entlang der Land-Diagonale
    g.fillStyle = 'rgba(10,30,50,0.28)';                 // Schatten auf dem Wasser
    g.fillRect(-hl * 0.8, -hw + TS * 0.07, hl * 1.6, hw * 2);
    g.fillStyle = '#a8804e'; g.strokeStyle = '#4f381f'; g.lineWidth = lw;
    roundRectPath(g, -hl, -hw, hl * 2, hw * 2, hw * 0.35); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(70,46,22,0.6)'; g.lineWidth = Math.max(0.75, TS / 44);   // Planken
    g.beginPath();
    for (let px = -hl + TS * 0.09; px < hl - TS * 0.04; px += TS * 0.09) { g.moveTo(px, -hw); g.lineTo(px, hw); }
    g.stroke();
    g.strokeStyle = '#e3c898'; g.lineWidth = lw;                                   // Geländer
    g.beginPath(); g.moveTo(-hl * 0.92, -hw * 0.62); g.lineTo(hl * 0.92, -hw * 0.62); g.moveTo(-hl * 0.92, hw * 0.62); g.lineTo(hl * 0.92, hw * 0.62); g.stroke();
    g.restore();
  };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = !isW(x, y), b = !isW(x + 1, y), c = !isW(x, y + 1), d = !isW(x + 1, y + 1);
    if (a && d && !b && !c) steg((x + 1) * TS, (y + 1) * TS, 1);          // links oben – rechts unten
    else if (b && c && !a && !d) steg((x + 1) * TS, (y + 1) * TS, -1);    // rechts oben – links unten
  }

  // feines Raster zur Orientierung
  g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 1; x < W; x++) { g.moveTo(x * TS + 0.5, 0); g.lineTo(x * TS + 0.5, H * TS); }
  for (let y = 1; y < H; y++) { g.moveTo(0, y * TS + 0.5); g.lineTo(W * TS, y * TS + 0.5); }
  g.stroke();
  return oc;
}
