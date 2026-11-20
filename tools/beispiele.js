// Beispiel-Spielstände für docs/spielstaende/ erzeugen (gehören nicht zum Spiel und nicht in den Release).
// Aufruf: node tools/beispiele.js [Name-Teil]   – ohne Angabe alle, sonst nur die Beispiele, deren Dateiname den Teil enthält.
// Die KI spielt beide Seiten (deine wie der einfache Vergleichsspieler der Messungen, ohne Fehler). Gespeichert wird zu Beginn
// deines Zugs, sobald die gewünschte Lage erreicht ist – mit allem, was das Spiel unterwegs aufzeichnet: Zeitraffer, Kräftekurve,
// Statistik, Meldungen (auf Deutsch). Laden im Spiel: ☰ Menü → Spielstände → Aus Datei laden …
// Die Partien hängen vom Zufall ab (Kampfausgänge); jeder Lauf ergibt andere, aber gleichartige Beispiele.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'spielstaende');
globalThis.localStorage = { getItem: k => (k === 'archipel-lang' ? 'de' : null), setItem() {}, removeItem() {} };
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
for (const f of ['data', 'map', 'game', 'ai']) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });

const share = () => { const a = strength(0).total, b = strength(strongestEnemy()).total; return a / Math.max(1, a + b); };
const cities = p => S.cities.filter(c => c.owner === p).length;
const units = (p, ...types) => S.units.filter(u => u.owner === p && types.includes(u.type)).length;

// Lagen: Welt, Größe, Stufe, Gegner; ab Runde from bis to wird nach ok() gesucht (final: bis zum Spielende)
const SCENARIOS = [
  { file: 'beispiel-1-inselreich-anfang.json', size: 'mittel', world: 'inseln', level: 'normal', nAi: 1, from: 28, to: 45,
    ok: () => cities(0) >= 4 && units(0, 'trn') >= 1 },
  { file: 'beispiel-2-inselreich-seekrieg.json', size: 'mittel', world: 'inseln', level: 'normal', nAi: 1, from: 100, to: 170,
    ok: () => share() > 0.45 && share() < 0.6 && units(0, 'trn') >= 2 && units(0, 'dst', 'crs', 'bat', 'car') >= 5 },
  { file: 'beispiel-3-festland-front.json', size: 'mittel', world: 'kontinente', level: 'normal', nAi: 1, from: 90, to: 160,
    ok: () => share() > 0.45 && share() < 0.6 && cities(0) >= 10 },
  { file: 'beispiel-4-drei-gegner.json', size: 'mittel', world: 'gemischt', level: 'normal', nAi: 3, from: 90, to: 160,
    ok: () => [1, 2, 3].every(p => cities(p) >= 3) && cities(0) >= 6 },
  { file: 'beispiel-5-kurz-vor-dem-sieg.json', size: 'klein', world: 'inseln', level: 'normal', nAi: 1, from: 80, to: 320,
    ok: () => share() >= 0.75 && share() <= 0.88 && cities(1) >= 1 && cities(1) <= 4 },
  { file: 'beispiel-6-schwere-lage.json', size: 'klein', world: 'gemischt', level: 'schwer', nAi: 1, from: 60, to: 220,
    ok: () => share() >= 0.2 && share() <= 0.35 && cities(0) >= 3 },
  { file: 'beispiel-7-sieg-gegen-drei.json', size: 'mittel', world: 'inseln', level: 'leicht', nAi: 3, from: 1, to: 350, final: 'win' },
];

function round() {
  for (const c of S.cities) if (c.owner === 0 && (c.progress === 0 || !c.prod)) aiChooseProduction(c);
  aiTurn(0); endTurn(0); if (S.over) return;
  if (nextRound()) checkGameOver();   // Gegner ziehen, neue Runde – derselbe Ablauf wie im Spiel (game.js)
}

fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] || '';
for (const sc of SCENARIOS) {
  if (only && !sc.file.includes(only)) continue;
  let done = false;
  for (let seed = 1000; seed < 1200 && !done; seed++) {
    newGame(sc.size, sc.level, sc.world, seed, sc.nAi);
    while (!S.over && S.turn < sc.to) {
      round();
      if (sc.final ? S.over === sc.final : !S.over && S.turn >= sc.from && sc.ok()) { done = true; break; }
    }
    if (!done) continue;
    if (S.over) { recordStrength(); recordTimeline(); }   // Endstand für Kurve und Zeitraffer (wie im Abschlussfenster)
    computeVision(0);
    // einmal durch die Prüfung beim Laden schicken: Was das Spiel nicht kennt (Notizen der KI an den Einheiten), fällt weg
    deserialize(serialize());
    const txt = serialize();
    fs.writeFileSync(path.join(out, sc.file), txt);
    const a = strength(0).total;
    console.log(`${sc.file}: Kartennummer ${fmtSeed(S.seed)}, Runde ${S.turn}${S.over ? ' (' + S.over + ')' : ''}, Städte ${S.players.map((_, p) => cities(p)).join('/')}, `
      + `Anteil ${Math.round(share() * 100)} %, ${Math.round(txt.length / 1024)} kB`);
  }
  if (!done) console.log(`${sc.file}: keine passende Lage gefunden`);
}
