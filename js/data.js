'use strict';
// ---------------------------------------------------------------------------
// Archipel – Grunddaten: Einheitentypen, Richtungen, Spieler, Zufall
// ---------------------------------------------------------------------------

// Versionsnummer: steht im Handbuch und bestimmt den Namen des Releases (siehe tools/pack.js, CHANGELOG.md)
const VERSION = '1.9.5';

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
// stealth: getaucht unsichtbar (nur geortet zu sehen), sonar: ortet U-Boote in voller Sichtweite
// shore: Schiff kann Einheiten an Land angreifen (Beschuss) – alle anderen Schiffe nur Schiffe und Flugzeuge, siehe canStrike
// noAttack: greift nie selbst an (Träger), siehe canAttack()
const UT = {
  inf:  { name: tt('Infanterie', 'Infantry'), g: 'f',     sym: 'I', domain: 'land', move: 1, hp: 1,  str: 1, cost: 5,  vision: 1, capture: true },
  tank: { name: tt('Panzer', 'Tank'), g: 'm',         sym: tt('P', 'A'), domain: 'land', move: 2, hp: 2,  str: 1, cost: 10, vision: 1, capture: true, noRepair: true },
  ftr:  { name: tt('Jäger', 'Fighter'), g: 'm',          sym: tt('J', 'F'), domain: 'air',  move: 6, hp: 1,  str: 1, cost: 10, vision: 2, fuel: 18 },
  trn:  { name: tt('Transporter', 'Transport'), g: 'm',    sym: 'T', domain: 'sea',  move: 3, hp: 1,  str: 0, cost: 15, vision: 1, carries: 'land', capacity: 6 },
  dst:  { name: tt('Zerstörer', 'Destroyer'), g: 'm',      sym: tt('Z', 'D'), domain: 'sea',  move: 4, hp: 3,  str: 1, cost: 15, vision: 2, sonar: true },
  sub:  { name: tt('U-Boot', 'Submarine'), g: 'n',         sym: tt('U', 'S'), domain: 'sea',  move: 3, hp: 2,  str: 3, cost: 20, vision: 2, stealth: true },
  crs:  { name: tt('Kreuzer', 'Cruiser'), g: 'm',        sym: tt('K', 'R'), domain: 'sea',  move: 3, hp: 8,  str: 2, cost: 30, vision: 2, shore: true },
  car:  { name: tt('Träger', 'Carrier'), g: 'm',         sym: tt('F', 'C'), domain: 'sea',  move: 3, hp: 8,  str: 1, cost: 30, vision: 4, carries: 'air', capacity: 6, noAttack: true },
  bat:  { name: tt('Schlachtschiff', 'Battleship'), g: 'n', sym: tt('S', 'B'), domain: 'sea',  move: 3, hp: 12, str: 3, cost: 40, vision: 2, shore: true },
};
// Kann dieser Typ selbst angreifen? Transporter (Stärke 0) nicht, der Träger auch nicht (noAttack: er verteidigt sich mit
// seiner Stärke, angreifen sollen seine Jäger)
const canAttack = k => UT[k].str > 0 && !UT[k].noAttack;
const UNIT_ORDER = ['inf', 'tank', 'ftr', 'trn', 'dst', 'sub', 'crs', 'car', 'bat'];

const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// Spieler 0 ist immer der Mensch, 1 … 3 Computergegner (jeder gegen jeden). Bei nur einem Gegner heißt er „Gegner“, bei mehreren
// nach seiner Farbe – siehe pname() in game.js. Die Zahl der Gegner wählt man im Fenster „Neues Spiel“ (MAP_SIZES.maxAi).
const PLAYERS = [
  { name: tt('Du', 'You'),         color: '#2f7de1', light: '#8fc0ff', dark: '#173f78' },
  { name: tt('Rot', 'Red'),        color: '#d9433b', light: '#ff9d96', dark: '#7a1c17' },
  { name: tt('Gelb', 'Yellow'),    color: '#d6970f', light: '#ffd56b', dark: '#6b4704' },
  { name: tt('Violett', 'Purple'), color: '#8e54c8', light: '#d0a8f5', dark: '#3f1a6a' },
];
// Landschaften: wie die Karte eingefärbt ist (Farbsätze in gfx.js LANDSCAPES – dieselben Schlüssel). Gehört zur Partie (S.land), ändert aber
// keine Regel. Standard ist DEFAULT_LAND (Klimazonen, Wunsch des Nutzers: die Inseln sehen nicht mehr alle gleich aus) – vorgewählt im Fenster
// „Neues Spiel“ und für die allererste Partie (FIRST_LAND). Bis 1.8.3 war die Vorauswahl zufällig und die erste Partie grün. START_LANDS gilt nur
// noch, wenn niemand wählt (Simulationen): aus der Kartennummer (FIRST_LAND);
// in den Einstellungen sind jederzeit alle wählbar. Die Asteroiden (asteroiden, eis, eisen, kristall, guertel) gehören zum Weltraum-Set, die alten Karten (altkarte, altwueste, altpolar, alttropen, altzonen) zur Segelzeit (eigene Einheitenbilder, gfx.js); beide werden nie zufällig gewählt.
const LAND_KEYS = ['gruen', 'wueste', 'schnee', 'lava', 'alien', 'zonen', 'asteroiden', 'eis', 'eisen', 'kristall', 'guertel', 'altkarte', 'altwueste', 'altpolar', 'alttropen', 'altzonen'];
const START_LANDS = ['gruen', 'wueste', 'schnee', 'lava', 'alien', 'zonen'], DEFAULT_LAND = 'zonen', FIRST_LAND = DEFAULT_LAND;
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
//  skill     – wie klug der Gegner spielt: 0 = einfach, 1 = umsichtig (siehe „Können“ in ai.js)
const DIFFICULTY = {
  leicht: { label: tt('Leicht', 'Easy'), desc: tt('Gegner muss die Karte erst erkunden, baut langsamer, macht öfter Fehler und greift vorsichtig an. Du startest mit einer Extra-Infanterie.',
    'The enemy has to explore the map first, builds more slowly, makes more mistakes and attacks cautiously. You start with an extra infantry.'),
    aiProd: 0.7, aiStart: [], youStart: ['inf'], aiCities: 0, invadeAt: 6, caution: 0.1, aiKnowsMap: false, aiMistake: 0.25, skill: 0 },
  normal: { label: 'Normal', desc: tt('Gleiche Bedingungen: Der Gegner muss wie du erkunden und macht gelegentlich Fehler.',
    'Equal terms: the enemy has to explore just like you and makes occasional mistakes.'),
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 4, caution: 0, aiKnowsMap: false, aiMistake: 0.12, skill: 0 },
  schwer: { label: tt('Schwer', 'Hard'), desc: tt('Gegner spielt umsichtiger: Er greift mehrere Städte zugleich an, jagt gelandete Truppen und deine Transporter und schützt seine eigenen mit Zerstörern. Er kennt die ganze Karte und macht keine Fehler, baut aber nicht schneller als du.',
    'The enemy plays more shrewdly: it attacks several cities at once, hunts landed troops and your transports, and escorts its own with destroyers. It knows the whole map and makes no mistakes, but builds no faster than you.'),
    aiProd: 1, aiStart: [], youStart: [], aiCities: 0, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0, skill: 1 },
  brutal: { label: 'Brutal', desc: tt('Wie Schwer, dazu baut der Gegner etwas schneller (115 %) und startet mit einer zweiten Stadt.',
    'Like Hard, and the enemy also builds a little faster (115 %) and starts with a second city.'),
    aiProd: 1.15, aiStart: [], youStart: [], aiCities: 1, invadeAt: 3, caution: -0.05, aiKnowsMap: true, aiMistake: 0, skill: 1 },
};
const diff = () => DIFFICULTY[(typeof S !== 'undefined' && S && S.difficulty) || 'normal'] || DIFFICULTY.normal;
// Kennt Spieler p die ganze Karte? Nur Computergegner (Platz 1 …), und nur auf Schwer/Brutal.
const aiKnowsMap = p => p >= 1 && diff().aiKnowsMap;
// Fehlerquote der Gegner (der Spielerplatz 0 macht in Simulationen keine Fehler)
const aiMistake = p => (p >= 1 ? diff().aiMistake : 0);

// maxAi: höchstens so viele Computergegner (auf der kleinen Karte wird es mit drei Gegnern zu eng)
const MAP_SIZES = {
  klein:  { w: 48, h: 30, maxAi: 2, label: tt('Klein (48×30)', 'Small (48×30)') },
  mittel: { w: 64, h: 40, maxAi: 3, label: tt('Mittel (64×40)', 'Medium (64×40)') },
  gross:  { w: 90, h: 56, maxAi: 3, label: tt('Groß (90×56)', 'Large (90×56)') },
};

// Weltarten für den Kartengenerator (map.js).
//  rBig  – Radius der großen Inseln (Startinseln) relativ zu √(Kartenfläche)
//  perBig – Kartenfläche je großer Insel (mehr Fläche → mehr große Inseln, mindestens 2)
//  mid   – Anteil mittlerer Inseln an den übrigen, small – größter Radius kleiner Inseln (relativ zu rBig)
//  gap   – Mindestabstand (Wasser) zwischen geplanten Inseln
//  massLen, massShare, minBig – Gemischt: eine Landmasse je massLen Felder Kantenlänge (mind. minBig), zusammen massShare des Landes
//  split – geplante Inseln bleiben getrennt (Rauschen darf sie nicht verbinden), siehe generateMap
const WORLDS = {
  inseln: { label: tt('Inselreich', 'Archipelago'),
    desc: tt('Viele mittlere und kleine Inseln, keine großen Landmassen. Ohne Schiffe kommst du nicht weit.', 'Many medium and small islands, no large land masses. You won\'t get far without ships.'),
    rBig: 0.09, perBig: 1700, mid: 0.5, small: 0.45, gap: 3.5, land: 0.33, split: true },
  gemischt: { label: tt('Gemischt', 'Mixed'),
    desc: tt('Mehrere mittelgroße Landmassen – je größer die Karte, desto mehr –, dazwischen viele kleine Inseln. Erst das eigene Land sichern, dann über See weiter.', 'Several medium-sized land masses – the larger the map, the more – with many small islands in between. Secure your own land first, then push on by sea.'),
    massLen: 13, massShare: 0.55, minBig: 3, mid: 0, small: 0.4, gap: 3.5, land: 0.36, split: true },
  // „kontinente“ bleibt der innere Name (ältere Spielstände), die Welt heißt jetzt Festland
  kontinente: { label: tt('Festland', 'Mainland'),
    desc: tt('Die ganze Welt ist eine Landmasse mit Binnenmeeren und Flüssen. Über die Flüsse führen Brücken, Schiffe fahren auf Seen und Flüssen.', 'The whole world is one land mass with inland seas and rivers. Bridges cross the rivers, ships sail on lakes and rivers.'),
    festland: true, lakeR: 4, lakeArea: 650, lakeGap: 4 },   // Seeradius ab lakeR, ein See je lakeArea Felder, Landenge lakeGap
  // Kontinente (innerer Name „erdteile“ – „kontinente“ ist das Festland): je Spieler ein eigener Kontinent, dazwischen Meer mit kleinen Inseln.
  // Zwei Spieler: links und rechts; drei: Dreieck; vier: in den Ecken (Wunsch des Nutzers). Die Karte hängt deshalb von der Zahl der Gegner ab.
  erdteile: { label: tt('Kontinente', 'Continents'),
    desc: tt('Jeder beginnt auf seinem eigenen Kontinent, dazwischen liegt das Meer mit kleinen Inseln als Trittsteinen. Erst das eigene Land sichern – dann entscheidet die Überfahrt.', 'Everyone starts on a continent of their own, with the sea and small stepping-stone islands in between. Secure your own land first – then the crossing decides.'),
    kont: true, massLen: 1, massShare: 0.45, minBig: 2, mid: 0, small: 0.4, gap: 3.5, land: 0.34, split: true },
  // Binnenmeer (Versuch, Wunsch des Nutzers): Land ringsherum, in der Mitte ein Meer mit wenigen kleinen Inseln (je größer die Karte, desto mehr)
  binnenmeer: { label: tt('Binnenmeer', 'Inland sea'),
    desc: tt('Land ringsherum, in der Mitte ein Meer mit einigen kleinen Inseln. Der Landweg führt außen herum – der kurze Weg geht übers Wasser.', 'Land all around, a sea with a few small islands in the middle. The land route runs around the outside – the short way is across the water.'),
    binnen: true, ring: 0.22, islArea: 150 },   // Breite des Landrings (Anteil der kürzeren Kante), eine Insel je islArea Felder Meer
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
