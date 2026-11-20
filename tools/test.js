// Automatische Prüfung der Spielregeln – ohne Browser, ohne Abhängigkeiten.
// Aufruf: node tools/test.js            (alle Tests; Ende mit Fehlercode, wenn etwas nicht stimmt)
//         node tools/test.js kampf      (nur Tests, deren Name den Teil enthält)
// Lädt data.js, map.js, game.js, ai.js wie tools/beispiele.js. Die Oberfläche (ui.js) braucht einen Browser – dafür gibt es
// tools/test-ui.js. Neue Regel oder behobener Fehler → hier einen Test ergänzen. Gehört nicht zum Spiel und nicht in den Release.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
globalThis.localStorage = { getItem: k => (k === 'archipel-lang' ? 'de' : null), setItem() {}, removeItem() {} };
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
for (const f of ['data', 'map', 'game', 'ai']) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });

// ------------------------------------------------------------------ kleines Testgerüst
const only = (process.argv[2] || '').toLowerCase();
let passed = 0, failed = 0, checks = 0;
const fails = [];
let current = '';
function eq(got, want, what) {
  checks++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) throw new Error(`${what}: erwartet ${b}, bekommen ${a}`);
}
function ok(cond, what) { checks++; if (!cond) throw new Error(what); }
function test(name, fn) {
  if (only && !name.toLowerCase().includes(only)) return;
  current = name;
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; fails.push(name + ' – ' + e.message); console.log('  FEHLER ' + name + '\n         ' + e.message); }
}
const pct = v => Math.round(v * 100);

// ------------------------------------------------------------------ Spielfeld für die Tests
// Feste Karte (kleines Inselreich, Kartennummer 4711), alle Einheiten entfernt – jeder Test stellt auf, was er braucht.
function board(world = 'inseln', seed = 4711, nAi = 1, level = 'normal') {
  newGame('klein', level, world, seed, nAi);
  for (const u of S.units.slice()) killUnit(u);
  S.log = [];
  computeVision(0);
}
const land = (x, y) => S.terrain[idx(x, y)] === 1;
const free = (x, y) => !topUnitsAt(x, y).length && !cityAt(x, y);
const tiles = test => { const o = []; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (test(x, y)) o.push([x, y]); return o; };
const nb = (x, y) => DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => inb(a, b));
const farFromLand = (x, y, d = 3) => { for (let b = y - d; b <= y + d; b++) for (let a = x - d; a <= x + d; a++) if (inb(a, b) && land(a, b)) return false; return true; };
// zwei benachbarte freie Felder auf offener See (kein Land, keine Stadt in der Nähe)
function openSeaPair() {
  for (const [x, y] of tiles((x, y) => !land(x, y) && farFromLand(x, y))) for (const [a, b] of nb(x, y)) if (!land(a, b) && farFromLand(a, b)) return [[x, y], [a, b]];
  throw new Error('kein offenes Meer gefunden');
}
// freies Landfeld mit freiem Seefeld daneben, beide nicht neben einer Stadt
function coastPair() {
  const noCity = (x, y) => !nb(x, y).some(([a, b]) => cityAt(a, b)) && !cityAt(x, y);
  for (const [x, y] of tiles((x, y) => land(x, y) && free(x, y) && noCity(x, y))) for (const [a, b] of nb(x, y)) if (!land(a, b) && free(a, b) && noCity(a, b)) return [[x, y], [a, b]];
  throw new Error('keine Küste gefunden');
}
const odds = (a, d) => pct(attackOdds(a, d, d.x, d.y));
const myCity = () => S.cities.find(c => c.owner === 0);
const endRound = () => { endTurn(0); S.turn++; startTurn(0); };

console.log('Archipel ' + VERSION + ' – Regeltests');

// ------------------------------------------------------------------ Daten
test('Daten: Einheitentypen vollständig', () => {
  eq(UNIT_ORDER.length, 9, 'Zahl der Einheitentypen');
  for (const k of UNIT_ORDER) {
    const t = UT[k];
    ok(t && t.name && t.cost > 0 && t.hp > 0 && t.move > 0 && ['land', 'sea', 'air'].includes(t.domain), 'Typ ' + k + ' unvollständig');
  }
  ok(!canAttack('trn') && !canAttack('car'), 'Transporter und Träger greifen nie an');
  ok(UNIT_ORDER.filter(k => !['trn', 'car'].includes(k)).every(canAttack), 'alle anderen können angreifen');
  eq(UNIT_ORDER.filter(k => UT[k].shore), ['crs', 'bat'], 'nur Kreuzer und Schlachtschiff beschießen Land');
});

// ------------------------------------------------------------------ Karte
test('Karte: gleiche Kartennummer = gleiche Karte, Städte und Startplätze', () => {
  for (const size of Object.keys(MAP_SIZES)) for (const world of ['inseln', 'gemischt', 'kontinente']) {
    const snap = () => JSON.stringify([Array.from(S.terrain), S.cities.map(c => [c.x, c.y, c.owner, c.name])]);
    newGame(size, 'normal', world, 12345, 1); const a = snap();
    newGame(size, 'normal', world, 12345, 1); const b = snap();
    ok(a === b, `${size}/${world}: zwei Läufe mit derselben Nummer unterscheiden sich`);
    // Nachbarnummern können dieselbe Karte ergeben: Lehnt der Generator eine Nummer ab (auf dem Festland etwa zwei von drei), nimmt
    // newGame die nächste, die passt (gemessen: höchstens 11 weiter). Deshalb mit weitem Abstand vergleichen.
    newGame(size, 'normal', world, 12345 + 5000, 1);
    ok(snap() !== a, `${size}/${world}: ganz andere Nummer ergibt dieselbe Karte`);
  }
});
test('Karte: jeder Spieler startet mit Stadt und Infanterie, Städte liegen an Land', () => {
  for (const world of ['inseln', 'gemischt', 'kontinente']) for (const [size, m] of Object.entries(MAP_SIZES)) for (let nAi = 1; nAi <= m.maxAi; nAi++) {
    newGame(size, 'normal', world, 777, nAi);
    eq(nPlayers(), nAi + 1, `${size}/${world}/${nAi}: Spielerzahl`);
    for (let p = 0; p <= nAi; p++) {
      ok(S.cities.some(c => c.owner === p), `${size}/${world}/${nAi}: Spieler ${p} ohne Stadt`);
      ok(S.units.some(u => u.owner === p && u.type === 'inf'), `${size}/${world}/${nAi}: Spieler ${p} ohne Infanterie`);
    }
    ok(S.cities.every(c => land(c.x, c.y)), `${size}/${world}: Stadt im Wasser`);
    ok(S.cities.length >= 8, `${size}/${world}: zu wenige Städte (${S.cities.length})`);
  }
});

// ------------------------------------------------------------------ Kampf
test('Kampf: Siegchancen auf offener See (Rollen der Schiffe)', () => {
  board();
  const [p, q] = openSeaPair();
  const duel = (a, d) => { const A = createUnit(a, 0, ...p), D = createUnit(d, 1, ...q); const r = odds(A, D); killUnit(A); killUnit(D); return r; };
  eq(duel('dst', 'sub'), 89, 'Zerstörer → U-Boot');
  eq(duel('sub', 'dst'), 25, 'U-Boot → Zerstörer');
  eq(duel('crs', 'sub'), 44, 'Kreuzer → U-Boot');
  eq(duel('crs', 'crs'), 50, 'Kreuzer → Kreuzer');
  eq(duel('inf', 'inf'), 50, 'gleiche Typen stehen bei 50 %');
  ok(duel('bat', 'dst') > 90, 'Schlachtschiff schlägt Zerstörer klar');
  ok(duel('ftr', 'crs') < 20, 'Jäger bleiben schwach gegen Kreuzer');
});
test('Kampf: Küstenangriff – Bodentruppen gegen Schiff nebenan', () => {
  board();
  const [l, s] = coastPair();
  const duel = (a, d) => { const A = createUnit(a, 0, ...l), D = createUnit(d, 1, ...s); const r = odds(A, D); killUnit(A); killUnit(D); return r; };
  eq(duel('inf', 'dst'), 50, 'Infanterie → Zerstörer');
  eq(duel('tank', 'dst'), 75, 'Panzer → Zerstörer');
  eq(duel('tank', 'car'), 31, 'Panzer → Träger');
});
test('Kampf: Luftdeckung – Jäger gegen gedeckten Transporter', () => {
  board();
  const [p, q] = openSeaPair();
  const third = nb(...q).find(([x, y]) => !land(x, y) && (x !== p[0] || y !== p[1]) && cheb(x, y, ...p) >= 1);
  const trn = createUnit('trn', 0, ...q), ftr = createUnit('ftr', 1, ...p);
  ok(odds(ftr, trn) === 100, 'ungedeckter Transporter ist wehrlos');
  const car = createUnit('car', 0, ...third);
  ok(!airCover(0, trn.x, trn.y), 'Träger ohne Jäger gibt keine Deckung');
  createUnit('ftr', 0, car.x, car.y).carrier = car.id;
  ok(airCover(0, trn.x, trn.y), 'Träger mit Jäger deckt das Nachbarfeld');
  eq(odds(ftr, trn), 33, 'Jäger → gedeckter Transporter');
});
test('Kampf: wer darf wen angreifen (canStrike)', () => {
  board();
  const [l, s] = coastPair(), [p, q] = openSeaPair();
  const at = (type, owner, xy) => createUnit(type, owner, ...xy);
  const dst = at('dst', 0, s), sub = at('sub', 0, p), crs = at('crs', 0, s), bat = at('bat', 0, s), trn = at('trn', 0, s), car = at('car', 0, s), inf = at('inf', 0, l);
  const eInf = at('inf', 1, l), eFtrLand = at('ftr', 1, l), eFtrSea = at('ftr', 1, q), eSub = at('sub', 1, q), eDst = at('dst', 1, q);
  ok(!canStrike(dst, eInf), 'Zerstörer schießt nicht auf Bodentruppen');
  ok(!canStrike(dst, eFtrLand), 'Zerstörer greift keinen Jäger über Land an');
  ok(canStrike(dst, eFtrSea), 'Zerstörer greift Jäger über Wasser an');
  ok(canStrike(crs, eInf) && canStrike(bat, eInf), 'Kreuzer und Schlachtschiff beschießen Land');
  ok(!canStrike(sub, eFtrSea) && canStrike(sub, eDst), 'U-Boot greift nur Schiffe an');
  ok(!canStrike(inf, eSub), 'Bodentruppen erreichen kein U-Boot');
  ok(!canStrike(trn, eDst) && !canStrike(car, eDst), 'Transporter und Träger greifen nie an');
  // Hafen als Schutzraum: Schiff in einer Stadt
  const port = S.cities.find(c => c.owner === 1 && c.coastal) || (() => { const c = S.cities.find(c => c.coastal && c.owner !== 0); c.owner = 1; return c; })();
  const inPort = at('trn', 1, [port.x, port.y]);
  ok(!canStrike(dst, inPort) && !canStrike(sub, inPort), 'Zerstörer und U-Boot schießen nicht in den Hafen');
  ok(canStrike(crs, inPort) && canStrike(bat, inPort), 'Kreuzer und Schlachtschiff erreichen Schiffe im Hafen');
  ok(canStrike(at('ftr', 0, p), inPort), 'Jäger erreichen Schiffe im Hafen');
});

// ------------------------------------------------------------------ Eroberung
test('Eroberung: 50 %, mit Feuerunterstützung 75 %, unter Feuerschutz 25 %', () => {
  board();
  const c = S.cities.find(c => c.coastal && c.owner < 0);
  const sea = nb(c.x, c.y).find(([x, y]) => !land(x, y) && free(x, y));
  eq(pct(captureChance(0, c)), 50, 'ohne Schlachtschiff');
  const b = createUnit('bat', 0, ...sea);
  eq(pct(captureChance(0, c)), 75, 'eigenes Schlachtschiff neben der Stadt');
  killUnit(b);
  c.owner = 1; createUnit('bat', 1, ...sea);
  eq(pct(captureChance(0, c)), 25, 'Schlachtschiff des Verteidigers neben der Stadt');
});
test('Eroberung: der Eroberer geht in der Stadt auf, Marschziel und Produktion werden gesetzt', () => {
  board();
  const c = S.cities.find(c => c.owner < 0);
  const spot = nb(c.x, c.y).find(([x, y]) => land(x, y) && free(x, y));
  let n = 0;
  while (c.owner !== 0 && n++ < 60) { const u = createUnit('inf', 0, ...spot); moveStep(u, c.x, c.y); if (alive(u) && c.owner !== 0) killUnit(u); }
  eq(c.owner, 0, 'Stadt nach höchstens 60 Versuchen erobert');
  eq(topUnitsAt(c.x, c.y).length, 0, 'eroberte Stadt steht leer');
  eq(c.prod, 'inf', 'eroberte Stadt baut Infanterie');
  eq(c.rally, null, 'kein Marschziel');
});

// ------------------------------------------------------------------ Bewegung
test('Bewegung: Gelände – Land, Wasser, Hafen', () => {
  board();
  const [l, s] = coastPair();
  const inf = createUnit('inf', 0, ...l), dst = createUnit('dst', 0, ...s);
  ok(!moveStep(inf, ...s).ok, 'Infanterie geht nicht ins Wasser');
  ok(!moveStep(dst, ...l).ok, 'Schiff fährt nicht an Land');
  ok(canEnterTerrain(createUnit('ftr', 0, ...l), ...s), 'Jäger fliegt über alles');
  const port = S.cities.find(c => c.owner === 0 && c.coastal);
  ok(canEnterTerrain(dst, port.x, port.y), 'Schiff läuft in den eigenen Hafen ein');
  const foreign = S.cities.find(c => c.owner !== 0 && c.coastal);
  ok(!canEnterTerrain(dst, foreign.x, foreign.y), 'Schiff läuft nicht in fremde Stadt ein');
});
test('Bewegung: Transporter lädt und nimmt die Ladung mit unter', () => {
  board();
  const [l, s] = coastPair();
  const trn = createUnit('trn', 0, ...s), inf = createUnit('inf', 0, ...l);
  const r = moveStep(inf, ...s);
  ok(r.ok && inf.carrier === trn.id, 'Infanterie geht vom Nachbarfeld an Bord');
  eq(cargoOf(trn).length, 1, 'Ladung');
  killUnit(trn, 1);
  ok(!alive(inf), 'mit dem Transporter geht die Ladung unter');
});

// ------------------------------------------------------------------ Jäger
test('Jäger: Treibstoff, Tanken, Absturz', () => {
  board();
  const c = myCity();
  const out = tiles((x, y) => cheb(x, y, c.x, c.y) === 2 && !cityAt(x, y))[0];
  const f = createUnit('ftr', 0, c.x, c.y);
  eq(f.fuel, UT.ftr.fuel, 'voller Tank');
  f.x = out[0]; f.y = out[1]; f.fuel = 10; f.moves = UT.ftr.move;
  endRound();
  ok(alive(f), 'mit Reserve bleibt er in der Luft');
  eq(f.fuel, 10 - UT.ftr.move, 'in der Luft stehen kostet den Treibstoff einer Runde');
  f.fuel = 1; f.moves = UT.ftr.move; endRound();
  ok(!alive(f), 'ohne Treibstoff stürzt der Jäger ab');
  eq(S.wasted[0].ftr, 1, 'Absturz zählt als „sonst verloren“');
  const g = createUnit('ftr', 0, c.x, c.y); g.fuel = 3; endRound();
  eq(g.fuel, UT.ftr.fuel, 'in der Stadt wird getankt');
});
test('Jäger: mehrrundiger Marsch hält an, bevor der Rückweg nicht mehr reicht', () => {
  board();
  const c = myCity();
  const f = createUnit('ftr', 0, c.x, c.y);
  // Ziel: weit weg, erreichbar, aber vom Ziel aus keine Basis mehr in Reichweite
  let tgt = null;
  for (const [x, y] of tiles((x, y) => !cityAt(x, y))) {
    const p = findPath(f, x, y, false);
    if (p && p.length > UT.ftr.move * 2 && p.length <= f.fuel && f.fuel - p.length < distHome(0, x, y)) { tgt = [x, y]; break; }
  }
  ok(tgt, 'kein passendes Ziel auf der Karte');
  f.order = { type: 'goto', x: tgt[0], y: tgt[1] };
  runGoto(f);   // Runde des Befehls: fliegt los
  ok(f.x !== c.x || f.y !== c.y, 'in der Befehlsrunde fliegt er los');
  let rounds = 0;
  while (f.order && alive(f) && rounds++ < 6) { endRound(); if (f.order) runGoto(f, true); }
  ok(alive(f), 'Jäger lebt noch');
  ok(f.x !== tgt[0] || f.y !== tgt[1], 'er ist nicht bis zum Ziel ohne Rückweg geflogen');
  ok(f.fuel >= distHome(0, f.x, f.y), `Treibstoff (${f.fuel}) reicht noch bis zur Basis (${distHome(0, f.x, f.y)})`);
  // Gegenprobe: Flug zu einer eigenen Stadt läuft durch
  const far = S.cities.filter(k => k.owner === 0 && k !== c)[0];
  if (far) {
    const g = createUnit('ftr', 0, c.x, c.y);
    g.order = { type: 'goto', x: far.x, y: far.y }; runGoto(g);
    let n = 0; while (g.order && alive(g) && n++ < 8) { endRound(); if (g.order) runGoto(g, true); }
    ok(alive(g) && g.x === far.x && g.y === far.y, 'Flug zur eigenen Stadt kommt an');
  }
});

// ------------------------------------------------------------------ Sicht
test('Sicht: getauchtes U-Boot erst auf dem Nachbarfeld geortet', () => {
  board();
  const [p, q] = openSeaPair();
  const two = tiles((x, y) => !land(x, y) && cheb(x, y, ...p) === 2 && farFromLand(x, y, 1))[0];
  const mine = createUnit('crs', 0, ...p);
  const sub = createUnit('sub', 1, ...two);
  computeVision(0);
  ok(!canSee(0, sub), 'U-Boot zwei Felder entfernt bleibt verborgen');
  sub.x = q[0]; sub.y = q[1]; computeVision(0);
  ok(canSee(0, sub), 'U-Boot auf dem Nachbarfeld wird geortet');
  sub.x = two[0]; sub.y = two[1]; sub.surf = true; computeVision(0);
  ok(canSee(0, sub), 'aufgetauchtes U-Boot ist sichtbar');
});

// ------------------------------------------------------------------ Spielende
test('Spielende: Gegner ohne Stadt scheidet aus, seine Einheiten verschwinden', () => {
  board('inseln', 4711, 2);
  const foe = S.cities.find(c => c.owner === 1);
  createUnit('dst', 1, ...tiles((x, y) => !land(x, y))[0]);
  foe.owner = 0;
  checkGameOver();
  ok(!isAlive(1), 'Spieler 1 ist ausgeschieden');
  eq(S.units.filter(u => u.owner === 1).length, 0, 'seine Einheiten sind weg');
  ok(!S.over, 'mit einem weiteren Gegner läuft die Partie weiter');
  for (const c of S.cities) if (c.owner === 2) c.owner = 0;
  checkGameOver();
  eq(S.over, 'win', 'ohne Gegner ist die Partie gewonnen');
});

// ------------------------------------------------------------------ Speichern und Laden
test('Spielstand: Speichern → Laden → Speichern ergibt dasselbe', () => {
  for (const world of ['inseln', 'kontinente']) {
    newGame('klein', 'normal', world, 99, 2);
    for (let k = 0; k < 12; k++) simRound();
    // Der erste Durchgang wirft ab, was nicht zum Spielstand gehört (Notizen der KI an den Einheiten) – danach muss er stabil sein
    deserialize(serialize());
    const a = serialize();
    deserialize(a);
    eq(serialize() === a, true, world + ': Spielstand ändert sich beim Laden und erneuten Speichern');
  }
});
test('Spielstand: kaputte Dateien werden abgelehnt', () => {
  newGame('klein', 'normal', 'inseln', 5, 1);
  const good = serialize();
  for (const bad of ['', '{}', 'null', '[]', '{"terrain":1}', good.slice(0, 200)]) {
    let threw = false;
    try { deserialize(bad); } catch (e) { threw = true; }
    ok(threw, 'kaputter Stand angenommen: ' + bad.slice(0, 30));
  }
  const o = JSON.parse(good);
  o.units.push({ id: 99999, type: 'gibtsnicht', owner: 0, x: 1, y: 1 }, { id: 99998, type: 'inf', owner: 7, x: -5, y: 9999 });
  o.unbekanntesFeld = '<script>';
  deserialize(JSON.stringify(o));
  ok(S.units.every(u => UT[u.type] && inb(u.x, u.y) && u.owner < nPlayers()), 'unsinnige Einheiten wurden nicht verworfen');
  ok(S.unbekanntesFeld === undefined, 'unbekanntes Feld wurde übernommen');
});
test('Spielstand: alle Beispiel-Spielstände lassen sich laden', () => {
  const dir = path.join(root, 'docs', 'spielstaende');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  eq(files.length, 7, 'Zahl der Beispiele');
  for (const f of files) {
    deserialize(fs.readFileSync(path.join(dir, f), 'utf8'));
    ok(S.turn >= 1 && S.cities.length > 0 && S.players.length >= 2, f + ': unvollständig');
    invariants(f);
  }
});

// ------------------------------------------------------------------ ganze Partien
// Eine Runde, in der die KI alle Seiten spielt (wie simGame in CLAUDE.md)
function simRound() {
  for (const c of S.cities) if (c.owner === 0 && c.progress === 0) aiChooseProduction(c);
  aiTurn(0); endTurn(0); if (S.over) return;
  for (let p = 1; p < nPlayers() && !S.over; p++) { if (!isAlive(p)) continue; startTurn(p); aiTurn(p); if (!S.over) endTurn(p); }
  if (S.over) return;
  S.turn++; startTurn(0); checkGameOver();
}
// Was in jeder Lage gelten muss
function invariants(where) {
  const seenAt = new Map();
  for (const u of S.units) {
    const t = UT[u.type];
    ok(t, `${where}: unbekannter Typ ${u.type}`);
    ok(inb(u.x, u.y), `${where}: ${t.name} außerhalb der Karte`);
    ok(u.hp > 0 && u.hp <= t.hp, `${where}: ${t.name} mit ${u.hp} Trefferpunkten`);
    if (u.carrier != null) { const c = unitById(u.carrier); ok(c && c.x === u.x && c.y === u.y && c.owner === u.owner, `${where}: ${t.name} an Bord eines fehlenden Schiffs`); continue; }
    const city = cityAt(u.x, u.y);
    if (t.domain === 'land') ok(land(u.x, u.y), `${where}: ${t.name} steht im Wasser`);
    if (t.domain === 'sea') ok(!land(u.x, u.y) || (city && city.owner === u.owner), `${where}: ${t.name} steht an Land`);
    if (t.domain === 'air') ok(u.fuel > 0, `${where}: Jäger ohne Treibstoff in der Luft`);
    if (city) { ok(city.owner === u.owner, `${where}: ${t.name} in fremder Stadt`); continue; }
    const i = idx(u.x, u.y);
    ok(!seenAt.has(i), `${where}: zwei Einheiten auf einem Feld außerhalb einer Stadt (${u.x},${u.y})`);
    seenAt.set(i, u);
  }
  for (const u of S.units) if (T(u).capacity) ok(cargoOf(u).length <= T(u).capacity, `${where}: ${T(u).name} überladen`);
  for (let p = 0; p < nPlayers(); p++) { const s = strength(p).total; ok(Number.isFinite(s) && s >= 0, `${where}: Stärke von Spieler ${p} ist ${s}`); }
}
test('Partie: KI gegen KI läuft auf allen Welten fehlerfrei bis zum Ende', () => {
  for (const [world, nAi] of [['inseln', 1], ['gemischt', 2], ['kontinente', 1]]) {
    newGame('klein', 'normal', world, 2024, nAi);
    let k = 0;
    for (; k < 350 && !S.over; k++) { simRound(); if (k % 10 === 0) invariants(`${world}, Runde ${S.turn}`); }
    invariants(`${world}, Ende`);
    ok(S.turn > 20, `${world}: Partie endete schon in Runde ${S.turn}`);
    const cities = S.cities.filter(c => c.owner >= 0).length;
    ok(cities > nAi + 1, `${world}: niemand hat eine Stadt erobert`);
  }
});

// ------------------------------------------------------------------ Ergebnis
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen (${checks} Einzelprüfungen)`);
if (failed) { console.log('\nFehlgeschlagen:\n- ' + fails.join('\n- ')); process.exit(1); }
