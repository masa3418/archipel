'use strict';
// ---------------------------------------------------------------------------
// Archipel – Grunddaten: Einheitentypen, Richtungen, Spieler, Zufall
// ---------------------------------------------------------------------------

// Sprache: 'de' oder 'en'. Gewählt über den Sprachknopf (gespeichert), sonst nach Browsersprache.
// Ein Wechsel lädt die Seite neu, daher dürfen alle Texte schon beim Laden festgelegt werden.
// tt(deutsch, englisch) liefert den Text in der aktuellen Sprache – beide Fassungen stehen direkt im Code.
const LANG = (() => {
  try { const l = localStorage.getItem('archipel-lang'); if (l === 'de' || l === 'en') return l; } catch (e) {}
  const nl = (typeof navigator !== 'undefined' && navigator.language) || 'de';
  return /^de\b/i.test(nl) ? 'de' : 'en';
})();
const EN = LANG === 'en';
const tt = (de, en) => (EN ? en : de);

// domain: land | sea | air
// move: Felder pro Runde, hp: Trefferpunkte, str: Schaden pro Treffer
// cost: Bauzeit in Runden, vision: Sichtweite
const UT = {
  inf:  { name: tt('Infanterie', 'Infantry'), g: 'f',     sym: 'I', domain: 'land', move: 1, hp: 1,  str: 1, cost: 5,  vision: 1, capture: true },
  tank: { name: tt('Panzer', 'Tank'), g: 'm',         sym: tt('P', 'A'), domain: 'land', move: 2, hp: 2,  str: 1, cost: 10, vision: 1, capture: true, noRepair: true },
  ftr:  { name: tt('Jäger', 'Fighter'), g: 'm',          sym: tt('J', 'F'), domain: 'air',  move: 6, hp: 1,  str: 1, cost: 10, vision: 2, fuel: 18 },
  trn:  { name: tt('Transporter', 'Transport'), g: 'm',    sym: 'T', domain: 'sea',  move: 3, hp: 1,  str: 0, cost: 15, vision: 1, carries: 'land', capacity: 6 },
  dst:  { name: tt('Zerstörer', 'Destroyer'), g: 'm',      sym: tt('Z', 'D'), domain: 'sea',  move: 4, hp: 3,  str: 1, cost: 15, vision: 2 },
  sub:  { name: tt('U-Boot', 'Submarine'), g: 'n',         sym: tt('U', 'S'), domain: 'sea',  move: 3, hp: 2,  str: 3, cost: 20, vision: 1 },
  crs:  { name: tt('Kreuzer', 'Cruiser'), g: 'm',        sym: tt('K', 'R'), domain: 'sea',  move: 3, hp: 8,  str: 2, cost: 30, vision: 2 },
  car:  { name: tt('Träger', 'Carrier'), g: 'm',         sym: tt('F', 'C'), domain: 'sea',  move: 3, hp: 8,  str: 1, cost: 30, vision: 2, carries: 'air', capacity: 6 },
  bat:  { name: tt('Schlachtschiff', 'Battleship'), g: 'n', sym: tt('S', 'B'), domain: 'sea',  move: 2, hp: 12, str: 3, cost: 40, vision: 2 },
};
const UNIT_ORDER = ['inf', 'tank', 'ftr', 'trn', 'dst', 'sub', 'crs', 'car', 'bat'];

const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

const PLAYERS = [
  { name: tt('Du', 'You'),     color: '#2f7de1', light: '#8fc0ff', dark: '#173f78' },
  { name: tt('Gegner', 'Enemy'), color: '#d9433b', light: '#ff9d96', dark: '#7a1c17' },
];
const NEUTRAL = { color: '#9aa0a6', light: '#d7dadd', dark: '#55595e' };

// Schwierigkeitsgrade. Sie wirken nur auf den Computergegner (und den Start):
//  aiProd    – Bautempo der gegnerischen Städte (1 = wie du)
//  aiStart   – zusätzliche Einheiten des Gegners zu Beginn
//  youStart  – zusätzliche eigene Einheiten zu Beginn
//  aiCities  – zusätzliche Städte des Gegners zu Beginn (nächstgelegene neutrale)
//  invadeAt  – mit wie vielen Truppen an Bord der Gegner eine Landung wagt
//  caution   – Zuschlag auf die nötige Siegchance, bevor der Gegner angreift
//  aiKnowsMap – Gegner kennt die ganze Karte (sonst muss er wie du erkunden)
//  aiMistake – Anteil „menschlicher“ Fehlentscheidungen (vergessene Einheiten, Fehleinschätzungen)
//  worlds    – abweichende Werte je Weltart (z. B. Schwer im Inselreich: Kartenwissen nützt dort weniger,
//              daher baut der Gegner etwas schneller; per Simulation eingemessen)
const DIFFICULTY = {
  leicht: { label: tt('Leicht', 'Easy'), desc: tt('Gegner muss die Karte erst erkunden, baut langsamer, macht öfter Fehler und greift vorsichtig an. Du startest mit einer Extra-Infanterie.',
    'The enemy has to explore the map first, builds more slowly, makes more mistakes and attacks cautiously. You start with an extra infantry.'),
    aiProd: 0.7, aiStart: [], youStart: ['inf'], aiCities: 0, invadeAt: 6, caution: 0.1, aiKnowsMap: false, aiMistake: 0.25 },
  normal: { label: 'Normal', desc: tt('Gleiche Bedingungen: Der Gegner muss wie du erkunden und macht gelegentlich Fehler.',
    'Equal terms: the enemy has to explore just like you and makes occasional mistakes.'),
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 4, caution: 0, aiKnowsMap: false, aiMistake: 0.12 },
  schwer: { label: tt('Schwer', 'Hard'), desc: tt('Gegner kennt die ganze Karte, macht keine Fehler und landet schon mit kleineren Trupps. Im Inselreich baut er etwas schneller.',
    'The enemy knows the whole map, makes no mistakes and lands even with smaller groups. In the archipelago it also builds a little faster.'),
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0,
    worlds: { inseln: { aiProd: 1.15 } } },
  brutal: { label: 'Brutal', desc: tt('Gegner kennt die ganze Karte, macht keine Fehler, baut anderthalbmal so schnell und startet mit einer zweiten Stadt.',
    'The enemy knows the whole map, makes no mistakes, builds one and a half times as fast and starts with a second city.'),
    aiProd: 1.5, aiStart: ['tank', 'inf'], youStart: [], aiCities: 1, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0 },
};
const diffCache = new Map();
function diff() {
  const has = typeof S !== 'undefined' && S;
  const d = DIFFICULTY[(has && S.difficulty) || 'normal'] || DIFFICULTY.normal;
  const w = has && S.world, o = w && d.worlds && d.worlds[w];
  if (!o) return d;
  const key = d.label + '|' + w;
  if (!diffCache.has(key)) diffCache.set(key, Object.assign({}, d, o));
  return diffCache.get(key);
}
// Kennt Spieler p die ganze Karte? Nur der Computergegner, und nur auf Schwer/Brutal.
const aiKnowsMap = p => p === 1 && diff().aiKnowsMap;
// Fehlerquote des Gegners (der Spielerplatz 0 macht in Simulationen keine Fehler)
const aiMistake = p => (p === 1 ? diff().aiMistake : 0);

const MAP_SIZES = {
  klein:  { w: 48, h: 30, label: tt('Klein (48×30)', 'Small (48×30)') },
  mittel: { w: 64, h: 40, label: tt('Mittel (64×40)', 'Medium (64×40)') },
  gross:  { w: 90, h: 56, label: tt('Groß (90×56)', 'Large (90×56)') },
};

// Weltarten für den Kartengenerator (map.js).
//  rBig  – Radius der großen Inseln (Startinseln) relativ zu √(Kartenfläche)
//  perBig – Kartenfläche je großer Insel (mehr Fläche → mehr große Inseln, mindestens 2)
//  mid   – Anteil mittlerer Inseln an den übrigen, small – größter Radius kleiner Inseln (relativ zu rBig)
//  gap   – Mindestabstand (Wasser) zwischen geplanten Inseln
const WORLDS = {
  inseln: { label: tt('Inselreich', 'Archipelago'),
    desc: tt('Viele Inseln, nur wenige große. Ohne Schiffe kommst du nicht weit.', 'Many islands, only a few large ones. You won\'t get far without ships.'),
    rBig: 0.12, perBig: 1700, mid: 0.3, small: 0.35, gap: 3.5, land: 0.33 },
  gemischt: { label: tt('Gemischt', 'Mixed'),
    desc: tt('Einige große Inseln und ein paar kleine dazwischen.', 'Several large islands with a few small ones in between.'),
    rBig: 0.16, perBig: 1500, mid: 0.5, small: 0.3, gap: 3, land: 0.35 },
  kontinente: { label: tt('Kontinente', 'Continents'),
    desc: tt('Eine oder zwei riesige Landmassen. Viel Landkrieg, Schiffe sind Nebensache.', 'One or two huge land masses. Lots of land warfare, ships play a minor role.') },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = Math.random;

const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
