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
// Weltraum-Set (Landschaft „Asteroiden“): dieselben neun Einheiten als Raumsoldat, Rover, Raumjäger, Frachter, Korvette, Tarnkappenschiff,
// Kreuzer, Mutterschiff und Schlachtschiff. Nur das Bild wechselt – Regeln und Namen bleiben (Entscheidung des Nutzers). Schiffe von der Seite,
// Bug rechts, wie im Inselset; Flossen oben und unten statt Wasserlinie, Rangpunkte unten wie bei Zerstörer, Kreuzer und Schlachtschiff.
const DOT = cx => `M${cx - 3.6} 89 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z`;
const ICON_SPACE = {
  inf: {   // Raumsoldat: runder Helm mit Visier, Rückentornister, Blaster nach vorn
    fill: [circ(47, 24, 13), 'M24 40 H33 V64 H24 Z',
      'M33 39 Q47 34 61 39 L63 60 H57 L57 90 H50 L48 68 L46 90 H39 V60 H33 Z',
      'M55 45 H86 V51.5 H66 L63 59 H56 Z'],
    cut: ['M38 21 Q47 16 57 21 L56 28 Q47 31.5 39 28 Z'],
  },
  tank: {   // Rover mit Geschützkuppel auf sechs Rädern (drei sichtbar), Antenne
    fill: ['M12 50 H84 L92 60 H6 Z', 'M6 60 H94 V67 H6 Z', circ(20, 73, 9.5), circ(50, 73, 9.5), circ(80, 73, 9.5),
      'M36 50 Q36 36 51 36 Q65 36 65 50 Z', 'M60 40 H96 V46 H60 Z', 'M23 50 L18 27 H21.5 L27.5 50 Z', circ(19.5, 25, 3.2)],
    cut: [circ(20, 73, 3.6), circ(50, 73, 3.6), circ(80, 73, 3.6), 'M41 44 H54 V46.5 H41 Z'],
  },
  ftr: {   // Raumjäger von oben: Pfeilflügel, Bordkanonen an den Flügelspitzen
    fill: ['M50 4 L57 30 L58 46 L82 60 L84 75 L60 70 L58 85 L50 80 L42 85 L40 70 L16 75 L18 60 L42 46 L43 30 Z',
      'M80 34 H85.5 V72 H80 Z', 'M14.5 34 H20 V72 H14.5 Z'],
    cut: ['M47.5 20 L50 12 L52.5 20 L52.5 33 L47.5 33 Z'],
  },
  trn: {   // Frachter mit Containern und Landebeinen
    fill: ['M8 56 H82 L96 64 L82 72 H8 Z', 'M2 58.5 H9 V69.5 H2 Z',
      'M12 44 H27 V55 H12 Z', 'M29 44 H44 V55 H29 Z', 'M46 44 H61 V55 H46 Z', 'M20 32 H35 V43 H20 Z', 'M37 32 H52 V43 H37 Z',
      'M64 44 H78 L84 56 H64 Z', 'M22 71 L16 83 H25 L30 71 Z', 'M66 71 L60 83 H69 L74 71 Z'],
    cut: ['M68 47.5 H79 V51 H68 Z'],
  },
  dst: {   // Korvette: schlanker Pfeil mit Flossen oben und unten, ein Geschütz
    fill: ['M10 58 L32 54 H68 L96 61 L68 68 H32 L10 64 Z', 'M17 56.5 L6 41 H17 L31 54.5 Z', 'M17 65.5 L6 81 H17 L31 67.5 Z',
      'M42 54 V47 H56 V54 Z', 'M54 48.5 H69 V51 H54 Z', DOT(50)],
  },
  sub: {   // Tarnkappenschiff: flacher, kantiger Keil mit Facetten
    fill: ['M4 63 L24 49 L62 46 L96 60 L62 74 L24 77 Z', 'M28 49.5 L21 35 H32 L41 48.5 Z'],
    cut: ['M40 49 L60 60.3 L40 74 L36.5 74 L55.5 60.3 L36.5 49 Z', 'M10 61.5 H22 V64 H10 Z'],
  },
  crs: {   // Kreuzer: Aufbau mit Turm, Geschütz vorn und hinten, Kielflosse
    fill: ['M8 56 H78 L96 64 L78 72 H8 Z', 'M2 58.5 H9 V69.5 H2 Z', 'M34 46 H62 L66 56 H30 Z', 'M43 36 H53 V46 H43 Z',
      'M70 49 H79 V56 H70 Z', 'M78 50.5 H93 V53 H78 Z', 'M15 49 H24 V56 H15 Z', 'M4 50.5 H16 V53 H4 Z',
      'M28 71 L22 81 H38 L42 71 Z', DOT(43), DOT(57)],
    cut: ['M45 39 H51 V42 H45 Z'],
  },
  car: {   // Mutterschiff: großer Rumpf mit Hangaröffnung am Bug, Brückenturm, Kielflosse
    fill: ['M2 50 H86 L98 60 L86 77 H10 L2 69 Z', 'M58 31 H72 V50 H58 Z', 'M63.5 22 H66.5 V31 H63.5 Z', 'M26 76 L20 85 H40 L44 76 Z'],
    cut: ['M70 61 H92 V67.5 H70 Z', 'M8 54 H18 V55.8 H8 Z', 'M22 54 H32 V55.8 H22 Z', 'M36 54 H46 V55.8 H36 Z', 'M61 35 H69 V38 H61 Z'],
  },
  bat: {   // Schlachtschiff: Stufenturm, Doppelgeschütze vorn und hinten, Kielflosse
    fill: ['M2 54 H76 L99 64 L76 78 H10 L2 70 Z', 'M30 54 V44 H37 V33 H44 V20 H54 V33 H61 V44 H68 V54 Z',
      'M76 46 H86 V54 H76 Z', 'M85 47.5 H99 V49.7 H85 Z', 'M85 51 H99 V53.2 H85 Z', 'M13 46 H23 V54 H13 Z', 'M1 47.5 H14 V49.7 H1 Z', 'M1 51 H14 V53.2 H1 Z',
      'M30 77 L25 84 H41 L45 77 Z', DOT(36), DOT(50), DOT(64)],
    cut: ['M46 24 H52 V27 H46 Z'],
  },
};
// Segelzeit-Set (Landschaft „Alte Karte“, Wunsch des Nutzers): Musketier, Kavallerie, Heißluftballon, Handelsschiff, Schaluppe, Piratenschiff,
// Fregatte, Ballonschiff und Linienschiff – wieder nur Bilder, Regeln und Namen bleiben. Schiffe von der Seite, Bug rechts; jedes an seinen Segeln
// zu erkennen (Schaluppe: Dreiecksegel, Piratenschiff: schräge Lateinersegel und Flagge, Fregatte: zwei Reihen Rahsegel, Linienschiff: drei Reihen
// und zwei Reihen Stückpforten). Rangpunkte wie in den anderen Sets.
const ICON_SAIL = {
  inf: {   // Musketier: Dreispitz, Rock, Muskete mit Bajonett, Kreuzgurt
    fill: ['M30 25 Q32 15 40 18 Q50 10 60 18 Q68 15 70 25 Q60 21.5 50 24 Q40 21.5 30 25 Z', circ(50, 30, 7),
      'M36 39 Q50 35 64 39 L67 63 L60 64 L59 55 L60 89 L53 89 L50 69 L47 89 L40 89 L41 55 L40 64 L33 63 Z',
      'M69.5 9 L73 9 L74.5 70 L71 70 Z', 'M70.2 9 L71.3 1 L72.4 9 Z'],
    cut: ['M41.5 40.5 L45 39.5 L59 57 L55.5 58 Z'],
  },
  tank: {   // Kavallerie: Reiter mit erhobenem Säbel auf einem Pferd
    fill: ['M22 51 Q22 43 32 43 H62 Q68 43 72 39 L80 31 L82 25 L85 29 Q90 30 96 37 Q98 41 94 42 L87 40 L82 46 Q80 54 75 57 L74 82 H69 L67 60 H62 L61 82 H56 L56 59 H40 L39 82 H34 L33 59 H32 L30 82 H25 L26 57 Q22 55 22 51 Z',
      'M23 46 Q11 49 13 68 Q17 57 25 53 Z',
      'M43 44 L45 27 Q47 22 53 22 L57 24 L56 44 Z', circ(51, 15, 5.5), 'M56 25 L74 6 L76.5 8.5 L59 28 Z'],
    cut: ['M46 44 L50 57 L54 57 L52 44 Z', circ(88, 34, 1.5)],
  },
  ftr: {   // Heißluftballon: Hülle mit Bahnen, Seile, Korb
    fill: ['M50 5 Q75 5 75 31 Q75 47 59 60 L41 60 Q25 47 25 31 Q25 5 50 5 Z',
      'M42 60 L44.5 60 L45.5 74 L43 74 Z', 'M55.5 60 L58 60 L57 74 L54.5 74 Z', 'M39 74 H61 L58.5 88 H41.5 Z'],
    cut: ['M49.2 7 H50.8 V58 H49.2 Z', 'M38 9 Q31 31 42 58 L40.6 58.6 Q29 31 36.4 9.6 Z', 'M62 9 Q69 31 58 58 L59.4 58.6 Q71 31 63.6 9.6 Z',
      'M27 34 H73 V35.8 H27 Z', 'M41 79 H59 V80.6 H41 Z'],
  },
  trn: {   // Handelsschiff: breiter Rumpf mit Achterkastell, ein großes Rahsegel, Kisten an Deck
    fill: ['M8 62 H88 L96 55 L91 66 L84 78 H18 Q10 73 8 62 Z', 'M8 51 H25 V62 H8 Z', 'M50 12 H53 V62 H50 Z', 'M53 12 L63 15 L53 18 Z',
      'M31 20 Q51.5 16 72 20 Q76 36 72 52 Q51.5 48 31 52 Q27 36 31 20 Z', 'M57 54 H66 V62 H57 Z', 'M68 54 H77 V62 H68 Z'],
    cut: ['M32 35.2 H71 V37 H32 Z', 'M11 54 H16 V57 H11 Z', 'M18 54 H23 V57 H18 Z'],
  },
  dst: {   // Schaluppe: ein Mast, Großsegel und Klüver als Dreiecke, langer Bugspriet
    fill: ['M14 64 H86 L96 59 L88 72 H22 Z', 'M46 14 H48.5 V64 H46 Z', 'M45 17 L45 61 L18 61 Z', 'M49.5 18 L84 60 L49.5 60 Z',
      'M86 61 L99 54.5 L99 57 L88 63.5 Z', DOT(50)],
  },
  sub: {   // Piratenschiff: flacher Rumpf, zwei schräge Lateinersegel, Flagge mit Totenkopf
    fill: ['M10 64 H84 L96 58 L88 72 H18 Z', 'M36 22 H38.5 V64 H36 Z', 'M62 14 H64.5 V64 H62 Z',
      'M21 57 L54 16 L56.5 18 L41 61 Z', 'M47 59 L82 22 L84.5 24 L66 62 Z', 'M64.5 13 H79 V23 H64.5 Z'],
    cut: [circ(71.8, 17.2, 2.7), 'M67.5 20.5 L76 20.5 L76 21.6 L67.5 21.6 Z'],
  },
  crs: {   // Fregatte: drei Masten mit je zwei Rahsegeln, eine Reihe Stückpforten
    fill: ['M8 60 H86 L96 55 L88 74 H16 Q10 70 8 60 Z', 'M8 53 H21 V60 H8 Z',
      'M29 16 H31.4 V60 H29 Z', 'M51 12 H53.4 V60 H51 Z', 'M72 18 H74.4 V60 H72 Z',
      'M22 22 H38 L39 31 H21 Z', 'M19 34 H41 L42 50 H18 Z', 'M43 16 H61 L62 29 H42 Z', 'M39 32 H65 L66 50 H38 Z',
      'M65 24 H81 L82 33 H64 Z', 'M62 36 H84 L85 50 H61 Z', 'M88 57 L99 51 L99 53.6 L90 59.6 Z', DOT(43), DOT(57)],
    cut: ['M24 64 h4.5 v3.5 h-4.5 Z', 'M34 64 h4.5 v3.5 h-4.5 Z', 'M44 64 h4.5 v3.5 h-4.5 Z', 'M54 64 h4.5 v3.5 h-4.5 Z', 'M64 64 h4.5 v3.5 h-4.5 Z', 'M74 64 h4.5 v3.5 h-4.5 Z'],
  },
  car: {   // Ballonschiff: großer Rumpf mit Deckshaus, darüber ein gefesselter Ballon
    fill: ['M4 60 H90 L98 55 L92 77 H12 Q5 72 4 60 Z', 'M12 51 H33 V60 H12 Z', 'M64 4 Q80 4 80 20 Q80 29 70 37 L58 37 Q48 29 48 20 Q48 4 64 4 Z',
      'M59 41 H69 L67.5 48 H60.5 Z', 'M59.5 37 L61 37 L61.5 41 L60 41 Z', 'M67 37 L68.5 37 L68 41 L66.5 41 Z', 'M63.3 48 H64.7 V60 H63.3 Z'],
    cut: ['M63.2 6 H64.8 V35 H63.2 Z', 'M56 8 Q51 20 59 35 L57.8 35.6 Q49 20 54.6 8.6 Z', 'M72 8 Q77 20 69 35 L70.2 35.6 Q79 20 73.4 8.6 Z', 'M16 54 H20 V57 H16 Z', 'M25 54 H29 V57 H25 Z',
      'M40 64 h9 v2 h-9 Z', 'M54 64 h9 v2 h-9 Z', 'M68 64 h9 v2 h-9 Z'],
  },
  bat: {   // Linienschiff: drei Masten mit je drei Rahsegeln, zwei Reihen Stückpforten
    fill: ['M4 56 H86 L98 51 L90 78 H14 Q6 72 4 56 Z', 'M4 47 H18 V56 H4 Z',
      'M29 8 H31.4 V56 H29 Z', 'M53 4 H55.4 V56 H53 Z', 'M75 10 H77.4 V56 H75 Z',
      'M23 12 H37 L38 19 H22 Z', 'M20 22 H40 L41 32 H19 Z', 'M18 35 H42 L43 49 H17 Z',
      'M46 7 H62 L63 15 H45 Z', 'M42 18 H66 L67 30 H41 Z', 'M39 33 H69 L70 49 H38 Z',
      'M69 14 H83 L84 21 H68 Z', 'M66 24 H86 L87 34 H65 Z', 'M64 37 H88 L89 50 H63 Z',
      'M90 53 L100 46 L100 49 L92 55.5 Z', DOT(36), DOT(50), DOT(64)],
    cut: ['M20 60 h4 v3.2 h-4 Z', 'M30 60 h4 v3.2 h-4 Z', 'M40 60 h4 v3.2 h-4 Z', 'M50 60 h4 v3.2 h-4 Z', 'M60 60 h4 v3.2 h-4 Z', 'M70 60 h4 v3.2 h-4 Z', 'M80 60 h4 v3.2 h-4 Z',
      'M22 67 h4 v3.2 h-4 Z', 'M32 67 h4 v3.2 h-4 Z', 'M42 67 h4 v3.2 h-4 Z', 'M52 67 h4 v3.2 h-4 Z', 'M62 67 h4 v3.2 h-4 Z', 'M72 67 h4 v3.2 h-4 Z'],
  },
};
// Grafik-Sets (Wunsch des Nutzers): Einheitenbilder, Landschaft und Kartenrand gehören zusammen. Das Set folgt aus der Landschaft
// (LANDSCAPES[…].set, ohne Angabe 'insel') – wer „Asteroiden“ wählt, sieht Raumschiffe; der Kartenrand wird je Set gemerkt (ui-schau.js).
const ICON_SETS = { insel: ICON_SRC, weltraum: ICON_SPACE, segel: ICON_SAIL };
const ICONS_OF = {};
for (const [s, src] of Object.entries(ICON_SETS)) {
  ICONS_OF[s] = {};
  for (const [k, v] of Object.entries(src)) ICONS_OF[s][k] = { fill: v.fill.map(p => new Path2D(p)), cut: (v.cut || []).map(p => new Path2D(p)) };
}
const ICONS = ICONS_OF.insel;
function gfxSet() { return landscape().set || 'insel'; }

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
function unitSprite(type, owner, size, set = gfxSet()) {
  size = Math.max(8, Math.round(size));
  const key = `u|${set}|${type}|${owner}|${size}`;
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
  const ic = (ICONS_OF[set] || ICONS)[type] || ICONS[type], s = r * 1.5 / 100;   // „besetzt“ (garrison) gibt es nur einmal
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
function unitSvg(type, owner, badge = true, title = '', set = gfxSet()) {
  const src = (ICON_SETS[set] || ICON_SRC)[type], pal = PLAYERS[owner], cut = src.cut || [];
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
function citySprite(owner, size, variant, set = gfxSet()) {
  size = Math.round(size);
  const key = `c|${set}|${owner}|${size}|${variant}`;
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
    g.fillStyle = set === 'segel' ? '#a7adb4' : '#cdbf9c'; g.fill();   // alte Karte: beige auf Pergament verschwände (Farbabstand 7–12), schiefergrau 30–34
    g.lineWidth = Math.max(1.2, s * 0.045); g.strokeStyle = '#4a4f57'; g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(s * 0.12, s * 0.52, s * 0.76, s * 0.06);
  if (set === 'weltraum') {
    // Raumstation: Glaskuppeln mit Sockel in Besitzerfarbe (statt der Dächer), dazwischen ein Verbindungsgang; Fahne wie bei den Städten
    const domes = [[[0.3, 0.6, 0.17], [0.62, 0.7, 0.13], [0.52, 0.44, 0.11]], [[0.66, 0.58, 0.16], [0.3, 0.7, 0.13], [0.34, 0.42, 0.11]]][variant % 2];
    g.fillStyle = '#9aa6b4'; g.strokeStyle = '#4b5563'; g.lineWidth = Math.max(0.6, s * 0.015);
    g.fillRect(s * 0.22, s * 0.6, s * 0.48, s * 0.06); g.strokeRect(s * 0.22, s * 0.6, s * 0.48, s * 0.06);
    for (const [x, y, r] of domes.slice().sort((a, b) => a[1] - b[1])) {
      const X = s * x, Y = s * y, R = s * r;
      g.fillStyle = pal.color; g.strokeStyle = pal.dark; g.lineWidth = Math.max(0.8, s * 0.02);
      g.fillRect(X - R * 1.08, Y - R * 0.05, R * 2.16, R * 0.34); g.strokeRect(X - R * 1.08, Y - R * 0.05, R * 2.16, R * 0.34);
      const gr = g.createRadialGradient(X - R * 0.35, Y - R * 0.6, R * 0.08, X, Y, R * 1.05);
      gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.55, '#b9dcef'); gr.addColorStop(1, '#6f9bb8');
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, Math.PI, 0); g.closePath(); g.fill();
      g.strokeStyle = '#3f5a70'; g.lineWidth = Math.max(0.8, s * 0.02); g.stroke();
      g.strokeStyle = 'rgba(63,90,112,0.55)'; g.lineWidth = Math.max(0.6, s * 0.012);   // Streben der Kuppel
      g.beginPath(); g.moveTo(X, Y - R); g.lineTo(X, Y); g.moveTo(X - R * 0.7, Y - R * 0.7); g.quadraticCurveTo(X - R * 0.25, Y - R * 0.4, X - R * 0.35, Y); g.stroke();
    }
  } else if (set === 'segel') {
    // Festungsstadt (Segelzeit): Häuser hinter der Mauer, Turm mit Kegeldach, vorn die Mauer mit Zinnen und Tor. Dächer in Besitzerfarbe
    // wie bei den Städten der Inselwelt; zwei Anordnungen wechseln sich ab.
    const lay = [{ tower: [0.16, 0.26, 0.34, 0.64], houses: [[0.42, 0.4, 0.58, 0.6], [0.58, 0.44, 0.76, 0.6]] },
      { tower: [0.58, 0.24, 0.75, 0.64], houses: [[0.16, 0.42, 0.34, 0.6], [0.34, 0.38, 0.52, 0.6]] }][variant % 2];
    const lw = Math.max(0.8, s * 0.02), STONE = '#d2cab6', EDGE = '#5d574c';
    const box = (x0, y0, x1, y1, fill, edge) => { g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = lw; g.fillRect(s * x0, s * y0, s * (x1 - x0), s * (y1 - y0)); g.strokeRect(s * x0, s * y0, s * (x1 - x0), s * (y1 - y0)); };
    const roof = (x0, x1, y, h) => { g.beginPath(); g.moveTo(s * (x0 - 0.02), s * y); g.lineTo(s * (x0 + x1) / 2, s * (y - h)); g.lineTo(s * (x1 + 0.02), s * y); g.closePath();
      g.fillStyle = pal.color; g.fill(); g.strokeStyle = pal.dark; g.lineWidth = Math.max(0.8, s * 0.025); g.stroke(); };
    for (const [x0, y0, x1, y1] of lay.houses) {
      box(x0, y0, x1, y1, '#f2ead8', '#8d806a');
      g.fillStyle = '#5b6b80'; g.fillRect(s * (x0 + (x1 - x0) * 0.38), s * (y0 + (y1 - y0) * 0.3), s * (x1 - x0) * 0.24, s * (y1 - y0) * 0.3);
      roof(x0, x1, y0, 0.13);
    }
    const [tx0, ty0, tx1, ty1] = lay.tower;
    box(tx0, ty0, tx1, ty1, STONE, EDGE);
    g.fillStyle = '#4a3f33'; g.fillRect(s * ((tx0 + tx1) / 2 - 0.02), s * (ty0 + 0.1), s * 0.04, s * 0.1);   // Schießscharte
    roof(tx0, tx1, ty0, 0.2);
    box(0.1, 0.6, 0.9, 0.8, STONE, EDGE);   // Mauer
    for (let x = 0.12; x < 0.86; x += 0.12) box(x, 0.54, x + 0.06, 0.6, STONE, EDGE);   // Zinnen
    g.fillStyle = '#4a3f33'; g.beginPath();   // Tor
    g.moveTo(s * 0.44, s * 0.8); g.lineTo(s * 0.44, s * 0.7); g.arc(s * 0.5, s * 0.7, s * 0.06, Math.PI, 0); g.lineTo(s * 0.56, s * 0.8); g.closePath(); g.fill();
  } else {
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
// Asteroiden (Weltraum-Set, eigene Einheitenbilder): Das Meer ist das All – dunkelblau mit Sternen statt Wellen und violetten Nebelschleiern
// (nebula), an den Felsen ein Staubschimmer statt Brandung. Land = Gestein mit Kratern statt Wald (crater), Licht von links oben und Schatten
// rechts unten an jeder Kante (bevel), Stege als Metallröhren (steg). Das All bleibt deutlich heller als der unerforschte Nebel (fast schwarz).
LANDSCAPES.asteroiden = {
  set: 'weltraum', space: true, fogDim: 135,
  water: [[52, 58, 92], [40, 45, 78], [33, 37, 68], [29, 32, 61], [26, 29, 56], [24, 27, 52]], nebula: [74, 44, 104], sand: [150, 144, 138],
  stops: [[0, [160, 153, 145]], [0.1, [140, 134, 127]], [0.42, [120, 115, 109]], [0.7, [104, 100, 96]], [1, [132, 128, 125]]],
  surf: 'rgb(122,117,111)', glow: 'rgba(176,188,228,0.4)', wave: null,   // surf liegt unter dem Gestein: grau, sonst scheinen die Kachelgrenzen dunkel durch
  mount: ['#a29b94', '#625d5a'], cap: '#c4e8ff', hill: '#8e8882', tree: ['#5a5551', '#aaa39c'], treeP: 0.5, crater: true, bevel: true,
  steg: ['#8e99a8', '#363e4c', 'rgba(36,44,58,0.6)', '#bfe3ff'], grid: 'rgba(170,190,235,0.05)', mini: [[132, 126, 120], [30, 33, 58]],
};
// Weitere Arten von Asteroiden (Wunsch des Nutzers: Vielfalt wie bei den Klimazonen) – All, Sterne, Kanten und Stege wie oben, nur das Gestein anders.
// surf jeweils etwa in der Farbe des Gesteins (liegt darunter, siehe oben).
const AST = LANDSCAPES.asteroiden;
LANDSCAPES.eis = Object.assign({}, AST, {   // Eis: hell, bläulich, Kristalle auf den Brocken
  sand: [214, 226, 238], stops: [[0, [206, 220, 232]], [0.1, [186, 202, 218]], [0.42, [166, 184, 202]], [0.7, [148, 166, 186]], [1, [180, 196, 212]]],
  surf: 'rgb(172,188,206)', glow: 'rgba(190,225,255,0.5)', mount: ['#e4eef6', '#8aa2ba'], cap: '#ffffff', hill: '#c4d4e4', tree: ['#8ea6bf', '#eef6fc'],
  mini: [[192, 208, 222], [30, 33, 58]],
});
LANDSCAPES.eisen = Object.assign({}, AST, {   // Eisen: rostrot, Erzadern glänzen golden
  sand: [182, 132, 104], stops: [[0, [172, 118, 90]], [0.1, [152, 100, 76]], [0.42, [132, 86, 66]], [0.7, [114, 74, 58]], [1, [146, 104, 86]]],
  surf: 'rgb(134,88,68)', glow: 'rgba(255,196,160,0.35)', mount: ['#c08664', '#6a4030'], cap: '#ffd28a', hill: '#a26c52', tree: ['#6a3e2c', '#cc9474'],
  mini: [[150, 98, 74], [30, 33, 58]],
});
LANDSCAPES.kristall = Object.assign({}, AST, {   // Kristall: dunkles Schiefergestein, leuchtende Kristalle statt Krater (shards)
  sand: [122, 132, 140], stops: [[0, [116, 126, 134]], [0.1, [100, 110, 120]], [0.42, [86, 96, 106]], [0.7, [74, 84, 94]], [1, [96, 106, 116]]],
  surf: 'rgb(86,96,106)', glow: 'rgba(120,255,215,0.42)', mount: ['#8a9aa8', '#465460'], cap: '#79ffd4', hill: '#748490', tree: ['#3e4a54', '#9aaab6'], shards: true,
  mini: [[86, 112, 110], [30, 33, 58]],
});
// Asteroidengürtel: alle vier Arten auf einer Karte (beltMap), dazu ein warmer Schein im All auf der Seite der Sonne (sun)
LANDSCAPES.guertel = Object.assign({}, AST, { zones: true, belt: true, zoneKeys: null, sun: [120, 78, 58], mini: [[140, 124, 116], [30, 33, 58]] });
// Alte Karte (Segelzeit-Set: Segelschiffe, Kavallerie, Festungsstädte – eigene Einheitenbilder): wie eine handkolorierte Karte – blassgrünes Meer
// mit Wellen in Tinte, Land in Ocker und Oliv, Küste mit Tintenstrich (ink), Berge, Hügel und Bäume umrandet (outline). Passender Rand: Alte Seekarte.
LANDSCAPES.altkarte = {
  set: 'segel',
  water: [[184, 208, 196], [168, 196, 188], [154, 184, 180], [142, 174, 172], [132, 164, 164], [124, 156, 158]], sand: [222, 204, 160],
  stops: [[0, [222, 214, 166]], [0.1, [206, 206, 150]], [0.42, [188, 194, 134]], [0.7, [186, 172, 126]], [1, [172, 156, 120]]],
  surf: 'rgb(198,200,142)', glow: 'rgba(246,238,206,0.75)', wave: 'rgba(60,78,74,0.34)',   // surf in Landfarbe (liegt darunter, siehe Asteroiden)
  mount: ['#c8ae84', '#8c7254'], cap: null, hill: '#b8a670', tree: ['#62703c', '#8e9c5c'], treeP: 0.42,
  ink: 'rgba(72,54,30,0.85)', outline: 'rgba(72,54,30,0.65)', grid: 'rgba(90,70,40,0.08)', mini: [[194, 196, 140], [156, 186, 180]],
};
// Weitere alte Karten (Wunsch des Nutzers: Klimazonen auch in der Segelzeit) – Meer, Tinte und Umrisse wie oben, nur das Land anders koloriert.
// surf jeweils in der Landfarbe (liegt darunter, siehe Asteroiden).
const OLD = LANDSCAPES.altkarte;
LANDSCAPES.altwueste = Object.assign({}, OLD, {   // Wüste: sandgelb, Dünen (Hügel), selten Oasen
  sand: [240, 222, 170], stops: [[0, [242, 216, 156]], [0.1, [238, 204, 136]], [0.42, [230, 188, 118]], [0.7, [216, 170, 108]], [1, [198, 152, 104]]],
  surf: 'rgb(232,190,122)', mount: ['#dcb27e', '#a2744c'], hill: '#deb070', tree: ['#5e7038', '#8c9c58'], treeP: 0.1, mini: [[232, 192, 124], [156, 186, 180]],
});
LANDSCAPES.altpolar = Object.assign({}, OLD, {   // Eismeer: blassblau-weißes Land, Gipfel mit Schnee, dunkle Nadelwälder
  sand: [226, 232, 230], stops: [[0, [234, 238, 236]], [0.1, [222, 230, 232]], [0.42, [208, 218, 224]], [0.7, [194, 206, 214]], [1, [180, 192, 202]]],
  surf: 'rgb(212,222,226)', mount: ['#dfe6ec', '#97a6b4'], cap: '#ffffff', hill: '#d2dce4', tree: ['#3e5a4a', '#62806a'], treeP: 0.3,
  mini: [[222, 228, 232], [156, 186, 180]],
});
LANDSCAPES.alttropen = Object.assign({}, OLD, {   // Tropen: sattes Grün, dichter Wald
  sand: [230, 216, 162], stops: [[0, [186, 204, 138]], [0.1, [164, 190, 116]], [0.42, [146, 174, 100]], [0.7, [150, 162, 104]], [1, [154, 148, 112]]],
  surf: 'rgb(160,186,112)', mount: ['#b0a878', '#706a48'], hill: '#9cb26e', tree: ['#3a6a2c', '#5e9044'], treeP: 0.7, mini: [[150, 178, 104], [156, 186, 180]],
});
// Klimazonen der alten Karte: dieselbe Verteilung wie bei den Inseln (zoneMap: Eismeer im Norden und Süden, Wüste in der Mitte, dazwischen
// gemäßigt, vereinzelt Tropen – an der Stelle, wo die Inseln Lava haben)
LANDSCAPES.altzonen = Object.assign({}, OLD, { zones: true, zoneKeys: ['altkarte', 'altwueste', 'altpolar', 'alttropen'], mini: [[206, 198, 146], [156, 186, 180]] });
// Die Grafik-Übersicht (ui-schau.js) zeichnet zeitweise mit der Landschaft eines anderen Sets (withLandscape), ohne die Partie zu ändern
let LAND_FORCE = null;
function withLandscape(k, fn) { const k0 = LAND_FORCE; LAND_FORCE = LANDSCAPES[k] ? k : null; try { return fn(); } finally { LAND_FORCE = k0; } }
function landscape() { return LANDSCAPES[LAND_FORCE || (typeof S !== 'undefined' && S && S.land)] || LANDSCAPES.gruen; }

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

// Asteroidengürtel (Landschaft „guertel“, Wunsch des Nutzers: verschiedene Arten von Asteroiden wie bei den Klimazonen). Eine Sonne steht außerhalb
// der Karte (Seite aus der Kartennummer, sunSide): nahe der Sonne Eisen, weit weg Eis – wie im Sonnensystem jenseits der Frostgrenze –, dazwischen
// Gestein, vereinzelt Kristall. Kleinere Asteroiden einheitlich nach ihrer Rangfolge zur Sonne (wie die Inseln der Klimazonen: so gibt es auf jeder
// Karte alle Arten), große Landmassen Feld für Feld mit welliger Grenze. Nur Aussehen, aus der Kartennummer.
const BELT_KEYS = ['asteroiden', 'eisen', 'eis', 'kristall'];
LANDSCAPES.guertel.zoneKeys = BELT_KEYS;
const BELT_NEAR = 0.3, BELT_FAR = 0.3, BELT_CRYSTAL = 0.12;   // Anteile: nächste 30 % Eisen, fernste 30 % Eis, 12 % Kristall
function sunSide() { return Math.floor(mulberry32(((S.seed || 7) ^ 0x2f6b1d) >>> 0)() * 4); }   // 0 links, 1 rechts, 2 oben, 3 unten
function sunDist(x, y, side = sunSide()) {   // 0 an der Sonnenseite … 1 gegenüber
  return side === 0 ? (x + 0.5) / S.W : side === 1 ? 1 - (x + 0.5) / S.W : side === 2 ? (y + 0.5) / S.H : 1 - (y + 0.5) / S.H;
}
let beltCache = null;
function beltMap() {
  const W = S.W, H = S.H, key = [S.gameId, W, H, S.seed].join();
  if (beltCache && beltCache.key === key) return beltCache.z;
  const seed = (S.seed || 7) >>> 0, side = sunSide(), cont = S.cont, land = i => S.terrain[i] === 1;
  const hash = (a, k) => mulberry32((Math.imul(a + 1, 73856093) ^ Math.imul(k, 83492791) ^ seed) >>> 0)();
  const size = new Map(), sd = new Map(); let total = 0;
  for (let i = 0; i < W * H; i++) if (land(i)) {
    total++; const k = cont ? cont[i] : -1; if (k < 0) continue;
    size.set(k, (size.get(k) || 0) + 1); sd.set(k, (sd.get(k) || 0) + sunDist(i % W, (i / W) | 0, side));
  }
  const rockZone = new Map();
  const rocks = [...size].filter(([, n]) => n < total * 0.15).map(([k, n]) => ({ k, d: sd.get(k) / n })).sort((p, q) => p.d - q.d || p.k - q.k);
  rocks.forEach((o, j) => {
    const q = rocks.length > 1 ? j / (rocks.length - 1) : 0.5;
    rockZone.set(o.k, hash(o.k, 5) < BELT_CRYSTAL ? 3 : q < BELT_NEAR ? 1 : q > 1 - BELT_FAR ? 2 : 0);
  });
  const z = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, k = cont && land(i) ? cont[i] : -1;
    if (rockZone.has(k)) { z[i] = rockZone.get(k); continue; }
    const t = sunDist(x, y, side) + (valueNoise(x, y, 7, seed ^ 0x51) - 0.5) * 0.3;
    z[i] = land(i) && valueNoise(x, y, 6, seed ^ 0x93) > 0.8 ? 3 : t < BELT_NEAR ? 1 : t > 1 - BELT_FAR ? 2 : 0;
  }
  const out = z.slice();   // Rand des Alls nimmt die Art des Asteroiden daneben (Farbe am Ufer)
  for (let i = 0; i < W * H; i++) {
    if (land(i)) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && land(ny * W + nx)) { out[i] = z[ny * W + nx]; break; } }
  }
  beltCache = { key, z: out };
  return out;
}
// Zonenkarte und Farbsätze einer gemischten Landschaft (Klimazonen, Asteroidengürtel)
function zonesOf(L) { return L.belt ? beltMap() : zoneMap(); }
function zoneKeysOf(L) { return L.zoneKeys || ZONE_KEYS; }
// Farbsatz für ein Feld der laufenden Partie (Übersichtskarte)
function tileLandscape(i) {
  const L = landscape();
  return L.zones ? LANDSCAPES[zoneKeysOf(L)[zonesOf(L)[i]]] : L;
}

// Weiches Rauschen 0…1 auf einem Gitter der Weite cell (Nebelschleier im All)
function valueNoise(x, y, cell, seed) {
  const hash = (a, b) => mulberry32((Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(seed, 83492791)) >>> 0)();
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
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
  // Klimazonen, Asteroidengürtel: Farbsatz je Feld aus der Zonenkarte der Partie (auch für den Ausschnitt der Lupe); Kartenstücke der
  // Grafik-Übersicht: der Grundfarbsatz (grün bzw. Gestein)
  const onMap = (st === S || st.ox != null) && typeof S !== 'undefined' && S;
  const Z = L.zones && onMap ? zonesOf(L) : null, ZK = zoneKeysOf(L);
  const pal = (x, y) => (Z ? LANDSCAPES[ZK[Z[(y + oy) * S.W + x + ox]]] : L);
  // Asteroidengürtel: warmer Schein im All auf der Seite der Sonne (bis 40 % der Karte weit)
  const sunSd = L.sun && onMap ? sunSide() : -1;
  const sunF = sunSd < 0 ? null : (x, y) => { const d = sunDist(x + ox, y + oy, sunSd); return d < 0.4 ? (1 - d / 0.4) ** 2 * 0.5 : 0; };
  const isW = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !st.terrain[y * W + x];

  // 1) Wasser: weiche Tiefenverläufe
  const wc = document.createElement('canvas'); wc.width = W; wc.height = H;
  const wg = wc.getContext('2d'), wi = wg.createImageData(W, H);
  const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  const lg = lc.getContext('2d'), li = lg.createImageData(W, H);
  // Nebelschleier im All: weiches Rauschen nach der Lage auf der Karte (Lupe und Karte gleich), Startwert aus der Kartennummer
  const nseed = (typeof S !== 'undefined' && S && (st === S || st.ox != null) ? S.seed || 7 : 7) >>> 0;
  const neb = L.nebula ? (x, y) => { const v = valueNoise(x + ox, y + oy, 7, nseed); return Math.max(0, Math.min(1, (v - 0.45) / 0.4)) * 0.75; } : null;
  for (let i = 0; i < W * H; i++) {
    let wcol = st.terrain[i] ? WATER_COL[0] : WATER_COL[Math.min(WATER_COL.length - 1, st.depth[i] - 1)];
    if (neb && !st.terrain[i]) { const f = neb(i % W, (i / W) | 0); if (f > 0) wcol = wcol.map((v, j) => v + (L.nebula[j] - v) * f); }
    if (sunF && !st.terrain[i]) { const f = sunF(i % W, (i / W) | 0); if (f > 0) wcol = wcol.map((v, j) => v + (L.sun[j] - v) * f); }
    const P = pal(i % W, (i / W) | 0), lcol = st.terrain[i] ? landColor(st.elev[i], P.stops) : (Z ? P.sand : SAND);
    for (let j = 0; j < 3; j++) { wi.data[i * 4 + j] = wcol[j]; li.data[i * 4 + j] = lcol[j]; }
    wi.data[i * 4 + 3] = 255; li.data[i * 4 + 3] = 255;
  }
  wg.putImageData(wi, 0, 0); lg.putImageData(li, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(wc, 0, 0, W * TS, H * TS);

  // Sterne im All (statt Wellen): je Feld bis zu zwei, ab und zu ein heller mit Strahlenkreuz
  if (L.space) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (st.terrain[y * W + x]) continue;
    seedAt(x, y, 1);
    const n = r() < 0.6 ? (r() < 0.3 ? 2 : 1) : 0;
    for (let k = 0; k < n; k++) {
      const sx = (x + r()) * TS, sy = (y + r()) * TS, big = r() < 0.1, a = 0.35 + r() * 0.6, tint = ['255,255,255', '205,220,255', '255,236,205'][Math.floor(r() * 3)];
      const rad = Math.max(0.55, TS * (big ? 0.045 : 0.014 + r() * 0.02));
      g.fillStyle = `rgba(${tint},${a.toFixed(2)})`; g.beginPath(); g.arc(sx, sy, rad, 0, 7); g.fill();
      if (big) {
        g.strokeStyle = `rgba(${tint},${(a * 0.5).toFixed(2)})`; g.lineWidth = Math.max(0.5, TS / 70);
        g.beginPath(); g.moveTo(sx - rad * 3.5, sy); g.lineTo(sx + rad * 3.5, sy); g.moveTo(sx, sy - rad * 3.5); g.lineTo(sx, sy + rad * 3.5); g.stroke();
      }
    }
  }
  // Wellen
  g.strokeStyle = L.wave || 'transparent'; g.lineWidth = Math.max(1, TS / 18); g.lineCap = 'round';
  if (L.wave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
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
  // Asteroiden: Licht von links oben – Schatten an den Kanten zum All rechts und unten, Glanz links und oben. Je Stufe ein Pfad aus Streifen,
  // die sich um 1 px überlappen und einmal gefüllt werden: Streifen, die genau aneinanderstoßen (oder das Land als verschobener Pfad),
  // ließen an den Kachelgrenzen feine Nähte. Die Abrundung der Ecken übernimmt der Zuschnitt aufs Land.
  // Alte Karte: Tintenstrich an der ganzen Küste (dieselben Streifen auf allen vier Seiten)
  const band = (b, shade, light, col) => {
    const p = new Path2D(), o = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (isW(x, y)) continue;
      const X = x * TS, Y = y * TS;
      if (shade) {
        if (isW(x + 1, y)) p.rect(X + TS - b, Y - o, b + o + 1, TS + 2 * o);
        if (isW(x, y + 1)) p.rect(X - o, Y + TS - b, TS + 2 * o, b + o + 1);
      }
      if (light) {
        if (isW(x - 1, y)) p.rect(X - o - 1, Y - o, b + o + 1, TS + 2 * o);
        if (isW(x, y - 1)) p.rect(X - o, Y - o - 1, TS + 2 * o, b + o + 1);
      }
    }
    g.fillStyle = col; g.fill(p);
  };
  if (L.bevel) { band(TS * 0.07, true, false, 'rgba(0,0,0,0.3)'); band(TS * 0.17, true, false, 'rgba(0,0,0,0.16)'); band(TS * 0.07, false, true, 'rgba(255,255,255,0.16)'); }
  if (L.ink) band(Math.max(1.2, TS * 0.045), true, true, L.ink);

  // Bodenstruktur
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isW(x, y)) continue;
    seedAt(x, y, 2);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
      g.beginPath(); g.arc((x + r()) * TS, (y + r()) * TS, TS * (0.04 + r() * 0.05), 0, 7); g.fill();
    }
    if (L.space) for (let k = 0; k < 5; k++) {   // Asteroiden: kleine Einschläge (nach den Flecken gewürfelt – die Inseln bleiben, wie sie sind)
      const px = (x + 0.08 + r() * 0.84) * TS, py = (y + 0.08 + r() * 0.84) * TS, pr = Math.max(0.6, TS * (0.018 + r() * 0.03));
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.arc(px + pr * 0.35, py + pr * 0.35, pr, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
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
    if (el > 0.68 && Q.space) {
      const n = el > 0.82 ? 3 : 2, rocks = [];
      for (let k = 0; k < n; k++) rocks.push([X + TS * (0.28 + r() * 0.44), Y + TS * (0.36 + r() * 0.36), TS * (0.15 + r() * 0.09)]);
      rocks.sort((a, b) => a[1] - b[1]);
      for (const [cx, cy, rr0] of rocks) {
        const pts = [];
        for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2, d = rr0 * (0.78 + r() * 0.32); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.82]); }
        const poly = (dx, dy, f) => { g.beginPath(); pts.forEach(([px, py], j) => { const qx = cx + (px - cx) * f + dx, qy = cy + (py - cy) * f + dy; if (j) g.lineTo(qx, qy); else g.moveTo(qx, qy); }); g.closePath(); };
        g.fillStyle = 'rgba(0,0,0,0.3)'; poly(rr0 * 0.22, rr0 * 0.3, 1); g.fill();      // Schatten
        g.fillStyle = Q.mount[1]; poly(0, 0, 1); g.fill();                              // Brocken
        g.fillStyle = Q.mount[0]; poly(-rr0 * 0.14, -rr0 * 0.16, 0.7); g.fill();        // Licht von links oben
      }
      if (el > 0.8 && Q.cap) for (let k = 0; k < 3; k++) {   // Eiskristalle
        const cx = X + TS * (0.3 + r() * 0.4), by = Y + TS * (0.55 + r() * 0.25), h = TS * (0.18 + r() * 0.14), w = TS * 0.06, tilt = (r() - 0.5) * 0.6;
        g.save(); g.translate(cx, by); g.rotate(tilt);
        g.fillStyle = Q.cap; g.beginPath(); g.moveTo(-w, 0); g.lineTo(0, -h); g.lineTo(w, 0); g.lineTo(0, h * 0.15); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(-w * 0.5, -h * 0.1); g.lineTo(0, -h); g.lineTo(0, 0); g.closePath(); g.fill();
        g.restore();
      }
    } else if (el > 0.68) {
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
        if (Q.outline) {   // alte Karte: Umriss und zwei Schraffurstriche auf der Schattenseite
          g.strokeStyle = Q.outline; g.lineWidth = Math.max(0.7, TS / 36); g.lineJoin = 'round';
          g.beginPath(); g.moveTo(cx - w, by); g.lineTo(cx, by - h); g.lineTo(cx + w, by);
          g.moveTo(cx + w * 0.28, by - h * 0.5); g.lineTo(cx + w * 0.18, by); g.moveTo(cx + w * 0.58, by - h * 0.24); g.lineTo(cx + w * 0.5, by); g.stroke();
        }
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
      if (Q.outline) { g.strokeStyle = Q.outline; g.lineWidth = Math.max(0.7, TS / 36); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.ellipse(cx - TS * 0.06, by - TS * 0.05, TS * 0.12, TS * 0.07, 0, Math.PI, 0); g.fill();
    } else if (el > 0.14 && el < 0.56 && r() < Q.treeP) {
      if (Q.shards) {
        // Kristall-Asteroiden: Gruppen leuchtender Kristalle mit hellem Schein statt Krater
        const cx = X + TS * (0.3 + r() * 0.4), by = Y + TS * (0.55 + r() * 0.25), n = 2 + Math.floor(r() * 3);
        const halo = g.createRadialGradient(cx, by - TS * 0.08, 0, cx, by - TS * 0.08, TS * 0.36);
        halo.addColorStop(0, Q.glow); halo.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = halo; g.beginPath(); g.arc(cx, by - TS * 0.08, TS * 0.36, 0, 7); g.fill();
        for (let k = 0; k < n; k++) {
          const h = TS * (0.14 + r() * 0.16), w = TS * (0.04 + r() * 0.025), tilt = (k - (n - 1) / 2) * 0.35 + (r() - 0.5) * 0.2;
          g.save(); g.translate(cx + (k - (n - 1) / 2) * TS * 0.07, by); g.rotate(tilt);
          g.fillStyle = Q.cap; g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.8, -h * 0.75); g.lineTo(0, -h); g.lineTo(w * 0.8, -h * 0.75); g.lineTo(w, 0); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(-w * 0.6, -h * 0.1); g.lineTo(-w * 0.5, -h * 0.72); g.lineTo(0, -h); g.lineTo(0, 0); g.closePath(); g.fill();
          g.restore();
        }
        continue;
      }
      if (Q.crater) {
        // Krater (Asteroiden statt Wald): heller Rand, nach rechts unten versetzt, darüber die dunkle Mulde
        const n = r() < 0.45 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const cr = TS * (0.08 + r() * 0.1), cx = X + TS * (0.24 + r() * 0.52), cy = Y + TS * (0.24 + r() * 0.52);
          g.fillStyle = Q.tree[1]; g.beginPath(); g.ellipse(cx + cr * 0.12, cy + cr * 0.14, cr * 1.1, cr * 0.9, 0, 0, 7); g.fill();
          g.fillStyle = Q.tree[0]; g.beginPath(); g.ellipse(cx - cr * 0.06, cy - cr * 0.05, cr * 0.86, cr * 0.68, 0, 0, 7); g.fill();
        }
        continue;
      }
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
        if (Q.outline) { g.strokeStyle = Q.outline; g.lineWidth = Math.max(0.6, TS / 44); g.stroke(); }
        g.fillStyle = Q.tree[1];
        g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.3, tr * 0.5, 0, 7); g.fill();
      }
    }
  }
  g.restore();

  // Stege über Eck: Land, das sich nur diagonal berührt, ist für Bodentruppen verbunden; Schiffe fahren darunter durch
  const SC = L.steg || ['#a8804e', '#4f381f', 'rgba(70,46,22,0.6)', '#e3c898'];   // Holz; Asteroiden: Metallröhre
  const steg = (cx, cy, dir) => {
    const hl = TS * 0.36, hw = TS * 0.105, lw = Math.max(1, TS / 30);
    g.save();
    g.translate(cx, cy); g.rotate(dir * Math.PI / 4);   // Längsachse entlang der Land-Diagonale
    g.fillStyle = 'rgba(10,30,50,0.28)';                 // Schatten auf dem Wasser
    g.fillRect(-hl * 0.8, -hw + TS * 0.07, hl * 1.6, hw * 2);
    g.fillStyle = SC[0]; g.strokeStyle = SC[1]; g.lineWidth = lw;
    roundRectPath(g, -hl, -hw, hl * 2, hw * 2, hw * 0.35); g.fill(); g.stroke();
    g.strokeStyle = SC[2]; g.lineWidth = Math.max(0.75, TS / 44);   // Planken (Asteroiden: Ringe der Röhre)
    g.beginPath();
    for (let px = -hl + TS * 0.09; px < hl - TS * 0.04; px += TS * 0.09) { g.moveTo(px, -hw); g.lineTo(px, hw); }
    g.stroke();
    g.strokeStyle = SC[3]; g.lineWidth = lw;                                       // Geländer
    g.beginPath(); g.moveTo(-hl * 0.92, -hw * 0.62); g.lineTo(hl * 0.92, -hw * 0.62); g.moveTo(-hl * 0.92, hw * 0.62); g.lineTo(hl * 0.92, hw * 0.62); g.stroke();
    g.restore();
  };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = !isW(x, y), b = !isW(x + 1, y), c = !isW(x, y + 1), d = !isW(x + 1, y + 1);
    if (a && d && !b && !c) steg((x + 1) * TS, (y + 1) * TS, 1);          // links oben – rechts unten
    else if (b && c && !a && !d) steg((x + 1) * TS, (y + 1) * TS, -1);    // rechts oben – links unten
  }

  // feines Raster zur Orientierung
  g.strokeStyle = L.grid || 'rgba(0,0,0,0.07)'; g.lineWidth = 1;   // im dunklen All hell
  g.beginPath();
  for (let x = 1; x < W; x++) { g.moveTo(x * TS + 0.5, 0); g.lineTo(x * TS + 0.5, H * TS); }
  for (let y = 1; y < H; y++) { g.moveTo(0, y * TS + 0.5); g.lineTo(W * TS, y * TS + 0.5); }
  g.stroke();
  return oc;
}
