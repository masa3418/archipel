'use strict';
// ---------------------------------------------------------------------------
// Archipel – Grunddaten: Einheitentypen, Richtungen, Spieler, Zufall
// ---------------------------------------------------------------------------

// domain: land | sea | air
// move: Felder pro Runde, hp: Trefferpunkte, str: Schaden pro Treffer
// cost: Bauzeit in Runden, vision: Sichtweite
const UT = {
  inf:  { name: 'Infanterie', g: 'f',     sym: 'I', domain: 'land', move: 1, hp: 1,  str: 1, cost: 5,  vision: 1, capture: true },
  tank: { name: 'Panzer', g: 'm',         sym: 'P', domain: 'land', move: 2, hp: 2,  str: 1, cost: 10, vision: 1, capture: true, noRepair: true },
  ftr:  { name: 'Jäger', g: 'm',          sym: 'J', domain: 'air',  move: 6, hp: 1,  str: 1, cost: 10, vision: 2, fuel: 18 },
  trn:  { name: 'Transporter', g: 'm',    sym: 'T', domain: 'sea',  move: 3, hp: 1,  str: 0, cost: 15, vision: 1, carries: 'land', capacity: 6 },
  dst:  { name: 'Zerstörer', g: 'm',      sym: 'Z', domain: 'sea',  move: 4, hp: 3,  str: 1, cost: 15, vision: 2 },
  sub:  { name: 'U-Boot', g: 'n',         sym: 'U', domain: 'sea',  move: 3, hp: 2,  str: 3, cost: 20, vision: 1 },
  crs:  { name: 'Kreuzer', g: 'm',        sym: 'K', domain: 'sea',  move: 3, hp: 8,  str: 2, cost: 30, vision: 2 },
  car:  { name: 'Träger', g: 'm',         sym: 'F', domain: 'sea',  move: 3, hp: 8,  str: 1, cost: 30, vision: 2, carries: 'air', capacity: 6 },
  bat:  { name: 'Schlachtschiff', g: 'n', sym: 'S', domain: 'sea',  move: 2, hp: 12, str: 3, cost: 40, vision: 2 },
};
const UNIT_ORDER = ['inf', 'tank', 'ftr', 'trn', 'dst', 'sub', 'crs', 'car', 'bat'];

const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

const PLAYERS = [
  { name: 'Du',     color: '#2f7de1', light: '#8fc0ff', dark: '#173f78' },
  { name: 'Gegner', color: '#d9433b', light: '#ff9d96', dark: '#7a1c17' },
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
const DIFFICULTY = {
  leicht: { label: 'Leicht', desc: 'Gegner muss die Karte erst erkunden, baut langsamer, macht öfter Fehler und greift vorsichtig an. Du startest mit einer Extra-Infanterie.',
    aiProd: 0.7, aiStart: [], youStart: ['inf'], aiCities: 0, invadeAt: 6, caution: 0.1, aiKnowsMap: false, aiMistake: 0.25 },
  normal: { label: 'Normal', desc: 'Gleiche Bedingungen: Der Gegner muss wie du erkunden und macht gelegentlich Fehler.',
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 4, caution: 0, aiKnowsMap: false, aiMistake: 0.12 },
  schwer: { label: 'Schwer', desc: 'Gegner kennt die ganze Karte, macht keine Fehler und landet schon mit kleineren Trupps.',
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0 },
  brutal: { label: 'Brutal', desc: 'Gegner kennt die ganze Karte, macht keine Fehler, baut anderthalbmal so schnell und startet mit einer zweiten Stadt.',
    aiProd: 1.5, aiStart: ['tank', 'inf'], youStart: [], aiCities: 1, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0 },
};
const diff = () => DIFFICULTY[(typeof S !== 'undefined' && S && S.difficulty) || 'normal'] || DIFFICULTY.normal;
// Kennt Spieler p die ganze Karte? Nur der Computergegner, und nur auf Schwer/Brutal.
const aiKnowsMap = p => p === 1 && diff().aiKnowsMap;
// Fehlerquote des Gegners (der Spielerplatz 0 macht in Simulationen keine Fehler)
const aiMistake = p => (p === 1 ? diff().aiMistake : 0);

const MAP_SIZES = {
  klein:  { w: 48, h: 30, label: 'Klein (48×30)' },
  mittel: { w: 64, h: 40, label: 'Mittel (64×40)' },
  gross:  { w: 90, h: 56, label: 'Groß (90×56)' },
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
